const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {test} = require('node:test');
const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'wayframe/sensor-test.html'), 'utf8');

function harness(){
  const elements = new Map(), listeners = new Map();
  let clock = 0;
  const element = id => {
    if(!elements.has(id)) elements.set(id, {textContent: '', disabled: id === 'calibrateBtn'});
    return elements.get(id);
  };
  const document = {hidden: false, getElementById: element, addEventListener: (name, fn) => listeners.set(name, fn)};
  const window = {screen: {orientation: {angle: 0}}, addEventListener: (name, fn) => listeners.set(name, fn)};
  const context = vm.createContext({document, window, performance: {now: () => clock}});
  const run = code => vm.runInContext(code, context);
  for(const file of ['step-detector.js', 'heading-tracker.js']){
    run(fs.readFileSync(path.join(root, 'wayframe', file), 'utf8'));
    assert.ok(page.indexOf('src="'+file+'"') < page.indexOf('<script>'));
  }
  run([...page.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(match => match[1]).join('\n'));
  const orient = (time, bearing, extra = {}) => {
    clock = time;
    listeners.get('deviceorientation')({alpha: (360 - bearing) % 360, beta: 20, gamma: 0, absolute: false, ...extra});
  };
  const stable = (start, end, bearing, extra) => {
    for(let time = start; time <= end; time += 50) orient(time, bearing, extra);
  };
  const injectSteps = (time, stepTimes) => {
    clock = time;
    // Isolate the page's consumption of timestamped steps. The detector itself has raw-sample tests.
    run(`stepDetector.updateMotion = () => ({...stepDetector.snapshot(), totalSteps: 77,
      valid: true, filteredAccel: 0, stepsAdded: ${stepTimes.length}, stepTimes: ${JSON.stringify(stepTimes)}})`);
    listeners.get('devicemotion')({});
  };
  return {run, element, listeners, document, window, orient, stable, injectSteps, setClock: time => {clock = time;}};
}

async function calibrated(){
  const h = harness();
  await h.run('enableSensors()');
  h.stable(0, 400, 70);
  h.element('calibrateBtn').onclick();
  assert.equal(h.run('headingTracker.isCalibrated'), true);
  return h;
}

test('calibration is optional and unavailable until sensors are enabled', async () => {
  const h = harness();
  assert.equal(h.element('calibrateBtn').disabled, true);
  h.element('calibrateBtn').onclick();
  assert.equal(h.run('headingTracker.isCalibrated'), false);
  await h.run('enableSensors()');
  assert.equal(h.element('calibrateBtn').disabled, false);
  h.element('calibrateBtn').onclick();
  assert.match(h.element('directionStatus').textContent, /not ready/);
  h.injectSteps(100, [50, 100]);
  assert.equal(Number(h.element('unknownSteps').textContent), 2);
  assert.equal(Number(h.element('netSteps').textContent), 0);
  assert.equal(Number(h.element('steps').textContent), 77, 'raw step count is independent of classification');
});

test('turning the phone while standing still never changes signed counts', async () => {
  const h = await calibrated();
  h.stable(450, 750, 70);
  h.injectSteps(750, [700]);
  h.stable(800, 1200, 250);
  assert.equal(Number(h.element('netSteps').textContent), 1);
  assert.equal(Number(h.element('backwardSteps').textContent), 0);
});

test('five forward steps and three after a turnaround produce net two', async () => {
  const h = await calibrated();
  h.stable(450, 1300, 70);
  h.injectSteps(1300, [500, 650, 800, 1000, 1250]);
  h.stable(1350, 2000, 250);
  h.injectSteps(2000, [1650, 1800, 1950]);
  assert.equal(Number(h.element('forwardSteps').textContent), 5);
  assert.equal(Number(h.element('backwardSteps').textContent), 3);
  assert.equal(Number(h.element('netSteps').textContent), 2);
  assert.equal(Number(h.element('unknownSteps').textContent), 0);
});

test('a delayed batch uses each original step heading, not the latest phone direction', async () => {
  const h = await calibrated();
  h.stable(450, 900, 70);
  h.stable(950, 1500, 250);
  h.injectSteps(1500, [800, 1400]);
  assert.equal(Number(h.element('forwardSteps').textContent), 1);
  assert.equal(Number(h.element('backwardSteps').textContent), 1);
  assert.equal(Number(h.element('netSteps').textContent), 0);
});

test('unclear, sideways, and stale heading steps stay unclassified', async () => {
  const h = await calibrated();
  h.stable(450, 500, 160);
  h.injectSteps(500, [500]);
  h.stable(550, 900, 160);
  h.injectSteps(900, [850]);
  h.injectSteps(1400, [1400]);
  assert.equal(Number(h.element('unknownSteps').textContent), 3);
  assert.equal(Number(h.element('netSteps').textContent), 0);
});

test('Reset count clears diagnostics and raw detector but preserves a valid direction', async () => {
  const h = await calibrated();
  h.stable(450, 800, 70);
  h.injectSteps(800, [700]);
  h.element('resetBtn').onclick();
  assert.equal(h.run('headingTracker.isCalibrated'), true);
  for(const id of ['forwardSteps', 'backwardSteps', 'unknownSteps', 'netSteps', 'steps']){
    assert.equal(Number(h.element(id).textContent), 0, id);
  }
  h.stable(850, 1200, 70);
  h.injectSteps(1200, [1150]);
  assert.equal(Number(h.element('netSteps').textContent), 1);
});

test('new calibration resets pending steps and cannot classify steps from the old reference', async () => {
  const h = await calibrated();
  h.stable(450, 800, 70);
  h.run('stepDetector.pendingTimes = [700]; stepDetector.pendingCandidates = 1; stepDetector.totalSteps = 4; forwardSteps = 4');
  h.element('calibrateBtn').onclick();
  assert.equal(h.run('stepDetector.pendingTimes.length'), 0);
  assert.equal(h.run('stepDetector.totalSteps'), 0);
  assert.equal(Number(h.element('netSteps').textContent), 0);
  h.injectSteps(850, [700]);
  assert.equal(Number(h.element('unknownSteps').textContent), 1);
  assert.equal(Number(h.element('netSteps').textContent), 0);
});

test('posture/reference changes require recalibration and cannot move net position', async () => {
  for(const extra of [{beta: 80}, {absolute: true}]){
    const h = await calibrated();
    h.orient(450, 70, extra);
    assert.equal(h.run('headingTracker.isCalibrated'), false);
    assert.match(h.element('directionStatus').textContent, /Recalibrate/);
    h.injectSteps(500, [450]);
    assert.equal(Number(h.element('netSteps').textContent), 0);
    assert.equal(Number(h.element('unknownSteps').textContent), 1);
  }
});

test('backgrounding or changing screen orientation invalidates the forward reference', async () => {
  for(const event of ['visibilitychange', 'orientationchange']){
    const h = await calibrated();
    if(event === 'visibilitychange') h.document.hidden = true;
    h.listeners.get(event)();
    assert.equal(h.run('headingTracker.isCalibrated'), false);
    h.element('resetBtn').onclick();
    assert.equal(h.run('headingTracker.isCalibrated'), false, 'reset must not invent calibration');
    assert.match(h.element('directionStatus').textContent, /Recalibrate/);
  }
});

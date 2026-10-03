'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const CampusHeadingTracker = require('../wayframe/heading-tracker.js');
const straight = [{ direction: 1, bearing: 0 }, { direction: -1, bearing: 180 }];
const event = (heading, extra = {}) => ({ alpha: (360 - heading) % 360, absolute: false, beta: 25, gamma: 0, ...extra });
function feed(tracker, from, to, heading, extra = {}, screenAngle = 0){
  for(let time = from; time <= to; time += 50) tracker.update(event(heading, extra), time, screenAngle);
}
function calibrated(heading = 0, bearing = 0){
  const tracker = new CampusHeadingTracker();
  feed(tracker, 0, 300, heading);
  assert.equal(tracker.calibrate(bearing, 300), true);
  return tracker;
}

test('no orientation or calibration never guesses forward', () => {
  const tracker = new CampusHeadingTracker();
  assert.equal(tracker.calibrate(0, 0), false);
  assert.equal(tracker.mapHeading(0), null);
  assert.deepEqual(tracker.classify(0, straight), { direction: 0, reason: 'not-calibrated', bearing: null });
});

test('calibration requires at least 300 ms of fresh stable readings', () => {
  const tracker = new CampusHeadingTracker();
  feed(tracker, 0, 250, 123);
  assert.equal(tracker.calibrate(90, 250), false);
  tracker.update(event(123), 300);
  assert.equal(tracker.calibrate(90, 300), true);
  assert.equal(tracker.mapHeading(300), 90);
  assert.equal(tracker.calibrate(90, 651), false);
  assert.equal(tracker.isCalibrated, false);
});

test('relative alpha is calibrated to the map instead of assuming true north', () => {
  const tracker = calibrated(123, 270);
  const candidates = [{ direction: 1, bearing: 270 }, { direction: -1, bearing: 90 }];
  feed(tracker, 350, 600, 123);
  assert.equal(tracker.classify(600, candidates).direction, 1);
  assert.equal(tracker.mapHeading(600), 270);
});

test('webkit compass heading takes precedence over alpha', () => {
  const tracker = new CampusHeadingTracker();
  feed(tracker, 0, 300, 0, { webkitCompassHeading: 200 });
  assert.equal(tracker.calibrate(0, 300), true);
  feed(tracker, 350, 600, 180, { webkitCompassHeading: 200 });
  assert.equal(tracker.classify(600, straight).direction, 1);
});

test('invalid or inaccurate Safari compass readings never become usable directions', () => {
  for(const extra of [
    { webkitCompassHeading: -1 },
    { webkitCompassHeading: 361 },
    { webkitCompassHeading: 0, webkitCompassAccuracy: -1 },
    { webkitCompassHeading: 0, webkitCompassAccuracy: NaN },
    { webkitCompassHeading: 0, webkitCompassAccuracy: 80 }
  ]){
    const tracker = new CampusHeadingTracker();
    feed(tracker, 0, 300, 0, extra);
    assert.equal(tracker.calibrate(0, 300), false);
    assert.equal(tracker.classify(300, straight).direction, 0);
  }
  const tracker = new CampusHeadingTracker();
  feed(tracker, 0, 300, 0, { webkitCompassHeading: 0, webkitCompassAccuracy: 10 });
  assert.equal(tracker.calibrate(0, 300), true);
  tracker.update(event(0, { webkitCompassHeading: 0, webkitCompassAccuracy: -1 }), 350);
  assert.equal(tracker.classify(350, straight).reason, 'missing-heading');
});

test('out-of-range alpha cannot be normalized into an accepted bearing', () => {
  for(const alpha of [-1, 361]){
    const tracker = new CampusHeadingTracker();
    feed(tracker, 0, 300, 0, { alpha });
    assert.equal(tracker.calibrate(0, 300), false);
  }
});

test('turning 180 degrees becomes reverse only after stable observations', () => {
  const tracker = calibrated();
  feed(tracker, 350, 600, 0);
  assert.equal(tracker.classify(600, straight).direction, 1);
  tracker.update(event(90), 650);
  assert.equal(tracker.classify(650, straight).direction, 0);
  tracker.update(event(180), 700);
  assert.equal(tracker.classify(700, straight).reason, 'unstable-heading');
  feed(tracker, 750, 1000, 180);
  assert.equal(tracker.classify(1000, straight).direction, -1);
  assert.equal(tracker.isCalibrated, true);
});

test('sideways heading does not advance along a straight route', () => {
  const tracker = calibrated();
  feed(tracker, 350, 650, 90);
  assert.deepEqual(tracker.classify(650, straight), { direction: 0, reason: 'off-route-heading', bearing: 90 });
});

test('missing fields create a barrier instead of reusing an earlier reading', () => {
  const tracker = calibrated();
  assert.equal(tracker.update({ alpha: null, beta: 25, gamma: 0 }, 350), false);
  assert.equal(tracker.mapHeading(350), null);
  assert.equal(tracker.classify(350, straight).reason, 'missing-heading');
  assert.equal(tracker.classify(300, straight).direction, 1);
  feed(tracker, 400, 650, 0);
  assert.equal(tracker.classify(650, straight).direction, 1);
});

test('stale headings cannot move the marker', () => {
  const tracker = calibrated();
  assert.equal(tracker.classify(651, straight).reason, 'stale-heading');
  assert.equal(tracker.mapHeading(651), null);
});

test('a long sample gap requires a new continuous stable window', () => {
  const tracker = calibrated();
  tracker.update(event(0), 1000);
  assert.equal(tracker.classify(1000, straight).reason, 'interrupted-heading');
  feed(tracker, 1050, 1250, 0);
  assert.equal(tracker.classify(1250, straight).direction, 1);
});

test('oscillating readings do not satisfy stability even when the latest aligns', () => {
  const tracker = calibrated();
  for(let time = 350; time <= 650; time += 50) tracker.update(event(time % 100 ? 40 : 0), time);
  assert.equal(tracker.classify(650, straight).reason, 'unstable-heading');
  assert.equal(tracker.calibrate(0, 650), false);
});

test('stability and averages cross 0/360 without a false jump', () => {
  const tracker = new CampusHeadingTracker();
  for(let time = 0; time <= 300; time += 50) tracker.update(event(time % 100 ? 1 : 359), time);
  assert.equal(tracker.calibrate(0, 300), true);
  for(let time = 350; time <= 650; time += 50) tracker.update(event(time % 100 ? 1 : 359), time);
  assert.equal(tracker.classify(650, straight).direction, 1);
  const bearing = tracker.mapHeading(650);
  assert.ok(Math.min(bearing, 360 - bearing) < 1);
});

test('buffered steps use their own past readings, never the current heading', () => {
  const tracker = calibrated();
  feed(tracker, 350, 700, 0);
  feed(tracker, 750, 1100, 180);
  assert.equal(tracker.classify(700, straight).direction, 1);
  assert.equal(tracker.classify(749, straight).direction, 1);
  assert.equal(tracker.classify(800, straight).direction, 0);
  assert.equal(tracker.classify(1100, straight).direction, -1);
  assert.equal(tracker.classify(200, straight).reason, 'not-calibrated');
});

test('a tight bend with forward and reverse matches is ambiguous', () => {
  const tracker = calibrated();
  assert.equal(tracker.classify(300, [
    { direction: 1, bearing: 10 }, { direction: -1, bearing: 350 }
  ]).reason, 'ambiguous-direction');
});

test('multiple matching candidates in the same direction are allowed', () => {
  const tracker = calibrated();
  assert.equal(tracker.classify(300, [
    { direction: 1, bearing: 0 }, { direction: 1, bearing: 30 }, { direction: -1, bearing: 180 }
  ]).direction, 1);
});

test('reference or absolute flag changes invalidate calibration and history', () => {
  for(const extra of [{ absolute: true }, { webkitCompassHeading: 0 }]){
    const tracker = calibrated();
    tracker.update(event(0, extra), 350);
    assert.equal(tracker.isCalibrated, false);
    assert.equal(tracker.calibrate(0, 350), false);
    feed(tracker, 400, 650, 0, extra);
    assert.equal(tracker.calibrate(0, 650), true);
  }
});

test('screen rotation requires new calibration even when rotated back', () => {
  const tracker = calibrated();
  assert.equal(tracker.update(event(0), 350, 90), false);
  assert.equal(tracker.isCalibrated, false);
  tracker.update(event(0), 400, 0);
  assert.equal(tracker.calibrate(0, 400), false);
  feed(tracker, 450, 700, 0);
  assert.equal(tracker.calibrate(0, 700), true);
});

test('unsuitable posture pauses direction without discarding the original calibration', () => {
  for(const extra of [{ beta: -1 }, { beta: 71 }, { gamma: 46 }, { gamma: -46 }]){
    const tracker = calibrated();
    assert.equal(tracker.update(event(0, extra), 350), false);
    assert.equal(tracker.isCalibrated, true);
    assert.equal(tracker.classify(350, straight).direction, 0);
    assert.equal(tracker.mapHeading(350), null);
    feed(tracker, 400, 600, 0);
    assert.equal(tracker.classify(600, straight).direction, 0);
    tracker.update(event(0), 650);
    assert.equal(tracker.classify(650, straight).direction, 1);
    assert.equal(tracker.classify(350, straight).reason, 'posture-changed');
  }
});

test('calibration is unavailable while landscape or posture readings are unsuitable', () => {
  const tracker = new CampusHeadingTracker();
  feed(tracker, 0, 300, 0, {}, 90);
  assert.equal(tracker.calibrate(0, 300), false);
  for(const extra of [{ beta: -1 }, { beta: 71 }, { gamma: 46 }]){
    const uncalibrated = new CampusHeadingTracker();
    feed(uncalibrated, 0, 300, 0, extra);
    assert.equal(uncalibrated.calibrate(0, 300), false);
  }
});

test('ordinary varied usable grip does not have to match its calibration posture', () => {
  const tracker = calibrated(123, 270);
  const candidates = [{ direction: 1, bearing: 270 }, { direction: -1, bearing: 90 }];
  const grips = [
    { beta: 60, gamma: 31 },
    { beta: 70, gamma: -45 },
    { beta: 0, gamma: 45 },
    { beta: 25, gamma: 0 }
  ];
  grips.forEach((grip, index) => {
    const time = 350 + index * 50;
    assert.equal(tracker.update(event(123, grip), time), true);
    assert.equal(tracker.isCalibrated, true);
    assert.equal(tracker.mapHeading(time), 270);
    assert.equal(tracker.classify(time, candidates).direction, 1);
  });
});

test('returning from unsuitable posture recovers reverse without changing the map offset', () => {
  const tracker = calibrated(123, 270);
  const candidates = [{ direction: 1, bearing: 270 }, { direction: -1, bearing: 90 }];
  feed(tracker, 350, 600, 200, { beta: 90 });
  assert.equal(tracker.classify(600, candidates).direction, 0);
  assert.equal(tracker.isCalibrated, true);
  feed(tracker, 650, 850, 303, { beta: 60, gamma: 35 });
  assert.equal(tracker.classify(850, candidates).direction, 0);
  tracker.update(event(303, { beta: 60, gamma: 35 }), 900);
  assert.equal(tracker.classify(900, candidates).direction, -1);
  assert.equal(tracker.mapHeading(900), 90);
  assert.equal(tracker.classify(600, candidates).direction, 0);
  assert.equal(tracker.classify(850, candidates).direction, 0);
});

test('missing heading pauses and then recovers with an entire fresh stable suffix', () => {
  for(const missing of [{ alpha: null }, { beta: null }, { gamma: NaN }]){
    const tracker = calibrated();
    tracker.update(event(0, missing), 350);
    assert.equal(tracker.isCalibrated, true);
    assert.equal(tracker.mapHeading(350), null);
    feed(tracker, 400, 600, 180);
    assert.equal(tracker.classify(600, straight).direction, 0);
    tracker.update(event(180), 650);
    assert.equal(tracker.classify(650, straight).direction, -1);
    assert.equal(tracker.classify(350, straight).reason, 'missing-heading');
  }
});

test('stale reading recovery does not reinterpret historical steps or reset direction', () => {
  const tracker = calibrated();
  assert.equal(tracker.classify(800, straight).reason, 'stale-heading');
  assert.equal(tracker.isCalibrated, true);
  feed(tracker, 1000, 1200, 180);
  assert.equal(tracker.classify(1200, straight).direction, 0);
  tracker.update(event(180), 1250);
  assert.equal(tracker.classify(1250, straight).direction, -1);
  assert.equal(tracker.classify(800, straight).reason, 'stale-heading');
});

test('unstable heading retains calibration and resumes after its stable suffix', () => {
  const tracker = calibrated();
  for(let time = 350; time <= 650; time += 50) tracker.update(event(time % 100 ? 120 : 180), time);
  assert.equal(tracker.classify(650, straight).reason, 'unstable-heading');
  assert.equal(tracker.isCalibrated, true);
  feed(tracker, 700, 900, 180);
  assert.equal(tracker.classify(900, straight).direction, 0);
  tracker.update(event(180), 950);
  assert.equal(tracker.classify(950, straight).direction, -1);
  assert.equal(tracker.classify(650, straight).reason, 'unstable-heading');
});

test('nonfinite inputs, malformed candidates, and duplicate times cannot guess direction', () => {
  const tracker = calibrated();
  assert.equal(tracker.update(event(180), 300), false);
  assert.equal(tracker.update(event(180), NaN), false);
  assert.equal(tracker.classify(NaN, straight).direction, 0);
  assert.equal(tracker.classify(300, [{ direction: 1, bearing: null }, { direction: 2, bearing: 0 }]).direction, 0);
  assert.equal(tracker.classify(300, null).direction, 0);
  assert.equal(tracker.calibrate(NaN, 300), false);
});

test('invalidate preserves observations; reset removes observations and reference', () => {
  const tracker = calibrated();
  tracker.invalidate();
  assert.equal(tracker.isCalibrated, false);
  assert.equal(tracker.calibrate(0, 300), true);
  tracker.reset();
  assert.equal(tracker.isCalibrated, false);
  assert.equal(tracker.calibrate(0, 300), false);
  assert.equal(tracker.update(event(0), 0), true);
});

test('history is bounded and old steps cannot use current observations', () => {
  const tracker = calibrated();
  feed(tracker, 350, 15000, 0);
  assert.equal(tracker.classify(300, straight).reason, 'missing-heading');
  assert.equal(tracker.classify(15000, straight).direction, 1);
  assert.ok(tracker._samples.length <= 201);
  for(let time = 15001; time <= 17500; time++) tracker.update(event(0), time);
  assert.ok(tracker._samples.length <= 1500);
});

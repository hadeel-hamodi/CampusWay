const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {test} = require('node:test');
const root = path.join(__dirname, '..');
const nav = fs.readFileSync(path.join(root, 'wayframe/navigation-demo.html'), 'utf8');
const tester = fs.readFileSync(path.join(root, 'wayframe/sensor-test.html'), 'utf8');
const detector = fs.readFileSync(path.join(root, 'wayframe/step-detector.js'), 'utf8');
function between(source, start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a, start);
  return source.slice(a,b);
}
function harness(testPage = false, permission) {
  const elements = new Map(), listeners = new Map(), timers = new Map(), frames = new Map();
  let clock = 0, serial = 0;
  const element = id => {
    if (!elements.has(id)) elements.set(id, {value:'',textContent:'',style:{},disabled:false});
    return elements.get(id);
  };
  const context = vm.createContext({
    console:{log(){},warn(){},error(){}},
    document:{getElementById:element,addEventListener(name,fn){listeners.set(name,fn);},hidden:false},
    window:{addEventListener(name,fn){listeners.set(name,fn);}},
    performance:{now:()=>clock},
    setInterval(fn){const id=++serial;timers.set(id,fn);return id;},
    clearInterval(id){timers.delete(id);},
    requestAnimationFrame(fn){const id=++serial;frames.set(id,fn);return id;},
    cancelAnimationFrame(id){frames.delete(id);},
    DeviceMotionEvent:permission ? {requestPermission:permission} : undefined
  });
  const run = code => vm.runInContext(code,context);
  run(detector);
  if (testPage) {
    run([...tester.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n'));
  } else {
    run(between(nav,'let routePath=[];',"const svg=$('mapSvg');"));
    run(`let BUILDING='main',advanceMeters=0;
      function localizedInstruction(en){return en;}
      function drawBaseMap(){}
      function updateTurnInstruction(){}
      function updateProgressUI(){}
      function floorButtons(){}
      function followNode(){}
      function currentHeading(){return 0;}
      function describeRoute(){}
      function resolveSelection(value){return value;}
      function selectionLabel(value){return value;}
      const testNodes=[{id:'a',floor:'floor500',x:0,y:0},{id:'b',floor:'floor500',x:1,y:0}];
      function dijkstra(){return ['a','b'];}
      function nodeById(id){return testNodes.find(n=>n.id===id);}
      async function loadGraph(){}
      function advanceAlongRoute(distance){advanceMeters+=distance;}
      function floorLabel(f){return f;}
      function localizedFloor(f){return f;}
      function localizedNodeLabel(f){return f;}
    `);
    run(between(nav,'function animateStepMovement(timestamp){','function updateDeviceHeading(e){'));
    run(between(nav,'function updateDeviceHeading(e){',"$('fromFloor').onchange="));
    run(between(nav,"let navMode = 'auto';","$('routeBtn').onclick=route;"));
    run(between(nav,'function route(){','function updateTurnInstruction(){'));
    run(between(nav,"document.getElementById('building').onchange =",'function nodeById('));
    run("routeNodes=testNodes.slice(); sensorsEnabled=true;");
  }
  return {run,element,listeners,timers,frames,setClock:t=>{clock=t;}};
}

test('modified scripts parse and shared detector loads before both consumers',()=>{
  for(const source of [nav,tester]) {
    for(const m of source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(m[1]);
    assert.ok(source.indexOf('src="step-detector.js"') < source.indexOf('<script>'));
  }
  new vm.Script(detector);
  const sw=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
  new vm.Script(sw);
  for(const file of ['step-detector.js','sensor-test.html','navigation-demo.html']) assert.ok(sw.includes('./wayframe/'+file));
});

test('navigation and diagnostic page count identical raw slow-walking samples',async()=>{
  const n=harness(),s=harness(true);
  n.run("setNavigationMode('sensor')"); await n.run('startNavigation()');
  await s.run('enableSensors()');
  for(let t=0;t<9500;t+=20){
    const phase=t<1000 ? 0 : (t-1000)%1400;
    const pulse=t>=1000 && t<8800 && phase<600 ? 3*Math.sin(2*Math.PI*phase/600) : 0;
    const sample={accelerationIncludingGravity:{x:0,y:0,z:9.81+pulse}};
    for(const h of [n,s]) h.setClock(t);
    n.run('updateDeviceMotion('+JSON.stringify(sample)+')');
    s.listeners.get('devicemotion')(sample);
  }
  const count=n.run('detectedSteps');
  assert.ok(count>=5, 'slow walking must be counted');
  assert.equal(count,Number(s.element('steps').textContent));
});

test('Auto to Sensors cancels automatic movement and waits for Start',async()=>{
  const h=harness(); await h.run('startNavigation()');
  const oldTick=[...h.timers.values()][0];oldTick();
  const before=h.run('advanceMeters');
  h.run("setNavigationMode('sensor')");
  assert.equal(h.timers.size,0); assert.equal(h.run('navigationActive'),false);
  assert.equal(h.element('startBtn').disabled,false);
  await h.run('startNavigation()');oldTick();
  assert.equal(h.run('advanceMeters'),before);
});

test('Sensors to Auto drops queued steps and ignores stale sensor callbacks',async()=>{
  const h=harness();h.run("setNavigationMode('sensor')");await h.run('startNavigation()');
  h.run('handleDetectedStep()');const oldFrame=[...h.frames.values()][0];
  assert.equal(h.run('pendingStepDistance'),0.65);
  h.run("setNavigationMode('auto')");await h.run('startNavigation()');
  oldFrame(1000);h.run('handleDetectedStep()');
  assert.equal(h.run('pendingStepDistance'),0);assert.equal(h.run('advanceMeters'),0);
  assert.equal(h.frames.size,0);
});

test('successful route replacement stops old timers before new navigation',async()=>{
  const h=harness();await h.run('startNavigation()');
  h.element('fromFloor').value='floor500';h.element('toFloor').value='floor500';
  h.element('from').value='a';h.element('to').value='b';
  h.run('route()');
  assert.equal(h.timers.size,0);assert.equal(h.run('navigationActive'),false);
  assert.equal(h.run('progressIndex'),0);assert.equal(h.element('startBtn').disabled,false);
});

test('building change drops queued movement and invalidates route',async()=>{
  const h=harness();h.run("setNavigationMode('sensor')");await h.run('startNavigation()');
  h.run('handleDetectedStep()');h.element('building').value='rabin';
  await h.element('building').onchange();
  assert.equal(h.frames.size,0);assert.equal(h.run('pendingStepDistance'),0);
  assert.equal(h.run('routeNodes.length'),0);assert.equal(h.run('navigationActive'),false);
});

test('late sensor permission cannot restart navigation or overwrite another mode status',async()=>{
  let resolve;const permission=new Promise(r=>{resolve=r;});
  const h=harness(false,()=>permission);h.run("sensorsEnabled=false;setNavigationMode('sensor')");
  const waiting=h.run('startNavigation()');
  h.run("setNavigationMode('auto')");await h.run('startNavigation()');
  const status=h.element('status').textContent;
  resolve('granted');await waiting;
  assert.equal(h.run('navMode'),'auto');assert.equal(h.timers.size,1);
  assert.equal(h.element('status').textContent,status);
});

test('denied sensor permission leaves Start available without motion',async()=>{
  const h=harness(false,async()=>'denied');h.run("sensorsEnabled=false;setNavigationMode('sensor')");
  await h.run('startNavigation()');
  assert.equal(h.run('navigationActive'),false);assert.equal(h.element('startBtn').disabled,false);
  assert.equal(h.timers.size,0);assert.equal(h.frames.size,0);
});

test('diagnostic reset clears totals without registering new listeners',async()=>{
  const h=harness(true);await h.run('enableSensors()');
  const before=h.listeners.size;h.element('resetBtn').onclick();
  assert.equal(Number(h.element('steps').textContent),0);assert.equal(h.listeners.size,before);
  assert.equal(h.run('sensorsEnabled'),true);
});

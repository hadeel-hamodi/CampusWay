const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.join(__dirname,'..');
const nav=fs.readFileSync(path.join(root,'wayframe/navigation-demo.html'),'utf8');
const tester=fs.readFileSync(path.join(root,'wayframe/sensor-test.html'),'utf8');
const modules=['step-detector.js','heading-tracker.js','route-progress.js'];
function between(source,start,end){
  const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a,start);return source.slice(a,b);
}
function harness(testPage=false,permission){
  const elements=new Map(),listeners=new Map(),timers=new Map(),frames=new Map();let clock=0,serial=0;
  const element=id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:'',style:{},disabled:false});return elements.get(id);};
  const document={getElementById:element,addEventListener(name,fn){listeners.set(name,fn);},hidden:false};
  const window={screen:{orientation:{angle:0}},addEventListener(name,fn){listeners.set(name,fn);}};
  const context=vm.createContext({console:{log(){},warn(){},error(){}},document,window,performance:{now:()=>clock},
    setInterval(fn){const id=++serial;timers.set(id,fn);return id;},clearInterval(id){timers.delete(id);},
    requestAnimationFrame(fn){const id=++serial;frames.set(id,fn);return id;},cancelAnimationFrame(id){frames.delete(id);},
    DeviceMotionEvent:permission?{requestPermission:permission}:undefined});
  const run=code=>vm.runInContext(code,context);
  for(const module of modules)run(fs.readFileSync(path.join(root,'wayframe',module),'utf8'));
  if(testPage){
    run([...tester.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n'));
  }else{
    run(between(nav,'let routePath=[];',"const svg=$('mapSvg');"));
    run(`let BUILDING='main';
      function localizedInstruction(en){return en;}
      function drawBaseMap(){} function floorButtons(){} function followNode(){}
      function currentHeading(){return 0;} function describeRoute(){}
      function resolveSelection(value){return value;} function selectionLabel(value){return value;}
      let testNodes=[{id:'a',label:'A',floor:'floor500',x:0,y:1},{id:'b',label:'B',floor:'floor500',x:0,y:0}];
      function dijkstra(){return testNodes.map(n=>n.id);}
      function nodeById(id){return testNodes.find(n=>n.id===id);} async function loadGraph(){}
      function floorLabel(f){return f;} function localizedFloor(f){return f;} function localizedNodeLabel(f){return f;}
      function mapPoint(n){return {x:n.x*13.26,y:n.y*10.12};}`);
    run(between(nav,'function currentInterpolated(){','function drawUserMarker(){'));
    // Actual route, signed movement, instructions, sensor and lifecycle code; only drawing/loading are stubbed.
    run(between(nav,'function route(){',"$('fromFloor').onchange="));
    run(between(nav,"let navMode = 'auto';","$('routeBtn').onclick=route;"));
    run(between(nav,"document.getElementById('building').onchange =",'function floorLabel('));
    run('routeNodes=testNodes.slice();sensorsEnabled=true;');
  }
  const orient=(time,bearing,extra={})=>{
    clock=time;const event={alpha:(360-bearing)%360,beta:20,gamma:0,absolute:false,...extra};
    if(testPage)listeners.get('deviceorientation')(event);else run('updateDeviceHeading('+JSON.stringify(event)+')');
  };
  const stable=(start,end,bearing,extra)=>{for(let t=start;t<=end;t+=50)orient(t,bearing,extra);};
  const injectSteps=(time,stepTimes)=>{
    clock=time;run(`stepDetector.updateMotion=()=>({...stepDetector.snapshot(),valid:true,stepTimes:${JSON.stringify(stepTimes)},stepsAdded:${stepTimes.length}})`);run('updateDeviceMotion({})');
  };
  const setRoute=nodes=>run('testNodes='+JSON.stringify(nodes)+';routeNodes=testNodes.slice();progressIndex=0;progressT=0;activeFloor=testNodes[0].floor;');
  const position=()=>run('currentInterpolated()');
  const drain=()=>{
    const positions=[];
    for(let guard=0;frames.size&&guard<2000;guard++){
      const [id,fn]=frames.entries().next().value;frames.delete(id);clock+=20;fn(clock);positions.push(position());
    }
    assert.equal(frames.size,0,'movement animation must finish');return positions;
  };
  const chooseRoute=()=>{for(const id of ['fromFloor','toFloor'])element(id).value='floor500';element('from').value='a';element('to').value='b';run('route()');};
  return {run,element,listeners,timers,frames,document,window,orient,stable,injectSteps,setRoute,position,drain,chooseRoute,setClock:t=>{clock=t;}};
}
async function startSensor(h,heading=0,start=0){
  h.run("setNavigationMode('sensor')");await h.run('startNavigation()');h.stable(start,start+400,heading);await h.run('calibrateAndStart()');assert.equal(h.run('navigationActive'),true);
}
function near(actual,expected){assert.ok(Math.abs(actual-expected)<1e-7,`${actual} ~= ${expected}`);}
function travelled(h){return (1-h.position().y)*10.12;}

test('scripts parse and shared helpers load before both consumers',()=>{
  for(const source of [nav,tester]){
    for(const m of source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
    for(const file of ['step-detector.js','heading-tracker.js'])assert.ok(source.indexOf('src="'+file+'"')<source.indexOf('<script>'));
  }
  for(const module of modules)new vm.Script(fs.readFileSync(path.join(root,'wayframe',module),'utf8'));
  assert.ok(nav.indexOf('src="route-progress.js"')<nav.indexOf('<script>'));
  const sw=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');new vm.Script(sw);
  for(const file of [...modules,'sensor-test.html','navigation-demo.html'])assert.ok(sw.includes('./wayframe/'+file));
});

test('sensors wait for a stable explicit calibration before counting or moving',async()=>{
  const h=harness();h.run("setNavigationMode('sensor')");await h.run('startNavigation()');
  assert.equal(h.run('navigationActive'),false);assert.equal(h.frames.size,0);
  h.injectSteps(50,[25]);assert.equal(h.run('detectedSteps'),0);await h.run('calibrateAndStart()');assert.equal(h.run('navigationActive'),false);
  h.stable(100,500,40);await h.run('calibrateAndStart()');assert.equal(h.run('navigationActive'),true);near(travelled(h),0);
});

test('navigation and diagnostic count identical raw slow-walking samples',async()=>{
  const n=harness(),s=harness(true);await startSensor(n);await s.run('enableSensors()');
  for(let t=500;t<10000;t+=20){
    const elapsed=t-500,phase=elapsed<1000?0:(elapsed-1000)%1400;
    const pulse=elapsed>=1000&&elapsed<8800&&phase<600?3*Math.sin(2*Math.PI*phase/600):0;
    const sample={accelerationIncludingGravity:{x:0,y:0,z:9.81+pulse}};
    for(const h of [n,s]){h.setClock(t);h.orient(t,0);}
    n.run('updateDeviceMotion('+JSON.stringify(sample)+')');s.listeners.get('devicemotion')(sample);
  }
  const count=n.run('detectedSteps');assert.ok(count>=5,'slow walking must be counted');assert.equal(count,Number(s.element('steps').textContent));
});

test('delayed batch animates five forward then three reverse in FIFO order to net two',async()=>{
  const h=harness();await startSensor(h);h.stable(450,2800,0);h.stable(2850,4550,180);
  h.injectSteps(4550,[700,1200,1700,2200,2700,3400,3900,4400]);
  assert.deepEqual(Array.from(h.run('stepMovementQueue')),Array(5).fill(0.65).concat(Array(3).fill(-0.65)));
  const positions=h.drain();near(travelled(h),1.3);assert.ok(Math.max(...positions.map(p=>(1-p.y)*10.12))>3.2,'forward travel must not be netted away');
  assert.equal(h.run('lastTravelDirection'),-1);assert.match(h.element('instruction').textContent,/Returning/);
});

test('turning alone causes no progress and unstable, sideways or stale headings hold position',async()=>{
  const h=harness();await startSensor(h);h.stable(450,800,0);h.injectSteps(800,[750]);h.drain();const before=travelled(h);
  h.stable(1500,1900,180);near(travelled(h),before);assert.equal(h.frames.size,0);
  h.stable(1950,2000,90);h.injectSteps(2000,[2000]);h.stable(2050,2400,90);h.injectSteps(2400,[2350]);h.injectSteps(2900,[2900]);
  assert.equal(h.frames.size,0);near(travelled(h),before);assert.match(h.element('status').textContent,/unclear/);
});

test('start/end bounds clamp steps and estimated arrival still permits turnaround',async()=>{
  const h=harness();h.setRoute([{id:'a',label:'A',floor:'floor500',x:0,y:1},{id:'b',label:'B',floor:'floor500',x:0,y:1-1.3/10.12}]);await startSensor(h);
  h.stable(450,850,180);h.injectSteps(850,[800]);h.drain();near(travelled(h),0);
  h.stable(900,1600,0);h.injectSteps(1600,[1200,1400,1550]);h.drain();near(travelled(h),1.3);
  assert.equal(h.run('navigationActive'),true);assert.match(h.element('instruction').textContent,/Estimated arrival/);
  h.stable(2800,3200,180);h.injectSteps(3200,[3150]);h.drain();near(travelled(h),0.65);
  h.stable(3600,4000,180);h.injectSteps(4000,[3800,3950]);h.drain();near(travelled(h),0);
});

test('endpoint pause and recalibration facing start allows backtracking',async()=>{
  const h=harness();h.setRoute([{id:'a',label:'A',floor:'floor500',x:0,y:1},{id:'b',label:'B',floor:'floor500',x:0,y:1-0.65/10.12}]);await startSensor(h);
  h.stable(450,850,0);h.injectSteps(850,[800]);h.drain();near(travelled(h),0.65);
  h.document.hidden=true;h.listeners.get('visibilitychange')();assert.match(h.element('directionStatus').textContent,/toward the starting location/);
  h.document.hidden=false;h.stable(1500,1950,210);await h.run('calibrateAndStart()');assert.equal(h.run('navigationActive'),true);
  h.stable(2000,2400,210);h.injectSteps(2400,[2350]);h.drain();near(travelled(h),0);
});

test('old heading cannot keep pushing beyond the corner tolerance',async()=>{
  const h=harness();h.setRoute([{id:'a',label:'A',floor:'floor500',x:0,y:1},{id:'b',label:'Corner',floor:'floor500',x:1.3/13.26,y:1},{id:'c',label:'C',floor:'floor500',x:1.3/13.26,y:0}]);
  await startSensor(h,90);h.stable(450,2600,90);h.injectSteps(2600,[800,1300,1800,2300]);h.drain();
  near(h.position().x,1.3/13.26);near(travelled(h),0.65);assert.match(h.element('status').textContent,/unclear/);
  h.stable(4200,4650,0);h.injectSteps(4650,[4600]);h.drain();near(travelled(h),1.3);
});

test('sensors stop at floor connector and can retreat on the current floor',async()=>{
  const h=harness();h.setRoute([{id:'a',label:'A',floor:'floor500',x:0,y:1},{id:'b',label:'Lift',floor:'floor500',x:0,y:1-0.65/10.12},{id:'c',label:'Lift',floor:'floor600',x:0,y:1-0.65/10.12},{id:'d',label:'D',floor:'floor600',x:0,y:0}]);await startSensor(h);
  h.stable(450,1100,0);h.injectSteps(1100,[700,1000]);h.drain();near(travelled(h),0.65);assert.equal(h.position().floor,'floor500');assert.equal(h.run('sensorFloorBoundary'),true);
  assert.match(h.element('instruction').textContent,/Confirm your location/);h.stable(1600,2100,180);h.injectSteps(2100,[2050]);h.drain();near(travelled(h),0);
  assert.equal(h.position().floor,'floor500');assert.equal(h.run('sensorFloorBoundary'),false);
});

test('Auto to Sensors cancels automatic movement and waits for calibration',async()=>{
  const h=harness();await h.run('startNavigation()');const oldTick=[...h.timers.values()][0];oldTick();const before=travelled(h);
  h.run("setNavigationMode('sensor')");assert.equal(h.timers.size,0);assert.equal(h.run('navigationActive'),false);assert.equal(h.element('startBtn').disabled,false);
  await h.run('startNavigation()');oldTick();near(travelled(h),before);assert.equal(h.run('navigationActive'),false);
});

test('Sensors to Auto drops queued motion and ignores stale sensor callbacks',async()=>{
  const h=harness();await startSensor(h);h.stable(450,800,0);h.injectSteps(800,[750]);const oldFrame=[...h.frames.values()][0];assert.equal(h.run('stepMovementQueue.length'),1);
  h.run("setNavigationMode('auto')");await h.run('startNavigation()');oldFrame(1000);h.run('handleDetectedStep(750)');assert.equal(h.run('stepMovementQueue.length'),0);near(travelled(h),0);assert.equal(h.frames.size,0);
});

test('successful route replacement stops old timers and invalidates calibration',async()=>{
  const h=harness();await h.run('startNavigation()');h.chooseRoute();assert.equal(h.timers.size,0);assert.equal(h.run('navigationActive'),false);
  assert.equal(h.run('progressIndex'),0);assert.equal(h.element('startBtn').disabled,false);await startSensor(h);h.chooseRoute();assert.equal(h.run('headingTracker.isCalibrated'),false);
});

test('building change drops queued motion and invalidates route and heading',async()=>{
  const h=harness();await startSensor(h);h.stable(450,800,0);h.injectSteps(800,[750]);h.element('building').value='rabin';await h.element('building').onchange();
  assert.equal(h.frames.size,0);assert.equal(h.run('stepMovementQueue.length'),0);assert.equal(h.run('routeNodes.length'),0);assert.equal(h.run('navigationActive'),false);assert.equal(h.run('headingTracker.isCalibrated'),false);
});

test('late sensor permission cannot restart navigation or overwrite another mode status',async()=>{
  let resolve;const permission=new Promise(r=>{resolve=r;});const h=harness(false,()=>permission);h.run("sensorsEnabled=false;setNavigationMode('sensor')");const waiting=h.run('startNavigation()');
  h.run("setNavigationMode('auto')");await h.run('startNavigation()');const status=h.element('status').textContent;resolve('granted');await waiting;
  assert.equal(h.run('navMode'),'auto');assert.equal(h.timers.size,1);assert.equal(h.element('status').textContent,status);
});

test('late permission after route replacement leaves the new route stopped',async()=>{
  let resolve;const permission=new Promise(r=>{resolve=r;});const h=harness(false,()=>permission);h.run("sensorsEnabled=false;setNavigationMode('sensor')");const waiting=h.run('startNavigation()');h.chooseRoute();
  const status=h.element('status').textContent;resolve('granted');await waiting;assert.equal(h.run('navigationActive'),false);assert.equal(h.frames.size,0);assert.equal(h.element('status').textContent,status);
});

test('denied permission leaves Start available without motion',async()=>{
  const h=harness(false,async()=>'denied');h.run("sensorsEnabled=false;setNavigationMode('sensor')");await h.run('startNavigation()');
  assert.equal(h.run('navigationActive'),false);assert.equal(h.element('startBtn').disabled,false);assert.equal(h.timers.size,0);assert.equal(h.frames.size,0);
});

test('background, screen rotation or posture change cancels movement for recalibration',async()=>{
  for(const reason of ['hidden','screen','posture']){
    const h=harness();await startSensor(h);h.stable(450,800,0);h.injectSteps(800,[750]);
    if(reason==='hidden'){h.document.hidden=true;h.listeners.get('visibilitychange')();}if(reason==='screen')h.listeners.get('orientationchange')();if(reason==='posture')h.orient(850,0,{beta:80});
    assert.equal(h.run('navigationActive'),false,reason);assert.equal(h.frames.size,0);assert.equal(h.run('headingTracker.isCalibrated'),false);assert.equal(h.element('calibrateBtn').disabled,false);near(travelled(h),0);
  }
});

test('diagnostic reset clears totals without registering listeners again',async()=>{
  const h=harness(true);await h.run('enableSensors()');const before=h.listeners.size;h.element('resetBtn').onclick();assert.equal(Number(h.element('steps').textContent),0);assert.equal(h.listeners.size,before);assert.equal(h.run('sensorsEnabled'),true);
});

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {test} = require('node:test');

const root = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const navigation = fs.readFileSync(
  path.join(root, 'wayframe', 'navigation-demo.html'),
  'utf8'
);
const serviceWorker = fs.readFileSync(
  path.join(root, 'service-worker.js'),
  'utf8'
);
const dataSource = fs.readFileSync(
  path.join(root, 'app', 'prototype', 'data.js'),
  'utf8'
);
const graphPath = path.join(
  root,
  'buildings',
  'student',
  'student-indoor-graph.json'
);
const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
const mainGraphPath = path.join(
  root,
  'buildings',
  'main',
  'main-indoor-graph.json'
);
const mainGraph = JSON.parse(fs.readFileSync(mainGraphPath, 'utf8'));
const rabinGraphPath = path.join(
  root,
  'buildings',
  'rabin',
  'rabin-indoor-graph.json'
);
const rabinGraph = JSON.parse(fs.readFileSync(rabinGraphPath, 'utf8'));

function between(source, start, end){
  const a = source.indexOf(start);
  const b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a, `missing ${start}`);
  return source.slice(a, b);
}

function allNodes(value){
  return Object.values(value.floors)
    .flatMap(floor => floor.nodes || []);
}

function connectedNodeIds(value, starts, options = {}){
  const nodes = allNodes(value).filter(
    node => !(options.avoidStairs && node.type === 'stairs')
  );
  const byId = new Map(nodes.map(node => [node.id, node]));
  const adjacency = new Map(nodes.map(node => [node.id, new Set()]));

  for(const floor of Object.values(value.floors)){
    for(const connection of (floor.connections || [])){
      if(
        options.avoidStairs &&
        (!byId.has(connection.from) || !byId.has(connection.to))
      ){
        continue;
      }
      assert.ok(byId.has(connection.from), `missing ${connection.from}`);
      assert.ok(byId.has(connection.to), `missing ${connection.to}`);
      adjacency.get(connection.from).add(connection.to);
      adjacency.get(connection.to).add(connection.from);
    }
  }

  const connectors = new Map();
  for(const node of nodes){
    if(
      !['stairs', 'elevator'].includes(node.type) ||
      !node.connectorId
    ) continue;
    const key = `${node.type}:${node.connectorId}`;
    if(!connectors.has(key)) connectors.set(key, []);
    connectors.get(key).push(node.id);
  }

  for(const ids of connectors.values()){
    for(let index = 1; index < ids.length; index += 1){
      const previous = ids[index - 1];
      const current = ids[index];
      adjacency.get(previous).add(current);
      adjacency.get(current).add(previous);
    }
  }

  const reached = new Set();
  const queue = starts.filter(id => byId.has(id));
  while(queue.length){
    const current = queue.shift();
    if(reached.has(current)) continue;
    reached.add(current);
    for(const next of adjacency.get(current)){
      if(!reached.has(next)) queue.push(next);
    }
  }
  return reached;
}

test('main page loads canonical Main, Rabin, Student and Education graphs before using them', async () => {
  const requests = [];
  const context = vm.createContext({
    fetch:async url => {
      requests.push(url);
      return {
        ok:true,
        status:200,
        async json(){
          if(url.includes('/main/')) return mainGraph;
          return url.includes('/rabin/') ? rabinGraph : graph;
        }
      };
    },
    console:{error(){}}
  });

  vm.runInContext(
    between(index, 'let MAIN_GRAPH = null;', 'let customStart = null;'),
    context
  );
  await vm.runInContext('indoorSearchGraphsReady', context);

  assert.deepEqual(requests, [
    'buildings/main/main-indoor-graph.json',
    'buildings/rabin/rabin-indoor-graph.json',
    'buildings/student/student-indoor-graph.json',
    'buildings/education/education-indoor-graph.json'
  ]);
  assert.equal(
    vm.runInContext('MAIN_GRAPH', context).floors.floor600.nodes.length,
    mainGraph.floors.floor600.nodes.length
  );
  assert.equal(
    vm.runInContext('RABIN_GRAPH', context).floors.floor5.nodes.length,
    rabinGraph.floors.floor5.nodes.length
  );
  assert.equal(
    vm.runInContext('STUDENT_GRAPH', context).floors.floor1.nodes.length,
    graph.floors.floor1.nodes.length
  );
});

test('a delayed graph load cannot show stale search suggestions', async () => {
  let finishLoading;
  const calls = [];
  const context = vm.createContext({
    indoorSearchGraphsReady:new Promise(resolve => {
      finishLoading = resolve;
    }),
    showStartSuggestions(value){calls.push(value);},
    doStartSearch(){throw new Error('search should not run');}
  });

  vm.runInContext(
    between(
      index,
      'let startSearchRequestId = 0;',
      "startInput.addEventListener('focus'"
    ),
    context
  );

  const oldRequest = vm.runInContext(
    "showReadyStartSuggestions('old')",
    context
  );
  const newRequest = vm.runInContext(
    "showReadyStartSuggestions('new')",
    context
  );
  finishLoading(graph);
  await Promise.all([oldRequest, newRequest]);

  assert.deepEqual(calls, ['new']);
});

test('choosing a destination waits before validating a typed indoor start', async () => {
  let finishLoading;
  const calls = [];
  const context = vm.createContext({
    indoorSearchGraphsReady:new Promise(resolve => {
      finishLoading = resolve;
    }),
    startInput:{value:'5014'},
    doStartSearch(value){
      calls.push(value);
      return true;
    }
  });

  vm.runInContext(
    between(
      index,
      'async function ensureStartSelection(){',
      'let startSearchRequestId = 0;'
    ),
    context
  );

  const pending = vm.runInContext('ensureStartSelection()', context);
  assert.deepEqual(calls, []);
  finishLoading();
  assert.equal(await pending, true);
  assert.deepEqual(calls, ['5014']);
});

test('main page, indoor navigation and offline cache share canonical graphs', () => {
  const canonicalGraphs = [
    'buildings/main/main-indoor-graph.json',
    'buildings/rabin/rabin-indoor-graph.json',
    'buildings/student/student-indoor-graph.json'
  ];
  for(const canonical of canonicalGraphs){
    assert.match(index, new RegExp(canonical.replaceAll('.', '\\.')));
    assert.match(
      serviceWorker,
      new RegExp(canonical.replaceAll('.', '\\.'))
    );
  }
  assert.match(
    navigation,
    /buildings\/\$\{BUILDING\}\/\$\{BUILDING\}-indoor-graph\.json/
  );
  assert.doesNotMatch(index, /app\/prototype\/main-graph\.js/);
  assert.doesNotMatch(index, /app\/prototype\/rabin-graph\.js/);
  assert.doesNotMatch(index, /app\/prototype\/student-graph\.js/);
  assert.doesNotMatch(serviceWorker, /app\/prototype\/main-graph\.js/);
  assert.doesNotMatch(serviceWorker, /app\/prototype\/rabin-graph\.js/);
  assert.doesNotMatch(serviceWorker, /app\/prototype\/student-graph\.js/);
  assert.match(index, /function pickLang\(l, dir\)/);
  assert.doesNotMatch(index, /async function pickLang\(l, dir\)/);
  assert.equal(
    fs.existsSync(path.join(root, 'app', 'prototype', 'main-graph.js')),
    false
  );
  assert.equal(
    fs.existsSync(path.join(root, 'app', 'prototype', 'rabin-graph.js')),
    false
  );
  assert.equal(
    fs.existsSync(path.join(root, 'app', 'prototype', 'student-graph.js')),
    false
  );
  assert.equal(
    fs.existsSync(path.join(
      root,
      'buildings',
      'student',
      'floors',
      'student-indoor-graph.json'
    )),
    false
  );
});

test('canonical Main graph includes the latest connected floor 600 updates', () => {
  const nodes = allNodes(mainGraph);
  const byId = new Map(nodes.map(node => [node.id, node]));
  assert.equal(new Set(byId.keys()).size, nodes.length);

  const buffet = byId.get('floor600_n160');
  assert.equal(buffet?.label, 'Teachers Room Buffet');
  assert.equal(buffet?.type, 'food');
  assert.equal(byId.get('floor600_n161')?.type, 'corridor');

  const data = vm.createContext({});
  vm.runInContext(`${dataSource};this.entrances=BUILDING_ENTRANCES.main`, data);
  const entranceIds = Array.from(data.entrances, entrance => entrance.nodeId);
  const reached = connectedNodeIds(mainGraph, entranceIds);
  assert.ok(reached.has('floor600_n160'));
  assert.ok(reached.has('floor600_n161'));
});

test('canonical Rabin graph includes its verified Madriga transfer', () => {
  const nodes = allNodes(rabinGraph);
  const byId = new Map(nodes.map(node => [node.id, node]));
  assert.equal(new Set(byId.keys()).size, nodes.length);

  const entrance = byId.get('floor5_n161');
  assert.equal(entrance?.type, 'entrance');

  const transfer = byId.get('floor5_n204');
  assert.equal(transfer?.type, 'entrance');
  assert.equal(transfer?.label, 'madriga');
  assert.ok(
    rabinGraph.floors.floor5.connections.some(connection =>
      [connection.from, connection.to].includes('floor5_n204') &&
      [connection.from, connection.to].includes('floor5_n122')
    )
  );

  const reached = connectedNodeIds(rabinGraph, [
    'floor7_n108',
    'floor6_n73',
    'floor5_n162',
    'floor7_n109'
  ]);
  assert.ok(reached.has('floor5_n161'));
  assert.ok(reached.has('floor5_n204'));
});

test('canonical Student graph has unique nodes and every node is reachable', () => {
  const nodes = allNodes(graph);
  const nodeIds = nodes.map(node => node.id);
  assert.equal(new Set(nodeIds).size, nodeIds.length);

  const data = vm.createContext({});
  vm.runInContext(`${dataSource};this.entrances=BUILDING_ENTRANCES.student`, data);
  const entranceIds = Array.from(data.entrances, entrance => entrance.nodeId);
  assert.deepEqual(entranceIds, ['floor1_n105', 'floor4_n3']);

  const reached = connectedNodeIds(graph, entranceIds);
  assert.equal(reached.size, nodes.length);

  const accessibleReached = connectedNodeIds(
    graph,
    entranceIds,
    {avoidStairs:true}
  );
  const userDestinations = nodes.filter(node =>
    ['room', 'restroom', 'landmark', 'shelter', 'parking'].includes(
      node.type
    )
  );
  for(const destination of userDestinations){
    assert.ok(
      accessibleReached.has(destination.id),
      `${destination.id} is not reachable without stairs`
    );
  }
});

test('Student room search uses destinations from the canonical graph', () => {
  const context = vm.createContext({
    CAMPUS_DATA:{buildings:[{
      name:'Student House',
      name_he:'בית הסטודנט',
      lat:1,
      lng:2
    }]},
    STUDENT_GRAPH:graph,
    t:{room:'Room'},
    localizedBuildingName(building){return building.name;}
  });

  vm.runInContext(
    between(index, 'function normalizeLocationQuery', 'function pickStart('),
    context
  );

  const added = vm.runInContext("getStartMatches('372')", context);
  assert.equal(added.roomMatches.length, 1);
  assert.equal(added.roomMatches[0].buildingKey, 'student');
  assert.equal(added.roomMatches[0].node.label, '372');

  const removed = vm.runInContext("getStartMatches('001')", context);
  assert.equal(removed.roomMatches.length, 0);
});

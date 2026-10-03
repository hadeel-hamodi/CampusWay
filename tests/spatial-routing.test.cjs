const assert = require('node:assert/strict');
const { test } = require('node:test');
const CampusRoutePlanner = require('../wayframe/route-planner.js');

function graphAdapter(points, connections) {
  const adjacency = new Map(Object.keys(points).map(id => [id, []]));
  for (const [from, to, weight] of connections) {
    adjacency.get(from).push({ id: to, weight });
    adjacency.get(to).push({ id: from, weight });
  }
  return {
    nodeIds: () => adjacency.keys(),
    neighbors: id => adjacency.get(id),
    edgeTarget: edge => edge.id,
    edgeWeight: edge => edge.weight,
    point: id => points[id]
  };
}

test('Spatial prefers a slightly longer route with fewer meaningful turns', () => {
  const points = {
    s: {x:0,y:0,floor:'f'},
    a: {x:0,y:1,floor:'f'},
    b: {x:4,y:1,floor:'f'},
    c: {x:4,y:0,floor:'f'},
    m: {x:5,y:4,floor:'f'},
    t: {x:10,y:0,floor:'f'}
  };
  const adapter = graphAdapter(points, [
    ['s','a',1], ['a','b',4], ['b','c',1], ['c','t',6],
    ['s','m',Math.sqrt(41)], ['m','t',Math.sqrt(41)]
  ]);

  const general = CampusRoutePlanner.findPath(adapter, 's', 't');
  const spatial = CampusRoutePlanner.findPath(adapter, 's', 't', {
    preferFewerTurns: true
  });

  assert.deepEqual(general.nodes, ['s','a','b','c','t']);
  assert.deepEqual(spatial.nodes, ['s','m','t']);
  assert.ok(spatial.distance > general.distance);
  assert.ok(spatial.turns < general.turns);
});

test('Spatial turn penalty does not justify an excessive detour', () => {
  const points = {
    s: {x:0,y:0,floor:'f'},
    a: {x:0,y:1,floor:'f'},
    b: {x:4,y:1,floor:'f'},
    c: {x:4,y:0,floor:'f'},
    m: {x:5,y:10,floor:'f'},
    t: {x:10,y:0,floor:'f'}
  };
  const adapter = graphAdapter(points, [
    ['s','a',1], ['a','b',4], ['b','c',1], ['c','t',6],
    ['s','m',20], ['m','t',20]
  ]);

  const spatial = CampusRoutePlanner.findPath(adapter, 's', 't', {
    preferFewerTurns: true
  });
  assert.deepEqual(spatial.nodes, ['s','a','b','c','t']);
});

test('small drawing bends below the threshold do not count as turns', () => {
  const points = {
    s: {x:0,y:0,floor:'f'},
    a: {x:1,y:0.05,floor:'f'},
    t: {x:2,y:0,floor:'f'}
  };
  const adapter = graphAdapter(points, [
    ['s','a',1], ['a','t',1]
  ]);
  const result = CampusRoutePlanner.findPath(adapter, 's', 't', {
    preferFewerTurns: true
  });
  assert.equal(result.turns, 0);
  assert.equal(result.score, 2);
});

test('floor transitions do not create artificial turn penalties', () => {
  const points = {
    s: {x:0,y:0,floor:'floor1'},
    e1: {x:1,y:0,floor:'floor1'},
    e2: {x:1,y:0,floor:'floor2'},
    t: {x:1,y:1,floor:'floor2'}
  };
  const adapter = graphAdapter(points, [
    ['s','e1',1], ['e1','e2',0.02], ['e2','t',1]
  ]);
  const result = CampusRoutePlanner.findPath(adapter, 's', 't', {
    preferFewerTurns: true
  });
  assert.equal(result.turns, 0);
});

test('Spatial never returns a loop to avoid a turn at duplicate map points', () => {
  const points = {
    s: {x:0,y:0,floor:'f'},
    x: {x:1,y:0,floor:'f'},
    a: {x:1,y:0,floor:'f'},
    b: {x:1,y:0,floor:'f'},
    t: {x:0.1,y:0,floor:'f'}
  };
  const adapter = graphAdapter(points, [
    ['s','x',1], ['x','t',.9],
    ['x','a',.1], ['a','b',.1], ['b','x',.1]
  ]);
  const result = CampusRoutePlanner.findPath(adapter, 's', 't', {
    preferFewerTurns: true
  });
  assert.deepEqual(result.nodes, ['s','x','t']);
});

test('suggested rest spaces include landmarks, libraries, gardens and terraces', () => {
  assert.equal(CampusRoutePlanner.isSuggestedRestSpace({type:'landmark',label:'Node 41'}), true);
  assert.equal(CampusRoutePlanner.isSuggestedRestSpace({type:'library',label:'Library'}), true);
  assert.equal(CampusRoutePlanner.isSuggestedRestSpace({type:'food',label:'Garden'}), true);
  assert.equal(CampusRoutePlanner.isSuggestedRestSpace({type:'room',label:'West terrace'}), true);
  assert.equal(CampusRoutePlanner.isSuggestedRestSpace({type:'food',label:'Cafe'}), false);
});

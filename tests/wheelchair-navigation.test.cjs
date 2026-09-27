const assert = require('node:assert/strict');
const { test } = require('node:test');
const WheelchairNavigation = require('../wayframe/wheelchair-navigation.js');

const node = (id, x, y, floor = 'floor500', type = 'corridor') => ({ id, x, y, floor, type });

test('straight corridor skips intermediate graph nodes', () => {
  const route = [node('start', 0, 0), node('a', 0.1, 0), node('b', 0.2, 0), node('end', 0.3, 0, 'floor500', 'room')];
  assert.deepEqual(WheelchairNavigation.checkpointIndices(route), [0, 3]);
  assert.equal(WheelchairNavigation.targetCheckpoint(route, { index: 0, t: 0 }, 1), 3);
});

test('turns and elevator floor boundaries become checkpoints', () => {
  const route = [
    node('start', 0, 0),
    node('corner', 0.2, 0),
    node('lift-500', 0.2, 0.2, 'floor500', 'elevator'),
    node('lift-600', 0.2, 0.2, 'floor600', 'elevator'),
    node('end', 0.4, 0.2, 'floor600', 'room')
  ];
  assert.deepEqual(WheelchairNavigation.checkpointIndices(route), [0, 1, 2, 3, 4]);
  assert.equal(WheelchairNavigation.targetCheckpoint(route, { index: 2, t: 0 }, 1), 3);
  assert.equal(WheelchairNavigation.targetCheckpoint(route, { index: 3, t: 0 }, -1), 2);
});

test('an uninterrupted elevator run skips pass-through floors', () => {
  const route = [
    node('start', 0, 0),
    node('lift-500', 0.2, 0, 'floor500', 'elevator'),
    node('lift-600', 0.2, 0, 'floor600', 'elevator'),
    node('lift-700', 0.2, 0, 'floor700', 'elevator'),
    node('end', 0.4, 0, 'floor700', 'room')
  ];
  assert.deepEqual(WheelchairNavigation.checkpointIndices(route), [0, 1, 3, 4]);
  assert.equal(WheelchairNavigation.targetCheckpoint(route, { index: 1, t: 0 }, 1), 3);
});

test('centimetre-scale graph noise does not create repeated button presses', () => {
  const route = [];
  for (let index = 0; index < 20; index++) {
    route.push(node(`horizontal-${index}`, index * 0.01, (index % 2 ? 1 : -1) * 0.0003));
  }
  route.push(node('corner', 0.2, 0));
  for (let index = 1; index <= 20; index++) {
    route.push(node(`vertical-${index}`, 0.2 + (index % 2 ? 1 : -1) * 0.0003, index * 0.01));
  }
  route[0].type = 'entrance';
  route[route.length - 1].type = 'room';
  const checkpoints = WheelchairNavigation.checkpointIndices(route);
  assert.deepEqual(checkpoints, [0, 20, route.length - 1]);
});

test('previous checkpoint works from a partial segment without counting steps', () => {
  const route = [node('start', 0, 0), node('corner', 0.2, 0), node('end', 0.2, 0.2, 'floor500', 'room')];
  assert.equal(WheelchairNavigation.targetCheckpoint(route, { index: 0, t: 0.5 }, -1), 0);
  assert.equal(WheelchairNavigation.targetCheckpoint(route, { index: 0, t: 0.5 }, 1), 1);
});

test('distance excludes vertical connector travel and measures the highlighted floor path', () => {
  const route = [
    node('start', 0, 0),
    node('lift-500', 1, 0, 'floor500', 'elevator'),
    node('lift-600', 1, 0, 'floor600', 'elevator'),
    node('end', 1, 1, 'floor600', 'room')
  ];
  assert.equal(WheelchairNavigation.distanceToCheckpoint(route, { index: 0, t: 0 }, 1), 132.6);
  assert.equal(WheelchairNavigation.distanceToCheckpoint(route, { index: 1, t: 0 }, 2), 0);
  assert.equal(WheelchairNavigation.progressFraction(route, { index: 1, t: 0 }), 132.6 / (132.6 + 101.2));
});

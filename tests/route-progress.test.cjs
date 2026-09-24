const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const geometry = require('../wayframe/route-progress.js');
const node = (x, y = 0, floor = '1') => ({ x: x / 13.26, y: y / 10.12, floor });
const cursor = (index = 0, t = 0) => ({ index, t });
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const bearings = values => values.map(v => `${v.direction}:${v.bearing}`).sort();

test('browser global and CommonJS expose the same pure API', () => {
  const sandbox = {};
  vm.runInNewContext(fs.readFileSync(require.resolve('../wayframe/route-progress.js'), 'utf8'), sandbox);
  assert.deepEqual(Object.keys(sandbox.CampusRouteProgress), ['segment', 'move', 'candidates']);
});

test('segment metric uses map scales and geographic bearings', () => {
  const start = node(0);
  for (const [end, bearing] of [[node(0, -2), 0], [node(2), 90], [node(0, 2), 180], [node(-2), 270]]) {
    const part = geometry.segment([start, end], 0);
    close(part.length, 2); close(part.bearing, bearing);
  }
  assert.equal(geometry.segment([start, node(0)], 0), null);
  assert.equal(geometry.segment([start, node(2, 0, '2')], 0), null);
});

test('five steps forward then three back leaves two steps of progress', () => {
  const nodes = [node(0), node(10)];
  let position = cursor();
  for (let i = 0; i < 5; i++) position = geometry.move(nodes, position, 0.65);
  for (let i = 0; i < 3; i++) position = geometry.move(nodes, position, -0.65);
  close(position.t * 10, 1.3); close(position.moved, -0.65);
});

test('signed travel crosses multiple segments and corners in both directions', () => {
  const nodes = [node(0), node(2), node(2, -3), node(6, -3)];
  const forward = geometry.move(nodes, cursor(), 7);
  assert.equal(forward.index, 2); close(forward.t, 0.5); close(forward.moved, 7);
  const backward = geometry.move(nodes, forward, -6);
  assert.equal(backward.index, 0); close(backward.t, 0.5); close(backward.moved, -6);
});

test('start and end clamp overshoot with actual signed movement', () => {
  const nodes = [node(0), node(2)];
  const end = geometry.move(nodes, cursor(), 3);
  assert.deepEqual({ ...end, moved: 2 }, { index: 1, t: 0, moved: 2, blocked: 'end', transition: null });
  close(end.moved, 2);
  const start = geometry.move(nodes, end, -4);
  assert.deepEqual({ ...start, moved: -2 }, { index: 0, t: 0, moved: -2, blocked: 'start', transition: null });
  close(start.moved, -2);
  assert.equal(geometry.move(nodes, start, -1).moved, 0);
});

test('duplicates do not stall traversal or distort travelled distance', () => {
  const nodes = [node(0), node(0), node(2), node(2), node(2), node(5), node(5)];
  const end = geometry.move(nodes, cursor(), 10);
  assert.equal(end.index, 6); close(end.moved, 5);
  const start = geometry.move(nodes, end, -10);
  assert.equal(start.index, 0); close(start.moved, -5);
});

test('forward floor crossing stops on its original floor even with overshoot', () => {
  const nodes = [node(0), node(2), node(2, 0, '2'), node(5, 0, '2')];
  const stopped = geometry.move(nodes, cursor(), 100);
  assert.equal(stopped.index, 1); assert.equal(stopped.t, 0); close(stopped.moved, 2);
  assert.equal(stopped.blocked, 'floor');
  assert.deepEqual(stopped.transition, { from: nodes[1], to: nodes[2], direction: 1 });
  assert.equal(geometry.move(nodes, stopped, 1).moved, 0);
});

test('backward floor crossing stops on its original floor even with overshoot', () => {
  const nodes = [node(0), node(2), node(2, 0, '2'), node(5, 0, '2')];
  const stopped = geometry.move(nodes, cursor(3), -100);
  assert.equal(stopped.index, 2); assert.equal(stopped.t, 0); close(stopped.moved, -3);
  assert.deepEqual(stopped.transition, { from: nodes[2], to: nodes[1], direction: -1 });
  assert.equal(geometry.move(nodes, stopped, -1).moved, 0);
});

test('exact floor-boundary arrival reports transition without crossing', () => {
  const nodes = [node(0), node(2), node(2, 0, '2'), node(5, 0, '2')];
  assert.equal(geometry.move(nodes, cursor(), 2).blocked, 'floor');
  assert.equal(geometry.move(nodes, cursor(3), -3).blocked, 'floor');
});

test('zero-distance travel never canonicalizes or triggers transition', () => {
  const nodes = [node(0), node(2), node(2, 0, '2')];
  for (const position of [cursor(0, 1), cursor(1), cursor(2)]) {
    assert.deepEqual(geometry.move(nodes, position, 0), { ...position, moved: 0, blocked: null, transition: null });
  }
});

test('at corners candidates include adjacent tangents for natural reverse turns', () => {
  const nodes = [node(0), node(2), node(2, -3)];
  assert.deepEqual(bearings(geometry.candidates(nodes, cursor(1, 0.1))), ['-1:180', '-1:270', '1:0', '1:90'].sort());
  assert.deepEqual(bearings(geometry.candidates(nodes, cursor(0, 0.9))), ['-1:180', '-1:270', '1:0', '1:90'].sort());
  assert.deepEqual(bearings(geometry.candidates(nodes, cursor(1, 0.5))), ['-1:180', '1:0'].sort());
});

test('end and start candidates suppress travel beyond physical route endpoints', () => {
  const nodes = [node(0), node(0), node(3), node(3)];
  assert.deepEqual(geometry.candidates(nodes, cursor()), [{ direction: 1, bearing: 90 }]);
  assert.deepEqual(geometry.candidates(nodes, cursor(3)), [{ direction: -1, bearing: 270 }]);
  assert.deepEqual(geometry.candidates(nodes, cursor(2)), [{ direction: -1, bearing: 270 }]);
});

test('floor boundary uses only local tangents on either side of the barrier', () => {
  const nodes = [node(0), node(2), node(2, 0, '2'), node(2, -3, '2')];
  assert.deepEqual(bearings(geometry.candidates(nodes, cursor(1))), ['-1:270', '1:90'].sort());
  assert.deepEqual(bearings(geometry.candidates(nodes, cursor(2))), ['-1:180', '1:0'].sort());
});

test('corner tangents skip duplicates but do not look around a second corner', () => {
  const nodes = [node(0), node(2), node(2), node(2, -1), node(1, -1)];
  assert.deepEqual(bearings(geometry.candidates(nodes, cursor(0, 0.9))), ['-1:180', '-1:270', '1:0', '1:90'].sort());
  assert.deepEqual(bearings(geometry.candidates(nodes, cursor(2, 0.1), 0)), ['-1:180', '1:0'].sort());
});

test('reversing equal distances restores positions throughout a longer polyline', () => {
  const nodes = [node(0), node(2), node(2), node(2, -3), node(7, -3), node(7, 1)];
  const travelled = position => {
    let metres = 0;
    for (let index = 0; index < position.index; index++) metres += geometry.segment(nodes, index)?.length || 0;
    return metres + (geometry.segment(nodes, position.index)?.length || 0) * position.t;
  };
  for (let i = 1; i <= 28; i++) {
    const position = geometry.move(nodes, cursor(), i * 0.4);
    const advanced = geometry.move(nodes, position, 0.3);
    const reversed = geometry.move(nodes, advanced, -0.3);
    close(travelled(reversed), travelled(position));
  }
});

test('a lone node and all-zero routes terminate without invented bearings', () => {
  for (const nodes of [[node(0)], [node(0), node(0), node(0)]]) {
    assert.equal(geometry.move(nodes, cursor(), 2).blocked, 'end');
    assert.equal(geometry.move(nodes, cursor(), -2).blocked, 'start');
    assert.deepEqual(geometry.candidates(nodes, cursor()), []);
  }
});

test('nonfinite data, invalid cursors, and impossible floor cursors reject safely', () => {
  const nodes = [node(0), node(2), node(2, 0, '2')];
  assert.throws(() => geometry.move([], cursor(), 1));
  assert.throws(() => geometry.segment([{ x: NaN, y: 0, floor: '1' }], 0));
  assert.throws(() => geometry.move(nodes, cursor(-1), 1));
  assert.throws(() => geometry.move(nodes, cursor(0, Infinity), 1));
  assert.throws(() => geometry.move(nodes, cursor(1, 0.5), 1));
  assert.throws(() => geometry.move(nodes, cursor(), Infinity));
  assert.throws(() => geometry.candidates(nodes, cursor(), -1));
});

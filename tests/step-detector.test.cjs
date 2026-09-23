'use strict';

// Deterministic synthetic sensor traces: these verify detector behavior, not
// accuracy on a real phone or for a particular gait, grip, or mobility aid.
// Run with: node tests/step-detector.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const CampusStepDetector = require('../wayframe/step-detector.js');

const GRAVITY = 9.81;
const pulseWidth = 450;
function eventWithLinearZ(linear = 0) {
  return { accelerationIncludingGravity: { x: 0, y: 0, z: GRAVITY + linear } };
}
function pulseSignal(starts, time) {
  const start = starts.find(value => time >= value && time < value + pulseWidth);
  return start === undefined ? 0 : 2.8 * Math.sin(2 * Math.PI * (time - start) / pulseWidth);
}
function feed(detector, {
  from = 0,
  to,
  hz = 100,
  starts = [],
  motion = time => eventWithLinearZ(pulseSignal(starts, time)),
  orientation,
}) {
  const states = [];
  for (let i = 0; from + i * 1000 / hz <= to + 0.000001; i++) {
    const time = from + i * 1000 / hz;
    if (orientation) orientation(detector, time, i);
    states.push({ time, ...detector.updateMotion(motion(time), time) });
  }
  return states;
}
function walkingTrace(gap = 600, count = 12, hz = 100) {
  const detector = new CampusStepDetector();
  const starts = Array.from({ length: count }, (_, i) => 1000 + gap * i);
  const states = feed(detector, { to: starts.at(-1) + 1200, starts, hz });
  return { detector, states, starts };
}
function assertFreshSignal(state) {
  assert.equal(state.isWalking, false);
  assert.equal(state.filteredAccel, 0);
  assert.equal(state.stepsAdded, 0);
  assert.equal(state.valid, false);
}

test('stationary sensor noise does not produce steps', () => {
  const detector = new CampusStepDetector();
  feed(detector, {
    to: 20000,
    motion: time => eventWithLinearZ(0.06 * Math.sin(time / 37) + 0.025 * Math.cos(time / 91)),
  });
  assert.equal(detector.snapshot().totalSteps, 0);
  assert.equal(detector.snapshot().candidates, 0);
  assert.equal(detector.snapshot().isWalking, false);
});

test('gravity vector rotating at a constant magnitude does not look like walking', () => {
  const detector = new CampusStepDetector();
  feed(detector, {
    to: 6000,
    motion: time => ({ accelerationIncludingGravity: {
      x: GRAVITY * Math.sin(time / 500), y: 0, z: GRAVITY * Math.cos(time / 500),
    } }),
  });
  assert.equal(detector.snapshot().totalSteps, 0);
  assert.equal(detector.snapshot().candidates, 0);
});

test('baseline initializes from the first magnitude without a startup step', () => {
  const detector = new CampusStepDetector();
  feed(detector, { to: 5000, motion: () => eventWithLinearZ(3) });
  assert.equal(detector.snapshot().filteredAccel, 0);
  assert.equal(detector.snapshot().candidates, 0);
  assert.equal(detector.snapshot().totalSteps, 0);
});

test('normal cadence confirms two movements and then reports one count per movement', () => {
  const { detector, states } = walkingTrace();
  const increments = states.filter(state => state.stepsAdded > 0);
  assert.equal(increments[0].stepsAdded, 2);
  assert.ok(increments.slice(1).every(state => state.stepsAdded === 1));
  assert.equal(increments.reduce((sum, state) => sum + state.stepsAdded, 0), 12);
  assert.equal(detector.snapshot().totalSteps, 12);
  assert.equal(detector.snapshot().stepsAdded, 0, 'reading a snapshot must not emit another count');
});

for (const gap of [1200, 1800]) {
  test(`slow cadence with ${gap} ms between movements starts and keeps counting`, () => {
    const { detector } = walkingTrace(gap);
    assert.equal(detector.snapshot().totalSteps, 12);
    assert.equal(detector.snapshot().isWalking, true);
  });
}

test('slow movement cycles can be broad, not only brief pulses spaced far apart', () => {
  for (const duration of [1200, 1800]) {
    const detector = new CampusStepDetector();
    feed(detector, {
      to: 1000 + 10 * duration + 1200,
      motion: time => {
        const elapsed = time - 1000;
        return eventWithLinearZ(elapsed >= 0 && elapsed < 10 * duration
          ? 2.8 * Math.sin(2 * Math.PI * (elapsed % duration) / duration) : 0);
      },
    });
    assert.equal(detector.snapshot().totalSteps, 10, `${duration} ms wide movement cycles`);
  }
});

test('a changing but continuous slow cadence does not require identical intervals', () => {
  const detector = new CampusStepDetector();
  const starts = [1000];
  for (const gap of [600, 1200, 1800, 900, 1400, 700, 1700, 1000, 1300]) {
    starts.push(starts.at(-1) + gap);
  }
  feed(detector, { starts, to: starts.at(-1) + 1200 });
  assert.equal(detector.snapshot().totalSteps, starts.length);
});

for (const hz of [30, 60, 100]) {
  test(`normal and slow traces retain their counts at ${hz} Hz`, () => {
    for (const gap of [600, 1200, 1800]) {
      const { detector } = walkingTrace(gap, 12, hz);
      assert.ok(Math.abs(detector.snapshot().totalSteps - 12) <= 1,
        `${hz} Hz / ${gap} ms: expected approximately 12 counts, got ${detector.snapshot().totalSteps}`);
    }
  });
}

test('one isolated phone movement is only a candidate, not walking', () => {
  const detector = new CampusStepDetector();
  feed(detector, { to: 2500, starts: [1000] });
  assert.equal(detector.snapshot().candidates, 1, 'trace must exercise the confirmation gate');
  assert.equal(detector.snapshot().totalSteps, 0);
  assert.equal(detector.snapshot().isWalking, false);
});

test('isolated movements separated by long rests are not added together', () => {
  const detector = new CampusStepDetector();
  feed(detector, { to: 8500, starts: [1000, 4000, 7000] });
  assert.equal(detector.snapshot().candidates, 3);
  assert.equal(detector.snapshot().totalSteps, 0);
});

test('a stale positive pulse cannot combine with a much later negative pulse', () => {
  const detector = new CampusStepDetector();
  const states = feed(detector, {
    to: 5000,
    motion: time => eventWithLinearZ(
      time >= 1000 && time < 1080 ? 2 : time >= 3500 && time < 3580 ? -2 : 0),
  });
  assert.ok(states.some(state => state.filteredAccel > 0.8), 'positive evidence must be present');
  assert.ok(states.some(state => state.time >= 3500 && state.filteredAccel < -0.4),
    'negative evidence must be present after the rest');
  assert.equal(detector.snapshot().candidates, 0);
  assert.equal(detector.snapshot().totalSteps, 0);
});

test('rest ends walking and resuming requires two fresh movements', () => {
  const detector = new CampusStepDetector();
  feed(detector, { to: 3000, starts: [1000, 1600, 2200] });
  assert.equal(detector.snapshot().totalSteps, 3);
  feed(detector, { from: 3010, to: 5500 });
  assert.equal(detector.snapshot().isWalking, false);
  feed(detector, { from: 5510, to: 6590, starts: [6000] });
  assert.equal(detector.snapshot().totalSteps, 3);
  feed(detector, { from: 6600, to: 7400, starts: [6600] });
  assert.equal(detector.snapshot().totalSteps, 5);
});

test('cadence expiry during a fresh pulse does not discard that pulse', () => {
  const detector = new CampusStepDetector();
  const starts = [1000, 1800, 4100, 4900, 5700];
  feed(detector, {
    to: 7500,
    hz: 50,
    motion: time => {
      const start = starts.find(value => time >= value && time < value + 600);
      return eventWithLinearZ(start === undefined ? 0 : 3 * Math.sin(2 * Math.PI * (time - start) / 600));
    },
  });
  assert.equal(detector.snapshot().totalSteps, 5);
});

test('pause keeps totals but drops orientation, partial evidence, and walking state', () => {
  const { detector } = walkingTrace(600, 3);
  const total = detector.snapshot().totalSteps;
  const candidates = detector.snapshot().candidates;
  detector.updateOrientation({ beta: 0, gamma: 0 }, 3450);
  detector.updateOrientation({ beta: 90, gamma: 0 }, 3460);
  detector.updateOrientation({ beta: 0, gamma: 0 }, 3470);
  detector.pause();
  assertFreshSignal(detector.snapshot());
  assert.equal(detector.snapshot().totalSteps, total);
  assert.equal(detector.snapshot().candidates, candidates);
  feed(detector, { from: 3500, to: 4700, starts: [4000] });
  assert.equal(detector.snapshot().totalSteps, total);
  feed(detector, { from: 4710, to: 5900, starts: [5200] });
  assert.equal(detector.snapshot().totalSteps, total + 2);
});

test('pause in the middle of a pulse cannot join evidence across recordings', () => {
  const detector = new CampusStepDetector();
  feed(detector, { to: 1090, starts: [1000] });
  assert.ok(detector.snapshot().filteredAccel > 0.8);
  detector.pause();
  feed(detector, { from: 1100, to: 2600, starts: [1000] });
  assert.equal(detector.snapshot().totalSteps, 0);
  assert.equal(detector.snapshot().candidates, 0);
});

test('reset clears counts and signal, and a new recording can count again', () => {
  const { detector } = walkingTrace(600, 3);
  detector.reset();
  assertFreshSignal(detector.snapshot());
  assert.equal(detector.snapshot().totalSteps, 0);
  assert.equal(detector.snapshot().candidates, 0);
  assert.equal(detector.snapshot().rejected, 0);
  feed(detector, { to: 3000, starts: [1000, 1600, 2200] });
  assert.equal(detector.snapshot().totalSteps, 3);
});

const invalidEvents = [
  ['missing event', undefined],
  ['null event', null],
  ['missing acceleration', {}],
  ['null acceleration', { accelerationIncludingGravity: null }],
  ['all null axes', { accelerationIncludingGravity: { x: null, y: null, z: null } }],
  ['one missing axis', { accelerationIncludingGravity: { x: 0, z: GRAVITY } }],
  ['NaN axis', { accelerationIncludingGravity: { x: NaN, y: 0, z: GRAVITY } }],
  ['infinite axis', { accelerationIncludingGravity: { x: 0, y: Infinity, z: GRAVITY } }],
  ['numeric string axis', { accelerationIncludingGravity: { x: '0', y: 0, z: GRAVITY } }],
  ['overflowing vector magnitude', { accelerationIncludingGravity: {
    x: Number.MAX_VALUE, y: Number.MAX_VALUE, z: Number.MAX_VALUE,
  } }],
  ['gravity-free data only', { acceleration: { x: 0, y: 0, z: 2 } }],
  ['invalid gravity data with valid gravity-free data', {
    accelerationIncludingGravity: { x: null, y: null, z: null },
    acceleration: { x: 0, y: 0, z: 2 },
  }],
];
test('unavailable or malformed input fails closed instead of inventing zero axes or falling back', () => {
  for (const [label, event] of invalidEvents) {
    const { detector } = walkingTrace(600, 3);
    const state = detector.updateMotion(event, 3410);
    assert.equal(state.valid, false, label);
    assert.equal(state.totalSteps, 3, label);
    assertFreshSignal(state);
    feed(detector, { from: 3420, to: 4700, starts: [4000] });
    assert.equal(detector.snapshot().totalSteps, 3, `${label}: old walking state must not resume`);
  }
});

test('nonfinite timestamps fail closed and preserve already counted steps', () => {
  for (const timestamp of [NaN, Infinity, -Infinity, null, '4000']) {
    const { detector } = walkingTrace(600, 3);
    const state = detector.updateMotion(eventWithLinearZ(2), timestamp);
    assertFreshSignal(state);
    assert.equal(state.totalSteps, 3);
  }
});

test('gaps, duplicate timestamps, and a clock moving backwards start fresh evidence', () => {
  for (const newTime of [6000, 3400, 10]) {
    const { detector } = walkingTrace(600, 3);
    const state = detector.updateMotion(eventWithLinearZ(), newTime);
    assert.equal(state.totalSteps, 3);
    assert.equal(state.isWalking, false);
    assert.equal(state.stepsAdded, 0);
    assert.equal(state.filteredAccel, 0);
    feed(detector, { from: newTime + 10, to: newTime + 1600, starts: [newTime + 1000] });
    assert.equal(detector.snapshot().totalSteps, 3);
    feed(detector, { from: newTime + 1610, to: newTime + 2600, starts: [newTime + 1800] });
    assert.equal(detector.snapshot().totalSteps, 5);
  }
});

test('rapid orientation changes reject candidates while they are recent', () => {
  const detector = new CampusStepDetector();
  feed(detector, {
    to: 4500,
    starts: [1000, 1600, 2200, 2800, 3400],
    orientation: (value, time, index) => value.updateOrientation({ beta: index % 2 ? 90 : 0, gamma: 0 }, time),
  });
  assert.ok(detector.snapshot().candidates > 0);
  assert.ok(detector.snapshot().rejected > 0);
  assert.equal(detector.snapshot().totalSteps, 0);
});

test('old unstable orientation samples expire even when orientation events stop', () => {
  const detector = new CampusStepDetector();
  feed(detector, {
    to: 3500,
    starts: [1000, 1600, 2200, 2800],
    orientation: (value, time, index) => value.updateOrientation({ beta: index % 2 ? 90 : 0, gamma: 0 }, time),
  });
  assert.equal(detector.snapshot().totalSteps, 0);
  feed(detector, { from: 3510, to: 7000, starts: [4500, 5100, 5700] });
  assert.equal(detector.snapshot().totalSteps, 3);
});

test('invalid orientation data does not permanently block a valid motion stream', () => {
  const detector = new CampusStepDetector();
  feed(detector, {
    to: 3500,
    starts: [1000, 1600, 2200],
    orientation: (value, time, index) => {
      const invalid = [undefined, {}, { beta: null, gamma: 0 }, { beta: 0, gamma: NaN }];
      value.updateOrientation(invalid[index % invalid.length], time);
    },
  });
  assert.equal(detector.snapshot().totalSteps, 3);
});

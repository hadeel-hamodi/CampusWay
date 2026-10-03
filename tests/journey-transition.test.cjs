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

function between(source, start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a, `missing ${start}`);
  return source.slice(a, b);
}

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    api: {
      getItem(key) { return values.get(key) ?? null; },
      setItem(key, value) { values.set(key, String(value)); },
      removeItem(key) { values.delete(key); }
    }
  };
}

const indexHelpers = between(
  index,
  'function storedJourneyFallback()',
  'function startIndoorTransition()'
);

const pageShowHandler = between(
  index,
  'async function handleCampusPageShow()',
  "window.addEventListener(\n  'pageshow'"
);

function coldReloadHarness(hasIndoorDestination) {
  const start = {
    lat: 32.761753,
    lng: 35.019978,
    label: 'Main Building',
    buildingKey: 'main',
    nodeId: 'floor700_n69',
    entranceId: 'floor600_n86'
  };

  const destination = {
    name: 'Rabin Building',
    lat: 32.76191,
    lng: 35.02039,
    keepIndoorContext: hasIndoorDestination
  };

  const savedJourney = JSON.stringify({
    version: 1,
    start,
    destination,
    startInput: 'Main Building',
    searchInput: hasIndoorDestination
      ? 'Room 5013 — Rabin Building'
      : 'Rabin Building',
    hasIndoorDestination
  });

  const session = storage({
    originIndoorComplete: 'true',
    campusTransitionDirection: 'outdoor',
    outdoorJourneyContext: savedJourney,
    indoorStartContext: JSON.stringify({
      buildingKey: 'main',
      startNodeId: 'floor700_n69',
      exitEntranceId: 'floor600_n86'
    }),
    indoorContext: JSON.stringify(
      hasIndoorDestination
        ? {
            buildingKey: 'rabin',
            destinationNodeId: 'floor5_n13',
            destinationLabel: '5013'
          }
        : {buildingKey: 'rabin'}
    )
  });

  const elements = new Map();
  const element = id => {
    if(!elements.has(id)){
      elements.set(id, {
        value: '',
        textContent: '',
        style: {},
        dataset: {}
      });
    }
    return elements.get(id);
  };

  const calls = [];
  const timers = [];
  const context = vm.createContext({
    sessionStorage: session.api,
    document: {getElementById: element},
    window: {location: {search: '?resumeJourney=1'}},
    URLSearchParams,
    Number,
    Boolean,
    JSON,
    console: {error() {}},
    setTimeout(fn, delay) {
      timers.push({fn, delay});
      return timers.length;
    },
    t: {continueIndoors: 'Continue indoors →'},
    BUILDING_ENTRANCES: {
      main: [{
        nodeId: 'floor600_n86',
        lat: start.lat,
        lng: start.lng
      }]
    },
    CAMPUS_DATA: {
      buildings: [{
        name: 'Rabin Building',
        lat: destination.lat,
        lng: destination.lng
      }]
    },
    routeTo: async (...args) => {
      calls.push(args);
      const button = element('continueIndoorBtn');
      button.style.display = 'block';
      button.dataset.destinationBuilding = 'rabin';
    }
  });

  vm.runInContext(
    `const OUTDOOR_JOURNEY_STORAGE_KEY='outdoorJourneyContext';\n` +
    `let customStart=null;\n` +
    `let currentOutdoorDestination=null;\n` +
    indexHelpers + '\n' + pageShowHandler,
    context
  );

  return {context, session, element, calls, timers, start, destination};
}

test('cold reload resumes Main-to-Rabin outdoors from the saved Main exit', async () => {
  const h = coldReloadHarness(false);

  await vm.runInContext('handleCampusPageShow()', h.context);

  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0][0], 'Rabin Building');
  assert.equal(h.calls[0][3].keepIndoorContext, false);
  assert.equal(
    vm.runInContext('customStart.entranceId', h.context),
    'floor600_n86'
  );
  assert.equal(h.element('startInput').value, 'Main Building');
  assert.equal(h.element('continueIndoorBtn').style.display, 'none');
  assert.equal(h.session.values.has('originIndoorComplete'), false);
  assert.equal(h.session.values.has('campusTransitionDirection'), false);
  assert.equal(h.session.values.has('outdoorJourneyContext'), true);
});

test('room destination resumes outdoors and then offers Rabin indoor navigation', async () => {
  const h = coldReloadHarness(true);

  await vm.runInContext('handleCampusPageShow()', h.context);

  const button = h.element('continueIndoorBtn');
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0][3].keepIndoorContext, true);
  assert.equal(button.style.display, 'block');
  assert.equal(button.dataset.stage, 'destination');
  assert.equal(button.dataset.building, 'rabin');
  assert.equal(button.dataset.destinationBuilding, 'rabin');
});

test('stored indoor contexts rebuild the outdoor leg during a first-version upgrade', async () => {
  const h = coldReloadHarness(false);
  h.session.values.delete('outdoorJourneyContext');

  await vm.runInContext('handleCampusPageShow()', h.context);

  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0][0], 'Rabin Building');
  assert.equal(
    vm.runInContext('customStart.entranceId', h.context),
    'floor600_n86'
  );
  assert.equal(h.session.values.has('outdoorJourneyContext'), true);
  assert.equal(h.element('continueIndoorBtn').style.display, 'none');
});

test('saved language is restored before a resumed journey is shown', () => {
  const session = storage({campuswayLanguage: 'ar'});
  let domReady = null;
  const calls = [];
  const context = vm.createContext({
    sessionStorage: session.api,
    window: {
      addEventListener(name, callback) {
        if(name === 'DOMContentLoaded') domReady = callback;
      }
    },
    pickLang(language, direction) {
      calls.push([language, direction]);
    }
  });

  const languageCode = between(
    index,
    'function restoreSavedLanguage()',
    'function localizedBuildingName(building)'
  );

  vm.runInContext(languageCode, context);
  assert.equal(typeof domReady, 'function');
  domReady();
  assert.deepEqual(calls, [['ar', 'rtl']]);
});

test('finishing the origin indoor leg automatically opens the saved outdoor journey', () => {
  const session = storage({
    journeyStage: 'origin',
    outdoorJourneyContext: '{}'
  });
  const elements = new Map();
  const element = id => {
    if(!elements.has(id)){
      elements.set(id, {
        textContent: '',
        style: {},
        disabled: false
      });
    }
    return elements.get(id);
  };
  const timers = [];
  let replaced = null;
  let backed = false;

  const context = vm.createContext({
    sessionStorage: session.api,
    window: {
      location: {
        search: '?building=main',
        replace(url) { replaced = url; },
        assign() {}
      },
      history: {
        length: 2,
        back() { backed = true; }
      }
    },
    URLSearchParams,
    encodeURIComponent,
    setTimeout(fn, delay) {
      timers.push({fn, delay});
      return timers.length;
    },
    $: element,
    localizedInstruction: english => english,
    localizedFloor: floor => floor,
    localizedNodeLabel: label => label,
    stopNavigationMotion() {},
    followNode() {},
    floorButtons() {},
    drawBaseMap() {},
    updateProgressUI() {},
    console: {warn() {}, error() {}}
  });

  const transitionCode = between(
    navigation,
    'function returnToOutdoorJourney()',
    'function screenOrientationAngle()'
  );

  vm.runInContext(
    `let progressIndex=0,progressT=0,activeFloor='floor600';\n` +
    `const routeNodes=[{floor:'floor600',label:'Main exit'}];\n` +
    transitionCode,
    context
  );

  vm.runInContext('completeNavigation()', context);

  assert.equal(session.values.get('originIndoorComplete'), 'true');
  assert.equal(session.values.get('journeyStage'), 'destination');
  assert.equal(timers.length, 1);
  assert.equal(timers[0].delay, 650);
  assert.match(element('status').textContent, /outdoor route/i);

  timers[0].fn();

  assert.equal(
    session.values.get('campusTransitionDirection'),
    'outdoor'
  );
  assert.equal(replaced, '../index.html?resumeJourney=1');
  assert.equal(backed, false);
});

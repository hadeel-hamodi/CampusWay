const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {test} = require('node:test');

const root = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function between(source, start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a, start);
  return source.slice(a, b);
}

// Loads the campus-map code that starts routes to food places, shops,
// restrooms and shelters, with routeTo() replaced by a recorder.
function serviceHarness() {
  const storage = new Map();
  const routeCalls = [];
  const element = () => ({classList: {add() {}, remove() {}, contains() { return false; }}});
  const context = vm.createContext({
    console,
    sessionStorage: {
      getItem: key => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: key => storage.delete(key)
    },
    document: {getElementById: element},
    routeTo: (name, lat, lng, options) => routeCalls.push({name, lat, lng, options})
  });
  const run = code => vm.runInContext(code, context);
  run(`
    let lang = 'en';
    const t = {nearestShelter: 'Nearest shelter'};
    const CAMPUS_DATA = {
      buildings: [
        {name: 'Rabin Building', lat: 32.7612, lng: 35.0204},
        {name: 'Student House', lat: 32.7618, lng: 35.0212}
      ],
      points: {clinic: []}
    };
    function localizedPlaceName(place) { return place.name; }
    let indoorSearchGraphsReady = Promise.resolve();
    let nearbyServiceRequestId = 0;
    let currentProfile = 'general';
    let activeRouteService = null;
    function closeRoute() {}
    function restoreServiceMarkers() {}
    function exitFoodShopMode() {}
    function setActiveServiceButton() {}
    function findNearbyIndoorService() {}
    function clearRestSpacePreview() {}
    function showRestSpacePreview() {}
    function showFoodPlaces() {}
    function showShopPlaces() {}
    function getStart() { return {lat: 32.7590, lng: 35.0214, label: 'Carmel Gate'}; }
    function collectIndoorRestroomServices() {
      return [{buildingKey: 'rabin', buildingName: 'Rabin Building', lat: 32.7612, lng: 35.0204}];
    }
    function collectIndoorShelterServices() {
      return [{buildingKey: 'student', buildingName: 'Student House', lat: 32.7618, lng: 35.0212}];
    }
  `);
  run(between(index, 'function routeToFoodPlace(food){', 'CAMPUS_DATA.points.food.forEach'));
  run(between(index, 'function routeToShopPlace(shop){', 'CAMPUS_DATA.points.shops.forEach'));
  run(between(index, 'async function findNearbyService(type){', 'function showFoodPlaces(){'));
  const indoorContext = () => JSON.parse(storage.get('indoorContext') || 'null');
  return {run, routeCalls, storage, indoorContext};
}

test('Navigate here for an indoor food place keeps the indoor destination', () => {
  const h = serviceHarness();
  h.run(`routeToFoodPlace(${JSON.stringify({
    name: 'Aroma Espresso Bar', lat: 32.7613, lng: 35.0209, type: 'food',
    indoor: {buildingKey: 'rabin', nodeIds: ['floor6_n70', 'floor6_n71']}
  })})`);
  assert.equal(h.routeCalls.length, 1);
  assert.equal(h.routeCalls[0].name, 'Rabin Building');
  assert.equal(h.routeCalls[0].options?.keepIndoorContext, true);
  const context = h.indoorContext();
  assert.deepEqual(Array.from(context.destinationNodeIds), ['floor6_n70', 'floor6_n71']);
  assert.equal(context.buildingKey, 'rabin');
  assert.equal(context.destinationDisplayLabel, 'Aroma Espresso Bar');
  assert.equal(h.storage.get('indoorBuilding'), 'rabin');
});

test('Navigate here for an outdoor-only place routes to the place itself', () => {
  const h = serviceHarness();
  h.run(`routeToFoodPlace(${JSON.stringify({name: 'Garden Cafe', lat: 32.7619, lng: 35.0198, type: 'food'})})`);
  assert.equal(h.routeCalls.length, 1);
  assert.equal(h.routeCalls[0].name, 'Garden Cafe');
  assert.equal(h.routeCalls[0].options?.keepIndoorContext, undefined);
});

test('Navigate here for an indoor shop keeps the indoor destination', () => {
  const h = serviceHarness();
  h.run(`routeToShopPlace(${JSON.stringify({
    name: 'Yozma', lat: 32.7620, lng: 35.0213, type: 'shop',
    indoor: {buildingKey: 'student', nodeIds: ['floor1_n24']}
  })})`);
  assert.equal(h.routeCalls[0].name, 'Student House');
  assert.equal(h.routeCalls[0].options?.keepIndoorContext, true);
  assert.equal(h.indoorContext().buildingKey, 'student');
});

test('Restrooms service keeps the indoor restroom destination', async () => {
  const h = serviceHarness();
  await h.run(`findNearbyService('restroom')`);
  assert.equal(h.routeCalls.length, 1);
  assert.equal(h.routeCalls[0].name, 'Rabin Building');
  assert.equal(h.routeCalls[0].options?.keepIndoorContext, true);
  const context = h.indoorContext();
  assert.equal(context.destinationLabel, 'Restroom');
  assert.equal(context.destinationDisplayLabel, 'Nearest restroom');
  assert.equal(context.buildingKey, 'rabin');
});

test('Shelters service keeps the indoor shelter destination', async () => {
  const h = serviceHarness();
  await h.run(`findNearbyService('shelter')`);
  assert.equal(h.routeCalls.length, 1);
  assert.equal(h.routeCalls[0].name, 'Student House');
  assert.equal(h.routeCalls[0].options?.keepIndoorContext, true);
  const context = h.indoorContext();
  assert.equal(context.destinationLabel, 'Shelter');
  assert.equal(context.destinationDisplayLabel, 'Nearest shelter');
  assert.equal(context.buildingKey, 'student');
});

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {test} = require('node:test');

const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function between(source, start, end){
  const a = source.indexOf(start);
  const b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a, start);
  return source.slice(a, b);
}

const ON_CAMPUS = {lat:32.7614, lng:35.0196};   // Main Building
const OFF_CAMPUS = {lat:32.0853, lng:34.7818};  // Tel Aviv

// Runs the real start-location code with a fake phone position.
// geolocation: {position}, {error:true}, {silent:true} (never answers) or null (no GPS at all).
function harness(geolocation, {customStart = null} = {}){
  const calls = {notify:[], gps:[], asked:0, timers:[]};
  const navigator = geolocation === null ? {} : {
    geolocation:{
      getCurrentPosition(success, failure){
        calls.asked += 1;
        if(geolocation.position) success({coords:{latitude:geolocation.position.lat, longitude:geolocation.position.lng}});
        else if(geolocation.error) failure({code:1});
      }
    }
  };
  const context = vm.createContext({
    navigator,
    customStart,
    DEFAULT_START:{name:'Carmel Gate (South gate)'},
    t:{
      startGateNoLocation:'No location, starting at {gate}.',
      startGateOffCampus:'Off campus, starting at {gate}.'
    },
    localizedBuildingNameByEnglishName:name => name,
    notify:message => calls.notify.push(message),
    applyGpsStart(lat, lng){ calls.gps.push([lat, lng]); context.customStart = {lat, lng, label:'📍 GPS'}; },
    setTimeout(fn, delay){ calls.timers.push({fn, delay}); return calls.timers.length; },
    clearTimeout(){}
  });
  vm.runInContext(between(index, 'const CAMPUS_AREA =', 'const startSuggestions'), context);
  return {context, calls, run:code => vm.runInContext(code, context)};
}

test('only positions inside the campus map count as on campus', () => {
  const h = harness(null);
  assert.equal(h.run(`isOnCampus(${ON_CAMPUS.lat}, ${ON_CAMPUS.lng})`), true);
  assert.equal(h.run(`isOnCampus(${OFF_CAMPUS.lat}, ${OFF_CAMPUS.lng})`), false);
  assert.equal(h.run('isOnCampus(32.7700, 35.0200)'), false, 'just north of the campus');
});

test('on campus, the route starts from the phone position', async () => {
  const h = harness({position:ON_CAMPUS});
  assert.equal(await h.run('startFromPhoneWhenUnset()'), true);
  assert.deepEqual(h.calls.gps, [[ON_CAMPUS.lat, ON_CAMPUS.lng]]);
  assert.deepEqual(h.calls.notify, []);
});

test('a start the user already chose is kept and the phone is not asked', async () => {
  const h = harness({position:ON_CAMPUS}, {customStart:{lat:1, lng:2, label:'Room 624'}});
  assert.equal(await h.run('startFromPhoneWhenUnset()'), true);
  assert.equal(h.calls.asked, 0);
  assert.deepEqual(h.calls.gps, []);
});

test('off campus, the default gate is used and the user is told why', async () => {
  const h = harness({position:OFF_CAMPUS});
  assert.equal(await h.run('startFromPhoneWhenUnset()'), false);
  assert.deepEqual(h.calls.gps, []);
  assert.deepEqual(h.calls.notify, ['Off campus, starting at Carmel Gate (South gate).']);
});

test('refused or missing location falls back to the gate with a message', async () => {
  for(const geolocation of [{error:true}, null]){
    const h = harness(geolocation);
    assert.equal(await h.run('startFromPhoneWhenUnset()'), false);
    assert.deepEqual(h.calls.notify, ['No location, starting at Carmel Gate (South gate).']);
  }
});

test('a phone that never answers does not block the route', async () => {
  const h = harness({silent:true});
  const result = h.run('startFromPhoneWhenUnset()');
  assert.equal(h.calls.timers.length, 1);
  assert.ok(h.calls.timers[0].delay <= 5000, 'gives up within five seconds');
  h.calls.timers[0].fn();
  assert.equal(await result, false);
  assert.equal(h.calls.notify.length, 1);
});

test('quiet mode falls back without its own message (shared links show theirs)', async () => {
  const h = harness({error:true});
  assert.equal(await h.run('startFromPhoneWhenUnset({quiet:true})'), false);
  assert.deepEqual(h.calls.notify, []);
});

test('the shelter button, shared links and reminders all try the phone position first', () => {
  const shelter = between(index, 'async function emergencyStartPoint(){', 'async function nearestShelterPlan(');
  assert.match(shelter, /await startFromPhoneWhenUnset\(\);\s*return getStart\(\);/);

  const shared = between(index, 'async function openSharedLink(){', '// EMERGENCY: one tap');
  assert.match(shared, /from \? true : await startFromPhoneWhenUnset\(\{quiet:true\}\)/);
  assert.ok(shared.indexOf('startFromPhoneWhenUnset') < shared.indexOf('await routeTo('), 'start is set before routing');

  const reminder = between(index, 'async function startReminderRoute(){', 'function setupPreferenceUI(){');
  assert.ok(reminder.indexOf('await startFromPhoneWhenUnset()') < reminder.indexOf('pickIndoorDestination('));
});

test('the fallback messages exist in every language', () => {
  for(const key of ['startGateNoLocation', 'startGateOffCampus']){
    const found = index.match(new RegExp(`${key}:'[^']*\\{gate\\}[^']*'`, 'g')) || [];
    assert.equal(found.length, 4, `${key} in en, he, ar and ru`);
  }
});

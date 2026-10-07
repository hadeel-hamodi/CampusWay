const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {test} = require('node:test');

const root = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');

function between(source, start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a, `missing ${start}`);
  return source.slice(a, b);
}

test('schedule reminders are an optional Settings-only feature with translated management UI', () => {
  const planner = between(index, '<section class="panel planner"', '<!-- Route result -->');
  const settings = between(index, '<div class="settings-dialog" id="settingsDialog"', '<div class="settings-dialog" id="scheduleDialog"');

  assert.doesNotMatch(planner, /scheduleRemindersBtn|manageScheduleBtn/);
  assert.match(settings, /id="scheduleRemindersBtn"[^>]+role="switch"/);
  assert.match(settings, /id="manageScheduleBtn"[^>]+hidden/);
  assert.match(index, /id="scheduleDialog"[^>]+aria-modal="true"/);
  assert.match(index, /id="scheduleReminder"[^>]+role="alertdialog"/);
  for(const label of [
    'Schedule reminders', 'תזכורות מערכת שעות', 'تذكيرات الجدول', 'Напоминания о занятиях'
  ]) assert.ok(index.includes(label), label);
  assert.match(serviceWorker, /campusway-v51-schedule-reminders/);
});

test('saved schedule data rejects malformed entries before it is shown or scheduled', () => {
  const raw = JSON.stringify([
    {id:'ok', title:'Algorithms', day:1, time:'09:30', target:{kind:'building', buildingName:'Main Building'}},
    {id:'bad-time', title:'Bad', day:1, time:'9:30', target:{}},
    {id:'bad-day', title:'Bad', day:9, time:'10:00', target:{}},
    null
  ]);
  const context = vm.createContext({
    PREFERENCE_KEYS:{scheduleEntries:'schedule'},
    readStoredPreference(){ return raw; },
    JSON,
    Array
  });
  vm.runInContext(between(index, 'function readScheduleEntries(){', 'function saveScheduleEntries(){'), context);
  const entries = JSON.parse(JSON.stringify(vm.runInContext('readScheduleEntries()', context)));
  assert.deepEqual(entries, [
    {id:'ok', title:'Algorithms', day:1, time:'09:30', target:{kind:'building', buildingName:'Main Building'}}
  ]);
});

test('a reminder starts the exact saved building or room route', async () => {
  const calls = [];
  const context = vm.createContext({
    scheduleReminderEntry:{target:{kind:'room', nodeId:'r5013', label:'5013', buildingKey:'rabin'}},
    dismissScheduleReminder(){ calls.push(['dismiss']); },
    pickIndoorDestination(...args){ calls.push(['room', ...args]); return Promise.resolve(); },
    pickDestination(...args){ calls.push(['building', ...args]); return Promise.resolve(); }
  });
  vm.runInContext(between(index, 'async function startReminderRoute(){', 'function setupPreferenceUI(){'), context);
  await vm.runInContext('startReminderRoute()', context);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    ['dismiss'], ['room', 'r5013', '5013', 'rabin', '5013']
  ]);
});

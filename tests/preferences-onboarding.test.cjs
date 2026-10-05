const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {test} = require('node:test');

const root = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  .replace(/\r\n/g, '\n');

function between(source, start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a, `missing ${start}`);
  return source.slice(a, b);
}

const restoreSource = between(
  index,
  'function restoreSavedLanguage(){',
  'function selectOnboardingProfile('
);

test('saved language and profile skip setup only after onboarding is complete', () => {
  const stored = new Map([
    ['campuswayLanguage', 'ar'],
    ['accessibilityProfile', 'mobility'],
    ['campuswayOnboardingComplete', 'true']
  ]);
  const calls = [];
  const context = vm.createContext({
    PROFILE_IDS: new Set(['general','mobility','visual','spatial','mental']),
    LANGUAGE_IDS: new Set(['en','he','ar']),
    PREFERENCE_KEYS: {
      language:'campuswayLanguage',
      profile:'accessibilityProfile',
      onboarding:'campuswayOnboardingComplete'
    },
    currentProfile:'general',
    pendingOnboardingProfile:null,
    readStoredPreference(key){ return stored.get(key) ?? null; },
    readValidStoredPreference(key, allowed){
      const value = stored.get(key) ?? null;
      return allowed.has(value) ? value : null;
    },
    writeStoredPreference(key, value){ stored.set(key, value); },
    applyLanguagePreference(language, direction, options){
      calls.push(['language', language, direction, options]);
    },
    setAccessibilityProfile(profile, options){
      calls.push(['profile', profile, options]);
    },
    revealApp(){ calls.push(['reveal']); },
    showOnboardingStep(step){ calls.push(['step', step]); }
  });

  vm.runInContext(restoreSource, context);
  assert.equal(vm.runInContext('restoreSavedLanguage()', context), true);
  assert.deepEqual(calls.map(call => call[0]), ['language','profile','reveal']);
  assert.deepEqual(calls[0].slice(1, 3), ['ar','rtl']);
  assert.equal(calls[1][1], 'mobility');
});

test('a saved language without completed setup opens the profile step', () => {
  const stored = new Map([['campuswayLanguage', 'he']]);
  const calls = [];
  const context = vm.createContext({
    PROFILE_IDS: new Set(['general','mobility','visual','spatial','mental']),
    LANGUAGE_IDS: new Set(['en','he','ar']),
    PREFERENCE_KEYS: {
      language:'campuswayLanguage',
      profile:'accessibilityProfile',
      onboarding:'campuswayOnboardingComplete'
    },
    currentProfile:'general',
    pendingOnboardingProfile:null,
    readStoredPreference(key){ return stored.get(key) ?? null; },
    readValidStoredPreference(key, allowed){
      const value = stored.get(key) ?? null;
      return allowed.has(value) ? value : null;
    },
    writeStoredPreference(){},
    applyLanguagePreference(language, direction){
      calls.push(['language', language, direction]);
    },
    setAccessibilityProfile(){ calls.push(['profile']); },
    revealApp(){ calls.push(['reveal']); },
    showOnboardingStep(step){ calls.push(['step', step]); }
  });

  vm.runInContext(restoreSource, context);
  assert.equal(vm.runInContext('restoreSavedLanguage()', context), true);
  assert.deepEqual(calls, [
    ['language','he','rtl'],
    ['step','profile']
  ]);
});

test('onboarding requires an explicit profile and saves completion afterwards', () => {
  const elements = {
    onboardingContinueBtn:{disabled:true},
    onboardingProfileError:{hidden:true,textContent:''}
  };
  const calls = [];
  const context = vm.createContext({
    PROFILE_IDS: new Set(['general','mobility','visual','spatial','mental']),
    PREFERENCE_KEYS:{onboarding:'campuswayOnboardingComplete'},
    pendingOnboardingProfile:null,
    t:{chooseProfileRequired:'Choose a profile'},
    document:{getElementById(id){ return elements[id]; }},
    buildProfiles(){ calls.push(['build']); },
    setAccessibilityProfile(profile, options){
      calls.push(['profile', profile, options]);
    },
    writeStoredPreference(key, value){ calls.push(['stored', key, value]); },
    revealApp(options){ calls.push(['reveal', options]); }
  });
  const source = between(
    index,
    'function selectOnboardingProfile(',
    'function renderSettingsLanguageChoices()'
  );
  vm.runInContext(source, context);

  vm.runInContext('completeOnboarding()', context);
  assert.equal(elements.onboardingProfileError.hidden, false);
  assert.equal(calls.some(call => call[0] === 'reveal'), false);

  vm.runInContext("selectOnboardingProfile('mobility')", context);
  assert.equal(elements.onboardingContinueBtn.disabled, false);
  vm.runInContext('completeOnboarding()', context);

  assert.equal(calls.some(call => call[0] === 'profile' && call[1] === 'mobility'), true);
  assert.equal(
    calls.some(call => call[0] === 'stored' && call[1] === 'campuswayOnboardingComplete' && call[2] === 'true'),
    true
  );
  assert.equal(calls.some(call => call[0] === 'reveal'), true);
});

test('changing profile in Settings preserves the destination and recalculates once', () => {
  const writes = [];
  const routes = [];
  const destination = {
    name:'Rabin Building',
    lat:32.7619,
    lng:35.0204,
    keepIndoorContext:true
  };
  const context = vm.createContext({
    PROFILE_IDS:new Set(['general','mobility','visual','spatial','mental']),
    PREFERENCE_KEYS:{profile:'accessibilityProfile'},
    currentProfile:'general',
    audioOn:false,
    currentOutdoorDestination:destination,
    t:{profiles:[{id:'mobility',label:'Mobility',sub:'No stairs'}]},
    writeStoredPreference(key, value){ writes.push([key, value]); },
    setAudioEnabled(){},
    updateRestSpaceServiceButton(){},
    showAlert(){},
    speak(){},
    buildProfiles(){},
    window:{CampusUI:{refresh(){}}},
    showRestSpacePreview(){},
    clearRestSpacePreview(){},
    routeTo(...args){ routes.push(args); }
  });
  const source = between(
    index,
    'function setAccessibilityProfile(',
    'function showAlert('
  );
  vm.runInContext(source, context);
  assert.equal(
    vm.runInContext("setAccessibilityProfile('mobility')", context),
    true
  );

  assert.deepEqual(writes, [['accessibilityProfile','mobility']]);
  assert.equal(routes.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(routes[0])), [
    'Rabin Building',
    32.7619,
    35.0204,
    {keepIndoorContext:true}
  ]);
});

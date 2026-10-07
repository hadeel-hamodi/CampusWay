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
    updateVisualVoiceControls(){},
    stopVisualVoiceFlow(){},
    startVisualVoiceFlow(){},
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

test('choosing Visual enables audio and contrast, then leaving Visual disables both', () => {
  const displayCalls = [];
  const context = vm.createContext({
    PROFILE_IDS:new Set(['general','mobility','visual','spatial','mental']),
    PREFERENCE_KEYS:{
  profile:'accessibilityProfile',
  contrast:'campusway.highContrastEnabled'
},
    currentProfile:'general',
    currentOutdoorDestination:null,
    t:{profiles:[
      {id:'visual',label:'Visual',sub:'Accessible display'},
      {id:'general',label:'General',sub:'Fastest route'}
    ]},
    writeStoredPreference(){},
    readStoredPreference(){ return null; },
    setAudioEnabled(value, options){ displayCalls.push(['audio',value,options]); },
    setContrastEnabled(value, options){ displayCalls.push(['contrast',value,options]); },
    updateRestSpaceServiceButton(){},
    showAlert(){},
    speak(){},
    buildProfiles(){},
    updateVisualVoiceControls(){},
    stopVisualVoiceFlow(){},
    startVisualVoiceFlow(){},
    window:{CampusUI:null},
    showRestSpacePreview(){},
    clearRestSpacePreview(){},
    routeTo(){}
  });
  const source = between(
    index,
    'function setAccessibilityProfile(',
    'function showAlert('
  );
  vm.runInContext(source, context);

  vm.runInContext("setAccessibilityProfile('visual')", context);
  vm.runInContext("setAccessibilityProfile('general')", context);

assert.deepEqual(JSON.parse(JSON.stringify(displayCalls)), [
  ['audio',true,{announce:false}],
  ['contrast',true,{persist:false,announce:false}],
  ['audio',false,{announce:false}],
  ['contrast',false,{persist:false,announce:false}]
]);
});

test('saved manual display choices override the Visual defaults on reload', () => {
  const calls = [];
  const stored = new Map([
    ['campusway.audioEnabled','false'],
    ['campusway.highContrastEnabled','false']
  ]);
  const context = vm.createContext({
    PREFERENCE_KEYS:{
      audio:'campusway.audioEnabled',
      contrast:'campusway.highContrastEnabled'
    },
    currentProfile:'visual',
    readStoredPreference(key){ return stored.get(key) ?? null; },
    setAudioEnabled(value, options){ calls.push(['audio',value,options]); },
    setContrastEnabled(value, options){ calls.push(['contrast',value,options]); }
  });
  const source = between(
    index,
    'function restoreDisplayPreferences(){',
    'function changeSettingsLanguage('
  );
  vm.runInContext(source, context);
  vm.runInContext('restoreDisplayPreferences()', context);

  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    ['audio',false,{persist:false,announce:false}],
    ['contrast',false,{persist:false,announce:false}]
  ]);
});

test('an existing Visual profile receives display defaults once when no choices were saved', () => {
  const calls = [];
  const context = vm.createContext({
    PREFERENCE_KEYS:{audio:'audio',contrast:'contrast'},
    currentProfile:'visual',
    readStoredPreference(){ return null; },
    setAudioEnabled(value, options){ calls.push(['audio',value,options]); },
    setContrastEnabled(value, options){ calls.push(['contrast',value,options]); }
  });
  const source = between(
    index,
    'function restoreDisplayPreferences(){',
    'function changeSettingsLanguage('
  );
  vm.runInContext(source, context);
  vm.runInContext('restoreDisplayPreferences()', context);

  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    ['audio',true,{persist:true,announce:false}],
    ['contrast',true,{persist:false,announce:false}]
  ]);
});

test('returning from indoor navigation refreshes shared display preferences', () => {
  assert.match(
    index,
    /window\.addEventListener\(\s*'pageshow',\s*restoreDisplayPreferences\s*\)/
  );
  assert.match(
    index,
    /window\.addEventListener\(\s*'pageshow',\s*restoreTextSizePreference\s*\)/
  );
});

test('text size choice updates the page, radio state, and shared preference', () => {
  const writes = [];
  const makeChoice = size => ({
    dataset:{textSize:size},
    attributes:{},
    selected:false,
    classList:{
      toggle(name, enabled){
        if(name === 'selected') this.owner.selected = enabled;
      },
      owner:null
    },
    setAttribute(name, value){ this.attributes[name] = value; }
  });
  const choices = [makeChoice('normal'), makeChoice('large')];
  choices.forEach(choice => { choice.classList.owner = choice; });
  const document = {
    documentElement:{dataset:{}},
    querySelectorAll(selector){
      return selector === '#settingsTextSizeOptions [data-text-size]'
        ? choices
        : [];
    }
  };
  let savedSize = 'large';
  const context = vm.createContext({
    TEXT_SIZE_IDS:new Set(['normal','large']),
    PREFERENCE_KEYS:{textSize:'campusway.textSize'},
    currentTextSize:'normal',
    document,
    writeStoredPreference(key, value){ writes.push([key, value]); },
    readValidStoredPreference(){ return savedSize; },
    renderDisplayPreferences(){
      choices.forEach(button => {
        const selected = button.dataset.textSize === context.currentTextSize;
        button.classList.toggle('selected', selected);
        button.setAttribute('aria-checked', String(selected));
      });
    }
  });
  const source = between(
    index,
    'function setTextSize(',
    'function changeSettingsLanguage('
  );
  vm.runInContext(source, context);

  vm.runInContext("setTextSize('large')", context);
  assert.equal(document.documentElement.dataset.textSize, 'large');
  assert.deepEqual(writes, [['campusway.textSize','large']]);
  assert.equal(choices[0].attributes['aria-checked'], 'false');
  assert.equal(choices[1].attributes['aria-checked'], 'true');
  assert.equal(choices[1].selected, true);

  writes.length = 0;
  vm.runInContext('restoreTextSizePreference()', context);
  assert.equal(document.documentElement.dataset.textSize, 'large');
  assert.deepEqual(writes, []);

  savedSize = 'invalid';
  vm.runInContext('restoreTextSizePreference()', context);
  assert.equal(document.documentElement.dataset.textSize, 'normal');
  assert.equal(choices[0].selected, true);
  assert.equal(choices[1].selected, false);
});

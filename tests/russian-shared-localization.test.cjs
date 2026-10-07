const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {test} = require('node:test');

const root = path.join(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

function sortedKeys(value){
  return Object.keys(value).sort();
}

test('share helpers include complete Russian text, LTR direction and Cyrillic slugs', () => {
  const source = read('app/ui/share.js').replace(
    'root.CampusShare = {open};',
    'root.CampusShare = {open, __test:{TEXT, slug, isRtlLanguage}};'
  );
  const context = vm.createContext({self:{}, console, setTimeout, clearTimeout});
  vm.runInContext(source, context);

  const helpers = context.self.CampusShare.__test;
  assert.deepEqual(sortedKeys(helpers.TEXT.ru), sortedKeys(helpers.TEXT.en));
  assert.equal(helpers.isRtlLanguage('ru'), false);
  assert.equal(helpers.isRtlLanguage('he'), true);
  assert.equal(helpers.isRtlLanguage('ar'), true);
  assert.equal(helpers.slug('Маршрут в библиотеку'), 'маршрут-в-библиотеку');
  assert.notEqual(helpers.slug('Главный корпус'), 'campusway');
});

test('campus status exposes Russian hours, reports, locale and elevator names', () => {
  const cachedStatus = JSON.stringify({
    elevators:[],
    closures:[],
    openingHours:{Library:'24/7'},
    reportEmail:''
  });
  const source = read('app/ui/campus-status.js').replace(
    'root.CampusStatus = {',
    'root.CampusStatus = {__test:{TEXT, DAY_NAMES, LANGUAGE_LOCALES, isRtlLanguage},'
  );
  const context = vm.createContext({
    self:{
      localStorage:{
        getItem(key){ return key === 'campuswayStatusCache' ? cachedStatus : null; },
        setItem(){}
      }
    },
    console
  });
  vm.runInContext(source, context);

  const status = context.self.CampusStatus;
  const helpers = status.__test;
  assert.deepEqual(sortedKeys(helpers.TEXT.ru), sortedKeys(helpers.TEXT.en));
  assert.deepEqual(sortedKeys(helpers.TEXT.ru.problems), sortedKeys(helpers.TEXT.en.problems));
  assert.equal(helpers.DAY_NAMES.ru.length, 7);
  assert.equal(helpers.LANGUAGE_LOCALES.ru, 'ru-RU');
  assert.equal(helpers.isRtlLanguage('ru'), false);
  assert.match(status.hoursText('Library', 'ru'), /^Открыто сейчас/);
  assert.equal(status.elevatorName('elevator-02', 'ru'), 'Лифт 2');
});

test('audio guide selects a Russian voice and speaks with ru-RU', () => {
  const spoken = [];
  class SpeechSynthesisUtterance {
    constructor(text){
      this.text = text;
      this.voice = null;
      this.lang = '';
    }
  }
  const voices = [
    {name:'English', lang:'en-US', localService:true},
    {name:'Russian', lang:'ru-RU', localService:true}
  ];
  const speechSynthesis = {
    addEventListener(){},
    removeEventListener(){},
    getVoices(){ return voices; },
    speak(utterance){ spoken.push(utterance); },
    cancel(){}
  };
  const window = {
    speechSynthesis,
    SpeechSynthesisUtterance,
    setTimeout,
    clearTimeout
  };
  const context = vm.createContext({
    window,
    SpeechSynthesisUtterance,
    localStorage:{getItem(){ return 'true'; }, setItem(){}},
    console,
    setTimeout,
    clearTimeout
  });

  vm.runInContext(read('wayframe/audio-guide.js'), context);
  const guide = new window.CampusAudioGuide({language:'ru'});
  assert.equal(guide.language, 'ru');
  assert.equal(guide.findVoice(), voices[1]);
  assert.equal(guide.speak('Поверните направо.'), true);
  assert.equal(spoken.length, 1);
  assert.equal(spoken[0].voice, voices[1]);
  assert.equal(spoken[0].lang, 'ru-RU');
});

test('manual audio page offers Russian phrases, voice inventory and LTR samples', () => {
  const source = read('wayframe/audio-test.html');
  assert.match(source, /data-lang="ru"[^>]*>Русский<\/button>/);
  assert.match(source, /ru:\s*\{[\s\S]*?Голосовые подсказки включены\./);
  assert.match(source, /line\('Russian',\s*pick\('ru'\)\)/);
  assert.match(source, /box\.dir\s*=\s*lang === 'he' \|\| lang === 'ar' \? 'rtl' : 'ltr'/);
  assert.match(source, /box\.lang\s*=\s*lang/);
});

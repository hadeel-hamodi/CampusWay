const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {test} = require('node:test');

const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function between(text, start, end){
  const a = text.indexOf(start);
  const b = text.indexOf(end, a);
  assert.ok(a >= 0 && b > a, start);
  return text.slice(a, b);
}

// A tiny stand-in for the page, enough to open the arrival message and press its buttons.
function harness(lang = 'en'){
  const calls = [];
  const byId = new Map();
  const searchInput = {focus(){ calls.push(['focus search']); }};
  function element(tag){
    const listeners = {};
    const el = {
      tag, children:[], attributes:{}, textContent:'', className:'', innerHTML:'', open:false,
      set id(value){ this._id = value; byId.set(value, this); }, get id(){ return this._id; },
      setAttribute(name, value){ this.attributes[name] = value; },
      append(...nodes){ this.children.push(...nodes); },
      addEventListener(name, fn){ listeners[name] = fn; },
      showModal(){ this.open = true; calls.push(['open']); },
      close(){ this.open = false; listeners.close?.(); },
      remove(){ byId.delete(this._id); calls.push(['removed']); },
      focus(){ calls.push(['focus', this.textContent]); }
    };
    return el;
  }
  const context = vm.createContext({
    lang,
    currentOutdoorDestination:{name:'Rabin Building', lat:32.7612, lng:35.0204},
    document:{
      createElement:element,
      getElementById:id => id === 'searchInput' ? searchInput : byId.get(id) || null,
      body:{append(){}}
    },
    closeRoute(){ calls.push(['closeRoute']); },
    pickStart(...args){ calls.push(['pickStart', ...args]); }
  });
  vm.runInContext(between(index, 'function showOutdoorArrival(placeName){', 'var routeStepTexts = [];'), context);
  const dialog = () => byId.get('outdoorArrivalDialog');
  const buttons = () => dialog().children.find(child => child.className === 'outdoor-arrival-actions').children;
  return {context, calls, dialog, buttons, open:name => vm.runInContext(`showOutdoorArrival(${JSON.stringify(name)})`, context)};
}

test('arriving at the end of the journey shows "You have arrived!" with the place', () => {
  const h = harness();
  h.open('Rabin Building');
  const dialog = h.dialog();
  assert.equal(dialog.open, true);
  const [icon, title, place] = dialog.children;
  assert.equal(icon.attributes['aria-hidden'], 'true');
  assert.equal(title.textContent, 'You have arrived!');
  assert.equal(place.textContent, 'Rabin Building');
  assert.equal(dialog.attributes['aria-labelledby'], 'outdoorArrivalTitle');
  assert.deepEqual(h.buttons().map(button => button.textContent), ['Done', 'New route from here']);
  assert.deepEqual(h.calls.at(-1), ['focus', 'Done'], 'focus starts on Done');
});

test('Done ends the journey and closes the message', () => {
  const h = harness();
  h.open('Rabin Building');
  h.buttons()[0].onclick();
  assert.equal(h.dialog(), undefined);
  assert.ok(h.calls.some(call => call[0] === 'closeRoute'));
  assert.ok(!h.calls.some(call => call[0] === 'pickStart'));
});

test('New route from here starts the next route at the place just reached', () => {
  const h = harness();
  h.open('Rabin Building');
  h.buttons()[1].onclick();
  const order = h.calls.map(call => call[0]).filter(name => ['closeRoute', 'pickStart', 'focus search'].includes(name));
  assert.deepEqual(order, ['closeRoute', 'pickStart', 'focus search']);
  assert.deepEqual(h.calls.find(call => call[0] === 'pickStart'), ['pickStart', 'Rabin Building', 32.7612, 35.0204, 'Rabin Building']);
});

test('the message is shown once and speaks every language', () => {
  const h = harness('he');
  h.open('מקלט חיצוני');
  h.open('מקלט חיצוני');
  assert.equal(h.calls.filter(call => call[0] === 'open').length, 1);
  assert.equal(h.dialog().dir, 'rtl');
  assert.equal(h.dialog().children[1].textContent, 'הגעת ליעד!');
  for(const [code, title] of [['ar', 'لقد وصلت!'], ['ru', 'Вы прибыли!']]){
    const other = harness(code);
    other.open('X');
    assert.equal(other.dialog().children[1].textContent, title);
  }
});

test('the message appears only when no indoor part follows the outdoor walk', () => {
  const finish = between(index, 'state.finished = true;', 'function projectOutdoorPosition(');
  assert.match(finish, /let journeyContinues = Boolean\(\s*document\.getElementById\('continueIndoorBtn'\)\?\.dataset\.building\s*\);/);
  assert.match(finish, /plan\.legs\?\.length > legIndex \+ 1\) journeyContinues = true;/);
  assert.match(finish, /if\(!journeyContinues\)\{\s*showOutdoorArrival\(/);
});

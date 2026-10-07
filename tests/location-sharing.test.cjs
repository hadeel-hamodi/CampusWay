const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {test} = require('node:test');

const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function functionSource(name) {
  const start = index.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `missing ${name}`);
  const open = index.indexOf('{', start);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = open; i < index.length; i += 1) {
    const character = index[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === "'" || character === '"' || character === '`') {
      quote = character;
      continue;
    }
    if (character === '{') depth += 1;
    if (character === '}') {
      depth -= 1;
      if (depth === 0) return index.slice(start, i + 1);
    }
  }
  throw new Error(`unterminated ${name}`);
}

test('a location can be shared from the sidebar while building popups no longer offer share', () => {
  assert.match(index, /id="shareMyLocationBtn"[\s\S]*?onclick="shareMyLocation\(\)"/);
  assert.match(index, /id="share-location-hint"/);
  assert.doesNotMatch(index, /onclick="shareBuilding\(/);
  assert.doesNotMatch(index, /function shareBuilding\(/);
});

test('shared-location links accept only coordinates in the University of Haifa area', () => {
  const context = vm.createContext({Number, String, isFinite});
  vm.runInContext(functionSource('parseSharedMeetLocation'), context);

  assert.deepEqual(
    {...context.parseSharedMeetLocation('32.761234,35.019876')},
    {lat:32.761234, lng:35.019876}
  );
  assert.equal(context.parseSharedMeetLocation('not-a-place'), null);
  assert.equal(context.parseSharedMeetLocation('31.9,35.019876'), null);
  assert.equal(context.parseSharedMeetLocation('32.761234,36.1'), null);
});

test('the location share link stores a precise one-time coordinate snapshot', () => {
  const context = vm.createContext({
    URL,
    Number,
    window:{location:{href:'https://hadeel-hamodi.github.io/CampusWay/index.html?old=1#map'}}
  });
  vm.runInContext(functionSource('sharedLocationLink'), context);
  const url = new URL(context.sharedLocationLink(32.76123449, 35.01987651));

  assert.equal(url.searchParams.get('meet'), '32.761234,35.019877');
  assert.equal(url.searchParams.get('old'), null);
  assert.equal(url.hash, '');
});

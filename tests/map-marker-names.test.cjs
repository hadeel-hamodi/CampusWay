const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {test} = require('node:test');

const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// The text of each L.marker(...) call, up to its closing bracket.
function markerCalls(){
  const calls = [];
  let from = 0;
  for(;;){
    const start = index.indexOf('L.marker(', from);
    if(start < 0) return calls;
    let depth = 0;
    let end = start + 'L.marker'.length;
    for(; end < index.length; end += 1){
      if(index[end] === '(') depth += 1;
      if(index[end] === ')' && --depth === 0) break;
    }
    const line = index.slice(0, start).split('\n').length;
    calls.push({line, text:index.slice(start, end + 1)});
    from = end;
  }
}

test('every map marker has a title, which screen readers announce as its name', () => {
  const calls = markerCalls();
  assert.ok(calls.length >= 10, 'markers found');
  const unnamed = calls.filter(call => !/\btitle\s*:/.test(call.text)).map(call => `index.html:${call.line}`);
  assert.deepEqual(unnamed, [], 'markers without a title');
});

test('marker titles become the accessible name, also after the icon changes', () => {
  assert.match(index, /L\.Marker\.prototype\._initIcon = function\(\)\{[\s\S]*?setAttribute\('aria-label', this\.options\.title\)/);
  assert.match(index, /function setMarkerName\(marker, name\)\{[\s\S]*?marker\.options\.title = name;[\s\S]*?setAttribute\('aria-label', name\)/);
});

test('marker names are refreshed when the language changes', () => {
  const start = index.indexOf('function applyLanguagePreference(');
  const body = index.slice(start, index.indexOf('\nfunction ', start + 10));
  assert.match(body, /refreshMarkerNames\(\)/);
  const refresh = index.slice(index.indexOf('function refreshMarkerNames(){'), index.indexOf('function shelterBuildings(){'));
  for(const group of ['buildingMarkers', 'restroomMarkers', 'gateMarkers', 'foodMarkers', 'shopMarkers', 'clinicMarkers', 'smokingMarkers', 'verticalMarkers', 'outdoorShelterMarker']){
    assert.ok(refresh.includes(group), `${group} renamed on language change`);
  }
});

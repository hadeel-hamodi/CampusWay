const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {test} = require('node:test');

const root = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const mainGraph = JSON.parse(fs.readFileSync(
  path.join(root, 'buildings', 'main', 'main-indoor-graph.json'),
  'utf8'
));

function between(source, start, end){
  const a = source.indexOf(start);
  const b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a, `missing ${start}`);
  return source.slice(a, b);
}

function searchHarness(extra = {}){
  const startSuggestions = {innerHTML:'', style:{display:'none'}};
  const calls = [];
  const context = vm.createContext({
    CAMPUS_DATA:{buildings:[
      {name:'Main Building', name_he:'בניין ראשי', lat:1, lng:2}
    ]},
    startSuggestions,
    lang:'en',
    t:{room:'Room', startNotMapped:'Starting point is not mapped.'},
    localizedBuildingName(building){return building.name;},
    localizedBuildingNameByEnglishName(name){return name;},
    customStart:null,
    selectedStartLocation:null,
    MAIN_GRAPH:mainGraph,
    pickStart(...args){calls.push(['building', ...args]);},
    pickIndoorStart(...args){calls.push(['room', ...args]);},
    alert(message){calls.push(['alert', message]);},
    ...extra
  });

  vm.runInContext(
    between(index, 'function normalizeLocationQuery', 'function pickStart('),
    context
  );
  vm.runInContext(
    between(index, 'function doStartSearch', "startInput.addEventListener('focus'"),
    context
  );

  return {context, calls, startSuggestions};
}

test('Starting From finds a connected Main room with bare and translated prefixes', () => {
  const h = searchHarness();
  for(const query of ['513', 'Room 513', 'غرفة 513', 'חדר 513']){
    const result = vm.runInContext(
      `getStartMatches(${JSON.stringify(query)})`,
      h.context
    );
    const main513 = result.roomMatches.filter(
      match => match.buildingKey === 'main' && String(match.node.label) === '513'
    );
    assert.equal(main513.length, 1, query);
  }
});

test('room search accepts a number and building name in either order and language', () => {
  const rabinGraph = {
    floors:{floor5:{
      nodes:[
        {id:'rabin_5013', label:'5013', type:'room'},
        {id:'rabin_corridor', label:'Corridor', type:'corridor'}
      ],
      connections:[{from:'rabin_5013', to:'rabin_corridor'}]
    }}
  };
  const h = searchHarness({
    CAMPUS_DATA:{buildings:[
      {name:'Main Building', name_he:'בניין ראשי', lat:1, lng:2},
      {name:'Rabin Building', name_he:'בניין רבין', lat:3, lng:4}
    ]},
    RABIN_GRAPH:rabinGraph
  });

  assert.equal(vm.runInContext("foldSearchText('٥٠١٣')", h.context), '5013');

  for(const query of [
    '5013 Rabin',
    'Rabin room 5013',
    'רבין ٥٠١٣',
    'مبنى رابين غرفة ٥٠١٣',
    'здание рабина аудитория ۵۰۱۳'
  ]){
    const result = vm.runInContext(
      `getStartMatches(${JSON.stringify(query)})`,
      h.context
    );
    assert.equal(
      result.roomMatches.filter(match => match.node.id === 'rabin_5013').length,
      1,
      query
    );
  }
});

test('Enter selects one exact mapped starting room', () => {
  const h = searchHarness();
  assert.equal(vm.runInContext("doStartSearch('Room 513')", h.context), true);
  assert.deepEqual(h.calls, [['room', 'floor500_n27', '513', 'main']]);
});

test('Enter keeps duplicate room numbers as explicit building choices', () => {
  const duplicateGraph = {
    floors:{floor5:{
      nodes:[
        {id:'rabin_513', label:'513', type:'room'},
        {id:'rabin_corridor', label:'Corridor', type:'corridor'}
      ],
      connections:[{from:'rabin_513', to:'rabin_corridor'}]
    }}
  };
  const h = searchHarness({RABIN_GRAPH:duplicateGraph});
  assert.equal(vm.runInContext("doStartSearch('513')", h.context), false);
  assert.equal(h.calls.length, 0);
  assert.equal(h.startSuggestions.style.display, 'block');
  assert.match(h.startSuggestions.innerHTML, /Main Building/);
  assert.match(h.startSuggestions.innerHTML, /Rabin Building/);
});

test('Starting From hides a room node that has no mapped connection', () => {
  const h = searchHarness();
  const result = vm.runInContext("getStartMatches('624')", h.context);
  assert.equal(
    result.roomMatches.some(match => String(match.node.label) === '624'),
    false
  );
  assert.equal(
    result.roomMatches.some(match => String(match.node.label) === '624/1'),
    true
  );
});

test('an unknown starting point does not silently select an old or default point', () => {
  const h = searchHarness();
  assert.equal(vm.runInContext("doStartSearch('not mapped')", h.context), false);
  assert.deepEqual(h.calls, []);
  assert.equal(h.startSuggestions.style.display, 'block');
  assert.match(h.startSuggestions.innerHTML, /Starting point is not mapped/);
});

test('an unmapped full room number is explained before longer partial matches', () => {
  const rabinGraph = {
    floors:{floor5:{
      nodes:[
        {id:'rabin_5013', label:'5013', type:'room'},
        {id:'rabin_corridor', label:'Corridor', type:'corridor'}
      ],
      connections:[{from:'rabin_5013', to:'rabin_corridor'}]
    }}
  };
  const h = searchHarness({RABIN_GRAPH:rabinGraph});
  assert.equal(vm.runInContext("doStartSearch('501')", h.context), false);
  assert.match(h.startSuggestions.innerHTML, /Starting point is not mapped/);
  assert.match(h.startSuggestions.innerHTML, /Room 5013/);
  assert.ok(
    h.startSuggestions.innerHTML.indexOf('Starting point is not mapped') <
      h.startSuggestions.innerHTML.indexOf('Room 5013')
  );
});

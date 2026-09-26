const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');

const root = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const navigation = fs.readFileSync(path.join(root, 'wayframe', 'navigation-demo.html'), 'utf8');
const outdoor = fs.readFileSync(path.join(root, 'app', 'prototype', 'outdoor-routing.js'), 'utf8');

function between(source, start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a, `missing ${start}`);
  return source.slice(a, b);
}

test('saved Mobility profile stays selected when profile buttons are rebuilt', () => {
  const storage = new Map([['accessibilityProfile', 'mobility']]);
  const profileList = { children: [], _html: '', appendChild(button) { this.children.push(button); } };
  Object.defineProperty(profileList, 'innerHTML', {
    get() { return this._html; },
    set(value) { this._html = value; if(value === '') this.children = []; }
  });
  const createButton = () => {
    const button = { className: '', dataset: {}, innerHTML: '', onclick: null };
    button.classList = {
      add(name) { if(!button.className.split(/\s+/).includes(name)) button.className += ` ${name}`; },
      remove(name) { button.className = button.className.split(/\s+/).filter(value => value && value !== name).join(' '); }
    };
    return button;
  };
  const document = {
    getElementById(id) { assert.equal(id, 'profileList'); return profileList; },
    createElement(type) { assert.equal(type, 'button'); return createButton(); },
    querySelectorAll() { return profileList.children; }
  };
  const context = vm.createContext({
    document,
    sessionStorage: {
      getItem(key) { return storage.get(key) ?? null; },
      setItem(key, value) { storage.set(key, value); }
    },
    t: { profiles: [
      {id:'general', label:'General', sub:'Fast'},
      {id:'mobility', label:'Mobility', sub:'No stairs'},
      {id:'visual', label:'Visual', sub:'Guide'},
      {id:'spatial', label:'Spatial', sub:'Simple'},
      {id:'mental', label:'Mental', sub:'Quiet'}
    ]},
    showAlert() {}, speak() {}, routeTo() {}, currentOutdoorDestination: null
  });
  const state = between(index, 'const PROFILE_IDS', 'let audioOn');
  const profiles = between(index, 'const ICONS =', 'function showAlert(');
  vm.runInContext(`${state}\n${profiles}`, context);
  vm.runInContext('buildProfiles()', context);
  assert.equal(vm.runInContext('currentProfile', context), 'mobility');
  assert.match(profileList.children.find(button => button.dataset.id === 'mobility').className, /active/);
  assert.doesNotMatch(profileList.children.find(button => button.dataset.id === 'general').className, /active/);

  vm.runInContext("t.profiles=t.profiles.map(profile=>({...profile,label:'AR '+profile.label})); buildProfiles()", context);
  assert.match(profileList.children.find(button => button.dataset.id === 'mobility').className, /active/);
});

test('outdoor Mobility route excludes OSM steps while a general route may use them', async () => {
  const data = { elements: [
    {type:'node', id:1, lat:32.7600, lon:35.0200},
    {type:'node', id:2, lat:32.7600, lon:35.0201},
    {type:'node', id:3, lat:32.7600, lon:35.0202},
    {type:'node', id:4, lat:32.7601, lon:35.0200},
    {type:'node', id:5, lat:32.7601, lon:35.0202},
    {type:'way', id:10, nodes:[1,2,3], tags:{highway:'steps'}},
    {type:'way', id:11, nodes:[1,4,5,3], tags:{highway:'footway'}}
  ] };
  const context = vm.createContext({
    fetch: async () => ({ok:true, json:async () => data}),
    console: {log() {}, warn() {}, error() {}}
  });
  vm.runInContext(`${outdoor};this.routing=CampusOutdoorRouting`, context);
  const general = await context.routing.route(32.7600, 35.0200, 32.7600, 35.0202);
  const accessible = await context.routing.route(32.7600, 35.0200, 32.7600, 35.0202, {avoidSteps:true});
  assert.ok(general.edges.some(edge => edge.type === 'steps'));
  assert.ok(accessible.edges.length > 0);
  assert.ok(accessible.edges.every(edge => edge.type !== 'steps'));
});

function indoorHarness(graph, accessible = true) {
  const elements = new Map();
  const element = id => {
    if(!elements.has(id)) elements.set(id, {
      value:'', checked:false, disabled:false, hidden:false,
      textContent:'', innerHTML:'', style:{}, dataset:{}
    });
    return elements.get(id);
  };
  element('accessibleRoute').checked = accessible;
  for(const id of ['fromFloor','toFloor']) element(id).value = id === 'fromFloor' ? 'floor1' : 'floor2';
  element('from').value = 'a';
  element('to').value = 'b';
  const context = vm.createContext({document:{getElementById:element}, console:{log(){}}, GRAPH:graph});
  const run = code => vm.runInContext(code, context);
  run(`
    const $=id=>document.getElementById(id);
    const ORDER=['floor1','floor2'];
    function allNodes(){return Object.values(GRAPH.floors).flatMap(f=>f.nodes||[])}
    function nodeById(id){return allNodes().find(node=>node.id===id)||null}
    function cid(n){const s=String(n.connectorId||'').trim();return (!s||['null','none','no','n/a'].includes(s.toLowerCase()))?'':s}
    function esc(value){return String(value)}
    const messages={noRoute:'No route yet',noRouteHelp:'Choose locations',routeNotFound:'No route found.',routeNotFoundHelp:'Try another route.',noAccessibleRoute:'No step-free route found.',noAccessibleRouteHelp:'Try another entrance.'};
    function it(key){return messages[key]||key}
    function localizedInstruction(en){return en}
    function resolveSelection(value){return value}
    function selectionLabel(value){return nodeById(value)?.label||value}
    function floorLabel(value){return value}
    function localizedFloor(value){return value}
    function localizedNodeLabel(value){return value}
    function followNode(){} function currentHeading(){return 0}
    function floorButtons(){} function drawBaseMap(){} function updateProgressUI(){}
    function updateDirectionControls(){} function stopNavigationMotion(){navigationActive=false}
    let routePath=['old'];
    let routeNodes=[{id:'old-stairs',type:'stairs',floor:'floor1',x:0,y:0},{id:'old-room',type:'room',floor:'floor2',x:1,y:1}];
    let progressIndex=1,progressT=.5,navigationActive=true,sensorFloorBoundary=true,followCamera=false,headingDeg=0;
  `);
  run(between(navigation, 'function buildGraph(){', 'function bestDestinationNode('));
  run(between(navigation, 'function describeRoute(){', 'function updateTurnInstruction(){'));
  return {run, element};
}

test('failed accessible route clears an older stair route and disables Start', () => {
  const graph = {floors:{
    floor1:{nodes:[
      {id:'a',label:'Entrance',type:'entrance',floor:'floor1',x:0,y:0},
      {id:'s1',label:'Stairs',type:'stairs',connectorId:'S',floor:'floor1',x:1,y:0}
    ],connections:[{from:'a',to:'s1'}]},
    floor2:{nodes:[
      {id:'s2',label:'Stairs',type:'stairs',connectorId:'S',floor:'floor2',x:1,y:0},
      {id:'b',label:'Room',type:'room',floor:'floor2',x:2,y:0}
    ],connections:[{from:'s2',to:'b'}]}
  }};
  const h = indoorHarness(graph, true);
  assert.equal(h.run('dijkstra("a","b")'), null);
  h.run('route()');
  assert.equal(h.run('routePath.length'), 0);
  assert.equal(h.run('routeNodes.length'), 0);
  assert.equal(h.run('navigationActive'), false);
  assert.equal(h.element('startBtn').disabled, true);
  assert.match(h.element('routeCard').innerHTML, /No step-free route found/);
});

test('accessible indoor route uses elevators and never stair nodes', () => {
  const graph = {floors:{
    floor1:{nodes:[
      {id:'a',type:'entrance',floor:'floor1',x:0,y:0},
      {id:'s1',type:'stairs',connectorId:'X',floor:'floor1',x:1,y:0},
      {id:'e1',type:'elevator',connectorId:'X',floor:'floor1',x:0,y:1}
    ],connections:[{from:'a',to:'s1'},{from:'a',to:'e1'}]},
    floor2:{nodes:[
      {id:'s2',type:'stairs',connectorId:'X',floor:'floor2',x:1,y:0},
      {id:'e2',type:'elevator',connectorId:'X',floor:'floor2',x:0,y:1},
      {id:'b',type:'room',floor:'floor2',x:0,y:2}
    ],connections:[{from:'s2',to:'b'},{from:'e2',to:'b'}]}
  }};
  const h = indoorHarness(graph, true);
  const pathIds = Array.from(h.run('dijkstra("a","b")'));
  assert.deepEqual(pathIds, ['a','e1','e2','b']);
  assert.ok(pathIds.every(id => h.run(`nodeById(${JSON.stringify(id)}).type`) !== 'stairs'));
});

test('current Madriga data reports no step-free route to floor minus one instead of using stairs', () => {
  const graphContext = vm.createContext({});
  const graphSource = fs.readFileSync(path.join(root, 'app', 'prototype', 'madriga-graph.js'), 'utf8');
  vm.runInContext(`${graphSource};this.graph=MADRIGA_GRAPH`, graphContext);
  const general = indoorHarness(graphContext.graph, false);
  const accessible = indoorHarness(graphContext.graph, true);
  const generalPath = Array.from(general.run('dijkstra("floor1_n49","floorminus1_n3")'));
  assert.ok(generalPath.some(id => general.run(`nodeById(${JSON.stringify(id)}).type`) === 'stairs'));
  assert.equal(accessible.run('dijkstra("floor1_n49","floorminus1_n3")'), null);
});

test('Mobility arriving indoors keeps the accessible option on and locked', () => {
  const accessible = {checked:false, disabled:false, title:''};
  const context = vm.createContext({
    sessionStorage:{getItem(key){return key === 'accessibilityProfile' ? 'mobility' : null;}},
    document:{getElementById(id){assert.equal(id,'accessibleRoute');return accessible;}},
    localizedInstruction(en){return en}
  });
  context.$ = id => context.document.getElementById(id);
  const initialization = between(navigation, '// Use accessibility profile selected in the main CampusWay app.', 'applyIndoorTranslations();');
  vm.runInContext(initialization, context);
  assert.equal(accessible.checked, true);
  assert.equal(accessible.disabled, true);
  assert.match(accessible.title, /stair-free/);
});

test('Mobility outdoor failure does not draw the unverified fallback path', async () => {
  const elements = new Map();
  const element = id => {
    if(!elements.has(id)) elements.set(id, {
      textContent:'', style:{}, dataset:{},
      classList:{add(name){this.added=name;}}
    });
    return elements.get(id);
  };
  const calls = [];
  const context = vm.createContext({
    document:{getElementById:element},
    sessionStorage:{removeItem(){}},
    CampusOutdoorRouting:{
      async route(...args){calls.push(args);return null;},
      distance(){return 0;}
    },
    map:{removeLayer(){},fitBounds(){},closePopup(){}},
    L:{polyline(){throw new Error('fallback path must not be drawn for Mobility');}},
    window:{}, console:{error(){},warn(){}},
    getStart(){return {lat:1,lng:2,label:'Start'};},
    localizedBuildingNameByEnglishName(name){return name;},
    speak(){},
    t:{noAccessibleRoute:'No step-free outdoor route found.',noAccessibleRouteHelp:'Try another point.'},
    currentProfile:'mobility', routeLine:null, keepIndoorContextForCurrentRoute:false,
    currentOutdoorDestination:null, outdoorRouteRequestId:0,
    clearInterval() {}
  });
  vm.runInContext(between(index, 'async function routeTo(', 'function closeRoute(){'), context);
  await vm.runInContext("routeTo('Main Building',3,4)", context);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][4].avoidSteps, true);
  assert.match(element('routeTitle').textContent, /No step-free/);
  assert.equal(element('routeEta').textContent, '—');
  assert.equal(element('routeCard').classList.added, 'show');
});

test('changing the start retries a saved destination even when no route line was drawn', () => {
  const calls = [];
  let scheduled = null;
  const elements = new Map();
  const element = id => {
    if(!elements.has(id)) elements.set(id, {value:'',classList:{remove(){}}});
    return elements.get(id);
  };
  const marker = {addTo(){return this;},bindPopup(){return this;},openPopup(){return this;}};
  const context = vm.createContext({
    document:{getElementById:element},
    L:{circleMarker(){return marker;}},
    map:{flyTo(){},removeLayer(){}},
    setTimeout(callback){scheduled=callback;},
    routeTo(...args){calls.push(args);},
    customStart:null, gpsMarker:null, routeLine:null,
    startSuggestions:{style:{}},
    currentOutdoorDestination:{name:'Main Building',lat:3,lng:4,keepIndoorContext:true}
  });
  vm.runInContext(between(index, 'function pickStart(', "document.getElementById('startInput').addEventListener"), context);
  vm.runInContext("pickStart('New Start',1,2)", context);
  assert.equal(typeof scheduled, 'function');
  scheduled();
  assert.equal(JSON.stringify(calls), JSON.stringify([['Main Building',3,4,{keepIndoorContext:true}]]));

  calls.length = 0;
  vm.runInContext("currentOutdoorDestination={name:'Main Building',lat:3,lng:4,keepIndoorContext:true}; pickStart('Later Start',5,6)", context);
  vm.runInContext("currentOutdoorDestination={name:'Rabin Building',lat:7,lng:8,keepIndoorContext:false}", context);
  scheduled();
  assert.equal(calls.length, 0);
});

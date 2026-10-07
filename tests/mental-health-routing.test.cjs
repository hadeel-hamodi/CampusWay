const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');

const root = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const CampusRoutePlanner = require('../wayframe/route-planner.js');

function between(source, start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a, `missing ${start}`);
  return source.slice(a, b);
}

test('Mental Health service finds a connected Student House landmark', () => {
  const graph = {floors:{floor0:{nodes:[
    {id:'entrance',type:'entrance',label:'Entrance',floor:'floor0',x:0,y:0},
    {id:'disconnected',type:'landmark',label:'Node 40',floor:'floor0',x:.1,y:.1},
    {id:'terrace',type:'landmark',label:'Node 41',floor:'floor0',x:.2,y:.2}
  ],connections:[{from:'entrance',to:'terrace'}]}}};
  let selected = null;
  const context = vm.createContext({
    STUDENT_GRAPH:graph,
    currentProfile:'mental',
    CAMPUS_DATA:{buildings:[{name:'Student House',lat:32.76,lng:35.02}]},
    BUILDING_ENTRANCES:{student:[{nodeId:'entrance'}]},
    CampusRoutePlanner,
    customStart:null,
    t:{suggestedRestSpace:'Suggested rest space',noRestSpace:'No rest space'},
    getStart(){return {lat:32.76,lng:35.02};},
    buildIndoorEtaGraph(value){
      const nodes=Object.values(value.floors).flatMap(floor=>floor.nodes||[]);
      const byId=new Map(nodes.map(node=>[node.id,node]));
      const adjacency=new Map(nodes.map(node=>[node.id,[]]));
      for(const floor of Object.values(value.floors)){
        for(const edge of (floor.connections||[])){
          adjacency.get(edge.from).push({id:edge.to});
          adjacency.get(edge.to).push({id:edge.from});
        }
      }
      return {byId,adjacency};
    },
    routeToIndoorService(match){selected=match;},
    alert(message){throw new Error(message);}
  });
  vm.runInContext(
    between(index, 'function findNearbyIndoorService(type){', 'function routeToIndoorService(match){'),
    context
  );
  vm.runInContext("findNearbyIndoorService('rest-space')", context);
  assert.equal(selected.buildingKey, 'student');
  assert.equal(selected.node.id, 'terrace');
  assert.equal(selected.displayLabel, 'Suggested rest space');
});

test('mapped Student House landmarks are available as real rest-space candidates', () => {
  const studentGraph = JSON.parse(fs.readFileSync(
    path.join(root, 'buildings', 'student', 'student-indoor-graph.json'),
    'utf8'
  ));
  const context = vm.createContext({
    CampusRoutePlanner,
    STUDENT_GRAPH:studentGraph,
    currentProfile:'mental',
    customStart:null,
    t:{suggestedRestSpace:'Suggested rest space',noRestSpace:'No rest space'},
    getStart(){return {lat:32.76179,lng:35.02131};},
    alert(message){throw new Error(message);}
  });
  const sources = fs.readFileSync(
    path.join(root, 'app', 'prototype', 'data.js'),
    'utf8'
  );
  const etaGraphHelpers = between(
    index,
    'function indoorEtaNodes(graph){',
    'function findIndoorEtaPath('
  );
  vm.runInContext(`${sources}\n${etaGraphHelpers}`, context);
  vm.runInContext(
    between(index, 'function findNearbyIndoorService(type){', 'function routeToIndoorService(match){'),
    context
  );
  vm.runInContext('this.selected=null;function routeToIndoorService(match){this.selected=match;}', context);
  vm.runInContext("findNearbyIndoorService('rest-space')", context);
  const selected = context.selected;
  assert.equal(selected.buildingKey, 'student');
  assert.equal(selected.node.type, 'landmark');
  assert.ok(['floor0_n41','floor1_n40','floor2_n49','floor3_n44','floor4_n4'].includes(selected.node.id));
});

test('rest-space journey stores an honest display label and semantic type', () => {
  const stored = new Map();
  const searchInput = {value:''};
  let routed = null;
  const context = vm.createContext({
    sessionStorage:{setItem(key,value){stored.set(key,value);}},
    document:{getElementById(id){assert.equal(id,'searchInput');return searchInput;}},
    searchSuggestions:{style:{}},
    localizedBuildingName(building){return building.name;},
    routeTo(...args){routed=args;}
  });
  vm.runInContext(
    between(index, 'function routeToIndoorService(match){', 'async function findNearbyService(type){'),
    context
  );
  vm.runInContext(`routeToIndoorService({
    node:{id:'floor0_n41',type:'landmark',label:'Node 41'},
    serviceType:'rest-space',
    displayLabel:'Suggested rest space',
    buildingKey:'student',
    building:{name:'Student House',lat:1,lng:2}
  })`, context);
  const saved = JSON.parse(stored.get('indoorContext'));
  assert.equal(saved.destinationType, 'rest-space');
  assert.equal(saved.destinationLabel, 'Suggested rest space');
  assert.equal(saved.destinationDisplayLabel, 'Suggested rest space');
  assert.equal(searchInput.value, 'Suggested rest space — Student House');
  assert.deepEqual(Array.from(routed.slice(0,3)), ['Student House',1,2]);
  assert.equal(routed[3].keepIndoorContext, true);
});

test('same-building rest-space title is not presented as a room', () => {
  const context = vm.createContext({
    name:'Student House',
    sameBuilding:true,
    startLabel:'Room 101',
    lang:'en',
    t:{room:'Room'},
    sessionStorage:{
      getItem(key){
        assert.equal(key, 'indoorContext');
        return JSON.stringify({
          destinationLabel:'Suggested rest space',
          destinationType:'rest-space'
        });
      }
    },
    localizedBuildingNameByEnglishName(value){return value;}
  });
  const titleLogic = between(
    index,
    'const isRestroomRoute =',
    "  document.getElementById('routeTitle')"
  );
  vm.runInContext(`${titleLogic}\nthis.result=displayDestination`, context);
  assert.equal(context.result, 'Suggested rest space');
});

test('all profiles keep the service order and leaf icon, with Rest Spaces for Mental', () => {
  const originalOrder = [
    'serviceRestroomBtn',
    'serviceFoodBtn',
    'serviceShopBtn',
    'serviceClinicBtn',
    'serviceGymBtn',
    'serviceLibraryBtn',
    'landmarkServiceBtn',
    'serviceSmokingBtn'
  ];

  const grid = {
    children: [],
    appendChild(button){
      this.children = this.children.filter(item => item !== button);
      this.children.push(button);
      button.parentElement = this;
    }
  };

  const elements = {
    landmarkServiceIcon: {textContent:''},
    'lbl-service-landmarks': {textContent:''}
  };

  for(const id of originalOrder){
    const button = {id, title:'', parentElement:grid};
    elements[id] = button;
    grid.children.push(button);
  }

  const context = vm.createContext({
    currentProfile:'mental',
    lang:'en',
    t:{
      serviceRestSpaces:'Rest Spaces',
      serviceLandmarks:'Quiet Spaces'
    },
    updateMentalBreakControls(){},
    document:{
      getElementById(id){return elements[id];}
    }
  });

  vm.runInContext(
    between(
      index,
      'function updateRestSpaceServiceButton(){',
      'function applyTranslations(){'
    ),
    context
  );

  for(const profile of ['mental', 'general', 'mobility', 'visual', 'spatial']){
    context.currentProfile = profile;
    vm.runInContext('updateRestSpaceServiceButton()', context);

      const expectedLabel =
      profile === 'mental' ? 'Rest Spaces' : 'Quiet spaces';

    assert.equal(elements.landmarkServiceIcon.textContent, '🌿');
    assert.equal(
      elements['lbl-service-landmarks'].textContent,
      expectedLabel
    );
    assert.equal(elements.landmarkServiceBtn.title, expectedLabel);
    assert.deepEqual(
      grid.children.map(button => button.id),
      originalOrder
    );
  }
});
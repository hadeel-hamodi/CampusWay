// ============================================================
// CampusWay — Indoor Navigation Logic
// Real routing logic for the Terrace Building / Madriga
//
// The actual WayFrame graph is stored separately in:
// madriga-graph.js
// ============================================================


// ------------------------------------------------------------
// BUILDING CONNECTION
// ------------------------------------------------------------

const INDOOR_BUILDINGS = {
  'Terrace Building': {
    displayName: 'Terrace Building',
    hebrewName: 'בניין מדרגה',

    /*
      This node is where outdoor navigation hands off
      to indoor navigation.

      We can change this later if we determine that another
      entrance node is the correct main entrance.
    */
    entranceNodeId: 'floor1_n49',

    graph: () => MADRIGA_GRAPH
  }
};


// ------------------------------------------------------------
// BASIC HELPERS
// ------------------------------------------------------------

function getIndoorGraph(buildingName = 'Terrace Building') {
  const building = INDOOR_BUILDINGS[buildingName];

  if (!building) {
    console.error('Unknown indoor building:', buildingName);
    return null;
  }

  return building.graph();
}


function getAllIndoorNodes(buildingName = 'Terrace Building') {
  const graph = getIndoorGraph(buildingName);

  if (!graph || !graph.floors) {
    return [];
  }

  return Object.values(graph.floors)
    .flatMap(floor => floor.nodes || []);
}


function getIndoorNodeById(
  nodeId,
  buildingName = 'Terrace Building'
) {
  return (
    getAllIndoorNodes(buildingName)
      .find(node => node.id === nodeId) || null
  );
}


function getFloorLabel(floorId) {
  if (floorId === 'floorminus1') {
    return '-1';
  }

  return String(floorId).replace('floor', '');
}


// ------------------------------------------------------------
// USER-FACING DESTINATIONS
// ------------------------------------------------------------

/*
  We intentionally DO NOT expose:
  - corridor nodes
  - staircase nodes
  - individual elevator graph nodes

  Those are routing infrastructure, not things the user
  should have to search through.
*/

function getIndoorDestinations(
  buildingName = 'Terrace Building'
) {
  const graph = getIndoorGraph(buildingName);

  if (!graph) {
    return [];
  }

  const destinations = [];

  for (const [floorId, floor] of Object.entries(graph.floors)) {

    for (const node of floor.nodes || []) {

      if (
        node.type === 'room' ||
        node.type === 'restroom' ||
        node.type === 'landmark' ||
        node.type === 'entrance'
      ) {
        destinations.push({
          id: node.id,
          label: node.label,
          type: node.type,
          floor: floorId,
          floorLabel: getFloorLabel(floorId),
          building: buildingName
        });
      }
    }

  }

  return destinations;
}


// ------------------------------------------------------------
// DESTINATIONS FOR ONE FLOOR ONLY
// ------------------------------------------------------------

function getIndoorDestinationsForFloor(
  floorId,
  buildingName = 'Terrace Building'
) {
  return getIndoorDestinations(buildingName)
    .filter(destination => destination.floor === floorId)
    .sort((a, b) => {

      // Rooms first
      const priority = {
        room: 0,
        restroom: 1,
        landmark: 2,
        entrance: 3
      };

      const pa = priority[a.type] ?? 9;
      const pb = priority[b.type] ?? 9;

      if (pa !== pb) {
        return pa - pb;
      }

      return a.label.localeCompare(
        b.label,
        undefined,
        { numeric: true }
      );
    });
}


// ------------------------------------------------------------
// CONNECTOR HELPERS
// ------------------------------------------------------------

function cleanConnectorId(node) {
  const value = String(node.connectorId || '').trim();

  if (!value) {
    return '';
  }

  if (
    ['null', 'none', 'no', 'n/a']
      .includes(value.toLowerCase())
  ) {
    return '';
  }

  return value;
}


// ------------------------------------------------------------
// BUILD COMPLETE MULTI-FLOOR GRAPH
// ------------------------------------------------------------

function buildIndoorRoutingGraph(
  buildingName = 'Terrace Building'
) {
  const graph = getIndoorGraph(buildingName);

  if (!graph) {
    return null;
  }

  const nodes = getAllIndoorNodes(buildingName);

  const byId = new Map(
    nodes.map(node => [node.id, node])
  );

  const adjacency = new Map(
    nodes.map(node => [node.id, []])
  );


  // ----------------------------------------------------------
  // SAME-FLOOR WALKING CONNECTIONS
  // ----------------------------------------------------------

  for (const floor of Object.values(graph.floors)) {

    for (const connection of floor.connections || []) {

      const from = byId.get(connection.from);
      const to = byId.get(connection.to);

      if (!from || !to) {
        continue;
      }

      /*
        WayFrame coordinates are normalized between 0–1.

        Euclidean distance is sufficient for choosing shortest
        paths because every node uses the same coordinate system
        within a floor.
      */

      const distance = Math.hypot(
        from.x - to.x,
        from.y - to.y
      );

      adjacency.get(from.id).push({
        id: to.id,
        weight: distance,
        type: 'walk'
      });

      adjacency.get(to.id).push({
        id: from.id,
        weight: distance,
        type: 'walk'
      });

    }

  }


  // ----------------------------------------------------------
  // GROUP STAIRS / ELEVATORS BY CONNECTOR ID
  // ----------------------------------------------------------

  const connectors = new Map();

  for (const node of nodes) {

    if (
      node.type !== 'stairs' &&
      node.type !== 'elevator'
    ) {
      continue;
    }

    const connectorId = cleanConnectorId(node);

    if (!connectorId) {
      continue;
    }

    const key =
      `${node.type}:${connectorId}`;

    if (!connectors.has(key)) {
      connectors.set(key, new Map());
    }

    const floors = connectors.get(key);

    if (!floors.has(node.floor)) {
      floors.set(node.floor, []);
    }

    floors
      .get(node.floor)
      .push(node);
  }


  // ----------------------------------------------------------
  // CONNECT FLOORS
  // ----------------------------------------------------------

  const floorOrder = [
    'floorminus1',
    'floor0',
    'floor1',
    'floor2',
    'floor3',
    'floor4'
  ];


  for (const [connectorKey, floors] of connectors) {

    const sortedFloors =
      [...floors.keys()]
        .sort(
          (a, b) =>
            floorOrder.indexOf(a) -
            floorOrder.indexOf(b)
        );


    for (
      let i = 0;
      i < sortedFloors.length - 1;
      i++
    ) {

      const floorA = sortedFloors[i];
      const floorB = sortedFloors[i + 1];

      const nodesA = floors.get(floorA);
      const nodesB = floors.get(floorB);

      if (!nodesA?.length || !nodesB?.length) {
        continue;
      }

      /*
        Normally there should be one cross-floor connector
        for this connector ID on each floor.

        Using .at(-1) also prevents accidentally connecting
        every stair node if an old duplicate remains.
      */

      const nodeA = nodesA.at(-1);
      const nodeB = nodesB.at(-1);


      /*
        Small transition weight.

        The exact number is not physical walking distance yet.
        It merely prevents floor transitions from costing zero.
      */

      const weight =
        connectorKey.startsWith('elevator:')
          ? 0.02
          : 0.04;


      adjacency.get(nodeA.id).push({
        id: nodeB.id,
        weight,
        type: 'vertical'
      });

      adjacency.get(nodeB.id).push({
        id: nodeA.id,
        weight,
        type: 'vertical'
      });

    }

  }


  return {
    nodes,
    byId,
    adjacency
  };
}


// ------------------------------------------------------------
// DIJKSTRA
// ------------------------------------------------------------

function findIndoorRoute(
  startNodeId,
  destinationNodeId,
  buildingName = 'Terrace Building',
  accessibilityProfile = 'general'
) {

  const routing =
    buildIndoorRoutingGraph(buildingName);

  if (!routing) {
    return null;
  }

  const {
    byId,
    adjacency
  } = routing;


  if (
    !byId.has(startNodeId) ||
    !byId.has(destinationNodeId)
  ) {
    console.error(
      'Indoor route contains unknown node.',
      startNodeId,
      destinationNodeId
    );

    return null;
  }


  const distances = new Map();

  const previous = new Map();

  const unvisited = new Set();


  for (const id of byId.keys()) {

    distances.set(id, Infinity);

    unvisited.add(id);

  }


  distances.set(
    startNodeId,
    0
  );


  while (unvisited.size) {

    let current = null;

    let bestDistance = Infinity;


    for (const id of unvisited) {

      const distance =
        distances.get(id);

      if (distance < bestDistance) {

        bestDistance = distance;

        current = id;

      }

    }


    if (
      current === null ||
      bestDistance === Infinity
    ) {
      break;
    }


    if (current === destinationNodeId) {
      break;
    }


    unvisited.delete(current);


    for (
      const edge of
      adjacency.get(current) || []
    ) {

      if(accessibilityProfile === 'mobility'){

  const nextNode =
    byId.get(edge.id);

  const currentNode =
    byId.get(current);

  if(
    nextNode?.type === 'stairs' ||
    currentNode?.type === 'stairs'
  ){
    continue;
  }

}

      if (!unvisited.has(edge.id)) {
        continue;
      }


      const candidate =
        bestDistance +
        edge.weight;


      if (
        candidate <
        distances.get(edge.id)
      ) {

        distances.set(
          edge.id,
          candidate
        );

        previous.set(
          edge.id,
          current
        );

      }

    }

  }


  if (
    distances.get(destinationNodeId) ===
    Infinity
  ) {
    return null;
  }


  // ----------------------------------------------------------
  // RECONSTRUCT PATH
  // ----------------------------------------------------------

  const pathIds = [];

  let current =
    destinationNodeId;


  while (current !== undefined) {

    pathIds.unshift(current);


    if (current === startNodeId) {
      break;
    }


    current =
      previous.get(current);

  }


  if (
    pathIds[0] !==
    startNodeId
  ) {
    return null;
  }


  return pathIds
    .map(id => byId.get(id))
    .filter(Boolean);
}


// ------------------------------------------------------------
// ROUTE FROM BUILDING ENTRANCE
// ------------------------------------------------------------

function routeFromBuildingEntrance(
  destinationNodeId,
  buildingName = 'Terrace Building'
) {

  const building =
    INDOOR_BUILDINGS[buildingName];


  if (!building) {
    return null;
  }


  return findIndoorRoute(
    building.entranceNodeId,
    destinationNodeId,
    buildingName
  );
}


// ------------------------------------------------------------
// FLOOR TRANSITIONS FOR TURN-BY-TURN DIRECTIONS
// ------------------------------------------------------------

function getIndoorFloorTransitions(route) {

  if (!route?.length) {
    return [];
  }


  const transitions = [];


  for (
    let i = 1;
    i < route.length;
    i++
  ) {

    const previous =
      route[i - 1];

    const current =
      route[i];


    if (
      previous.floor !==
      current.floor
    ) {

      const method =
        previous.type === 'elevator' ||
        current.type === 'elevator'
          ? 'elevator'
          : 'stairs';


      transitions.push({

        fromFloor:
          previous.floor,

        toFloor:
          current.floor,

        method,

        fromNode:
          previous,

        toNode:
          current

      });

    }

  }


  return transitions;
}


// ------------------------------------------------------------
// DEBUGGING
// ------------------------------------------------------------

function debugIndoorGraph() {

  const graph =
    getIndoorGraph();


  if (!graph) {
    console.error(
      'Madriga graph not loaded.'
    );

    return;
  }


  console.log(
    'CampusWay indoor graph loaded:',
    graph
  );


  console.log(
    'Floors:',
    Object.keys(graph.floors)
  );


  console.log(
    'Nodes:',
    getAllIndoorNodes().length
  );


  console.log(
    'User destinations:',
    getIndoorDestinations().length
  );

}
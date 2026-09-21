const CampusOutdoorRouting = (() => {

  // University of Haifa / Mount Carmel routing area
  const BOUNDS = {
    south: 32.7570,
    west: 35.0140,
    north: 32.7680,
    east: 35.0250
  };

  // Lower cost = preferred walking route
  const TYPE_COST = {
    footway: 1.00,
    pedestrian: 1.00,
    path: 1.05,
    living_street: 1.20,
    steps: 1.30,
    service: 2.50,
    residential: 3.00
  };

  const graph = new Map();
  const coordinates = new Map();

  let loaded = false;
  let loadingPromise = null;

  // --------------------------------------------------
// CampusWay outdoor graph corrections
// --------------------------------------------------

// Verified missing walkway connections can be added here.
// Keep this empty until a connection has been confirmed.
const CAMPUS_CORRECTIONS = [
  {
    fromNode: 2102963372,
    toNode: 1446999286,
    type: 'footway'
  }
];

  // --------------------------------------------------
  // Distance between two GPS coordinates in meters
  // --------------------------------------------------

  function distance(a, b) {

    const R = 6371000;

    const lat1 = a[0] * Math.PI / 180;
    const lat2 = b[0] * Math.PI / 180;

    const dLat =
      (b[0] - a[0]) * Math.PI / 180;

    const dLon =
      (b[1] - a[1]) * Math.PI / 180;

    const x =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(dLon / 2) ** 2;

    return R * 2 * Math.atan2(
      Math.sqrt(x),
      Math.sqrt(1 - x)
    );
  }


  // --------------------------------------------------
  // Add connection between two OSM nodes
  // --------------------------------------------------

  function addEdge(aId, bId, type) {

    if(
      !coordinates.has(aId) ||
      !coordinates.has(bId)
    ){
      return;
    }

    if(!graph.has(aId)){
      graph.set(aId, []);
    }

    if(!graph.has(bId)){
      graph.set(bId, []);
    }

    const a = coordinates.get(aId);
    const b = coordinates.get(bId);

    const meters = distance(a, b);

    const multiplier =
      TYPE_COST[type] || 2;

    graph.get(aId).push({
      node: bId,
      weight: meters * multiplier,
      meters,
      type
    });

    graph.get(bId).push({
      node: aId,
      weight: meters * multiplier,
      meters,
      type
    });
  }

function removeEdge(aId, bId){

  if(graph.has(aId)){
    graph.set(
      aId,
      graph.get(aId).filter(
        edge => edge.node !== bId
      )
    );
  }

  if(graph.has(bId)){
    graph.set(
      bId,
      graph.get(bId).filter(
        edge => edge.node !== aId
      )
    );
  }
}
  
  
  function addCampusNode(id, lat, lng){

  coordinates.set(
    id,
    [lat, lng]
  );

  if(!graph.has(id)){
    graph.set(id, []);
  }
}

function findClosestEdge(lat, lng){

  const point = [lat, lng];

  let best = null;
  let bestDistance = Infinity;

  const checked = new Set();

  for(const [nodeA, edges] of graph.entries()){

    const a = coordinates.get(nodeA);
    if(!a) continue;

  for(const edge of edges){

  const nodeB = edge.node;

  // Ignore CampusWay custom correction edges.
  // We only want to find the original OSM path underneath the point.
  if(
    String(nodeA).startsWith('campus_') ||
    String(nodeB).startsWith('campus_')
  ){
    continue;
  }

      const key = [String(nodeA), String(nodeB)]
        .sort()
        .join('-');

      if(checked.has(key)){
        continue;
      }

      checked.add(key);

      const b = coordinates.get(nodeB);
      if(!b) continue;

      // Approximate locally as a flat plane.
      const x = point[1];
      const y = point[0];

      const x1 = a[1];
      const y1 = a[0];

      const x2 = b[1];
      const y2 = b[0];

      const dx = x2 - x1;
      const dy = y2 - y1;

      const lengthSquared =
        dx * dx + dy * dy;

      if(lengthSquared === 0){
        continue;
      }

      let t =
        ((x - x1) * dx +
         (y - y1) * dy) /
        lengthSquared;

      t = Math.max(0, Math.min(1, t));

      const projected = [
        y1 + t * dy,
        x1 + t * dx
      ];

      const d =
        distance(point, projected);

      if(d < bestDistance){

        bestDistance = d;

        best = {
          nodeA,
          nodeB,
          coordinateA: a,
          coordinateB: b,
          projectedCoordinate: projected,
          distanceMeters: d,
          type: edge.type
        };
      }
    }
  }

  return best;
}

  // --------------------------------------------------
// Apply verified CampusWay corrections to OSM graph
// --------------------------------------------------

function applyCampusCorrections(){

   addCampusNode(
  'campus_crossing_1',
  32.75965118924193,
  35.020708607441215
);

// Split the existing OSM segment at the exact
// CampusWay crossing point.
removeEdge(
  1447013833,
  1447013832
);

addEdge(
  1447013833,
  'campus_crossing_1',
  'service'
);

addEdge(
  'campus_crossing_1',
  1447013832,
  'service'
);

// CampusWay pedestrian crossing
addEdge(
  1446999294,
  'campus_crossing_1',
  'footway'
);


  for(const correction of CAMPUS_CORRECTIONS){

    const {
      fromNode,
      toNode,
      type = 'footway'
    } = correction;

    if(
      !coordinates.has(fromNode) ||
      !coordinates.has(toNode)
    ){
      console.warn(
        'CampusWay correction references missing OSM node:',
        correction
      );

      continue;
    }

    addEdge(
      fromNode,
      toNode,
      type
    );
  }
}

  // --------------------------------------------------
  // Find closest OSM routing node
  // --------------------------------------------------

  function nearestNode(lat, lon) {

    let best = null;
    let bestDistance = Infinity;

    const point = [lat, lon];

    for(const [id, coord] of coordinates.entries()){

      if(!graph.has(id)){
        continue;
      }

      const d = distance(point, coord);

      if(d < bestDistance){
        bestDistance = d;
        best = id;
      }
    }

    return best;
  }

  function inspectNearestNode(lat, lon){

  const node = nearestNode(lat, lon);

  if(node === null){
    return null;
  }

  const result = {
    node,
    coordinate: coordinates.get(node),
    distanceMeters: distance(
      [lat, lon],
      coordinates.get(node)
    ),
    connections: graph.get(node) || []
  };

  console.log('Nearest outdoor routing node:', result);

  return result;
}

  function connectedComponent(startNode){

  const visited = new Set();
  const queue = [startNode];

  while(queue.length){

    const current = queue.shift();

    if(visited.has(current)){
      continue;
    }

    visited.add(current);

    for(const edge of graph.get(current) || []){

      if(!visited.has(edge.node)){
        queue.push(edge.node);
      }
    }
  }

  return visited;
}
function getDebugGraph(){

  const nodes = [];

  for(const [id, coord] of coordinates.entries()){

    if(!graph.has(id)){
      continue;
    }

    nodes.push({
      id,
      coordinate: coord,
      connections: graph.get(id).map(edge => ({
        node: edge.node,
        type: edge.type
      }))
    });
  }

  return nodes;
}

function closestNodesBetweenComponents(componentA, componentB){

  let best = null;
  let bestDistance = Infinity;

  for(const nodeA of componentA){

    const coordA = coordinates.get(nodeA);

    if(!coordA) continue;

    for(const nodeB of componentB){

      const coordB = coordinates.get(nodeB);

      if(!coordB) continue;

      const d = distance(coordA, coordB);

      if(d < bestDistance){

        bestDistance = d;

        best = {
          nodeA,
          coordinateA: coordA,
          nodeB,
          coordinateB: coordB,
          distanceMeters: d
        };
      }
    }
  }

  return best;
}

  // --------------------------------------------------
  // Dijkstra
  // --------------------------------------------------

 function shortestPath(start, end) {

    const distances = new Map();
    const previous = new Map();
    const previousEdge = new Map();

    const unvisited =
      new Set(graph.keys());

    for(const node of graph.keys()){
      distances.set(node, Infinity);
    }

    distances.set(start, 0);

    while(unvisited.size){

      let current = null;
      let currentDistance = Infinity;

      for(const node of unvisited){

        const d = distances.get(node);

        if(d < currentDistance){
          current = node;
          currentDistance = d;
        }
      }

      if(
        current === null ||
        currentDistance === Infinity
      ){
        break;
      }

      if(current === end){
        break;
      }

      unvisited.delete(current);
for(const edge of graph.get(current) || []){

  if(!unvisited.has(edge.node)){
    continue;
  }


        const alt =
          currentDistance +
          edge.weight;

        if(alt < distances.get(edge.node)){

          distances.set(
            edge.node,
            alt
          );

          previous.set(
            edge.node,
            current
          );

          previousEdge.set(
            edge.node,
            edge
          );
        }
      }
    }

    if(
      start !== end &&
      !previous.has(end)
    ){
      return null;
    }

    const nodes = [];
    const edges = [];

    let current = end;

    nodes.push(current);

    while(current !== start){

      const edge =
        previousEdge.get(current);

      const previousNode =
        previous.get(current);

      if(!edge || !previousNode){
        return null;
      }

      edges.push(edge);

      current = previousNode;

      nodes.push(current);
    }

    nodes.reverse();
    edges.reverse();

    const realDistance =
      edges.reduce(
        (sum, edge) =>
          sum + edge.meters,
        0
      );

    return {
      nodes,
      edges,
      distance: realDistance
    };
  }


  // --------------------------------------------------
  // Load pedestrian network from OpenStreetMap
  // --------------------------------------------------

  function load(){

    if(loaded){
      return Promise.resolve();
    }

    if(loadingPromise){
      return loadingPromise;
    }

    const query = `
[out:json][timeout:25];

(
  way["highway"~"^(footway|path|pedestrian|steps|living_street)$"]
    (${BOUNDS.south},${BOUNDS.west},${BOUNDS.north},${BOUNDS.east});

  way["highway"="service"]["foot"!~"^(no|private)$"]
    (${BOUNDS.south},${BOUNDS.west},${BOUNDS.north},${BOUNDS.east});

  way["highway"="residential"]["foot"!~"^(no|private)$"]
    (${BOUNDS.south},${BOUNDS.west},${BOUNDS.north},${BOUNDS.east});
);

out body;
>;
out skel qt;
`;

    const url =
      'https://overpass-api.de/api/interpreter?data=' +
      encodeURIComponent(query);

    loadingPromise =
      fetch(url)

        .then(response => {

          if(!response.ok){
            throw new Error(
              'Overpass returned HTTP ' +
              response.status
            );
          }

          return response.json();
        })

        .then(data => {

          graph.clear();
          coordinates.clear();

          const ways =
            data.elements.filter(
              element =>
                element.type === 'way'
            );

          const nodes =
            data.elements.filter(
              element =>
                element.type === 'node'
            );

          nodes.forEach(node => {

            coordinates.set(
              node.id,
              [node.lat, node.lon]
            );

          });

          ways.forEach(way => {

            if(
              !Array.isArray(way.nodes) ||
              way.nodes.length < 2
            ){
              return;
            }

            const type =
              way.tags?.highway ||
              'unknown';

            for(
              let i = 0;
              i < way.nodes.length - 1;
              i++
            ){

              addEdge(
                way.nodes[i],
                way.nodes[i + 1],
                type
              );
            }
          });

          applyCampusCorrections();

          loaded = true;

          console.log(
            `Campus outdoor routing loaded: ${ways.length} walkways / ${graph.size} routing nodes`
          );
        })

        .catch(error => {

          loadingPromise = null;

          console.error(
            'Campus outdoor routing failed:',
            error
          );

          throw error;
        });

    return loadingPromise;
  }


  // --------------------------------------------------
  // Public route function
  // --------------------------------------------------

async function route(
  startLat,
  startLng,
  endLat,
  endLng
){

    await load();

    const startNode =
      nearestNode(
        startLat,
        startLng
      );

    const endNode =
      nearestNode(
        endLat,
        endLng
      );

    if(
      startNode === null ||
      endNode === null
    ){
      return null;
    }

const result =
  shortestPath(
    startNode,
    endNode
  );

if(!result){

  const startComponent =
    connectedComponent(startNode);

  const endComponent =
    connectedComponent(endNode);

    const closestGap =
  closestNodesBetweenComponents(
    startComponent,
    endComponent
  );

  console.warn(
    'No connected OSM route found',
    {
      startNode,
      startCoordinate: coordinates.get(startNode),
      startComponentSize: startComponent.size,

      endNode,
      endCoordinate: coordinates.get(endNode),
      endComponentSize: endComponent.size,
    
      closestGap
    }
  );

  return null;
}

    const routeCoordinates = [
      [startLat, startLng],

      ...result.nodes.map(
        node =>
          coordinates.get(node)
      ),

      [endLat, endLng]
    ];

    return {
      coordinates: routeCoordinates,
      distance: result.distance,
      edges: result.edges,
      startNode,
      endNode
    };
  }


  // --------------------------------------------------
  // Public API
  // --------------------------------------------------

return {
 load,
  route,
  distance,
  inspectNearestNode,
  getDebugGraph,
  findClosestEdge,

  inspectNode: function(nodeId){
    return {
      node: nodeId,
      coordinate: coordinates.get(nodeId),
      connections: graph.get(nodeId) || []
    };
  },

  isLoaded: () => loaded
};

})();
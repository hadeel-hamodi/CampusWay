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
    isLoaded: () => loaded
  };

})();
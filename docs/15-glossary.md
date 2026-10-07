# 15 · Glossary

> Terms used in the CampusWay code and documentation.

| Term | Meaning |
|---|---|
| **Accessibility profile** | The user's chosen routing and guidance mode: General, Mobility, Visual Impairment, Spatial / Navigation, or Mental Health Support. Stored as `accessibilityProfile`. |
| **Auto mode** | Indoor navigation mode that animates the marker along the route as a preview. |
| **Building key** | Short identifier of a mapped building: `main`, `rabin`, `madriga`, `student`, `multi-purpose`, `education`. |
| **Campus status** | Official information about elevator outages, closures, no-go zones and opening hours, from `app/data/campus-status.json`. |
| **Carmel Gate** | The campus's south gate; the default start point. |
| **Checkpoint** | A point on the indoor route (a turn, or elevator entry or exit) that the user confirms in Manual / Wheelchair mode. |
| **Connector ID** | Shared identifier (e.g. `elevator1`) given to stairs or elevator nodes on different floors, so they are linked vertically. |
| **Connection** | An undirected walkable link between two nodes on the same floor in an indoor graph. |
| **Dead reckoning (PDR)** | Pedestrian dead reckoning: estimating movement from step count and heading instead of from a positioning signal. |
| **Dijkstra's algorithm** | The shortest-path algorithm used for both indoor and outdoor routing. |
| **Entrance** | A building door that connects the indoor graph to the outdoor path network (`BUILDING_ENTRANCES`). |
| **ETA** | Estimated time of arrival: the walking time shown on the route card. |
| **Floor ID** | Floor identifier in the graphs: `floorminus1`, `floor0`…`floor7`, `floor500`/`floor600`/`floor700` (Main Building). |
| **Heading** | The direction the phone is pointing, from the orientation sensor. |
| **Heading-up** | Map orientation that rotates so the walking direction points up (Phone Sensors mode). |
| **Indoor graph** | JSON file of nodes and connections per floor that describes a building's walkable network. |
| **Intermediate stage** | The part of a journey that passes through Rabin Building between Main and Terrace, or when leaving Terrace through Rabin. |
| **Journey stage** | Which leg of a trip the indoor page guides: `origin`, `destination`, `same-building` or `intermediate`. |
| **Leaflet** | The open-source JavaScript map library used for the campus map. |
| **Madriga** | Hebrew for "terrace": the internal key (`madriga`) of the Terrace Building. |
| **Manual / Wheelchair mode** | Indoor navigation mode without sensors: the user confirms checkpoints. |
| **No-go zone** | An outdoor polygon in the campus status that routes must avoid. |
| **Node** | A point in a graph. Indoors: a room door, corridor junction, stairs, elevator, entrance, etc.; it has a type and normalised x/y. |
| **Normalised coordinates** | Positions as fractions (0–1) of the floor-plan width and height. |
| **OSM / OpenStreetMap** | Open map database; the source of the outdoor path network and base-map tiles. |
| **Overpass API** | The OpenStreetMap query service used to export `campus-osm.json`. |
| **Phone Sensors mode** | Indoor navigation mode that moves the marker as steps are detected. |
| **PWA** | Progressive Web App: a website that can be installed and used offline. |
| **RDP (Ramer–Douglas–Peucker)** | Line-simplification algorithm used to reduce a route to checkpoints. |
| **Rest space** | A mapped quiet place (landmark, library, garden or terrace) suggested by the Mental Health Support profile. |
| **Route card** | The panel on the campus map showing ETA, start → destination, directions and actions. |
| **RTL** | Right-to-left layout, used for Hebrew and Arabic. |
| **Service worker** | Background script that caches the app for offline use (`service-worker.js`). |
| **Shared transfer** | The direct indoor connection between Rabin floor 5 and Terrace floor 4, by stairs or the shared elevator. |
| **Shelter** | A protected space (ממ"ד / מקלט), mapped as `shelter` nodes and used by Nearest shelter. |
| **Snapping** | Moving a start or end point to the nearest node of the path network. |
| **Step-free route** | A route with no stairs; required by the Mobility profile. |
| **Terrace Building** | Campus building connected to Rabin Building (internal key `madriga`). |
| **Turn penalty** | Extra cost (6 m) added per turn of 35° or more in Spatial routing. |
| **WayFrame** | The project's indoor-graph editor (`wayframe/wayframe.html`); also the folder holding the indoor navigation code. |

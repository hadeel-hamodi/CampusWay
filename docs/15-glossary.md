# 15 · Glossary

> Terms used in the CampusWay code and documentation.

| Term | Meaning |
|---|---|
| **Accessibility profile** | The user's chosen routing and guidance mode: General, Mobility, Visual Impairment, Spatial / Navigation, or Sensory & Wellbeing Support. Stored as `accessibilityProfile` in `localStorage`, so it is kept between visits. |
| **Admin screen** | `admin.html`: the campus team's page for problem reports, the live status, announcements, emergency mode, names and opening hours, data health, insights and tests. It works only when opened from the PC server. |
| **Auto mode** | Indoor navigation mode that animates the marker along the route as a preview; chosen automatically in demo mode. |
| **Building key** | Short identifier of a mapped building: `main`, `rabin`, `madriga`, `student`, `multi-purpose`, `education`. |
| **Campus status** | Official information about elevator outages, closures, no-go zones, noisy areas, announcements, emergency mode, names and opening hours. The app reads the live status from the cloud inbox; `app/data/campus-status.json` is the offline fallback. |
| **Carmel Gate** | The campus's south gate; the default start point. |
| **Checkpoint** | A point on the indoor route (a turn, or elevator entry or exit) that the user confirms in Manual / Wheelchair mode. |
| **Cloud inbox** | A free Cloudflare Worker with a D1 (SQLite) database (`cloud/`, live at `https://campusway-inbox.campusway.workers.dev/`). Phones send it problem reports and anonymous usage counts and read the live status from it; the PC server fetches from it every 5 minutes. |
| **Connector ID** | Shared identifier (e.g. `elevator1`) given to stairs or elevator nodes on different floors, so they are linked vertically. |
| **Connection** | An undirected walkable link between two nodes on the same floor in an indoor graph. |
| **Data health** | The admin screen page that checks the indoor maps: isolated nodes, stairs and elevators without a connector ID, placeholder names, missing entrances, and places that cannot be reached or only by stairs. |
| **Dead reckoning (PDR)** | Pedestrian dead reckoning: estimating movement from step count and heading instead of from a positioning signal. |
| **Demo mode** | `?demo=1` in the address: outdoor guidance moves along the route by itself and indoor navigation uses Auto mode, for demonstrations without walking. |
| **Dijkstra's algorithm** | The shortest-path algorithm used for both indoor and outdoor routing. |
| **Draft** | Status changes made in the admin screen that are not saved yet. **Save to live status** checks the draft, keeps a backup and publishes it. |
| **Emergency mode** | An administrator switch in the admin screen that shows a red emergency banner with a *Nearest shelter* button on every page. |
| **Entrance** | A building door that connects the indoor graph to the outdoor path network (`BUILDING_ENTRANCES`). |
| **ETA** | Estimated time of arrival: the walking time shown on the route card. |
| **Floor ID** | Floor identifier in the graphs: `floorminus1`, `floor0`…`floor7`, `floor500`/`floor600`/`floor700` (Main Building). |
| **Heading** | The direction the phone is pointing, from the orientation sensor. |
| **Heading-up** | Map orientation that rotates so the walking direction points up (Phone Sensors mode). |
| **Indoor graph** | JSON file of nodes and connections per floor that describes a building's walkable network. |
| **Intermediate stage** | The part of a journey that passes through Rabin Building between Main and Terrace, or when leaving Terrace through Rabin. |
| **Journey stage** | Which leg of a trip the indoor page guides: `origin`, `destination`, `same-building` or `intermediate`. |
| **Leaflet** | The open-source JavaScript map library used for the campus map. |
| **Live status** | The campus status as last saved in the admin screen and published to the cloud inbox. Phones show it the next time CampusWay is opened, without a commit. |
| **Madriga** | Hebrew for "terrace": the internal key (`madriga`) of the Terrace Building. |
| **Manual / Wheelchair mode** | Indoor navigation mode without sensors: the user confirms checkpoints (tap-to-confirm). Chosen automatically for the Mobility profile. |
| **No-go zone** | An outdoor polygon in the campus status that routes must avoid. |
| **Node** | A point in a graph. Indoors: a room door, corridor junction, stairs, elevator, entrance, etc.; it has a type and normalised x/y. |
| **Normalised coordinates** | Positions as fractions (0–1) of the floor-plan width and height. |
| **OSM / OpenStreetMap** | Open map database; the source of the outdoor path network and base-map tiles. |
| **Outdoor guidance** | Live guidance on the campus map: the phone's GPS position follows the outdoor route, the current step is highlighted (and spoken with the audio guide on), and *You have arrived!* appears at the end of the journey. |
| **Overpass API** | The OpenStreetMap query service used to export `campus-osm.json`. |
| **PC server** | `server/campusway-server.js`: a Node.js program (built-in modules only) on one campus-team PC. It serves the app and the admin screen, keeps reports, admin accounts and history as JSON files in `server/db/` (never committed), fetches from the cloud inbox and publishes the live status. |
| **Phone Sensors mode** | Indoor navigation mode that moves the marker as steps are detected; chosen automatically for every profile except Mobility. |
| **PWA** | Progressive Web App: a website that can be installed and used offline. |
| **RDP (Ramer–Douglas–Peucker)** | Line-simplification algorithm used to reduce a route to checkpoints. |
| **Rest space** | A mapped quiet place (landmark, library, garden or terrace) suggested by the Sensory & Wellbeing Support profile. |
| **Roles** | Admin screen permissions: Administrator (everything), Facilities, Accessibility office and Content editor, each allowed to change only its own parts of the status. |
| **Route card** | The panel on the campus map showing ETA, start → destination, directions and actions. |
| **RTL** | Right-to-left layout, used for Hebrew and Arabic. |
| **Schedule reminders** | Optional class timetable in Settings. While CampusWay is open, a reminder appears up to 15 minutes before a saved class and starts the route to it. |
| **Sensory & Wellbeing Support** | The profile for people who need a quiet break or feel overwhelmed (formerly *Mental Health Support*; internal id `mental`). It prefers quieter paths and suggests rest spaces. |
| **Service worker** | Background script that caches the app for offline use (`service-worker.js`). |
| **Shared transfer** | The direct indoor connection between Rabin floor 5 and Terrace floor 4 through the shared elevator. Not used while that elevator is out of service. |
| **Shelter** | A protected space (ממ"ד / מקלט), mapped as `shelter` nodes and used by Nearest shelter. |
| **Snapping** | Moving a start or end point to the nearest node of the path network. |
| **Step-free route** | A route with no stairs; required by the Mobility profile. |
| **Sync key** | The secret shared by the PC server and the cloud inbox (at least 24 characters). It is kept only in Cloudflare and in `server/db/cloud.json` on the PC, never in the repository. |
| **Tap-to-confirm** | Manual checkpoints: the user taps to confirm each point on the indoor route. Used by Manual / Wheelchair mode, and automatically when motion sensors are refused or send no readings. |
| **Terrace Building** | Campus building connected to Rabin Building (internal key `madriga`). |
| **Text size** | *Normal* or *Large*, chosen in Settings and remembered on the device for both pages. |
| **Turn penalty** | Extra cost (6 m) added per turn of 35° or more in Spatial routing. |
| **WayFrame** | The project's indoor-graph editor (`wayframe/wayframe.html`); also the folder holding the indoor navigation code. |

# 08 · Data model

> Every data structure CampusWay uses: campus buildings, places and entrances (`data.js`), the indoor graph JSON format, floor plans, the outdoor path network, the live campus-status file, browser storage keys, URL parameters, and statistics about the mapped data.

**Contents:** [Overview](#1-overview) · [Campus data](#2-campus-data-appprototypedatajs) · [Indoor graphs](#3-indoor-graphs) · [Outdoor path network](#4-outdoor-path-network) · [Campus status file](#5-campus-status-file) · [Browser storage keys](#6-browser-storage-keys) · [URL parameters](#7-url-parameters) · [Data statistics](#8-data-statistics)

---

## 1. Overview

```mermaid
erDiagram
    BUILDING ||--o{ ENTRANCE : "has (BUILDING_ENTRANCES)"
    BUILDING ||--o| INDOOR_GRAPH : "mapped by"
    INDOOR_GRAPH ||--|{ FLOOR : contains
    FLOOR ||--|{ NODE : has
    FLOOR ||--o{ CONNECTION : has
    CONNECTION }o--|| NODE : "from / to"
    FLOOR ||--o| FLOOR_PLAN_SVG : "drawn on"
    ENTRANCE }o--|| NODE : "nodeId = indoor entrance"
    PLACE }o--o| BUILDING : "indoor.buildingKey"
    PLACE }o--o{ NODE : "indoor.nodeIds"
    CAMPUS_STATUS ||--o{ ELEVATOR_OUTAGE : lists
    CAMPUS_STATUS ||--o{ CLOSURE : lists
    CAMPUS_STATUS ||--o{ OPENING_HOURS : lists

    BUILDING {
        string name
        string name_he
        float lat
        float lng
        array polygon
    }
    ENTRANCE {
        string nodeId
        float lat
        float lng
        bool primary
        bool requiresStairs
        bool avoidForMobility
        string onlyForService
    }
    PLACE {
        string name
        string type "food | shop | gate | clinic | restroom"
        float lat
        float lng
    }
    INDOOR_GRAPH {
        int version "2"
        string building
        string coordinateSystem "normalized_0_to_1"
    }
    NODE {
        string id "floor5_n104"
        string label
        string type "room | corridor | elevator | stairs | ..."
        string connectorId "links floors"
        float x "0..1"
        float y "0..1"
        string floor
    }
    CONNECTION {
        string from
        string to
    }
    ELEVATOR_OUTAGE {
        string building
        string elevator
        date from
        date until
    }
    CLOSURE {
        string building
        array nodeIds
        array area "outdoor polygon"
    }
```

<sub>Diagram source: [`diagrams/09-data-model.mmd`](diagrams/09-data-model.mmd) · Image: [PNG](diagrams/09-data-model.png) · [SVG](diagrams/09-data-model.svg)</sub>

| Data | File | Format | Edited with |
|---|---|---|---|
| Buildings, places, gates, restrooms | `app/prototype/data.js` | JavaScript object `CAMPUS_DATA` | Text editor |
| Hebrew place names | `app/prototype/data.js` | `PLACE_NAMES_HE` | Text editor |
| Building entrances | `app/prototype/data.js` | `BUILDING_ENTRANCES` | Text editor |
| Indoor graphs | `buildings/<key>/<key>-indoor-graph.json` | JSON | WayFrame node plotter |
| Floor plans | `buildings/<key>/floors/*.svg` | SVG drawings | External drawing tools |
| Outdoor paths | `app/prototype/campus-osm.json` | Overpass API JSON | Re-export from OpenStreetMap |
| Outdoor corrections | `app/prototype/outdoor-routing.js` | Code (`addCampusNode`, `addEdge`, `removeEdge`) | Text editor |
| Live status | Cloud inbox (live copy); `app/data/campus-status.json` (offline fallback) | JSON | Admin screen ([17](17-admin-screen.md)) |

**Building keys** link the data together: `main`, `rabin`, `madriga` (Terrace Building), `student`, `multi-purpose`, `education`.

## 2. Campus data (`app/prototype/data.js`)

### 2.1 `CAMPUS_DATA.buildings[]`

| Field | Type | Description |
|---|---|---|
| `name` | string | English name (also used as an identifier in share links) |
| `name_he` | string | Hebrew name |
| `lat`, `lng` | number | Marker position |
| `polygon` | `[lat, lng][]` | Building outline |

### 2.2 `CAMPUS_DATA.points`

| Collection | Count | Fields |
|---|---|---|
| `food` | 10 | `name`, `lat`, `lng`, `type: "food"`, optional `indoor: {buildingKey, nodeIds[]}` (8 places are linked to indoor nodes) |
| `shops` | 7 | same as food (1 linked indoors: Yozma, Student House) |
| `gates` | 2 | Carmel Gate (south, default start) and Haifa (Denya) Gate (north) |
| `clinic` | 1 | University Clinic |
| `restrooms` | 73 | outdoor reference points per building |
| `smoking` | 3 | `name` ("Smoking area"), `lat`, `lng`; shown by the *Smoking areas* service button |
| `parking` | 0 | reserved |

```js
{ "name": "Aroma Espresso Bar", "lat": 32.76126, "lng": 35.02086, "type": "food",
  "indoor": { "buildingKey": "rabin", "nodeIds": ["floor6_n70", "floor6_n71", "floor6_n72"] } }
```

### 2.3 `BUILDING_ENTRANCES`

A map from building key to its entrances (22 in total, under 10 keys). For the six mapped buildings, `nodeId` is the entrance node in the indoor graph; for the four outdoor-only buildings (`health`, `eshkol`, `art`, `bloom`) it is an outdoor `campus_*` label. `lat`/`lng` is where the outdoor route connects.

| Field | Type | Description |
|---|---|---|
| `nodeId` | string | Indoor entrance node, e.g. `floor1_n49` |
| `lat`, `lng` | number | Outdoor connection point |
| `primary` | bool | Default entrance |
| `requiresStairs` | bool | Not used for Mobility routing |
| `avoidForMobility` | bool | Not used for Mobility routing |
| `onlyForService` | string | Reserved for one service, e.g. `"gym"`; never used as a destination entrance |

```js
madriga: [
  { nodeId: 'floor1_n49', lat: 32.760836, lng: 35.021125, primary: true },
  { nodeId: 'floorminus1_n1', lat: 32.760864, lng: 35.021283, onlyForService: 'gym' },
  …
]
```

## 3. Indoor graphs

### 3.1 File format

```json
{
  "version": 2,
  "building": "rabin",
  "coordinateSystem": "normalized_0_to_1",
  "floors": {
    "floor5": {
      "nodes": [
        { "id": "floor5_n0",   "label": "5007",     "type": "room",     "connectorId": "",          "x": 0.454448, "y": 0.861378, "floor": "floor5" },
        { "id": "floor5_n104", "label": "elevator", "type": "elevator", "connectorId": "elevator1", "x": 0.722649, "y": 0.492619, "floor": "floor5" }
      ],
      "connections": [ { "from": "floor5_n137", "to": "floor5_n104" } ],
      "nextNodeId": 205
    }
  }
}
```

### 3.2 Node fields

| Field | Description |
|---|---|
| `id` | Unique ID, `<floorId>_n<number>`, e.g. `floor600_n86`, `floorminus1_n1` |
| `label` | Room number or name shown to users (e.g. `5007`, `Hecht Museum`) |
| `type` | One of the node types below |
| `connectorId` | For `stairs` and `elevator`: nodes with the same ID on different floors are the same stairwell or shaft. Empty for other types. |
| `x`, `y` | Position as a fraction (0–1) of the floor-plan width and height |
| `floor` | Floor ID: `floorminus1`, `floor0` … `floor7`, `floor500`, `floor600`, `floor700` |

### 3.3 Node types

| Type | Count (all buildings) | Role |
|---|---|---|
| `corridor` | 1,484 | Walkable junctions and bends |
| `room` | 1,018 | Destinations (classrooms, offices, labs) |
| `stairs` | 159 | Vertical connector (excluded in step-free routing) |
| `restroom` | 61 | Service destination |
| `elevator` | 47 | Vertical connector |
| `entrance` | 29 | Building doors; used for indoor ↔ outdoor hand-off |
| `landmark` | 23 | Notable places; rest-space candidates |
| `shelter` | 14 | Protected spaces for emergency routing |
| `food` | 9 | Cafés and food counters |
| `parking` | 3 | Parking entrances |
| `gym`, `clinic`, `museum`, `library` | 1 each | Service destinations |

### 3.4 Connections and floors

- `connections` are undirected `{from, to}` pairs on the same floor. They store no length; length is computed from coordinates.
- Floor changes are **implicit**: stairs and elevator nodes sharing a `connectorId` are linked between adjacent mapped floors.
- `nextNodeId` is the WayFrame editor's counter for new IDs.

### 3.5 Floor plans

`buildings/<key>/floors/` holds one SVG per floor, named `floor<n>.svg`, `floorminus1.svg`, or `<n>-Model.svg` for Main Building. Node coordinates are relative to the drawing, so a graph and its floor plan must stay together. If a plan is replaced with a different crop or aspect ratio, the nodes must be re-placed.

### 3.6 Duplicated graph copies

`app/prototype/madriga-graph.js` and `multi-purpose-graph.js` hold older JavaScript copies of two graphs (`MADRIGA_GRAPH`, `MULTI_PURPOSE_GRAPH`). The app does not use them: both the campus page and the indoor page load `buildings/<key>/<key>-indoor-graph.json`. The copies are still in the offline file list, the admin screen's map-data health check compares them with the JSON files, and one test reads `madriga-graph.js`. Both are out of date:

| Copy | Nodes / connections in the copy | In the JSON file |
|---|---|---|
| `madriga-graph.js` | 484 / 476 | 390 / 388 |
| `multi-purpose-graph.js` | 305 / 0 | 301 / 308 |

## 4. Outdoor path network

| Item | Format |
|---|---|
| `campus-osm.json` | Overpass API output: `elements[]` with `type: "node"` (`id`, `lat`, `lon`) and `type: "way"` (`nodes[]`, `tags.highway`) |
| Campus corrections | `addCampusNode('campus_<name>', lat, lng)`, `addEdge(a, b, type)`, `removeEdge(a, b)` calls in `applyCampusCorrections()` |
| Edge types | `footway`, `pedestrian`, `path`, `living_street`, `steps`, `service`, `residential`, `elevator` |

The data is © OpenStreetMap contributors, available under the Open Database Licence (ODbL).

## 5. Campus status file

The live campus status is edited in the admin screen and published to the cloud inbox; the PC server also writes it to `app/data/campus-status.json`, and the copy of that file on the site is the offline fallback. Every time the app opens it reads the file (network first), then asks the cloud inbox named in `reportEndpoint` for the live version (`GET /api/status`). It uses the inbox version when the inbox answers, otherwise the file (opened from the PC server, the PC's file is used directly), and keeps the result in `localStorage` (`campuswayStatusCache`) for offline use. See [18 · Data, servers and offline use](18-data-servers-and-offline.md).

```json
{
  "updated": "2026-10-04",
  "elevators": [
    { "building": "rabin", "elevator": "2", "status": "out-of-service",
      "from": "2026-10-04", "until": "2026-10-12", "note": "Maintenance" }
  ],
  "closures": [
    { "building": "main", "nodeIds": ["floor600_n12"], "reason": "Construction", "until": "2026-11-01" },
    { "area": [[32.7621, 35.0201], [32.7622, 35.0203], [32.7620, 35.0204]], "reason": "Construction", "until": "2026-11-01" }
  ],
  "openingHours": {
    "Cafe Aguda": { "sun": "07:30-18:00", "mon": "07:30-18:00", "tue": "07:30-18:00",
                    "wed": "07:30-18:00", "thu": "07:30-18:00", "fri": "07:30-12:00", "sat": "closed" }
  },
  "noiseAreas": [
    { "id": "garden-cafe", "label": "Garden Café", "outdoorNodeIds": ["campus_main_garden_path"],
      "noisy": true, "crowded": true, "until": "2026-10-20T23:59:59+03:00" }
  ],
  "reportEmail": "facilities@example.ac.il",
  "reportEndpoint": "https://campusway-inbox.campusway.workers.dev/"
}
```

| Section | Notes |
|---|---|
| `elevators` | `building` is a building key, or `"campus"` with `"elevator": "main-600-outdoor"` for the outdoor elevator. An entry is active from `from` 00:00 to `until` 23:59:59. |
| `closures` | Indoor: `building` + `nodeIds`. Outdoor no-go zone: `area` polygon. |
| `openingHours` | Keyed by the English place name or the indoor label. Several ranges are separated by commas; `"24/7"` is allowed. |
| `reportEmail` | Shows an e-mail button after a problem report. Leave it empty to hide the button. |
| `reportEndpoint` | Address of the cloud inbox. The app fetches the live status from it and sends problem reports and anonymous usage counts to it. Leave it empty to keep reports on the device. |
| `noiseAreas` | `{id, label, outdoorNodeIds, noisy, crowded, until}`: outdoor path points the Sensory & Wellbeing profile avoids (edge cost × 5) while `noisy` or `crowded`, until `until`. |
| `announcements` | Banners: `{id, severity: "info" \| "warning" \| "critical", text: {en, he, ar, ru}, from, until}`. English is shown when a language is missing. |
| `emergency` | `{active, message: {en, he, ar, ru}}`. When active, every page shows a red banner with a *Nearest shelter* button. |
| `names` | Name corrections keyed by the English name: `{"Cafe Aguda": {"ar": "…"}}`. They replace the built-in name in that language. |

The admin screen ([17 · Admin screen](17-admin-screen.md)) edits the status, checks it with `app/admin/status-schema.js` before saving, and publishes it.

The file in the repository currently lists one noise area (the Garden Café path, until 20 October 2026) and the inbox address; it has no outages, closures, announcements or opening hours.

## 6. Browser storage keys

Everything below stays in the browser on the phone. Only problem reports (`campuswayReports`) are ever sent, to the campus team's cloud inbox. What is stored and what is sent: [18 · Data, servers and offline use](18-data-servers-and-offline.md).

### `localStorage` (kept until the user clears the site data)

| Key | Written by | Content |
|---|---|---|
| `campuswayLanguage` | campus map | `en`, `he`, `ar` or `ru` |
| `accessibilityProfile` | campus map | `general`, `mobility`, `visual`, `spatial` or `mental` (`mental` = Sensory & Wellbeing Support) |
| `campuswayOnboardingComplete` | campus map | `true` once the first-run language and profile screens are done |
| `campusway.audioEnabled` | both pages | Audio guide `true` or `false` |
| `campusway.highContrastEnabled` | campus map | High contrast `true` or `false` (the indoor page follows it) |
| `campusway.textSize` | campus map | `normal` or `large` (the indoor page follows it) |
| `campusway.scheduleRemindersEnabled` | campus map | Class reminders `true` or `false` |
| `campusway.scheduleEntries` | campus map | Class reminders: up to 80 `{id, title, day (0–6), time ("HH:MM"), target}` |
| `campusway.favourites.v1` | campus map | Array of `{kind: "place", name, lat, lng}` or `{kind: "indoor", name, nodeId, type, buildingKey, buildingName, floor}` |
| `campusway.legendOpen` | campus map | Map key open or closed |
| `campuswayIndoorVoice` | indoor page | Indoor voice guidance `on` or `off` |
| `campuswayReports` | both pages | Problem reports made on this device (the last 50, kept 14 days), each marked `synced` once the cloud inbox or PC server has accepted it |
| `campuswayStatusCache` | both pages | The last live campus status received |
| `campusway_wayframe_v2_<building>`, `campusway_wayframe_last_building`, `campusway_wayframe_last_floor_<building>` | WayFrame editor | Editor autosave and last position (developer tool) |

The campus map also copies the first eight keys above (language to class reminders) into `sessionStorage`, so the indoor page in the same tab always sees the current choice.

### `sessionStorage` (kept for this tab until it is closed)

| Key | Written by | Content |
|---|---|---|
| `journeyPlan` | both pages | `{version: 1, currentLeg, legs: [{kind: "indoor" \| "outdoor" \| "transfer", …}]}`: the legs of the whole journey and the current one |
| `journeyStage` | both pages | `origin`, `destination`, `same-building` or `intermediate` |
| `indoorBuilding` | both pages | Building key for the indoor page |
| `indoorContext` | campus map | Destination: `{destinationNodeId, destinationNodeIds, destinationLabel, destinationDisplayLabel, destinationType, buildingKey, entranceId, startNodeId}` |
| `indoorStartContext` | campus map | Origin: `{buildingKey, startNodeId, exitEntranceId, label}` |
| `outdoorJourneyContext` | campus map | Snapshot used to rebuild the outdoor leg after the origin leg |
| `sharedIndoorTransfer` | campus map | `{originBuilding, destinationBuilding, method}` (Rabin ↔ Terrace) |
| `intermediateIndoorTransfer` | campus map | `{building, startNodeId, destinationNodeId, destinationBuilding}`: Rabin pass-through leg on the Main → Terrace chain |
| `originIndoorComplete` | indoor page | Signals the campus map to resume the journey |
| `campusTransitionDirection` | indoor page | Shows the "switching to outdoor" overlay |
| `sharedNavigationResume` | indoor page | `{building, mode}`: continue navigation in the next building |
| `madrigaTransferEntrance` | indoor page | Arrival node in Terrace after the transfer |
| `campusway.pendingSharedElevatorRide` | indoor page | Elevator ride in progress across buildings |
| `newRouteStartContext` | indoor page | `{version: 1, buildingKey, nodeId, label, displayLabel}`: the reached room, used as the start after *New route from here* |
| `campusway.outdoorDemo` | campus map | `true` when the journey was started with `?demo=1`, so the indoor page uses Auto mode |
| `campusway.indoorManualCheckpoints` | indoor page | `true` when motion sensors were unavailable; later buildings in the same visit use tap-to-confirm checkpoints without asking again |
| `campusway.speechVoice.<language>` | both pages | The speech voice picked for that language |
| `campuswayDismissedAnnouncements` | both pages | Ids of announcement banners the user closed |

## 7. URL parameters

| Page | Parameter | Example | Effect |
|---|---|---|---|
| `index.html` | `from`, `to` | `?from=building:Rabin%20Building&to=room:madriga:floor1_n6` | Opens with this route (share links). Values are `building:<name>`, `room:<buildingKey>:<nodeId>` or `place:<name>` (`place:<name>@<buildingKey>` for a place with several branches). Without `from`, the route starts at the phone's position when it is on campus. |
| `index.html` | `meet=lat,lng` | `?meet=32.7612,35.0205` | *Share my location* link: routes the receiver to that point (accepted only around the campus) |
| `index.html` | `emergency=1` | `?emergency=1&from=building:Main%20Building` | Starts nearest-shelter routing (used by the indoor page's emergency button) |
| `index.html` | `resumeJourney=1` | | Used by the indoor page to resume the outdoor leg |
| `index.html` | `newRouteFromHere=1` | | Used by the indoor page's *New route from here*: the reached room becomes the start (from `newRouteStartContext`) |
| `index.html` | `demo=1` | `?demo=1` | Demonstration: outdoor guidance simulates walking, and the indoor page opens in Auto mode |
| `index.html` | `debug` | `?debug` | Clicking the map shows coordinates |
| `navigation-demo.html` | `building` | `?building=rabin` | Building to load |
| `navigation-demo.html` | `from`, `to` | `?building=rabin&from=floor7_n108&to=floor5_n0` | Opens with this indoor route |
| `navigation-demo.html` | `demo=1` | `?building=rabin&demo=1` | Auto mode (except for the Mobility profile, which always uses Manual / Wheelchair) |

## 8. Data statistics

### Indoor graphs

| Building (key) | Floors with nodes | Nodes | Connections | Room nodes | Elevator / stair nodes | Entrance nodes | Restrooms | Shelters |
|---|---|---|---|---|---|---|---|---|
| Main Building (`main`) | 500, 600, 700 | 411 | 419 | 124 | 3 / 24 | 7 | 15 | 1 |
| Rabin Building (`rabin`) | 5, 6, 7 | 593 | 605 | 202 | 12 / 40 | 8 | 5 | 4 |
| Terrace Building (`madriga`) | −1, 0, 1, 2, 3, 4 | 390 | 388 | 137 | 8 / 25 | 4 | 8 | 1 |
| Student House (`student`) | 0–4 | 415 | 412 | 140 | 10 / 42 | 2 | 5 | 4 |
| Multi-Purpose (`multi-purpose`) | 1 | 301 | 308 | 125 | 2 / 8 | 7 | 0 | 0 |
| Education and Science (`education`) | 1–6 | 741 | 745 | 290 | 12 / 20 | 1 | 28 | 4 |
| **Total** | | **2,851** | **2,877** | **1,018** | **47 / 159** | **29** | **61** | **14** |

Counted from `buildings/*/*-indoor-graph.json`. Multi-Purpose and Education and Science also list empty floors (−1, 0, 2 and −1, 0) in their files.

### Outdoor network and places

| Item | Count |
|---|---|
| OSM nodes / ways in the extract | 947 / 157 |
| Routing nodes / edges after corrections | 1,067 / 1,096 |
| Buildings on the map | 10 |
| Building entrances | 22 |
| Food places / shops / gates / clinic / smoking areas | 10 / 7 / 2 / 1 / 3 |
| Floor-plan SVGs | 27 (about 96 MB); the 24 for floors with nodes are pre-cached for offline use |

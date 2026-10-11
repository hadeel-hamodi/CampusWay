# 05 · Architecture

> How CampusWay is built: the system context, the two main pages and the modules they share, the project file structure, how a journey is handed between pages, where state is stored, and how the app works offline.

**Contents:** [Architectural style](#1-architectural-style) · [System context](#2-system-context) · [Components](#3-components) · [File structure](#4-file-structure) · [Module responsibilities](#5-module-responsibilities) · [Page hand-off](#6-page-hand-off-between-the-campus-map-and-indoor-navigation) · [State and storage](#7-state-and-storage) · [Offline and PWA design](#8-offline-and-pwa-design) · [Design decisions](#9-design-decisions)

---

## 1. Architectural style

CampusWay is a **static, offline-first Progressive Web App**:

- **Runs on the phone, mostly from its cache.** All routing, search and navigation run in the browser, from files the service worker saved on the phone. GitHub Pages only delivers files.
- **Two small services, for the campus team only.** A free cloud inbox (Cloudflare Worker + D1 database) receives problem reports and anonymous counts and hands out the live campus status; a Node.js server on one PC runs the admin screen and keeps its data in JSON files. Navigation never depends on either. Full details: [18 · Data, servers and offline use](18-data-servers-and-offline.md).
- **No build step and no framework.** Plain HTML, CSS and JavaScript. The algorithm modules work both in the browser (as globals) and in Node.js (with `require`, for tests); the outdoor router and the UI helpers are browser globals.
- **Data-driven maps.** Buildings, places, entrances, indoor graphs and floor plans are data files; the routing code is mostly generic, with a few building-pair special cases in `routeTo()`.
- **Two pages, one journey.** The campus map (`index.html`) plans the trip and handles outdoor guidance. The indoor navigator (`wayframe/navigation-demo.html`) handles indoor guidance. They pass the journey between them through `sessionStorage`.

## 2. System context

```mermaid
flowchart LR
    user(["Student / visitor<br/>on phone or laptop"])

    subgraph browser["Web browser (installable PWA)"]
        main["Campus map<br/><i>index.html</i>"]
        indoor["Indoor navigation<br/><i>wayframe/navigation-demo.html</i>"]
        sw["Service worker<br/><i>offline cache</i>"]
        storage[("sessionStorage /<br/>localStorage")]
    end

    subgraph device["Device capabilities"]
        sensors["Motion + orientation sensors"]
        speech["Speech synthesis /<br/>speech recognition"]
        gps["Geolocation"]
        mic["Microphone"]
    end

    pages["GitHub Pages<br/>(static hosting)"]
    osm["OpenStreetMap<br/>tile server"]
    inbox["Cloud inbox<br/>(Cloudflare Worker + D1)"]
    pc["Admin PC server<br/>(Node.js + JSON files)"]

    user --> main
    main <-->|"journey hand-off"| indoor
    main --- storage
    indoor --- storage
    sw -.->|"caches app files,<br/>graphs, floor plans"| main
    pages -->|"HTML, JS, JSON, SVG"| sw
    main -->|"base map tiles"| osm
    main -->|"reports, anonymous counts"| inbox
    inbox -->|"live status"| main
    pc <-->|"fetch reports, publish status"| inbox
    indoor --> sensors
    main --> speech
    indoor --> speech
    main --> gps
    main --> mic
```

<sub>Diagram source: [`diagrams/01-system-context.mmd`](diagrams/01-system-context.mmd) · Image: [PNG](diagrams/01-system-context.png) · [SVG](diagrams/01-system-context.svg)</sub>

| External element | Role |
|---|---|
| GitHub Pages | Hosts the static files over HTTPS |
| Cloud inbox | Cloudflare Worker + D1 database: receives problem reports and anonymous usage counts, serves the live campus status ([18](18-data-servers-and-offline.md#5-the-cloud-inbox-cloudflare-worker--d1)) |
| Admin PC server | `server/campusway-server.js` on one campus-team PC: admin screen, data in `server/db/*.json`, fetches from and publishes to the inbox ([17](17-admin-screen.md), [18](18-data-servers-and-offline.md#6-the-pc-server-nodejs--json-files)) |
| OpenStreetMap tile server | Base-map images for the campus map (online only) |
| Device sensors | Accelerometer and orientation for Phone Sensors mode |
| Speech services | Built-in browser text-to-speech and speech recognition |
| Geolocation | GPS start point (also used automatically by Nearest shelter, shared links and class reminders when no start is chosen), Share my location, live outdoor guidance |

## 3. Components

```mermaid
flowchart TB
    subgraph pages["Pages"]
        direction TB
        main["<b>index.html</b><br/>campus map, search, profiles,<br/>services, journey planner"]
        indoor["<b>wayframe/navigation-demo.html</b><br/>indoor floor plans and<br/>turn-by-turn navigation"]
        tools["<b>wayframe/wayframe.html</b> + test pages<br/>graph editor, sensor / audio / mic tests"]
    end

    subgraph routing["Routing and guidance"]
        direction LR
        rp["route-planner.js<br/><i>Dijkstra + fewer-turns search</i>"]
        out["outdoor-routing.js<br/><i>campus path graph</i>"]
        instr["route-instructions.js<br/><i>outdoor directions</i>"]
        wc["wheelchair-navigation.js<br/><i>checkpoints</i>"]
    end

    subgraph sensing["Phone-sensor navigation"]
        direction LR
        step["step-detector.js"]
        head["heading-tracker.js"]
        prog["route-progress.js"]
        audio["audio-guide.js<br/><i>(audio test page)</i>"]
    end

    subgraph uimods["UI and services"]
        direction LR
        cui["campus-ui.js<br/><i>toasts, menus, ARIA</i>"]
        voice["speech-voice.js + haptics.js<br/><i>voices, vibration</i>"]
        status["campus-status.js<br/><i>outages, closures, reports</i>"]
        qr["qr-code.js + share.js"]
        leaflet["Leaflet 1.9.4<br/><i>map library</i>"]
    end

    subgraph data["Data"]
        direction TB
        cdata["app/prototype/data.js<br/><i>buildings, places, entrances</i>"]
        osmjson["campus-osm.json<br/><i>OSM path extract</i>"]
        graphs["buildings/*/*-indoor-graph.json"]
        svgs["buildings/*/floors/*.svg"]
        sjson["app/data/campus-status.json"]
    end

    sw[["service-worker.js<br/>offline cache"]]

    pages --> routing
    pages --> sensing
    pages --> uimods
    routing --> data
    uimods --> data
    sw -.-> pages
```

<sub>Diagram source: [`diagrams/02-components.mmd`](diagrams/02-components.mmd) · Image: [PNG](diagrams/02-components.png) · [SVG](diagrams/02-components.svg)</sub>

## 4. File structure

```text
CampusWay/
├── index.html                    Campus map, search, profiles, services, journey planner (main page)
├── manifest.json                 PWA manifest (name, icons, colours, standalone display)
├── service-worker.js             Offline cache (CACHE_NAME, APP_FILES)
├── admin.html                    Admin screen (works only with the PC server)
├── start-admin.bat               Windows: starts the PC server and opens the admin screen
├── README.md                     Project front page
├── CHANGELOG.md                  Development history
├── CONTRIBUTING.md               Team workflow and checklist
├── app/
│   ├── admin/                    Admin screen scripts and styles (reports, live status, content, data health…)
│   ├── data/
│   │   └── campus-status.json    Live status file (offline fallback; the live copy comes from the cloud inbox)
│   ├── prototype/
│   │   ├── data.js               Buildings, places, entrances (CAMPUS_DATA, BUILDING_ENTRANCES)
│   │   ├── campus-osm.json       OpenStreetMap footpath extract (Overpass)
│   │   ├── outdoor-routing.js    Outdoor graph, campus corrections, routing API
│   │   ├── route-instructions.js Outdoor turn-by-turn directions (EN/HE/AR/RU)
│   │   ├── madriga-graph.js      Older JS copy of the Terrace graph (the app loads the JSON; used by the admin data-health check)
│   │   ├── multi-purpose-graph.js Older JS copy of the Multi-Purpose graph (as above)
│   ├── ui/
│   │   ├── campusway.css         Design tokens (colours, radii, shadows, fonts)
│   │   ├── campus-map.css        Campus map layout and components
│   │   ├── indoor-nav.css        Indoor navigation layout and components
│   │   ├── campus-ui.js          Toasts, language menu, profile picker, tabs, ARIA combobox
│   │   ├── campus-status.js      Live status, opening hours, problem-report dialog
│   │   ├── qr-code.js            QR code encoder (offline, no library)
│   │   ├── share.js              Share dialog (QR, PNG download, copy, native share)
│   │   ├── speech-voice.js       Picks a speech voice per language, explains missing voices
│   │   └── haptics.js            Vibration patterns for the Visual Impairment profile
│   └── vendor/
│       ├── leaflet.js / .css     Leaflet 1.9.4 map library
│       └── images/               Leaflet marker images and the CampusWay icon
├── buildings/
│   └── <building>/               main, rabin, madriga, student, multi-purpose, education
│       ├── <building>-indoor-graph.json   Indoor graph (nodes + connections per floor)
│       └── floors/*.svg                   Floor-plan drawings
├── wayframe/
│   ├── navigation-demo.html      Indoor navigation page
│   ├── route-planner.js          Dijkstra and fewer-turns path search (shared indoor/outdoor)
│   ├── step-detector.js          Step detection from the accelerometer
│   ├── heading-tracker.js        Heading calibration and step-direction classification
│   ├── route-progress.js         Moving a position along the route polyline
│   ├── wheelchair-navigation.js  Checkpoint generation for Manual / Wheelchair mode
│   ├── audio-guide.js            Speech-synthesis helper (used by the audio test page)
│   ├── wayframe.html             WayFrame node plotter (indoor graph editor)
│   ├── route-tester.html         Route viewer for published graphs
│   ├── sensor-test.html          Step and heading field test
│   ├── audio-test.html           Text-to-speech voice test
│   ├── mic-test.html             Microphone access test
│   └── floors/                   Older copy of the Terrace floor plans (not referenced)
├── server/
│   ├── campusway-server.js       PC server: serves the app, admin API, cloud sync
│   ├── db.js                     JSON-file storage (atomic writes)
│   ├── test-runner.js            Runs the tests for the admin Tests page
│   └── db/                       The PC's data (git-ignored, never committed)
├── cloud/
│   ├── worker.mjs                Cloud inbox (Cloudflare Worker)
│   ├── schema.sql                Cloud inbox database tables (D1)
│   ├── wrangler.toml             Worker settings and caps
│   └── update-inbox.mjs          Deploys or re-keys the inbox
├── tests/                        Automated tests (node:test), 39 files
├── docs/                         This documentation
└── Claude outputs/
    └── start-campusway.bat       Windows helper that starts a local server and opens the app
```

## 5. Module responsibilities

### Pages

| Page | Responsibilities |
|---|---|
| `index.html` | Language selection, translations (`T` tables), Leaflet map and markers, search (start and destination), voice input, accessibility profiles, services near me, rest-space ranking, nearest shelter, the journey orchestrator `routeTo()` (exit/entrance choice, ETA, transfers), route card and directions, sharing, favourites, live-status integration, and the journey hand-off to the indoor page. |
| `wayframe/navigation-demo.html` | Loads the building's indoor graph and floor plans, builds the routing graph (with step-free and live-status filters), plans the indoor route, draws the SVG map (schematic or floor plan, overlays, user marker), generates indoor instructions, runs the three navigation modes, handles floor changes and shared-elevator rides, the arrival dialog, and the hand-off back to the campus map. |

### Shared modules

| Module | Global / export | Responsibility | Used by |
|---|---|---|---|
| `wayframe/route-planner.js` | `CampusRoutePlanner` | Generic shortest path (Dijkstra) and fewer-turns path search; rest-space detection | both pages, outdoor routing |
| `app/prototype/outdoor-routing.js` | `CampusOutdoorRouting` | Loads the OSM extract, applies campus corrections, snaps points, applies restrictions, returns routes | `index.html` |
| `app/prototype/route-instructions.js` | `CampusRouteInstructions` | Turns an outdoor polyline into worded steps | `index.html` |
| `app/prototype/data.js` | `CAMPUS_DATA`, `BUILDING_ENTRANCES`, `PLACE_NAMES_HE` | Campus data | `index.html` |
| `app/ui/campus-status.js` | `CampusStatus` | Loads the status file, evaluates outages, closures and hours, report dialog | both pages |
| `app/ui/campus-ui.js` | `CampusUI` | Presentation helpers for the campus page | `index.html` |
| `app/ui/qr-code.js`, `share.js` | `CampusQR`, `CampusShare` | QR encoding and the share dialog | both pages |
| `app/ui/speech-voice.js` | `CampusSpeech` | Chooses a voice for each language and explains how to add a missing one | both pages |
| `app/ui/haptics.js` | `CampusHaptics` | Vibration at turns, floor changes and arrival (Visual Impairment profile, Android) | both pages |
| `wayframe/step-detector.js` | `CampusStepDetector` | Step detection | indoor page, sensor test |
| `wayframe/heading-tracker.js` | `CampusHeadingTracker` | Heading calibration and step direction | indoor page, sensor test |
| `wayframe/route-progress.js` | `CampusRouteProgress` | 1-D movement along the route | indoor page |
| `wayframe/wheelchair-navigation.js` | `CampusWheelchairNavigation` | Checkpoints for manual navigation | indoor page |

## 6. Page hand-off between the campus map and indoor navigation

The two pages never call each other directly. The campus map writes the journey into `sessionStorage` and opens `wayframe/navigation-demo.html?building=<key>`. The indoor page writes the result back and returns to `index.html?resumeJourney=1`.

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant M as Campus map (index.html)
    participant S as sessionStorage
    participant I as Indoor page (navigation-demo.html)

    U->>M: Choose start room and destination room
    M->>M: routeTo() picks best exit + entrance,<br/>draws outdoor route, computes ETA
    M->>S: indoorStartContext, indoorContext,<br/>sharedIndoorTransfer / intermediateIndoorTransfer
    U->>M: Press "Start indoor route"
    M->>S: outdoorJourneyContext (snapshot),<br/>journeyStage = origin, indoorBuilding
    M->>I: open ?building=<origin building>
    I->>S: read contexts, restore route room → exit
    U->>I: Navigate (Auto / Sensors / Wheelchair)
    I->>S: originIndoorComplete = true,<br/>journeyStage = destination
    I->>M: location.replace(index.html?resumeJourney=1)
    M->>S: read outdoorJourneyContext
    M->>M: redraw outdoor leg, show "Continue indoors"
    U->>M: Walk outdoors, press "Continue indoors"
    M->>I: open ?building=<destination building>
    I->>S: read indoorContext (entrance → room)
    U->>I: Navigate to the room
    I-->>U: "You have arrived!"
```

<sub>Diagram source: [`diagrams/03-page-handoff-sequence.mmd`](diagrams/03-page-handoff-sequence.mmd) · Image: [PNG](diagrams/03-page-handoff-sequence.png) · [SVG](diagrams/03-page-handoff-sequence.svg)</sub>

The **journey stage** (`journeyStage`) tells the indoor page which part of the trip it is guiding:

| Stage | Meaning | Indoor route |
|---|---|---|
| `origin` | The user starts inside a building | start room → best exit |
| `destination` | The user arrives at the destination building | entrance → destination room |
| `same-building` | Start and destination are in the same building | start room → destination room |
| `intermediate` | Passing through Rabin between Main and Terrace, or when leaving Terrace through Rabin | Rabin entrance → shared connection, or shared connection → Rabin exit |

See [06 · User flows](06-user-flows.md#3-multi-building-journey-stages) for the full state diagram.

## 7. State and storage

| Kind | Where | Lifetime | Examples |
|---|---|---|---|
| Preferences | `localStorage` | Until cleared | `campuswayLanguage`, `accessibilityProfile`, `campuswayOnboardingComplete`, `campusway.audioEnabled`, `campusway.highContrastEnabled`, `campusway.textSize` |
| Journey state | `sessionStorage` | Until the journey ends or a new one starts | `indoorContext`, `indoorStartContext`, `journeyStage`, `outdoorJourneyContext`, `sharedIndoorTransfer`, `campusway.pendingSharedElevatorRide` |
| Personal data | `localStorage` | Until cleared | `campusway.favourites.v1`, `campuswayReports` (14 days) |
| UI preferences | `localStorage` | Until cleared | `campusway.legendOpen`, `campuswayIndoorVoice`, `campusway.scheduleRemindersEnabled`, `campusway.scheduleEntries` |
| Cached data | `localStorage` + Cache Storage | Until updated | `campuswayStatusCache` (last live status); service-worker cache `campusway-v68-fresh-maps` |
| Shareable state | URL parameters | – | `?from=…&to=…`, `?emergency=1`, `?building=…&from=…&to=…` |

The full list of keys and parameters is in [08 · Data model](08-data-model.md#6-browser-storage-keys).

## 8. Offline and PWA design

```mermaid
flowchart TD
    I(["install"]) --> I1["Open cache CACHE_NAME<br/>(now campusway-v68-fresh-maps)"]
    I1 --> I2["Pre-cache APP_FILES:<br/>pages, JS, CSS, data,<br/>indoor graphs, floor SVGs"]
    I2 --> I3[skipWaiting]
    A(["activate"]) --> A1[Delete caches with<br/>other names] --> A2[clients.claim]
    F(["fetch (GET)"]) --> F0{"Other site, /api/ or admin?"}
    F0 -- Yes --> P["Not handled:<br/>OSM tiles, cloud inbox, admin"]
    F0 -- No --> F1{"Page, script, style,<br/>.json or .svg?"}
    F1 -- Yes --> N1["Network first<br/>→ update cache<br/>→ fall back to cache"]
    F1 -- No --> C1["Cache first<br/>(ignoreSearch)<br/>→ fall back to network"]
```

<sub>Diagram source: [`diagrams/11-service-worker.mmd`](diagrams/11-service-worker.mmd) · Image: [PNG](diagrams/11-service-worker.png) · [SVG](diagrams/11-service-worker.svg)</sub>

- `manifest.json` makes the app installable (standalone display, theme colour `#0D1B3E`).
- On install, the service worker pre-caches everything in `APP_FILES` (about 75 MB): pages, scripts, styles, campus data, the outdoor path network, every indoor graph and every floor-plan SVG. After the first visit the whole app works offline.
- Pages, scripts, styles and all `.json`/`.svg` files (indoor maps, floor plans, live-status file) are **network-first**: online, the newest version is used and saved; offline, the saved copy. Other files (images) are **cache-first**.
- Requests to other sites (OpenStreetMap tiles, the cloud inbox), `/api/` and the admin screen are never cached. Offline, the map shows the routes, outlines and markers on a plain background.
- A new release replaces the cache when `CACHE_NAME` or the file list changes. The new worker deletes the old cache and takes control at once.
- What is stored on the phone and what is sent: [18 · Data, servers and offline use](18-data-servers-and-offline.md).

## 9. Design decisions

| Decision | Reason |
|---|---|
| Static, offline-first PWA; servers only for the campus team | Free hosting, works offline, and no personal data leaves the phone. Reports and the live status use a free cloud inbox and one PC, never for routing. |
| Vanilla JavaScript, no framework or bundler | Simple for a student team to read and deploy; no toolchain to maintain. |
| Algorithm modules wrapped as UMD | The same file runs in the browser and in Node tests (route planner, progress, wheelchair checkpoints, instructions, QR, step and heading detection). |
| Graph-based indoor model (nodes and connections) over floor plans | Easy to draw with the WayFrame tool and to route on; floor plans are only a background. |
| Normalised (0–1) indoor coordinates | Graphs stay independent of each SVG's size and resolution. |
| OpenStreetMap extract stored locally, plus a correction layer | Routing works offline, and the team can fix campus paths missing from OSM. |
| `sessionStorage` hand-off between pages | Keeps both pages independent while surviving reloads within the tab. |
| Honest failure for step-free routing | Showing no route is safer than an unverified one for wheelchair users. |
| Manual checkpoint mode next to sensor mode | Sensors are unreliable for wheelchairs and differ between phones; confirmation always works. |

# 09 · Technology stack

> The languages, libraries, browser APIs, data sources and tools CampusWay is built with, and what each one is used for.

## At a glance

| Layer | Technology |
|---|---|
| Front end | HTML5, CSS3, vanilla JavaScript (ES2020+), no framework, no build step |
| Map | Leaflet 1.9.4 (vendored), OpenStreetMap tiles |
| Indoor maps | SVG map renderer with the floor-plan drawings as background images, plus graph data in JSON |
| Routing | Custom Dijkstra and fewer-turns search (`route-planner.js`) |
| App platform | Progressive Web App: Web App Manifest and service worker |
| Data | OpenStreetMap extract (Overpass API), hand-mapped JSON indoor graphs, JS data files |
| Admin and servers | Admin screen (`admin.html`, `app/admin/`); PC server in Node.js (`server/campusway-server.js`, built-in modules only, data as JSON files in `server/db/`); cloud inbox on Cloudflare Workers + D1 (`cloud/`) |
| Testing | Node.js built-in test runner (`node:test`, `node:assert`, `node:vm`) |
| Hosting | GitHub Pages (the app); Cloudflare Workers free plan (the cloud inbox) |
| Collaboration | Git, GitHub, GitHub Desktop, branches and pull requests |

## Languages and core web technologies

| Technology | Used for |
|---|---|
| **HTML5** | The two app pages, the admin screen (`admin.html`) and the tool pages. Uses `<dialog>` for modals, `<svg>` for maps and icons, and ARIA attributes. |
| **CSS3** | Custom properties (design tokens in `campusway.css`), CSS Grid and Flexbox layout, logical properties for right-to-left support, media queries for phone and desktop, `prefers-reduced-motion`, a high-contrast theme and a large text size. |
| **JavaScript** | All application logic, the PC server and the cloud inbox Worker. Algorithm modules use a UMD wrapper so they run in the browser and in Node.js. Uses `async`/`await`, `fetch`, optional chaining (`?.`), `??`, `Array.at`, `Map`/`Set`, and `requestAnimationFrame`. |
| **SVG** | Floor plans (27 drawings in `buildings/*/floors/`), the indoor map renderer, the QR codes, and the icons. |
| **JSON** | Indoor graphs, the OSM extract, the campus-status file, and the PC server's data files (`server/db/`). |
| **SQL** | The cloud inbox's D1 tables (`cloud/schema.sql`). |

## Libraries

| Library | Version | Licence | Used for |
|---|---|---|---|
| [Leaflet](https://leafletjs.com/) | 1.9.4 | BSD-2-Clause | Interactive campus map: tiles, polygons, markers, popups, polylines; also the map in the admin screen |

Everything else (routing, QR encoding, step detection, the share dialog, the PC server, the cloud inbox) was written for the project. There are no npm runtime dependencies: the PC server uses only Node.js built-in modules, and Cloudflare's `wrangler` tool (run with `npx`) is needed only to set up and deploy the cloud inbox.

## Admin screen, PC server and cloud inbox

These parts are for the campus team only; navigation never depends on them ([18 · Data, servers and offline use](18-data-servers-and-offline.md)).

| Technology | Used for |
|---|---|
| **Node.js**, built-in modules only (`http`, `fs`, `path`, `os`, `crypto`, `vm`, `child_process`) | `server/campusway-server.js`: serves the app and the admin screen at `http://localhost:8080`, runs the admin API, keeps the data as JSON files in `server/db/` (git-ignored), fetches from the cloud inbox every 5 minutes, publishes the live status, and runs the test suite for the admin **Tests** page |
| **scrypt** (`crypto.scryptSync`, a random salt per account) | Admin password hashing; sessions use an HttpOnly, SameSite=Strict cookie |
| **Cloudflare Workers** | `cloud/worker.mjs`: the cloud inbox that receives reports and anonymous usage counts from the public site and serves the live campus status |
| **Cloudflare D1** (SQLite) | The cloud inbox's database (`cloud/schema.sql`) |
| **wrangler** (Cloudflare's command-line tool, via `npx`) | Creating the D1 database, storing the sync key and deploying the Worker; `cloud/update-inbox.mjs` runs it |

## Browser APIs

| API | Used for | Page |
|---|---|---|
| Web Speech API: `speechSynthesis` | Audio guide, reading directions, indoor voice guidance | both |
| Web Speech API: `SpeechRecognition` | Voice search; *Plan route by voice* (Visual Impairment profile) | campus map |
| `getUserMedia` + Web Audio `AnalyserNode` | Voice-level indicator while listening; mic test page | campus map |
| `DeviceMotionEvent` | Step detection | indoor |
| `DeviceOrientationEvent` (+ `webkitCompassHeading`) | Heading for step direction and map rotation | indoor |
| Geolocation API | GPS start point and the automatic start from the phone's position on campus, nearest shelter, live outdoor guidance (`watchPosition`), *Share my location* | campus map |
| Service Worker + Cache Storage | Offline support | both |
| Web App Manifest | Installable app | both |
| `localStorage` / `sessionStorage` | Preferences (language, profile, audio, high contrast, text size), favourites, schedule reminders, reports, journey hand-off | both |
| Web Share API (`navigator.share`) | Native share sheet | both |
| Clipboard API | Copy link / report | both |
| Canvas `toBlob` | QR code PNG download | both |
| `navigator.vibrate` | Visual Impairment profile: turns, floor changes and arrival (`app/ui/haptics.js`); a short arrival pulse indoors for the other profiles. Android browsers only; iPhones do not support it | both |
| Pointer Events, `MutationObserver` | Pan/zoom, live-region and UI updates | both |

## Data sources

| Source | Content | Licence / terms |
|---|---|---|
| OpenStreetMap (via Overpass API) | Campus footpaths, roads and steps (`campus-osm.json`) | ODbL, © OpenStreetMap contributors |
| OpenStreetMap tile server | Base map images | OSMF Tile Usage Policy |
| Team mapping (WayFrame) | Indoor graphs of six buildings | Project data |
| Building floor plans | SVG drawings used as backgrounds | – |

## Development and quality tools

| Tool | Used for |
|---|---|
| Node.js 21+ (tested on 24) | Running `node --test tests/*.test.cjs`, the PC server and `cloud/update-inbox.mjs` |
| `node:vm` | Tests load slices of the HTML pages' inline scripts into a sandbox |
| `http-server` (via `npx`) or Python `http.server` | Local web server (static files only) |
| `start-admin.bat` | One-click start of the PC server on Windows; opens the admin screen |
| `Claude outputs/start-campusway.bat` | Older one-click static server on Windows (port 8765; Python, or Node.js if Python is missing) |
| Admin **Tests** and **Data health** pages | Running the test suite and checking the indoor maps from the admin screen ([17 · Admin screen](17-admin-screen.md)) |
| WayFrame node plotter | Drawing and exporting indoor graphs |
| Sensor / audio / mic test pages | Testing on real devices |
| Browser DevTools | Device emulation, sensor emulation, service-worker inspection |
| Mermaid | Diagrams in this documentation (rendered by GitHub) |

## Why these choices

- **No framework or bundler:** anyone in the team can open a file and change it; GitHub Pages serves the repository as it is.
- **Leaflet:** small, mature, and offline-friendly, since it is vendored rather than loaded from a CDN.
- **Custom routing:** the campus needs indoor and outdoor graphs, accessibility filters, turn penalties and building transfers in one consistent model, which general map APIs do not offer.
- **Web APIs instead of native apps:** one code base runs on Android, iOS and desktop, with access to sensors, speech and offline storage.
- **A PC server with built-in modules and a free cloud inbox:** nothing to install and no cost. The campus team's PC keeps the data; the inbox only passes reports and the live status between phones and the PC.

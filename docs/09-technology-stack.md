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
| Testing | Node.js built-in test runner (`node:test`, `node:assert`, `node:vm`) |
| Hosting | GitHub Pages |
| Collaboration | Git, GitHub, GitHub Desktop, branches and pull requests |

## Languages and core web technologies

| Technology | Used for |
|---|---|
| **HTML5** | The two app pages, plus the tool pages. Uses `<dialog>` for modals, `<svg>` for maps and icons, and ARIA attributes. |
| **CSS3** | Custom properties (design tokens in `campusway.css`), CSS Grid and Flexbox layout, logical properties for right-to-left support, media queries for phone and desktop, `prefers-reduced-motion`, and a high-contrast theme. |
| **JavaScript** | All application logic. Algorithm modules use a UMD wrapper so they run in the browser and in Node.js. Uses `async`/`await`, `fetch`, optional chaining (`?.`), `??`, `Array.at`, `Map`/`Set`, and `requestAnimationFrame`. |
| **SVG** | Floor plans (28 drawings), the indoor map renderer, the QR codes, and the icons. |
| **JSON** | Indoor graphs, the OSM extract, and the campus-status file. |

## Libraries

| Library | Version | Licence | Used for |
|---|---|---|---|
| [Leaflet](https://leafletjs.com/) | 1.9.4 | BSD-2-Clause | Interactive campus map: tiles, polygons, markers, popups, polylines |

Everything else (routing, QR encoding, step detection, the share dialog) was written for the project. There are no npm runtime dependencies.

## Browser APIs

| API | Used for | Page |
|---|---|---|
| Web Speech API: `speechSynthesis` | Audio guide, reading directions, indoor voice guidance | both |
| Web Speech API: `SpeechRecognition` | Voice search | campus map |
| `getUserMedia` + Web Audio `AnalyserNode` | Voice-level indicator while listening; mic test page | campus map |
| `DeviceMotionEvent` | Step detection | indoor |
| `DeviceOrientationEvent` (+ `webkitCompassHeading`) | Heading for step direction and map rotation | indoor |
| Geolocation API | GPS start point, nearest shelter | campus map |
| Service Worker + Cache Storage | Offline support | both |
| Web App Manifest | Installable app | both |
| `localStorage` / `sessionStorage` | Preferences, favourites, reports, journey hand-off | both |
| Web Share API (`navigator.share`) | Native share sheet | both |
| Clipboard API | Copy link / report | both |
| Canvas `toBlob` | QR code PNG download | both |
| `navigator.vibrate` | Arrival feedback (where supported) | indoor |
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
| Node.js 18+ (tested on 22) | Running `node --test tests/*.test.cjs` |
| `node:vm` | Tests load slices of the HTML pages' inline scripts into a sandbox |
| `http-server` (via `npx`) or Python `http.server` | Local web server |
| `Claude outputs/start-campusway.bat` | One-click local server on Windows (Python or Node) |
| WayFrame node plotter | Drawing and exporting indoor graphs |
| Sensor / audio / mic test pages | Testing on real devices |
| Browser DevTools | Device emulation, sensor emulation, service-worker inspection |
| Mermaid | Diagrams in this documentation (rendered by GitHub) |

## Why these choices

- **No framework or bundler:** anyone in the team can open a file and change it; GitHub Pages serves the repository as it is.
- **Leaflet:** small, mature, and offline-friendly, since it is vendored rather than loaded from a CDN.
- **Custom routing:** the campus needs indoor and outdoor graphs, accessibility filters, turn penalties and building transfers in one consistent model, which general map APIs do not offer.
- **Web APIs instead of native apps:** one code base runs on Android, iOS and desktop, with access to sensors, speech and offline storage.

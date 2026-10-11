# 04 · Requirements

> What CampusWay must do (functional requirements), how well it must do it (non-functional requirements), and what users and developers need in order to run it (device, browser and development requirements). The *Status* column shows how each requirement stands in the current version.

**Contents:** [Functional requirements](#1-functional-requirements) · [Non-functional requirements](#2-non-functional-requirements) · [User device and browser requirements](#3-user-device-and-browser-requirements) · [Permissions](#4-permissions) · [Development requirements](#5-development-requirements) · [Hosting requirements](#6-hosting-requirements) · [Assumptions and constraints](#7-assumptions-and-constraints)

Status legend: ✅ implemented · 🟡 partly implemented, or limited by data or device · ⬜ not implemented

---

## 1. Functional requirements

### 1.1 Campus map and route planning

| ID | Requirement | Status |
|---|---|---|
| FR-01 | The system shall display an interactive map of the University of Haifa campus with buildings, gates, food places, shops, the clinic, and outdoor elevators and stairs. | ✅ |
| FR-02 | The user shall be able to set a start point by search, voice, GPS, or a room inside a mapped building; the default start is Carmel Gate. | ✅ |
| FR-03 | The user shall be able to set a destination: a building, a room, a food place, a shop or a campus service. | ✅ |
| FR-04 | The system shall calculate a walking route over the campus path network and draw it on the map. | ✅ |
| FR-05 | The system shall choose the building exit and entrance that minimise walking time from the start (indoor walk to the exit plus the outdoor route). | ✅ |
| FR-06 | The system shall display an estimated walking time for the whole journey. | ✅ |
| FR-07 | The system shall generate turn-by-turn outdoor directions with distances and building landmarks. | ✅ |
| FR-08 | The system shall let the user clear a route and plan a new one. | ✅ |

### 1.2 Search

| ID | Requirement | Status |
|---|---|---|
| FR-09 | The system shall search buildings by name and alias in English, Hebrew, Arabic and Russian. | ✅ |
| FR-10 | The system shall search rooms and indoor places of all mapped buildings by number or name and show building and floor. | ✅ |
| FR-11 | The system shall understand service words (restroom, shelter, food, shop, clinic, library, gym) in all four languages and offer the nearest one. | ✅ |
| FR-12 | Search shall tolerate small typos and ignore accents and diacritics. | ✅ |
| FR-13 | The system shall tell the user when nothing matches, or when a start room is not mapped yet. | ✅ |
| FR-14 | The user shall be able to search by voice. | 🟡 depends on browser speech recognition |

### 1.3 Accessibility profiles

| ID | Requirement | Status |
|---|---|---|
| FR-15 | The user shall be able to choose an accessibility profile: General, Mobility, Visual Impairment, Spatial / Navigation, or Sensory & Wellbeing Support. | ✅ |
| FR-16 | With the Mobility profile, routes shall avoid stairs outdoors and indoors, and use only step-free entrances and elevators. | ✅ |
| FR-17 | When no step-free route is mapped, the system shall say so and shall not draw a fallback route. | ✅ |
| FR-18 | With the Spatial profile, routes shall prefer fewer turns while keeping detours reasonable. | ✅ |
| FR-19 | With the Visual Impairment profile, spoken guidance shall be enabled. | ✅ |
| FR-20 | With the Sensory & Wellbeing Support profile, routes shall prefer quieter paths (avoiding noisy or crowded areas named in the live status), and the system shall show nearby rest spaces and guide the user to the nearest one (*I need a break*). | ✅ |

### 1.4 Indoor navigation

| ID | Requirement | Status |
|---|---|---|
| FR-21 | The system shall show the indoor route on a schematic view or on the building's floor plan, floor by floor. | ✅ |
| FR-22 | The system shall generate indoor step-by-step instructions, including floor changes by stairs or elevator. | ✅ |
| FR-23 | The system shall offer an automatic preview mode (Auto). | ✅ for demonstrations, with `?demo=1` |
| FR-24 | The system shall offer a mode that estimates the user's progress from phone motion and orientation sensors (Phone Sensors). | 🟡 estimate only; needs real-phone tuning |
| FR-25 | The system shall offer a sensor-free checkpoint mode suitable for wheelchair users (Manual / Wheelchair). | ✅ |
| FR-26 | The system shall ask the user to confirm floor changes by stairs or elevator in sensor mode. | ✅ |
| FR-27 | The system shall announce arrival at the destination. | ✅ (in Phone Sensors mode the user confirms the estimated arrival with *✓ I have arrived*) |

The indoor mode is chosen automatically, not by the user: the Mobility profile gets Manual / Wheelchair (tap-to-confirm checkpoints on a stair-free route), a `?demo=1` link gets Auto, and everyone else gets Phone Sensors. If motion-sensor permission is refused or the phone has no motion sensors, guidance switches to tap-to-confirm checkpoints on the same route (stairs stay allowed). See [06 · User flows](06-user-flows.md#4-indoor-navigation-modes).

### 1.5 Multi-building journeys

| ID | Requirement | Status |
|---|---|---|
| FR-28 | The system shall support journeys from a room in one building to a room in another, split into indoor, outdoor and indoor legs. | ✅ |
| FR-29 | On leaving the origin building, the system shall return to the campus map with the outdoor leg ready. | ✅ in every mode, after the user confirms the exit (*Continue outdoors*) |
| FR-30 | The system shall support the direct indoor transfer between Rabin and Terrace buildings (stairs or shared elevator). | ✅ |
| FR-31 | A journey shall survive a page reload. | ✅ |

### 1.6 Services, safety and sharing

| ID | Requirement | Status |
|---|---|---|
| FR-32 | The system shall find the nearest restroom, clinic, gym, library, landmark or shelter from the start point, and highlight food places and shops on the map. | ✅ |
| FR-33 | The system shall offer a one-tap emergency route to the fastest reachable shelter. | ✅ |
| FR-34 | The user shall be able to save buildings and rooms as favourites. | ✅ |
| FR-35 | The user shall be able to share a route or place as a link and as a QR code. | ✅ |
| FR-36 | The system shall apply official status information (elevator outages, closures, no-go zones, opening hours) to routing and display. | ✅ from the live status published by the admin screen (it currently lists one noise area, at the Garden Café) |
| FR-37 | The user shall be able to report a problem with an elevator, a restroom or anything else. | ✅ sent to the campus team through the cloud inbox; kept on the phone until it can be sent |

### 1.7 Language and presentation

| ID | Requirement | Status |
|---|---|---|
| FR-38 | The interface shall be available in English, Hebrew, Arabic and Russian, with right-to-left layout for Hebrew and Arabic. | ✅ |
| FR-39 | Directions and spoken guidance shall follow the selected language. | ✅ |
| FR-40 | The system shall offer a high-contrast display mode. | ✅ |
| FR-41 | The system shall be able to read directions aloud. | ✅ |

## 2. Non-functional requirements

| ID | Category | Requirement | Status |
|---|---|---|---|
| NFR-01 | Usability | Main tasks (plan a route, start indoor navigation) need no more than a few taps; controls use clear labels and icons. | ✅ |
| NFR-02 | Accessibility | Touch targets of at least 44 px; visible focus; keyboard operation; ARIA roles for menus, lists and live status; respects `prefers-reduced-motion`. | 🟡 a few secondary buttons are 30–36 px; the outdoor route animation ignores reduced motion |
| NFR-03 | Responsiveness | The layout adapts to desktop (side panel + map) and phones (map on top, panels below). | ✅ |
| NFR-04 | Internationalisation | All interface strings exist in four languages; layout mirrors correctly in RTL. | 🟡 a few messages have no Russian text yet and show English (e.g. voice route planning in the Visual Impairment profile) |
| NFR-05 | Offline availability | After the first visit, the app, indoor graphs and floor plans work without a network. | ✅ (map tiles excepted) |
| NFR-06 | Performance | Route calculation completes within a moment on a phone for the campus-size graphs (about 1,070 outdoor and 2,850 indoor nodes). | ✅ |
| NFR-07 | Safety and honesty | The app never presents an unverified route as accessible, and labels sensor positions as estimates. | ✅ |
| NFR-08 | Privacy | No user accounts and no third-party analytics. Location, sensor readings, settings and favourites stay on the phone. Only problem reports, anonymous daily usage counts (no names, device ids, locations or times of day) and a live-status request are sent, to the campus team's cloud inbox. Route share links contain only place identifiers; a *Share my location* link contains the position the user chose to share. See [18](18-data-servers-and-offline.md). | ✅ |
| NFR-09 | Security | Served over HTTPS (required for sensors, microphone, clipboard and service worker). | ✅ (GitHub Pages) |
| NFR-10 | Portability | Runs in current Chromium-based browsers and Safari on Android, iOS, Windows and macOS without installation. | ✅ |
| NFR-11 | Maintainability | Indoor maps are data files (JSON) edited with a visual tool; shared logic lives in standalone modules covered by automated tests. | 🟡 much of the journey logic is still inline in the HTML pages |
| NFR-12 | Testability | Core algorithms and journey hand-offs have automated tests that run with plain Node.js. | ✅ 539 tests in 39 files, all passing (`node --test tests/*.test.cjs`) |
| NFR-13 | Deployability | No build step; the app can be served as-is by any static web server. The cloud inbox and the admin PC server are separate and optional for navigation. | ✅ |

## 3. User device and browser requirements

| Item | Requirement |
|---|---|
| Device | Any smartphone, tablet or computer with a modern browser |
| Browser | Current Chrome, Edge, Samsung Internet or Firefox; Safari on iOS / iPadOS 15.4 or later (the code uses modern JavaScript such as `?.`, `??` and `Array.at`) |
| Connection | Internet for the first visit and for map tiles; offline afterwards |
| Storage | About 75 MB of browser cache for the full offline package (floor plans are most of it) |
| Phone Sensors mode | Accelerometer and gyroscope/compass; phone held upright in portrait |
| Voice features | Text-to-speech voice installed for the chosen language; speech recognition support for voice search (best in Chrome and Edge) |
| Secure context | The app must be opened over `https://` (or `http://localhost`) for sensors, microphone, clipboard and offline support |

## 4. Permissions

| Permission | Used for | When requested | Required? |
|---|---|---|---|
| Location | GPS start point; live outdoor guidance; *Share my location*; automatic start for Nearest shelter, shared links and class reminders when no start is chosen | When pressing the GPS button, starting outdoor guidance or *Share my location*, or when Nearest shelter, a shared link or a class reminder needs a start | Optional; falls back to Carmel Gate |
| Motion and orientation | Phone Sensors mode | When starting Phone Sensors navigation (iOS shows a prompt) | Only for that mode; if refused, tap-to-confirm checkpoints are used instead |
| Microphone | Voice search | When pressing a microphone button | Optional |
| Clipboard | Copy link / copy report | On button press | Optional |

## 5. Development requirements

| Tool | Version | Purpose |
|---|---|---|
| Git + GitHub (GitHub Desktop or CLI) | any | Version control and collaboration |
| Node.js | 18 or newer (tested on 22) | Running the automated tests (`node --test`), and optionally `npx http-server` |
| Python 3 (alternative) | any 3.x | `python -m http.server` as a local web server |
| A modern browser | – | Manual testing; desktop DevTools device emulation |
| A real Android phone and iPhone | – | Testing sensors, speech and permissions |
| Code editor | e.g. VS Code | Editing; Mermaid preview for the diagrams |

No package manager install is needed: the project has no `package.json` and no third-party runtime dependencies besides the vendored Leaflet.

## 6. Hosting requirements

- Any static file host that serves over HTTPS (the project uses GitHub Pages).
- The site may live in a sub-path (e.g. `/CampusWay/`); all paths in the app are relative.
- The public app needs no server-side code, database or environment variables.
- Problem reports, usage counts and the live campus status use the cloud inbox (a Cloudflare Worker with a D1 database, free plan) and the admin PC server (Node.js, JSON files). See [18 · Data, servers and offline use](18-data-servers-and-offline.md).

## 7. Assumptions and constraints

- Indoor maps are only as accurate as the mapped graphs; the app does not check the current physical conditions on site.
- Indoor distances assume a common scale for all floor plans (see [07 · Algorithms](07-routing-and-navigation-algorithms.md#indoor-distances-and-eta)).
- Live status is edited by the campus team in the admin screen and published through the cloud inbox (`app/data/campus-status.json` is the offline fallback); there is no connection to university systems.
- Outdoor paths come from OpenStreetMap (ODbL) plus team corrections and must be refreshed by hand.

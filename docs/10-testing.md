# 10 · Testing

> How CampusWay is tested: the automated test suite (what each file covers and how to run it), the latest results, what is not covered automatically, and a manual checklist for testing on real phones.

## 1. Running the tests

From the project folder:

```powershell
node --test tests/*.test.cjs
```

Run one file:

```powershell
node --test tests/step-integration.test.cjs
```

Requirements: Node.js 18 or newer. No `npm install` is needed; the tests use only Node's built-in modules.

## 2. Latest result

| Date | Node.js | Tests | Passed | Failed | Duration |
|---|---|---|---|---|---|
| 2026-10-07 (commit `521863b`) | 22.22.0 | 171 | 171 | 0 | about 1.7 s |

## 3. How the tests work

- **Pure modules** (`route-planner.js`, `route-progress.js`, `step-detector.js`, `heading-tracker.js`, `wheelchair-navigation.js`, `route-instructions.js`) are loaded with `require()` and tested directly.
- **Page logic** inside `index.html` and `wayframe/navigation-demo.html` is tested by reading the HTML, cutting out the needed part of the inline script between known marker strings, and running it in a `node:vm` sandbox with a fake DOM and storage.

> ⚠️ Because of this, the marker strings used by the tests must stay in the HTML when the code is changed. Examples are `let routePath=[];`, `const svg=$('mapSvg')`, `function buildGraph(){` and `function route()` in `navigation-demo.html`, and `const PROFILE_IDS` and `const ICONS =` in `index.html`. If a test fails on an assertion that names one of these strings after a refactor, the marker was moved or renamed.

- **Real data** is used where it matters. For example, the tests check that the real Terrace graph has no step-free route to floor −1, and that the Student House graph is fully connected.

## 4. Test files

| File | Tests | What it covers |
|---|---|---|
| `accessibility-routing.test.cjs` | 11 | Mobility profile is kept; outdoor Mobility excludes steps; Spatial prefers fewer turns; a failed step-free route clears the old route and draws no fallback; indoor step-free routes use elevators only; the Mobility indoor lock |
| `heading-tracker.test.cjs` | 28 | Compass calibration; relative vs iOS headings; invalid, stale and oscillating readings; reverse detection; 0°/360° wrap-around; posture and rotation changes |
| `journey-transition.test.cjs` | 5 | Resuming Main → Rabin after a reload; room destinations re-offer *Continue indoors*; rebuilding the journey from stored contexts; language restore; finishing the origin leg opens the outdoor leg |
| `mental-health-routing.test.cjs` | 5 | Rest-space discovery and labelling; Rest Spaces shown first for the Mental Health profile |
| `route-instructions.test.cjs` | 5 | One turn on an L-shaped route; small wiggles ignored; nearby buildings named; stairs step; "passing X" on long walks |
| `route-progress.test.cjs` | 17 | Segment geometry, forward and backward travel, corners, clamping, floor boundaries, direction candidates, invalid input |
| `sensor-direction.test.cjs` | 11 | Sensor test page: calibration, turning in place, 5 forward + 3 back = 2 net, delayed batches, reset, tilt and background behaviour |
| `spatial-routing.test.cjs` | 6 | Fewer turns without large detours; small bends; no penalty for floor changes; no loops; rest-space candidates |
| `start-search.test.cjs` | 6 | Start-point room search (bare and translated prefixes), exact match on Enter, duplicate room numbers across buildings, unmapped rooms explained |
| `step-detector.test.cjs` | 26 | Noise rejection, gravity rotation, cadence confirmation, slow walking (1.2–1.8 s steps), 30/60/100 Hz sampling, pauses, malformed input, clock jumps, unstable orientation |
| `step-integration.test.cjs` | 37 | End-to-end indoor navigation: calibration gating, step animation queue, stairs confirmation, mode switching, permissions, background and rotation, wheelchair checkpoints, Spatial elevator guidance, shared-elevator ride restore, reject and exit, Auto mode floor skipping |
| `student-graph-source.test.cjs` | 8 | Both pages and the service worker use the same graph files; no stale suggestions; Main floor 600 updates; Rabin–Terrace transfer nodes; Student House graph connectivity and room search |
| `wheelchair-navigation.test.cjs` | 6 | Checkpoint simplification, turns and elevator boundaries, multi-floor rides, noise tolerance, going back, distance excluding vertical travel |
| **Total** | **171** | |

## 5. Not covered by automated tests

| Area | How it is checked instead |
|---|---|
| Visual layout, RTL and high contrast | Manual browser testing (desktop and device emulation) |
| Real sensor behaviour on phones | `wayframe/sensor-test.html` and walking tests (checklist below) |
| Speech synthesis and recognition | `wayframe/audio-test.html`, `wayframe/mic-test.html` and manual use |
| `campus-status.js`, `qr-code.js`, `share.js`, `campus-ui.js` | Manual testing |
| Integrity of `data.js` and `campus-osm.json` | Manual route checks, the routing debug view (`showOutdoorDebugGraph()`) |
| Service worker and offline mode | DevTools → Application → Service Workers / Offline |

## 6. Manual test checklist (real phones)

Use the HTTPS live app. Test on at least one Android phone (Chrome) and one iPhone (Safari).

### Campus map

- [ ] Language screen appears; each language switches the text and the direction (RTL for Hebrew and Arabic).
- [ ] Search finds a building, a room number, a food place and a service word, in all three languages.
- [ ] GPS button sets the start (permission prompt appears).
- [ ] Voice search fills the field (Chrome).
- [ ] Route between two buildings shows a line, an ETA and directions; *Read aloud* speaks them.
- [ ] Mobility profile changes the route or reports "no step-free route".
- [ ] Each *Services near me* button behaves as described in [02 · Features](02-features.md#4-services-near-me).
- [ ] *Nearest shelter* gives a red route card.
- [ ] Favourites: save, reopen after closing the browser, remove.
- [ ] Share: QR scans on a second phone and opens the same route.
- [ ] High contrast is readable in sunlight.

### Indoor navigation

- [ ] *Continue indoors* opens the right building, entrance and destination.
- [ ] Floor-plan toggle, floor buttons, zoom and pan work by touch.
- [ ] Auto mode runs to the arrival dialog.
- [ ] Manual / Wheelchair: checkpoints are sensible; *Previous point* works; elevator confirmation.
- [ ] Phone Sensors: permission prompt (iPhone); calibration succeeds when held upright; 20 normal steps move the marker about 13 m; standing still adds no steps; turning around moves it back; stairs and elevator confirmation.
- [ ] Origin leg returns to the campus map automatically with the outdoor leg drawn.
- [ ] Rabin ↔ Terrace shared elevator: the ride continues across the page change.
- [ ] Voice guidance speaks new instructions in the selected language.

### PWA and offline

- [ ] Install to the home screen; it opens standalone.
- [ ] Turn on airplane mode: search, routing, indoor navigation and QR still work; the map shows outlines without tiles.
- [ ] After a new release (`CACHE_NAME` changed), reopening the app loads the new version.

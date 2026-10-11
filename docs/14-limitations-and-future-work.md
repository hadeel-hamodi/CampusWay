# 14 · Limitations and future work

> An honest list of what the current version of CampusWay does not do, or does only approximately, followed by ideas for future development.

## 1. Known limitations

### Positioning and navigation

| Limitation | Impact | Why |
|---|---|---|
| Phone Sensors mode estimates position along the **planned route** only | The indoor position is an estimate: leaving the route is not detected, and the marker can drift | No indoor positioning infrastructure (beacons, Wi-Fi fingerprinting) is available; step counting is relative |
| Fixed step length (0.65 m) | Distance error grows for people with shorter or longer steps | No per-user calibration yet |
| Phone must be held upright in portrait | Position updates pause when the phone is pocketed or tilted | The heading is only reliable in this posture |
| Walking backwards without turning around is not supported | Steps are treated as ambiguous | Direction comes from the phone's heading |
| Live outdoor guidance depends on GPS accuracy | Guidance pauses while the position is less accurate than 30 m; when the user leaves the route the app says so, but it does not plan a new route | Phone GPS is often imprecise between buildings |
| The shared Rabin ↔ Terrace elevator is always used for that transfer | A reported outage of that elevator is not applied to journeys between the two buildings | The transfer is a fixed connection between the two graphs |

### Map data and coverage

| Limitation | Details |
|---|---|
| Indoor maps for 6 of 10 buildings | Eshkol Tower, Arts, Bloom, and Welfare and Health are outdoor only |
| Multi-Purpose Building: only floor 1 is mapped | Floors −1, 0 and 2 have no nodes (the unconnected floor 0 nodes were removed), and its stairs and elevators have no connector IDs, so indoor navigation stays on floor 1 |
| Step-free gaps | Terrace Building floors 0 and −1 have no mapped elevator, so no step-free route reaches them |
| One scale for all floor plans | Indoor distances and times use 132.6 m × 101.2 m for every drawing, so they are approximate |
| Data quality | 88 of 206 stairs and elevator nodes have no connector ID (so they are not linked between floors), one destination still has a placeholder name, and some restroom names are machine-translated. The admin **Data health** page lists them |
| Outdoor network | Based on an OpenStreetMap snapshot plus hand corrections; it must be refreshed by hand when paths change |

### Platform and infrastructure

| Limitation | Details |
|---|---|
| Reports reach the team only through the PC | Phones send reports to the cloud inbox; the campus team sees them only after the PC running the CampusWay server fetches them (every 5 minutes while it is on). While the PC is off, reports wait in the inbox for up to 90 days ([17 · Admin screen](17-admin-screen.md)) |
| The admin screen runs on one PC | It works only on the PC that runs the server (unless started with `--lan-admin`), and that PC holds all reports and history in `server/db/` |
| Cloud inbox free-plan caps | 30 reports and 600 usage counts per device per hour; 1,000 reports and 20,000 counts per day for the whole inbox; a 100 MB database. Above a cap new data is refused until the cap resets (the next hour or day); phones keep unsent reports and try again later ([`cloud/README.md`](../cloud/README.md)) |
| Map tiles are not saved for offline use | CampusWay does not cache OpenStreetMap tiles; offline, the map shows routes and markers without streets |
| Large offline package | About 75 MB on the first install, mostly floor plans |
| No vibration on iPhones | Safari and other iOS browsers do not support vibration, so the Visual profile's vibration works only on Android |
| Schedule reminders only while CampusWay is open | There are no push notifications; a reminder appears in the open app up to 15 minutes before a saved class |
| Browser-dependent features | Voice search, available voices and sensor permissions differ between browsers and devices |

### Languages

- In Arabic, food places and shops keep their Hebrew names (buildings have Arabic names with the Hebrew name in brackets).
- A few status and error messages are English only, e.g. the *Plan route by voice* questions in Russian.

## 2. Future work

### Short term

- [ ] Finish the Multi-Purpose Building graph (floors −1, 0 and 2, connector IDs).
- [ ] Map an elevator for Terrace floors 0 and −1, or document the step-free alternative.
- [ ] Apply a reported outage of the shared Rabin ↔ Terrace elevator to journeys between the two buildings.
- [x] Arabic names for buildings (food places and shops still to do).
- [x] Remember language, profile, high contrast, the audio guide and text size between visits.
- [x] Load the JSON graphs directly; the JS graph copies are no longer used by the app.
- [ ] Add a per-building, per-floor scale (metres per unit) to each graph file.
- [x] Data validation: the admin **Data health** page checks isolated nodes, missing connector IDs, entrances that are not `entrance` nodes and placeholder labels; `map-data-integrity.test.cjs` checks ids, connections, entrances and places in the test suite.

### Medium term

- [ ] **Step-length calibration:** walk a known distance once and store the user's step length.
- [ ] **Off-route detection** in sensor mode (e.g. heading persistently differs from every route candidate).
- [x] **Live outdoor guidance:** follow GPS along the outdoor route, highlight and speak each step, and show *You have arrived!* at the end.
- [x] **Arrival confirmation in Phone Sensors mode:** the user confirms arrival with a tap.
- [x] **Reports and status on one PC:** the CampusWay local server and admin screen ([17](17-admin-screen.md)).
- [x] **Cloud inbox** (a free Cloudflare Worker, [`cloud/`](../cloud/README.md)), so reports from the public site also reach the facilities team. It is set up and live.
- [x] **Live status without git:** saving in the admin screen publishes the status through the cloud inbox; no commit is needed.
- [ ] **Accessibility audit** with screen readers (TalkBack, VoiceOver) and with users from each profile group.
- [ ] Move the journey logic (`routeTo`) and the indoor-page logic out of the HTML files into tested modules.
- [ ] Continuous integration (GitHub Actions) to run the tests on every pull request.

### Long term

- [ ] Indoor positioning with Bluetooth beacons or Wi-Fi fingerprinting in key buildings.
- [ ] Map the remaining buildings (Eshkol Tower, Arts, Bloom, Welfare and Health).
- [ ] Live crowd and noise information for rest spaces (today: noisy areas set in the admin screen and users' rest-space reports).
- [ ] Timetable integration ("navigate to my next class"). Partly done: schedule reminders in Settings start the route to a saved class.
- [x] An admin page for editing the campus status without touching JSON (`admin.html`).

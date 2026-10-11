# Changelog

The development history of CampusWay, grouped by milestone and summarised from the Git commit history. CampusWay is deployed continuously from `main`; the service-worker cache name (`campusway-vNN-…`) changes with each release (currently `campusway-v68-fresh-maps`).

## 2026-10-11 · Arrival screen, vibration, screen-reader names and fresh maps

**Added**
- *You have arrived!* screen at the end of an outdoor journey, with *Done* and *New route from here* (pull request #19).
- Vibration for the Visual Impairment profile: one pulse before a turn, two for a floor change, three on arrival (`app/ui/haptics.js`; Android only, iPhones do not support it) (#18).
- Map icons have names for screen readers, also after an icon or the language changes (#17).
- Routes start from the phone's position when it is on campus and no start was chosen, also for the shelter button, shared links and schedule reminders; otherwise from the gate, with a message (#15).
- Voices per language (`app/ui/speech-voice.js`): the app picks the best installed voice (including Android's Hebrew "iw" voices), explains how to add a missing one, and reads distances as words (#11).
- Favourites from service popups; problem reports for the Multi-Purpose Building.
- Building-journey regression tests for every building and profile (`building-journeys.test.cjs`). The suite now has 539 tests in 39 files, all passing.

**Changed**
- Indoor maps and floor plans are fetched network-first, so map fixes reach phones at once (cache `campusway-v68-fresh-maps`, #12).
- Updated indoor graphs (Terrace, Main, Multi-Purpose, Education); the unconnected Multi-Purpose floor 0 nodes were removed.
- Improved spoken guidance indoors and outdoors and the demo pacing; the indoor directions panel is shorter and keeps the current step centred.
- README and app screenshots updated.

**Fixed**
- Indoor routes no longer leave a floor and come back to save a few metres: a floor change now costs 12 m by elevator and 36 m by stairs, as in the campus planner (#13).
- When motion sensors are refused or send no readings, indoor guidance continues with tap-to-confirm checkpoints on the same route instead of stopping (#14); the reminder to confirm only on arrival is shown at the first point only (#16).
- Terrace → Rabin → Main journeys through the shared elevator; Rabin outdoor routes are kept.
- Gym and service destinations use an entrance from which they can really be reached.
- Journey stages, indoor guidance timing and step highlights; schedule room labels and suggestion ranking.
- Navigation test fixtures updated to the new screens, with more shelter coverage (by Jasmin).

## 2026-10-10 · Journey polish and the outdoor shelter

**Added**
- An outdoor shelter on the map; the shelter button can route to it without an indoor hand-off.
- Confirmation dialogs before a journey is cancelled; demonstrations pause while a dialog is open.

**Changed**
- Rabin ↔ Terrace transfers use the shared elevator for every profile; simpler journey labels.
- Mobile guidance and demo journey transitions; indoor route preview layout and endpoint labels; schedule form spacing and the *Add class* button.

**Fixed**
- Journey hand-offs, indoor speech and route time previews.
- Audio cancellation and phone speech recovery; an entrance connection and the search controls; continuous outdoor demo movement.

## 2026-10-09 · Admin screen, local server and cloud inbox

**Added**
- `admin.html` (pull request #9): reports inbox, live status editor (elevator outages, indoor closures on the floor plan, outdoor zones, noisy areas) with route-impact previews, announcements and emergency mode, place names and opening hours, map data-health checks, usage insights, admin accounts with roles, activity log and status-file history.
- `server/campusway-server.js`: a local server with no dependencies that serves the app and saves reports, admin accounts, usage counts and the audit log as JSON files in `server/db/` (git-ignored). `start-admin.bat` starts it on Windows.
- The app sends problem reports and anonymous usage counts to the local server when it is opened from it (and, from GitHub Pages, to the cloud inbox below), and shows reporters the status of their reports.
- Announcement and emergency banners on the campus map and indoor pages; name corrections from the status file.
- 55 new tests: emergency shelter routing, live status in routing, campus reachability, map data integrity, shared links, opening hours and offline caching.
- Admin **Tests** page: runs the automated tests on the PC and shows passes, failures and error details (administrators only).
- Admin **Storage** page with a 10 GB limit for the PC's data and storage and daily caps for the cloud inbox.
- Cloud inbox (`cloud/`): a free Cloudflare Worker + D1 that collects reports and usage counts from the public site. The PC server fetches them every 5 minutes and sends report statuses back; the admin screen's **Cloud inbox** page walks through the setup.

- Live status without commits (#10): saving in the admin publishes announcements, emergency mode, outages, closures, names and hours to the cloud inbox, and the app reads them from there (the repository file stays as the offline copy). Failed publishes retry automatically; **Publish now** on the Overview page.

**Changed**
- Indoor phone layout: a simpler navigation card with expandable directions, zoom controls and a distance-based progress line.
- Settings layout with compact language and profile pickers.

**Fixed**
- Nearest shelter for the Mobility profile: no longer picks an entrance or shelter that has no step-free route (it used to fall back to a straight-line guess, sending wheelchair users towards routes the app then refused to draw); says honestly when no step-free shelter exists.
- Nearest shelter and journey times now respect live elevator outages and closures, like the indoor page; closed shelters are never offered.
- Searching for a route that only stairs could reach took over a second each time (a mapping diagnostic compared every pair of path points); the shelter search is about 14× faster.
- Shared links to a place with several branches (Pilpelet Cafe) opened the wrong branch; such links now name the building (old links still work).
- Indoor demo-mode hand-off; duplicate highlighting in the indoor direction steps.

## 2026-10-07 – 2026-10-08 · Russian, outdoor GPS guidance, reminders and journey plans

**Added**
- Complete Russian localisation: interface, search, indoor directions, sharing, campus status and the audio guide (`ru-RU`) (by Hadeel).
- Live outdoor GPS guidance along the route, and a demonstration mode (`?demo=1`) with simulated movement that hands over to the indoor arrival.
- Optional schedule reminders in Settings that start the route to a class (by Hadeel).
- *Share my location* (a one-time link), Arabic building names with the Hebrew name in brackets, and more flexible multilingual search (by Hadeel).
- Multi-stage journey plans that adapt to each route and advance across building transfers, with the user deciding when to continue; mobile directions in a compact side drawer; *New route from here* after arriving indoors (pull requests #7 and #8, by Hadeel).
- *Plan route by voice* for the Visual Impairment profile.
- Quiet spaces and the *I need a break* button for the Sensory & Wellbeing Support profile, whose routes now prefer quieter paths (emergency routes keep shelter priority); updated smoking areas and condition reports.
- Project documentation in `docs/` (pull request #6).

**Changed**
- The *Mental Health Support* profile is now called *Sensory & Wellbeing Support* (its internal id `mental` is unchanged).
- The indoor navigation mode is chosen automatically, and the audio setting is shared across the journey.
- Finished Terrace indoor graph; updated Main, Education and Student House indoor graphs.
- Simpler report dialogs (with elevator and rest-space reports) and indoor arrival actions; the retired indoor prototype and duplicate indoor controls were removed.
- A manual high-contrast choice is kept when the profile changes.

**Fixed**
- Restrooms, shelters, food places and shops chosen from *Services near me* or *Navigate here* keep their indoor destination when continuing indoors; in Phone Sensors mode the user now confirms arrival.
- Terrace hand-off, arrival and map controls; the indoor route card for room journeys.

## 2026-10-04 – 2026-10-06 · Polish, integration and documentation

**Added**
- First-run setup that saves the language and profile on the device; display controls moved to Settings; persistent text size and complete high contrast (by Hadeel, merged on 7 October in pull request #3).
- Finished Education and Science indoor graph; updated Multi-Purpose indoor graph.
- Voice search for the starting point; rest-space previews on the map.
- Project README.
- Translated floor-plan toggle in indoor navigation; the schematic map is the default view.
- Translated indoor turn instructions and new direction icons.

**Changed**
- Merged the *Enhance-UI-UX* branch (interface and experience improvements).
- Pages, scripts and styles are fetched network-first, so an old cached page cannot miss new preferences or styles (by Hadeel).
- Favourites are the default tab; standalone indoor shortcuts hidden from the campus screen.
- Compact shelter button on phones; building labels shown at closer zoom.
- Simplified indoor route controls; manual destination arrival needs one confirmation; removed redundant outdoor exit confirmations.

**Fixed**
- Shared-elevator rides are preserved across building transfers (with tests); stale route guidance is cleared.
- Sensor pause recovery and reverse-direction retries (Hadeel's branch integrated).

## 2026-10-01 – 2026-10-03 · Search, favourites and multi-building journeys

**Added**
- Persistent favourites for rooms and places.
- Multilingual place search; audio tools; translated map popups and destination labels.
- Expanded place search and starting points; better service labels.
- Comparison of shared indoor transfers (stairs vs elevator); automatic indoor route display.

**Changed**
- Integrated the route planner, wheelchair navigation and sensor improvements into one flow.
- Unified indoor graph sources (one Rabin graph; Student House was unified on 2026-09-28).

**Fixed**
- Indoor transition hand-off logic; navigation resumes across shared building transfers.
- Sensor calibration and stairs floor confirmation.

## 2026-09-26 – 2026-09-30 · Accessibility profiles and campus-wide routing

**Added**
- *Mobility* routes that safely avoid stairs; step-free wheelchair checkpoint navigation.
- *Spatial* routing with fewer turns; suggested rest spaces (*Mental Health Support*).
- Multi-building routing Main → Terrace, with full ETA across buildings.
- Indoor routing to campus food places and to the Yozma shop; shops and indoor shelter services; service filters.
- Terrace gym routing; Student House routes and entrances; outdoor elevator and stairs markers.
- Cross-building routes resume after indoor navigation.

**Changed**
- Many updates to the outdoor routing graph, campus paths and building entrances (Main, Rabin, Terrace, Multi-Purpose, Student House).
- App updates activate without reopening tabs.

**Fixed**
- Same-building indoor routing and outdoor transitions; Madriga ↔ Main routing chain; starting-room search.

## 2026-09-24 – 2026-09-25 · Continuous room-to-room navigation

**Added**
- Continuous room-to-room navigation flow (indoor → outdoor → indoor).
- Room search for starting points; verified entrance hand-offs for all mapped buildings.
- Main ↔ Rabin bridge routing; Terrace (Madriga) ↔ Rabin indoor transfer.
- Accessible entrance filtering for outdoor routes; WayFrame remembers the last selected floor.

**Fixed**
- Calibrated turnarounds and recovery after temporary phone tilt in sensor navigation.
- Indoor distance calibration.

## 2026-09-19 – 2026-09-23 · Outdoor routing, PWA and floor plans

**Added**
- OpenStreetMap-based outdoor routing with a campus correction layer and pedestrian crossings; route distance used for walking ETA.
- Progressive Web App with offline support (service worker, manifest); local OSM data.
- Floor-plan backgrounds in indoor navigation for all buildings (by Hadeel).
- Nearby campus services; indoor services in search and navigation.
- Room search with indoor hand-off for Main, Rabin and Student House; then Education and Multi-Purpose.
- Multilingual indoor navigation.

**Changed**
- OpenStreetMap base tiles restored on the campus map (pull request #1 by Hadeel).
- Step detection shared between pages and tuned for slower walking.
- Expanded offline cache.

## 2026-09-12 – 2026-09-18 · Phone sensors and the first connected app

**Added**
- Indoor navigation with route testing.
- Phone step detection, tuned with real sensor readings: cadence validation, orientation-stability filtering, smooth movement.
- Heading sensor test and standalone sensor test page; live map rotation with phone heading.
- Accessible (step-free) indoor routing.
- Main app published and connected to indoor navigation, with room search, mobile layout and return to the campus map.

**Changed**
- Indoor navigation uses real-world distances.

## 2026-08-26 – 2026-09-10 · Mapping foundation

**Added**
- **WayFrame** node plotter for drawing indoor graphs: undo/redo, zoom, node editing, published-graph loading, remembered building.
- Node types: food, gym, restroom, shelter, library, museum, parking, clinic.
- Building folder structure and floor plans for Main, Multi-Purpose, Rabin, Student House, Education and Terrace.
- Indoor graphs for Terrace (Madriga), Main Building and Rabin Building; Rabin room-number prefixes.

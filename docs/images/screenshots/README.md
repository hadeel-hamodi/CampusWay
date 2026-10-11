# Screenshots

Screenshots of CampusWay taken on 11 October 2026 from branch `Fix-docs-data-and-servers` (based on `main` at `5b2d9d5`). The five phone screenshots were retaken the same day from `main` at `1558574`, with the resizable phone panel. They are used throughout the documentation and can be reused in reports and presentations.

**How they were taken:** headless Chrome, desktop at 1440 × 900 and phone at 390 × 844 (2× pixel density), with the service worker disabled. The app was served by `server/campusway-server.js` with a throwaway database, and the simulated GPS position was on campus. The OpenStreetMap street tiles were online, so the campus map shows the street map under the building outlines. Indoor journeys marked *demo* used `?demo=1`, which simulates walking.

## Campus map (desktop)

| File | Shows |
|---|---|
| `main-01-language-picker.png` | First screen, step 1 of 2: choose English, Hebrew, Arabic or Russian |
| `main-02-home.png` | Campus screen: top bar (*Nearest shelter*, *Settings*), route planner, services, share my location, favourites, map and map key |
| `main-03-outdoor-route.png` | Route Student House → Main Building with ETA and directions |
| `main-04-search-suggestions.png` | Destination search for "libr": nearest-library service and the Library room |
| `main-05-accessibility-profiles.png` | *Settings* dialog with the navigation profile list open: General User, Mobility, Visual Impairment, Spatial / Navigation, Sensory & Wellbeing Support |
| `main-06-mobility-route.png` | Step-free route Student House → Rabin Building (Mobility profile) |
| `main-07-room-to-room-journey.png` | Room 521 (Main) → Room 1001 (Terrace) with *Start indoor route* and the four journey stages |
| `main-08-rest-spaces.png` | Sensory & Wellbeing Support profile: *I need a break* button and rest spaces highlighted on the map |
| `main-09-food-places.png` | Food places highlighted, with the Garden Cafe popup |
| `main-10-nearest-shelter.png` | Emergency route from the user's GPS position to the nearest shelter (red card) |
| `main-11-share-qr.png` | Share dialog with QR code and link |
| `main-12-hebrew-rtl.png` | Hebrew interface (right-to-left) with a route |
| `main-13-arabic-rtl.png` | Arabic interface (right-to-left) with a route |
| `main-14-high-contrast.png` | High-contrast mode (turned on in *Settings*) with a route |
| `main-15-favourites.png` | Favourites list with a building and a room |
| `main-16-building-popup.png` | Rabin Building popup: Navigate here, Save to Favourites, Report a problem |
| `main-17-report-dialog.png` | *Report a problem* dialog for Rabin Building |

## Indoor navigation (desktop)

| File | Shows |
|---|---|
| `indoor-01-route-schematic.png` | Rabin entrance (floor 7) → room 5007 via the elevator, schematic view, ready to start |
| `indoor-02-route-floor-plan.png` | Same route over the floor plan |
| `indoor-03-auto-mode.png` | Auto mode (demo) in Main Building, room 614 → 717, after taking the stairs to floor 700 |
| `indoor-04-wheelchair-mode.png` | Mobility profile, room 614 → 717 via the elevator: large *✓ I reached the next point* and *Previous point* buttons |
| `indoor-05-phone-sensors-setup.png` | Phone-sensor guidance explanation (ⓘ dialog) on the Rabin route, before Start |
| `indoor-06-arrival.png` | "You have arrived!" dialog (room 717) |
| `indoor-07-hebrew.png` | Indoor navigation in Hebrew (Rabin, demo) |
| `indoor-08-arabic.png` | Indoor navigation in Arabic (Student House, entrance → room 201) |

## Phone layout

| File | Shows |
|---|---|
| `mobile-01-home.png` | Campus screen on a phone: the map on top and the route planner in the panel below it, with the blue resize handle |
| `mobile-02-route.png` | Route Student House → Main Building on a phone: map with the direction strip, and the route card in the half-open panel |
| `mobile-03-route-directions.png` | Route on a phone with the directions list opened from the direction strip |
| `mobile-04-indoor.png` | Indoor route in Main Building (room 705 → 716, Spatial profile) on a phone, ready to start |
| `mobile-05-indoor-navigating.png` | Auto navigation (demo) in progress on a phone |

## Developer tools

| File | Shows |
|---|---|
| `tool-01-wayframe-editor.png` | WayFrame node plotter with the published Terrace (Madriga) floor 3 graph |

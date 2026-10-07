# CampusWay

CampusWay is a University of Haifa student project for indoor and outdoor campus navigation, with multilingual guidance and accessibility profiles.

[Open the live app](https://ja4smin.github.io/CampusWay/)

## Features

- Outdoor routing along the mapped campus path network.
- Indoor routing between rooms and across floors.
- Connected journeys between buildings.
- English, Hebrew, Arabic and Russian interfaces.
- Accessibility profiles, including Mobility and Spatial routing.
- Search for rooms, buildings, food places, shops and campus services.
- Voice search and voice guidance.
- Saved favourites.

## Run locally

Install Node.js, then open a terminal in the project folder and run:

```powershell
npx.cmd http-server . -p 8080 -c-1
```

Open:

http://localhost:8080/

Keep the terminal open while using the app. Press Ctrl+C to stop the server.

A static HTTP server is the local preview setup used for this project.

## Plan a route

Choose the start and destination on the main campus screen. A mapped indoor room can be used as either point.

Open indoor navigation when the planned journey offers it. The indoor page restores the route automatically.

Indoor navigation modes:

- **Auto:** simulates movement for previews and demonstrations.
- **Phone Sensors:** estimates progress along the planned route from detected steps and calibrated phone heading.
- **Manual / Wheelchair:** advances between checkpoints when the user confirms reaching them.

Elevator and stairs transitions in Phone Sensors mode require user confirmation. Shared elevator journeys preserve the pending ride when switching between buildings.

## Accessibility and limitations

Mobility routing excludes mapped stairs. If no mapped step-free route is available, the app reports that instead of drawing an unverified fallback.

Accessibility depends on the accuracy and completeness of the mapped network. A calculated route does not verify current physical conditions.

Indoor sensor positioning is an estimate. It does not detect whether the user has left the planned route, and it requires testing on real phones.

Phone sensor access requires a secure context. Use the HTTPS live app for phone testing; a local network HTTP address may not support sensors.

Speech and voice-search support vary by browser and installed voices.

## Tests

Run the full test suite from the project folder:

```powershell
node --test tests/*.test.cjs
```

Run the navigation integration tests:

```powershell
node --test tests/step-integration.test.cjs
```

Automated tests cover routing, search, sensor logic and journey transitions. They complement manual browser and real-phone testing.

## Project structure

- `index.html` — main campus map and route planning.
- `app/prototype/` — campus data and routing logic.
- `app/ui/` — interface styles and supporting UI code.
- `buildings/` — indoor graph JSON files and floor plans.
- `wayframe/navigation-demo.html` — indoor navigation.
- `wayframe/` — route planning, sensor and checkpoint helpers.
- `tests/` — automated tests.
- `service-worker.js` — offline caching and app updates.

## Development notes

The team uses separate branches to review and combine changes before merging them into `main`.

Interface changes should preserve existing routing and journey behaviour. Validation includes automated tests and manual navigation checks.

Offline app files are managed in `service-worker.js` through `CACHE_NAME` and `APP_FILES`.

The interface supports English, Hebrew, Arabic and Russian.

## Project status

CampusWay is a student project under active development. Mapping coverage, device testing and guidance continue to be refined.

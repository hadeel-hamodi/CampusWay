# 01 · Project overview

> CampusWay is an accessible indoor and outdoor navigation web app for the University of Haifa campus. It guides people from a starting point, which can be a room inside a building, across campus paths and into the exact destination room, in English, Hebrew, Arabic or Russian.

**Live app:** <https://ja4smin.github.io/CampusWay/>

![CampusWay campus map with a planned route](images/screenshots/main-03-outdoor-route.png)

## The problem

The University of Haifa campus is large and multi-level. Buildings are connected by bridges, shared elevators and stairs, and room numbers do not show which floor or wing a room is on. Existing map apps stop at the building door. They know nothing about indoor corridors, which entrances are step-free, or where the nearest shelter or restroom is inside a building.

This is hardest for:

- new students and visitors who do not know the campus;
- people who use a wheelchair or crutches and need step-free routes;
- people with visual impairments, who need spoken guidance;
- people who find complex directions or crowded places stressful.

## Goals

1. **Door-to-door guidance.** One continuous journey from a start point (a gate, a building, GPS, or a room) to a destination room, across outdoor paths and indoor floors.
2. **Accessibility first.** Routing and guidance adapt to the user's needs through accessibility profiles, and the app says honestly when no step-free route is mapped.
3. **Four languages.** English, Hebrew, Arabic and Russian. Hebrew and Arabic use a full right-to-left layout; Russian is left-to-right.
4. **Works on a phone, even offline.** An installable Progressive Web App (PWA) that keeps working after the first visit.
5. **Offline first, with almost no server.** The app is static files on GitHub Pages, saved on the phone after the first visit; routes are calculated on the phone. Two small services serve only the campus team: a free cloud inbox (Cloudflare Worker + D1 database) for problem reports, anonymous counts and the live campus status, and a PC server with the admin screen that keeps its data in JSON files. See [18 · Data, servers and offline use](18-data-servers-and-offline.md).

## Target users

| User group | What CampusWay offers |
|---|---|
| New students and visitors | Search by room number, building or service; turn-by-turn directions that follow your position; floor plans; optional class reminders |
| Wheelchair and crutch users | *Mobility* profile: stairs excluded indoors and outdoors, step-free entrances only, elevator transfers, slower walking speed for the time estimate, and tap-to-confirm indoor navigation |
| People with visual impairments | *Visual Impairment* profile: High Contrast and the Audio Guide turn on, routes can be planned by voice, and Android phones vibrate before turns, at floor changes and on arrival |
| People who prefer simpler routes | *Spatial / Navigation* profile: routes with fewer turns and countdown-style indoor instructions |
| People who find busy places stressful | *Sensory & Wellbeing Support* profile: quieter outdoor paths, rest spaces with travel time, and an **I need a break** button |
| Everyone in an emergency | One-tap **Nearest shelter** routing |

## Campus coverage

| Building | On the campus map | Indoor map (graph) | Indoor navigation | Floors mapped |
|---|:-:|:-:|:-:|---|
| Main Building | ✓ | ✓ | ✓ | 500, 600, 700 |
| Rabin Building | ✓ | ✓ | ✓ | 5, 6, 7 |
| Terrace Building (Madriga) | ✓ | ✓ | ✓ | −1, 0, 1, 2, 3, 4 |
| Student House | ✓ | ✓ | ✓ | 0–4 |
| Education and Science | ✓ | ✓ | ✓ | 1–6 |
| Multi-Purpose Building | ✓ | partial | floor 1 only | 1 (floors −1, 0 and 2 have drawings but no graph yet) |
| Eshkol Tower | ✓ | – | – | – |
| Arts Building | ✓ | – | – | – |
| Bloom Building | ✓ | – | – | – |
| Welfare and Health Building | ✓ | – | – | – |

## Key numbers

| | |
|---|---|
| Buildings on the map | 10 |
| Buildings with an indoor graph | 6 |
| Indoor graph nodes / connections | 2,851 / 2,877 |
| Room nodes | 1,018 (about 970 distinct rooms; rooms with several doors have one node per door) |
| Floor-plan drawings (SVG) | 27 |
| Outdoor path network | 1,064 nodes, 1,089 path segments (OpenStreetMap + hand corrections) |
| Building entrances modelled | 22 |
| Food places / shops / smoking areas | 10 / 7 / 3 |
| Interface languages | 4 (English, Hebrew, Arabic, Russian) |
| Accessibility profiles | 5 |
| Indoor navigation modes | 3 (Auto, Phone Sensors, Manual / Wheelchair), chosen automatically |
| Automated tests | 542 in 39 test files, all passing |

## How it works at a glance

1. **First-run setup** in two steps: choose a language (English, עברית, العربية, Русский), then a navigation profile. Both are saved on the device and can be changed later in **Settings**.
2. **Plan a route** on the campus map. Choose *From* (default Carmel Gate, GPS, a building or a room) and *To* (a building, room, food place, shop or service). The saved profile is applied automatically.
3. CampusWay **compares every allowed exit and entrance** of the buildings involved, using the outdoor path network and the indoor graphs, and picks the combination with the shortest walking time for the chosen profile.
4. The **outdoor route** is drawn with a walking time, a *Your journey* list of stages and turn-by-turn directions. Once the walk starts, the app follows the phone's GPS position along the route and can read each turn aloud.
5. If the trip starts or ends in a room, **Start indoor route / Continue indoors** opens the indoor navigator with the right floor plan, entrance and destination already loaded.
6. Indoors, the way of moving is **chosen automatically**: *Manual / Wheelchair* (tap at each checkpoint) for the Mobility profile, *Auto* (simulated walking) in demo mode, and *Phone Sensors* (the marker moves as you walk) for everyone else. Without motion sensors the app switches to tap-to-confirm on the same route.
7. At an exit the app offers **Continue outdoors**; at the destination it says **"You have arrived!"** with *Done* or *New route from here*.

See [06 · User flows](06-user-flows.md) for diagrams of each journey, and [05 · Architecture](05-architecture.md) for how the parts fit together.

## Project status

CampusWay is a final-year student project under active development. The main navigation flows are complete and covered by automated tests. Indoor mapping coverage, real-phone sensor tuning and data quality continue to be refined; see [14 · Limitations and future work](14-limitations-and-future-work.md).

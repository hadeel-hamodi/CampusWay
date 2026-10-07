# 01 · Project overview

> CampusWay is an accessible indoor and outdoor navigation web app for the University of Haifa campus. It guides people from a starting point, which can be a room inside a building, across campus paths and into the exact destination room, in English, Hebrew or Arabic.

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
3. **Three languages.** English, Hebrew and Arabic, with full right-to-left layout.
4. **Works on a phone, even offline.** An installable Progressive Web App (PWA) that keeps working after the first visit.
5. **No backend to run.** A static site that any web server, or GitHub Pages, can host.

## Target users

| User group | What CampusWay offers |
|---|---|
| New students and visitors | Search by room number, building or service; turn-by-turn directions; floor plans |
| Wheelchair and crutch users | *Mobility* profile: stairs excluded indoors and outdoors, step-free entrances only, elevator transfers, checkpoint-based navigation |
| People with visual impairments | *Visual* profile: spoken guidance turned on and directions read aloud; a separate High Contrast mode is also available |
| People who prefer simpler routes | *Spatial* profile: routes with fewer turns |
| People who need a quiet break | *Mental Health Support* profile: suggested rest spaces with travel time |
| Everyone in an emergency | One-tap **Nearest shelter** routing |

## Campus coverage

| Building | On the campus map | Indoor map (graph) | Indoor navigation | Floors mapped |
|---|:-:|:-:|:-:|---|
| Main Building | ✓ | ✓ | ✓ | 500, 600, 700 |
| Rabin Building | ✓ | ✓ | ✓ | 5, 6, 7 |
| Terrace Building (Madriga) | ✓ | ✓ | ✓ | −1, 0, 1, 2, 3, 4 |
| Student House | ✓ | ✓ | ✓ | 0–4 |
| Education and Science | ✓ | ✓ | ✓ | 1–6 |
| Multi-Purpose Building | ✓ | partial | floor 1 only (floor 0 not connected, no links between floors) | 0–1 partially mapped |
| Eshkol Tower | ✓ | – | – | – |
| Arts Building | ✓ | – | – | – |
| Bloom Building | ✓ | – | – | – |
| Welfare and Health Building | ✓ | – | – | – |

## Key numbers

| | |
|---|---|
| Buildings on the map | 10 |
| Buildings with an indoor graph | 6 |
| Indoor graph nodes / connections | 3,007 / 2,969 |
| Room nodes | 1,126 (about 1,070 distinct rooms; rooms with several doors have one node per door) |
| Floor-plan drawings (SVG) | 28 |
| Outdoor path network | 1,064 nodes, 1,089 path segments (OpenStreetMap + hand corrections) |
| Building entrances modelled | 22 |
| Food places / shops | 10 / 7 |
| Interface languages | 3 (English, Hebrew, Arabic) |
| Accessibility profiles | 5 |
| Indoor navigation modes | 3 (Auto, Phone Sensors, Manual / Wheelchair) |
| Automated tests | 171, all passing |

## How it works at a glance

1. **Choose a language** (English, עברית, العربية).
2. **Plan a route** on the campus map. Choose *From* (default Carmel Gate, GPS, a building or a room) and *To* (a building, room, food place, shop or service), then pick an accessibility profile.
3. CampusWay **compares every allowed exit and entrance** of the buildings involved, using the outdoor path network and the indoor graphs, and picks the combination with the shortest walking time for the chosen profile.
4. The **outdoor route** is drawn with a walking time and turn-by-turn directions that can be read aloud.
5. If the trip starts or ends in a room, **Start indoor route / Continue indoors** opens the indoor navigator with the right floor plan, entrance and destination already loaded.
6. Indoors, the user chooses **Auto** (preview), **Phone Sensors** (the marker moves as you walk), or **Manual / Wheelchair** (confirm each checkpoint).
7. At the exit or the destination the app hands back to the campus map, or says **"You have arrived!"**

See [06 · User flows](06-user-flows.md) for diagrams of each journey, and [05 · Architecture](05-architecture.md) for how the parts fit together.

## Project status

CampusWay is a final-year student project under active development. The main navigation flows are complete and covered by automated tests. Indoor mapping coverage, real-phone sensor tuning and data quality continue to be refined; see [14 · Limitations and future work](14-limitations-and-future-work.md).

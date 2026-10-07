# 06 · User flows

> Diagrams of the main journeys through CampusWay: planning a route, multi-building trips, the hand-off between pages, the three indoor navigation modes, the shared-elevator crossing, the emergency shelter route, and returning to the campus map. Each diagram's editable source and image export are in [`diagrams/`](diagrams/README.md).

**Contents:** [Plan a route](#1-plan-a-route) · [Page hand-off](#2-hand-off-between-the-campus-map-and-indoor-navigation) · [Multi-building journey stages](#3-multi-building-journey-stages) · [Indoor navigation modes](#4-indoor-navigation-modes) · [Shared-elevator crossing](#5-shared-elevator-crossing-rabin--terrace) · [Nearest shelter](#6-nearest-shelter) · [Example journeys](#7-example-journeys)

---

## 1. Plan a route

From opening the app to a drawn route. The profile decides how the route is searched. The start and destination types decide whether indoor navigation is offered.

```mermaid
flowchart TD
    A([Open CampusWay]) --> B{Language chosen<br/>this session?}
    B -- No --> C[Language screen:<br/>English / עברית / العربية]
    C --> D
    B -- Yes --> D[Campus map]
    D --> E["Optional: set From<br/>(type, voice, GPS or room)<br/>default = Carmel Gate"]
    E --> F["Set To: building, room,<br/>food, shop or service"]
    F --> G{Accessibility profile}
    G -- General --> H[Shortest weighted route]
    G -- Mobility --> I[Exclude stairs and<br/>stair-only entrances]
    G -- Spatial --> J[Prefer fewer turns]
    G -- Visual --> K[Turn voice guidance on]
    G -- Mental health --> L[Show suggested rest spaces]
    H & I & J & K & L --> M[Compare every allowed exit ×<br/>entrance pair, pick the fastest]
    M --> N{Route found?}
    N -- No, Mobility --> O["Explain: no step-free<br/>route is mapped"]
    N -- Yes --> P[Draw route, ETA,<br/>turn-by-turn directions]
    P --> Q{Start or destination<br/>is an indoor room?}
    Q -- Yes --> R["Show 'Start indoor route' /<br/>'Continue indoors' button"]
    Q -- No --> S([Walk with directions,<br/>optionally read aloud])
    R --> T([Indoor navigation page])
```

<sub>Diagram source: [`diagrams/04-plan-route-flow.mmd`](diagrams/04-plan-route-flow.mmd) · Image: [PNG](diagrams/04-plan-route-flow.png) · [SVG](diagrams/04-plan-route-flow.svg)</sub>

## 2. Hand-off between the campus map and indoor navigation

A full room-to-room journey crosses pages twice. Both pages store the journey in `sessionStorage`, so it survives reloads and the browser's back and forward buttons.

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant M as Campus map (index.html)
    participant S as sessionStorage
    participant I as Indoor page (navigation-demo.html)

    U->>M: Choose start room and destination room
    M->>M: routeTo() picks best exit + entrance,<br/>draws outdoor route, computes ETA
    M->>S: indoorStartContext, indoorContext,<br/>sharedIndoorTransfer / intermediateIndoorTransfer
    U->>M: Press "Start indoor route"
    M->>S: outdoorJourneyContext (snapshot),<br/>journeyStage = origin, indoorBuilding
    M->>I: open ?building=<origin building>
    I->>S: read contexts, restore route room → exit
    U->>I: Navigate (Auto / Sensors / Wheelchair)
    I->>S: originIndoorComplete = true,<br/>journeyStage = destination
    I->>M: location.replace(index.html?resumeJourney=1)
    M->>S: read outdoorJourneyContext
    M->>M: redraw outdoor leg, show "Continue indoors"
    U->>M: Walk outdoors, press "Continue indoors"
    M->>I: open ?building=<destination building>
    I->>S: read indoorContext (entrance → room)
    U->>I: Navigate to the room
    I-->>U: "You have arrived!"
```

<sub>Diagram source: [`diagrams/03-page-handoff-sequence.mmd`](diagrams/03-page-handoff-sequence.mmd) · Image: [PNG](diagrams/03-page-handoff-sequence.png) · [SVG](diagrams/03-page-handoff-sequence.svg)</sub>

## 3. Multi-building journey stages

The value of `journeyStage` decides what the indoor page does when it opens and where it goes when the user arrives.

```mermaid
stateDiagram-v2
    [*] --> Planning: route planned on campus map

    Planning --> SameBuilding: start and destination<br/>in the same building
    Planning --> Origin: start is a room
    Planning --> Outdoor: start is outdoors

    Origin --> Outdoor: reached exit<br/>(auto return to map)
    Origin --> SharedTransfer: Rabin ↔ Terrace<br/>shared stairs / elevator

    Outdoor --> Intermediate: Main → Terrace chain<br/>(pass through Rabin)
    Outdoor --> Destination: "Continue indoors"
    Outdoor --> [*]: destination is a building<br/>or outdoor place

    Intermediate --> SharedTransfer
    SharedTransfer --> Destination: ride / walk into<br/>next building

    SameBuilding --> Arrived
    Destination --> Arrived
    Arrived --> [*]
```

<sub>Diagram source: [`diagrams/05-journey-stages.mmd`](diagrams/05-journey-stages.mmd) · Image: [PNG](diagrams/05-journey-stages.png) · [SVG](diagrams/05-journey-stages.svg)</sub>

| From → To | Legs |
|---|---|
| Gate → building | outdoor |
| Gate → room | outdoor → indoor (*destination*) |
| Room → building | indoor (*origin*) → outdoor |
| Room → room, different buildings | indoor (*origin*) → outdoor → indoor (*destination*) |
| Room → room, same building | indoor (*same-building*) |
| Rabin ↔ Terrace | indoor → shared stairs or elevator → indoor (no outdoor leg) |
| Main → Terrace | Main indoor → bridge → Rabin (*intermediate*) → shared elevator → Terrace (*destination*) |

## 4. Indoor navigation modes

```mermaid
stateDiagram-v2
    [*] --> RouteReady: graph loaded, route planned

    state "Auto mode (preview)" as Auto {
        [*] --> Moving
        Moving --> FloorPause: floor change<br/>(2 s pause)
        FloorPause --> Moving
        Moving --> [*]: end of route
    }

    state "Phone Sensors mode" as Sensors {
        [*] --> Calibrating: Start pressed,<br/>sensor permission
        Calibrating --> Tracking: heading aligned<br/>with route
        Calibrating --> NeedsRetry: unstable heading
        NeedsRetry --> Calibrating: Retry direction setup
        Tracking --> Tracking: step detected →<br/>move 0.65 m along route
        Tracking --> Paused: direction unclear /<br/>motion unavailable
        Paused --> Tracking: readings recover
        Tracking --> FloorConfirm: reached stairs /<br/>elevator
        FloorConfirm --> Calibrating: user confirms floor
        Tracking --> EstimatedArrival: last node
    }

    state "Manual / Wheelchair mode" as Wheel {
        [*] --> Checkpoint
        Checkpoint --> Checkpoint: "I reached the next point"
        Checkpoint --> FloorStep: elevator checkpoint
        FloorStep --> Checkpoint: "Reached floor X"
        Checkpoint --> [*]: final checkpoint
    }

    RouteReady --> Auto: Auto selected
    RouteReady --> Sensors: Phone Sensors selected
    RouteReady --> Wheel: Wheelchair selected<br/>(pre-selected for Mobility profile)
    Auto --> Arrived
    Wheel --> Arrived
    Arrived --> [*]: Done / continue journey
```

<sub>Diagram source: [`diagrams/06-indoor-navigation-modes.mmd`](diagrams/06-indoor-navigation-modes.mmd) · Image: [PNG](diagrams/06-indoor-navigation-modes.png) · [SVG](diagrams/06-indoor-navigation-modes.svg)</sub>

| | Auto | Phone Sensors | Manual / Wheelchair |
|---|---|---|---|
| Purpose | Preview or demonstration | Hands-free guidance while walking | Reliable guidance without sensors |
| What moves the marker | A timer | Detected steps, about 0.65 m each, in the detected direction | The user's confirmation at each checkpoint |
| Floor changes | Automatic, with a 2 s pause | User confirms (*I'm on Floor X*; elevator: *entered* then *exited*) | User confirms (*Reached Floor X*) |
| Map orientation | North-up | Heading-up (rotates with the phone) | North-up |
| Step-free route | Optional (locked on for Mobility) | Optional (locked on for Mobility) | Always |
| Arrival | Arrival dialog, or automatic hand-off to the next leg | "Estimated arrival — check the room sign" (no automatic hand-off) | Arrival dialog, or automatic hand-off to the next leg |

## 5. Shared-elevator crossing (Rabin ↔ Terrace)

Rabin floor 5 and Terrace floor 4 share an elevator and a stair connection. A step-free route between them uses the elevator:

1. The route in the first building ends at the shared elevator. The banner shows **Enter the shared elevator** with the button **✓ I entered the elevator**.
2. CampusWay saves the pending ride (`campusway.pendingSharedElevatorRide`) and opens the second building's floor plan.
3. The second page restores the ride and shows **Stay in the elevator until Floor X**, with **✓ I exited on Floor X**.
4. Navigation continues in the second building in the same mode.

On the way from Main Building to Terrace, the journey passes through Rabin: Main floor 600 → outdoor bridge → Rabin floor 7 entrance → Rabin floor 5 (the shared elevator for step-free routes, otherwise the stairs connection) → Terrace floor 4. Trips that leave Terrace through Rabin use the same *intermediate* stage in the other direction.

## 6. Nearest shelter

```mermaid
flowchart TD
    A(["Press 'Nearest shelter'"]) --> B{Start point set?}
    B -- Yes --> D
    B -- No --> C{"Geolocation<br/>within 4 s?"}
    C -- Yes --> D[Use position]
    C -- No --> C2[Use default start<br/>Carmel Gate]
    C2 --> D
    D --> E["For every mapped shelter node:<br/>outdoor route time + indoor path time"]
    E --> F{"Shelter with indoor guidance<br/>vs. any shelter ≥ 60 s faster"}
    F --> G["Draw red emergency route card<br/>🛡️ From X → Nearest shelter"]
    G --> H(["'Continue indoors' to the<br/>shelter room on the floor plan"])
```

<sub>Diagram source: [`diagrams/10-nearest-shelter-flow.mmd`](diagrams/10-nearest-shelter-flow.mmd) · Image: [PNG](diagrams/10-nearest-shelter-flow.png) · [SVG](diagrams/10-nearest-shelter-flow.svg)</sub>

## 7. Example journeys

| Example | Start | Destination | What happens |
|---|---|---|---|
| Building to building | Student House | Main Building | About 3 minutes outdoors, 6 directions ([screenshot](images/screenshots/main-03-outdoor-route.png)) |
| Step-free | Student House (Mobility profile) | Rabin Building | Stairs avoided; slower walking speed in the ETA ([screenshot](images/screenshots/main-06-mobility-route.png)) |
| Room to room | Room 521, Main Building | Room 1001, Terrace Building | *Start indoor route* from room 521 to the Main floor 600 exit, outdoor bridge to Rabin, then on to Terrace ([screenshot](images/screenshots/main-07-room-to-room-journey.png)) |
| Indoor, multi-floor | Rabin entrance, floor 7 | Room 5007, floor 5 | Stairs down two floors; about 66 m ([screenshot](images/screenshots/indoor-02-route-floor-plan.png)) |
| Emergency | Main Building | Nearest shelter | Shelter in Rabin Building, about 5 minutes ([screenshot](images/screenshots/main-10-nearest-shelter.png)) |

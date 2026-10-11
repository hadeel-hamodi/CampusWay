# 06 · User flows

> Diagrams of the main journeys through CampusWay: planning a route, multi-building trips, the hand-off between pages, the three indoor navigation modes (chosen automatically), the shared-elevator crossing, the emergency shelter route, and returning to the campus map. Each diagram's editable source and image export are in [`diagrams/`](diagrams/README.md).

**Contents:** [Plan a route](#1-plan-a-route) · [Page hand-off](#2-hand-off-between-the-campus-map-and-indoor-navigation) · [Multi-building journey stages](#3-multi-building-journey-stages) · [Indoor navigation modes](#4-indoor-navigation-modes) · [Shared-elevator crossing](#5-shared-elevator-crossing-rabin--terrace) · [Nearest shelter](#6-nearest-shelter) · [Example journeys](#7-example-journeys)

---

## 1. Plan a route

From opening the app to a drawn route. On the first visit the user picks a language and a profile; both are saved on the device, so later visits open straight on the map. The profile decides how the route is searched. The start and destination types decide whether indoor navigation is offered.

```mermaid
flowchart TD
    A([Open CampusWay]) --> B{Language and profile<br/>saved on this device?}
    B -- No --> C["First-run screens:<br/>1. English / עברית #8206;/ العربية / Русский<br/>2. accessibility profile"]
    C --> D
    B -- Yes --> D[Campus map]
    D --> E["Optional: set From<br/>(type, voice, GPS or room)<br/>default = Carmel Gate"]
    E --> F["Set To: building, room,<br/>food, shop or service"]
    F --> G{Accessibility profile}
    G -- General --> H[Shortest weighted route]
    G -- Mobility --> I[Exclude stairs and<br/>stair-only entrances]
    G -- Spatial --> J[Prefer fewer turns]
    G -- Visual --> K[Voice guidance and<br/>high contrast on]
    G -- Sensory and wellbeing --> L["Prefer quieter paths;<br/>'I need a break' finds<br/>a rest space"]
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

    Origin --> Outdoor: reached exit,<br/>"Continue outdoors"
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

The user does not choose the mode; the indoor page picks it when it opens (the mode buttons are hidden):

- **Mobility profile** → Manual / Wheelchair: tap-to-confirm checkpoints on a stair-free route.
- **A `?demo=1` link** (for demonstrations) → Auto. The Mobility profile still gets Manual / Wheelchair.
- **Everyone else** → Phone Sensors.
- If motion-sensor permission is refused, or the phone has no motion sensors, the page switches to **tap-to-confirm checkpoints on the same route** (stairs stay allowed). This is remembered for the rest of the visit (`campusway.indoorManualCheckpoints`), so the next building does not ask again.

```mermaid
stateDiagram-v2
    state Pick <<choice>>
    [*] --> Pick: graph loaded, route planned
    Pick --> Wheel: Mobility profile
    Pick --> Auto: ?demo=1 link
    Pick --> Sensors: everyone else

    state "Auto mode (demo)" as Auto {
        [*] --> Moving
        Moving --> FloorPause: floor change<br/>(elevator 3 s + 1 s per floor,<br/>stairs 4 s per floor)
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
        EstimatedArrival --> [*]: "✓ I have arrived" /<br/>"✓ I reached the exit"
    }

    state "Manual / Wheelchair mode (tap-to-confirm)" as Wheel {
        [*] --> Checkpoint
        Checkpoint --> Checkpoint: "✓ I reached the next point"
        Checkpoint --> FloorStep: elevator checkpoint
        FloorStep --> Checkpoint: "✓ Reached Floor X"
        Checkpoint --> [*]: final checkpoint
    }

    Sensors --> Wheel: permission refused or<br/>no motion sensors<br/>(same route, stairs allowed)
    Auto --> Arrived
    Sensors --> Arrived
    Wheel --> Arrived
    Arrived --> [*]: Done / Continue outdoors /<br/>New route from here
```

<sub>Diagram source: [`diagrams/06-indoor-navigation-modes.mmd`](diagrams/06-indoor-navigation-modes.mmd) · Image: [PNG](diagrams/06-indoor-navigation-modes.png) · [SVG](diagrams/06-indoor-navigation-modes.svg)</sub>

| | Auto | Phone Sensors | Manual / Wheelchair |
|---|---|---|---|
| Used for | Demonstrations (`?demo=1`) | Everyone except the Mobility profile | The Mobility profile, and as the fallback when motion sensors are unavailable |
| What moves the marker | A timer: 0.5 m every 200 ms (0.2 m on segments at stairs or elevators) | Detected steps, about 0.65 m each, in the detected direction | The user's confirmation at each checkpoint |
| Floor changes | Automatic pause: elevator 3 s + 1 s per floor, stairs 4 s per floor | User confirms (*I'm on Floor X*; elevator: *entered* then *exited*) | User confirms (*✓ Reached Floor X*) |
| Map orientation | Turns with the route ahead | Heading-up (rotates with the phone) | Not rotated |
| Step-free route | Optional | Optional | Always for Mobility; the sensor fallback keeps the original route, stairs allowed |
| Arrival | Arrival dialog | The user confirms the estimated arrival (*✓ I have arrived*, or *✓ I reached the exit*), then the arrival dialog | Arrival dialog (the last checkpoint button reads *✓ I reached the exit — continue outdoors* on an origin leg) |

The arrival dialog never moves on by itself. At the destination it offers **Done** and **New route from here**; at an exit it offers **Continue outdoors →**, which returns to the campus map with the outdoor leg ready; at a connection to the next building it offers **Continue →**.

## 5. Shared-elevator crossing (Rabin ↔ Terrace)

Rabin floor 5 and Terrace floor 4 share an elevator and a stair connection. A step-free route between them uses the elevator:

1. The route in the first building ends at the shared elevator. The banner shows **Enter the shared elevator** with the button **✓ I entered the elevator**.
2. CampusWay saves the pending ride (`campusway.pendingSharedElevatorRide`) and opens the second building's floor plan.
3. The second page restores the ride and shows **Stay in the elevator until Floor X**, with **✓ I exited on Floor X**.
4. Navigation continues in the second building in the same mode.

On the way from Main Building to Terrace, the journey passes through Rabin: Main floor 600 → outdoor bridge → Rabin floor 7 entrance → Rabin floor 5 (the shared elevator for step-free routes, otherwise the stairs connection) → Terrace floor 4. Trips that leave Terrace through Rabin use the same *intermediate* stage in the other direction.

## 6. Nearest shelter

If no start has been chosen, the app asks the phone for its position (about 4 s timeout). On campus, the route starts there; off campus, or without a position, it starts at Carmel Gate and a message says so. Every shelter node in the indoor maps (except shelters closed in the live status) and the outdoor shelter are compared by walking time. The same flow runs from the indoor page's emergency button and from a `?emergency=1` link.

```mermaid
flowchart TD
    A(["Press 'Nearest shelter'"]) --> B{Start point chosen?}
    B -- Yes --> D
    B -- No --> C{"Phone position<br/>(about 4 s)"}
    C -- On campus --> C1[Start at the<br/>phone's position]
    C -- "Off campus or<br/>no position" --> C2["Start at Carmel Gate<br/>(message shown)"]
    C1 --> D
    C2 --> D
    D[Start point] --> E["Every mapped shelter that is not closed:<br/>outdoor route time + indoor path time;<br/>also the outdoor shelter"]
    E --> F{"Fastest, but prefer a shelter<br/>with indoor guidance unless<br/>another is ≥ 60 s faster"}
    F -- Outdoor shelter --> G2(["Outdoor route to<br/>the outdoor shelter"])
    F -- Shelter in a building --> G["Draw red emergency route card<br/>🛡️ From X → Nearest shelter"]
    G --> H(["'Continue indoors' to the<br/>shelter room on the floor plan"])
```

<sub>Diagram source: [`diagrams/10-nearest-shelter-flow.mmd`](diagrams/10-nearest-shelter-flow.mmd) · Image: [PNG](diagrams/10-nearest-shelter-flow.png) · [SVG](diagrams/10-nearest-shelter-flow.svg)</sub>

## 7. Example journeys

| Example | Start | Destination | What happens |
|---|---|---|---|
| Building to building | Student House | Main Building | About 3 minutes outdoors, with turn-by-turn directions ([screenshot](images/screenshots/main-03-outdoor-route.png)) |
| Step-free | Student House (Mobility profile) | Rabin Building | Stairs avoided; slower walking speed in the ETA ([screenshot](images/screenshots/main-06-mobility-route.png)) |
| Room to room | Room 521, Main Building | Room 1001, Terrace Building | *Start indoor route* from room 521 to the Main floor 600 exit, outdoor bridge to Rabin, then on to Terrace ([screenshot](images/screenshots/main-07-room-to-room-journey.png)) |
| Indoor, multi-floor | Rabin entrance, floor 7 | Room 5007, floor 5 | Elevator down two floors; about 77 m of walking, about 2 minutes ([screenshot](images/screenshots/indoor-02-route-floor-plan.png), taken before floor changes were weighted by time, when this route used the stairs) |
| Emergency | Main Building | Nearest shelter | The shelter inside Main Building, floor 500: from the Main Building start point (floor 700 entrance) by elevator, about 1½ minutes ([screenshot](images/screenshots/main-10-nearest-shelter.png), taken before Main Building had a mapped shelter, when the route went to Rabin Building) |

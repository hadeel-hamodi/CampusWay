# Diagrams

Every diagram in the documentation, in three forms:

- **`.mmd`**: editable [Mermaid](https://mermaid.js.org/) source. GitHub renders the same code inside the Markdown documents. Edit it in any text editor, or preview it in VS Code or at <https://mermaid.live>.
- **`.png`**: image export (2× resolution) for Word reports and slides.
- **`.svg`**: scalable vector export for print and posters.

| # | Diagram | Type | Used in |
|---|---|---|---|
| 01 | [System context](01-system-context.png) | Flowchart | [05 · Architecture](../05-architecture.md#2-system-context) |
| 02 | [Components](02-components.png) | Flowchart | [05 · Architecture](../05-architecture.md#3-components) |
| 03 | [Page hand-off sequence](03-page-handoff-sequence.png) | Sequence diagram | [05 · Architecture](../05-architecture.md), [06 · User flows](../06-user-flows.md) |
| 04 | [Plan a route](04-plan-route-flow.png) | Flowchart | [06 · User flows](../06-user-flows.md#1-plan-a-route) |
| 05 | [Journey stages](05-journey-stages.png) | State diagram | [06 · User flows](../06-user-flows.md#3-multi-building-journey-stages) |
| 06 | [Indoor navigation modes](06-indoor-navigation-modes.png) | State diagram | [06 · User flows](../06-user-flows.md#4-indoor-navigation-modes) |
| 07 | [Sensor pipeline](07-sensor-pipeline.png) | Flowchart | [07 · Algorithms](../07-routing-and-navigation-algorithms.md#7-phone-sensor-navigation) |
| 08 | [Outdoor routing pipeline](08-outdoor-routing-pipeline.png) | Flowchart | [07 · Algorithms](../07-routing-and-navigation-algorithms.md#2-outdoor-routing) |
| 09 | [Data model](09-data-model.png) | Entity–relationship | [08 · Data model](../08-data-model.md#1-overview) |
| 10 | [Nearest shelter](10-nearest-shelter-flow.png) | Flowchart | [06 · User flows](../06-user-flows.md#6-nearest-shelter) |
| 11 | [Service worker](11-service-worker.png) | Flowchart | [05 · Architecture](../05-architecture.md#8-offline-and-pwa-design) |
| 12 | [Indoor mapping workflow](12-mapping-workflow.png) | Flowchart | [13 · Developer tools](../13-developer-tools-and-mapping.md#3-mapping-a-building-step-by-step) |

## Regenerating the images

With Node.js installed:

```powershell
npx -p @mermaid-js/mermaid-cli mmdc -i docs/diagrams/04-plan-route-flow.mmd -o docs/diagrams/04-plan-route-flow.png -s 2 -b white
npx -p @mermaid-js/mermaid-cli mmdc -i docs/diagrams/04-plan-route-flow.mmd -o docs/diagrams/04-plan-route-flow.svg -b white
```

If you edit a `.mmd` file, also update the matching ```` ```mermaid ```` block in the document that uses it, so GitHub shows the same version.

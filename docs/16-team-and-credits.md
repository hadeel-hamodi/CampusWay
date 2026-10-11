# 16 · Team and credits

> The people who built CampusWay, and the third-party software, services and data it uses.

## Team

CampusWay is a student project at the **University of Haifa**.

- **Jasmin Taya** (GitHub: [@ja4smin](https://github.com/ja4smin))
- **Hadeel Hamodi** (GitHub: [@hadeel-hamodi](https://github.com/hadeel-hamodi))
- **Naseem Muhammad** (GitHub: [@iNaseemMuh](https://github.com/iNaseemMuh))
- **Shady Salem** (GitHub: [@ShakyShako](https://github.com/ShakyShako))

**Client:** Accessibility and Learning Disabilities Unit, University of Haifa.

**Supervisor:** Professor Anna Zmansky.

## Third-party software

| Component | Author | Licence | Location |
|---|---|---|---|
| [Leaflet](https://leafletjs.com/) 1.9.4 | Vladimir Agafonkin and contributors (© 2010–2023), CloudMade (© 2010–2011) | BSD-2-Clause | `app/vendor/leaflet.js`, `leaflet.css`, `app/vendor/images/` (marker and layer images) |

## Third-party services

| Service | Used for |
|---|---|
| [GitHub Pages](https://pages.github.com/) | Hosting the app at <https://ja4smin.github.io/CampusWay/> |
| [Cloudflare Workers](https://developers.cloudflare.com/workers/) and [D1](https://developers.cloudflare.com/d1/) (free plan) | The cloud inbox (`cloud/`): problem reports, anonymous usage counts and the live campus status. Deployed with Cloudflare's `wrangler` tool, which is not part of the repository |

## Data

| Data | Source | Licence / terms |
|---|---|---|
| Campus footpath network (`app/prototype/campus-osm.json`) | © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, exported with the Overpass API | [Open Database Licence (ODbL)](https://opendatacommons.org/licenses/odbl/) |
| Base-map tiles | © OpenStreetMap contributors, served by the OpenStreetMap Foundation | [OSMF Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/) |
| Indoor graphs, entrances, places, corrections | Mapped by the CampusWay team | Project data |
| Floor plans (`buildings/*/floors/*.svg`) | Building drawings used as map backgrounds | – |

The map shows the "© OpenStreetMap contributors" attribution, as both licences require.

## Licence

The project does not include a licence file yet; the team will choose one.

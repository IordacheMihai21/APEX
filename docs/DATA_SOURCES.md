# Data Sources & Licensing

Checked 2026-09-30. Licences come from each repository's LICENSE file and
README. This is an engineering assessment, not legal advice: get a
lawyer's review before any commercial launch that uses real-circuit
geometry or names.

## Summary

| Source | Licence | Use in APEX | Ship in product? |
|---|---|---|---|
| [F1DB](https://github.com/f1db/f1db) | CC BY 4.0 | Circuits, drivers, constructors, results, historical metadata | **Yes, with attribution** |
| [f1db/f1-circuits-svg](https://github.com/f1db/f1-circuits-svg) | CC BY 4.0 | Reference layouts (78 circuits, with layout evolutions) | Yes with attribution, but see "Circuit layouts" |
| [FastF1](https://github.com/theOehrly/Fast-F1) | MIT (code) | R&D: telemetry to sanity-check lines and braking zones | **Code yes; data no** |
| [OpenF1](https://github.com/br-g/openf1) | **CC BY-NC-SA 4.0** | Experiments only | **No** (non-commercial, share-alike) |
| [bacinger/f1-circuits](https://github.com/bacinger/f1-circuits) | MIT | GeoJSON circuit geometry for R&D / reference | Code/data licence permits; see "Circuit layouts" |
| [nilamadhab47/raceosf1](https://github.com/nilamadhab47/raceosf1) | **None** (all rights reserved) | Read for ideas only | **No, copy nothing** |
| [OpenStreetMap](https://www.openstreetmap.org/copyright) via Overpass | **ODbL 1.0** | Real surroundings of each circuit: buildings, grandstands, woods, trees, water and coastline, roads, rail, pit lanes, landmarks (`data/scenery/*.json`, built by `tools/track-builder/src/import-osm.ts`) | **Yes, with attribution** ("Map data © OpenStreetMap contributors", shown on the circuit view and linked to osm.org/copyright). The extracted files are a derivative database: if distributed separately they stay under the ODbL (share-alike). |
| [formula1.com race pages](https://www.formula1.com/en/racing/2025) | Facts only (not copyrightable) | Lap length, first Grand Prix and race laps for the trivia games (`apps/web/src/modes/circuits.ts`) | Yes: plain numbers, no text, logos or images copied |
| [Wikipedia circuit infoboxes](https://en.wikipedia.org/wiki/Monza_Circuit) via the MediaWiki API | Facts only (text is CC BY-SA, numbers are not) | Corner count of each current Grand Prix layout (formula1.com doesn't publish it) | Yes: numbers only |
| [Jolpica F1 API](https://github.com/jolpica/jolpica-f1) (api.jolpi.ca, Ergast successor) | Apache-2.0 code; facts | 2025 pole laps (`REFERENCE_POLE_MS`), cross-checked 2026-10-03 | Yes: times only, no driver names |
| [TUMFTM/global_racetrajectory_optimization](https://github.com/TUMFTM/global_racetrajectory_optimization) | LGPL-3.0 | Offline reference optimizer | Output lines yes; don't bundle the library in the client |

## Notes per source

**F1DB.** Primary structured dataset. CC BY 4.0 allows commercial use
with attribution: add an "Data: F1DB (CC BY 4.0)" credit wherever F1DB
data is shown. Distributed as CSV/JSON/SQL/SQLite releases, so import from
a pinned release into our own PostgreSQL. Never fetch at runtime.

**FastF1.** The MIT licence covers the library code only. The data comes
from Formula 1's live-timing service, which has **no published terms of
use**. Treat it as R&D-only: use it to calibrate the car and to compare our
optimal lines with real qualifying laps. Never redistribute raw telemetry
or derived per-lap traces to players.

**OpenF1.** CC BY-NC-SA 4.0 is incompatible with a monetized product
(NonCommercial) and would impose share-alike on derivatives. Keep it out
of production and out of anything we ship. Local experiments are fine.

**raceosf1.** No licence means no rights granted. Its pipeline idea
(telemetry X/Y → normalise → SVG path → resample) is generic and we have
implemented our own. Do not copy code or its bundled track SVGs.

**TUMFTM optimizer.** LGPL-3.0 is fine for an offline Python tool whose
*outputs* (racing lines) we store. We currently don't need it: our
TypeScript optimizer uses the authoritative game physics directly (see
ARCHITECTURE ADR-2). Keep it as a research benchmark.

## Circuit layouts & trademarks

- A repository licence covers that author's work (their drawing or
  tracing). It does not settle rights that circuit owners or promoters may
  assert over a layout, name, or logo.
- "F1", "Formula 1", "Grand Prix" and related marks belong to Formula One
  Licensing B.V. Every source above disclaims affiliation. APEX must not
  use these marks in branding, and must not use team logos, liveries,
  driver likenesses, or broadcast graphics.
- **Decision (2026-09-30, product owner): the game uses real circuits.**
  Geometry comes from bacinger/f1-circuits (MIT, hand-traced), ingested
  offline into our own track format (`tools/track-builder/src/import-geojson.ts`,
  raw copy with its LICENSE in `data/raw/bacinger/`). Guardrails:
  - Display **venue/location names only** ("Monza", "Spielberg", "Austin"),
    never series branding, circuit logos, or official corner-name graphics.
  - Credit: "Circuit geometry: bacinger/f1-circuits (MIT)".
  - Real pole times are used only as an internal pace check
    (`check-tracks.ts`); don't present them as official data in the product.
  - **Before a commercial launch, get legal review** of using real layouts
    and venue names. Some venue names are registered trademarks (e.g.
    Silverstone, Suzuka Circuit). The fallback is renaming to location-only
    names, or "inspired-by" originals, without changing any engine code.

## Competitive landscape (context for product decisions)

- **Track Bender** (mysimrig.nl): fixed circuit, racing line shaped with
  drag handles, deterministic lap, medals, ghost, top-10 leaderboard.
  The closest existing product.
- **DrawRace 2** (RedLynx/Chillingo, iOS 2011, Metacritic 88): draw your
  line, then race. Proves the mechanic works commercially.
- RACELN, ApexDrawn, OpenKartLine: line/lap-time tools or draw-your-own-
  track games.

APEX's differentiators are the daily shared challenge, the Wordle-style
share loop and percentile, freehand-first input, and per-corner feedback,
not the physics itself.

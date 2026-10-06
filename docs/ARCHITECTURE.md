# Lapdle Architecture

Status: Phase 1 (physics prototype). No UI, backend, or accounts yet.

## Repository layout

```
Lapdle/
├── packages/
│   └── engine/              @apex/engine — pure TypeScript, zero runtime deps
│       ├── src/math/        dense solver, periodic cubic spline, cbrt
│       ├── src/track/       track format, builder, geometry, runtime prep
│       ├── src/line/        racing-line representation, limits, drawing fit
│       ├── src/physics/     car model, speed profile, simulateLap
│       ├── src/optimize/    minimum-lap-time line optimizer
│       └── test/            vitest suites (92 tests)
├── tools/
│   ├── track-builder/       build-tracks, import-geojson, real-circuits,
│   │                        check-tracks (quality gate), compare-lines, preview
│   └── physics-spike/       Python research spike (historical, not maintained)
├── data/
│   ├── raw/bacinger/        pinned copy of source GeoJSON + its LICENSE
│   └── tracks/              generated game tracks: <id>.v<version>.json
└── docs/
```

`apps/web` (Phase 2): Vite + React + Tailwind. `src/game/game.ts` owns all
game state, pointer input and Canvas rendering outside React; React renders
only the overlays (HUD, pit board, controls) from a snapshot via
`useSyncExternalStore`. Tracks load lazily from `data/tracks` (one chunk each).
Rendering is an aerial view: `src/game/scenery.ts` builds the circuit
surroundings once (grass/urban ground, tarmac run-off, gravel traps on the
outside of corners the car slows for, barriers, kerbs, edge lines, grid) as
world-space `Path2D`s filled with small procedural textures, and hides any
barrier that would cross another section of track. `src/game/car.ts`
pre-renders a top-down formula car and its shadow to sprites. A frame costs
~0.2–0.5 ms of main-thread time on a DPR-2 phone canvas.

Planned additions (not created yet, to avoid empty scaffolding):
`supabase/` + `apps/api` (Phase 4),
`tools/f1db-importer`, `tools/telemetry-analysis` (Phase 7, Python).

## Games registry (`apps/web/src/games/registry.ts`)

Lapdle is a hub of daily games. Every game is declared once in the registry:
id, name and short name, its address (`route`), its cadence (`daily` or
`endless`), whether it counts towards today's set (`inDailySet`), its
one-line tagline and hub blurb, its page title, its How to play steps, and a
`today(day)` function that reports where the player stands (`new`,
`playing` or `done`, with a short label and an optional medal).

Everything that lists games reads from it: the app's routing and page titles,
the hub's Today bar and cards, the finish card's "Play next", the footer, the
How to play cards and the analytics names. `todayProgress()` gives "x of y
played today" for the daily set.

The play streak and daily progress live in `games/profile.ts`, derived from
the games' own records (nothing extra stored): a day counts when at least one
game of the daily set was finished (each daily game exposes `doneDays()` so
the whole history is read once); a perfect day is the whole set. The hub's
Today bar shows "x/y" and the play streak; finish cards show today's progress
and offer today's unplayed games first; a finished Daily Quali offers the next
one ("Next: Mystery circuit").

To add a game:

1. Its logic in `src/modes/<game>.ts` (records in local storage, keyed by day
   for a daily game), its UI in `src/ui/<Game>.tsx` (lazy-loaded in `App.tsx`).
2. One entry in `GAMES`.
3. Its route in `public/_redirects` and `public/sitemap.xml`
   (`registry.test.ts` fails until both list it).

## Content pages (pre-rendered)

How to play (an index and one guide per game, written from the registry's
`howTo` and `guide` fields) and About are React components in
`apps/web/src/content/Guides.tsx`. The build renders them to static HTML
(`vite build --ssr src/ssg/entry.tsx`, then `scripts/prerender.mjs`): one file
per route in `CONTENT_ROUTES` (`dist/about.html`, `dist/how-to-play/mystery.html`,
...), each with its own title, description, canonical and preview tags and the
page's markup inside `#root`. Cloudflare Pages serves them at clean addresses
(`/about`, `/how-to-play/mystery`); in the browser the app takes over and
renders the same page. Links between pages are plain anchors: the app opens
any link to one of its own pages in place (`screenFromPath` in `App.tsx`).
To add a content page: a component, a parser case in `content/meta.ts`, its
route in `CONTENT_ROUTES` and in `public/sitemap.xml` (the registry test checks).

Circuit guides (`/circuits` and `/circuits/<slug>`, `content/Circuits.tsx`)
are built from data: facts from `modes/circuits.ts`, the outline, perfect laps
and medal times from `game/outlines.ts`, famous corners from the Corner of the
week list, and the written character and driving notes from
`content/circuitText.ts`. Slugs are the internal ids except where an id carries
a sponsor's name (`red-bull-ring` is `/circuits/spielberg`; `circuitSlug`).
Their practice links (`/?play=practice&track=<id>&cond=<wet|lowdf>`) open in
place too (`practiceFromQuery`).

## Data flow

```
GeoJSON (lon/lat) ─ import-geojson: project → 2 m resample → smooth → scale to official length
        ▼
TrackSpec (control points, width)          tracks.ts (originals), real-circuits.ts (real)
        │ buildTrack: spline → uniform resample → normals → boundaries
        │             → corner detection → line knots → timing segments
        ▼
GameTrack JSON (geometry only)
        │ optimizeLine (multi-start coordinate descent on simulateLap)
        ▼
data/tracks/kestrel.v1.json  (+ optimalLine, optimalTimeMs)
        │ prepareTrack: typed arrays + spline basis B (once per load)
        ▼
PreparedTrack ──► fitDrawing(stroke) ──► RacingLine { knotOffsets[24] }
        │                                        │
        └──────────────► simulateLap ◄───────────┘
                              │
                    SimulationResult (lapTimeMs, samples, corners, sectors)
                              │
                    compareRuns(run, optimal) → per-corner time loss
```

## Track format (`GameTrack`, formatVersion 1)

See `packages/engine/src/track/types.ts`. Key fields:

| Field | Meaning |
|---|---|
| `id`, `version` | Identity. **Any geometry change = new version.** |
| `centerline` | N points (1000), uniform arc-length spacing, mm precision. Index 0 = start/finish. |
| `leftBoundary`, `rightBoundary` | For rendering only; the engine recomputes normals. |
| `widthMeters` | Constant width (variable width is a later extension). |
| `corners[]` | start/apex/end index and distance, direction, `timingStartIndex`. |
| `sectors[]` | Three equal-distance sectors. |
| `lineKnots[]` | Centerline indices where the line has a free offset. |
| `optimalLine`, `optimalTimeMs` | Target, computed with `physicsVersion` + `carModel`. |
| `source.kind` | original / geojson / svg / telemetry / procedural. |

The engine never cares where geometry came from; every source is converted
into a `TrackSpec` or directly into this format.

Track JSON is 50–160 KB (real circuits ~2,000–2,800 points; roughly 40% of
that size gzipped). That's fine for one daily track. It can be halved by
dropping the boundaries, which are derivable.

## Architecture decisions

**ADR-1: The line is a set of per-corner knot offsets, not a polyline.**
Freehand input at phone scale has noise comparable to or bigger than the
difference between good and bad racecraft (PHYSICS.md, Findings 2 and 5).
Knots keep intent and reject tremor. They also give tiny submissions
(24 numbers), trivial server validation, a natural draggable handle per
corner in the UI, and the same search space for the optimizer.
*Consequence:* the "cost" of a line is decided by knot values only;
`fitDrawing` is a pure client-side convenience, and the server can accept
knots directly.

**ADR-2: One physics implementation, in TypeScript** (ingestion too, so far). The plan proposed
Python for track processing and optimization. Two implementations of the
lap-time model would drift, and then published targets would not match
what players are scored with. Track building and optimization therefore
use `@apex/engine` directly (all 13 tracks build in ~3 min). GeoJSON
ingestion also turned out simple enough for TypeScript. Python remains the
choice for heavier R&D (FastF1 telemetry comparison, F1DB import), whose
output is a `TrackSpec`, never a lap time.

**ADR-9: Players set gates, not draw lines** (supersedes the "draw" part
of ADR-1). The racing line is still one offset per knot. Knots near corners
that slow the car are *gates*; the rest are interpolated (`expandGates`,
idempotent). Gates are grouped into corner groups (`lineControls`), stored in
the track JSON (`controls`), and the published optimum is computed inside
this control space, so the target is always reachable. `fitDrawing` remains
in the engine but is unused by the game.

**ADR-8: Real circuits are data, not code.** The raw source is pinned in
`data/raw/`, the per-circuit config (id, display name, width, direction
fixes) lives in `real-circuits.ts`, and every built track must pass
`check-tracks.ts` and `tracks.test.ts` before it is published. Changing a
circuit's geometry means bumping its `version`.

**ADR-3: Determinism by construction.** Engine arithmetic is restricted to
IEEE-correctly-rounded operations (PHYSICS.md, "Determinism"). The same
module runs in the browser (instant preview), in Supabase Edge Functions
(Deno/V8, authoritative), in the optimizer, and for ghosts. Results carry
`physicsVersion`, `carModel`, `trackId`, and `trackVersion`; leaderboards
compare only identical tuples.

**ADR-4: Never clip the line.** Track limits are a hard validity rule on
the whole spline; inputs are *projected* inside (`enforceLimits`). Clipping
produced a discontinuous, exploitable score landscape (PHYSICS.md, Finding 3).

**ADR-5: Corner timing segments partition the lap.** Corner *j* owns its
braking zone, the corner, and the straight after it, up to the next
corner's braking zone. So per-corner losses sum exactly to the lap delta,
and exit-speed losses are blamed on the corner that caused them.

**ADR-6: Flying lap, start at index 0.** Simple and fair. The closed-loop
speed solve starts at the slowest point, so the result does not depend on
where the start/finish line is.

**ADR-7: Minimal monorepo.** npm workspaces + tsx + vitest, no build step:
packages export TypeScript sources. Add bundling only when `apps/web` needs it.

## Engine API (stable surface)

```ts
buildTrack(spec: TrackSpec): GameTrack
prepareTrack(track: GameTrack): PreparedTrack
fitDrawing(pt, points: Vec2[], car, opts?): FitResult     // stroke → RacingLine
resolveLine(pt, line, car): ResolvedLine                  // limits check
simulateLap({ track: pt, line, car? }): SimulationResult
compareRuns(run, reference): { lapDeltaMs, corners[], sectors[] }
optimizeLine(pt, opts?): OptimizeResult
```

Performance: one `simulateLap` on 1000 points takes ~0.1 ms in Node. The
optimizer runs ~9k simulations per track build.

## Server validation (Phase 4 preview)

Client submits `{ challengeId, trackId, trackVersion, physicsVersion, knotOffsets }`.
Server loads its own copy of the track, rejects mismatched versions,
checks `knotOffsets` (length, finite, centimetre grid, limits) with
`resolveLine`, runs `simulateLap`, and stores `lapTimeMs`. The client's
time is never trusted. (We could also store the raw stroke for analytics
and anti-cheat, but it plays no part in scoring.)

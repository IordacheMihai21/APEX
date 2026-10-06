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

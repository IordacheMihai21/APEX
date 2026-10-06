# Lapdle Roadmap

Guiding question at every step: **does this make Draw → Race → Retry better?**

## ✅ Phase 0 — Research spike (done 2026-09-30)

- Licences reviewed → `DATA_SOURCES.md`. Key flags: OpenF1 is
  non-commercial; raceosf1 has no licence; FastF1 data has no terms, so R&D only.
- Competitors: Track Bender (very close), DrawRace 2 (validated mechanic).
- Python spike (`tools/physics-spike/`) proved the physics idea and found the
  input-noise problem that shaped the line representation.

## ✅ Phase 1 — Physics prototype (done 2026-09-30)

- `@apex/engine`: track builder, per-corner knot lines, drawing fitter,
  deterministic lap simulation, optimizer, per-corner comparison.
- Original circuit **Kestrel** (2.2 km, 6 corners incl. hairpin, fast
  sweeper, exit-critical final corner). Optimal lap 0:33.940 with car v1
  (0:31.332 with v2).
- 38 tests; go/no-go invariants encoded in `racing.test.ts`.
- **Go/no-go: GO**, with the input conditions below.

## ✅ Real circuits (done 2026-09-30)

- 12 real circuits imported from bacinger/f1-circuits (MIT): Monza, Spa,
  Silverstone, Suzuka, Monaco, Interlagos, Hungaroring, Spielberg,
  Zandvoort, Austin, Barcelona, Imola.
- Car recalibrated to v2 (physics 0.2.0): optimal laps within about ±2% of
  real pole on 10 of 12 circuits.
- Quality gate: `check-tracks.ts` + `tracks.test.ts` (optimal valid,
  golden time, centerline and inside slower, drawing round-trip).
- Follow-ups:
  - Map detected corners to real turn numbers/names per circuit (the
    detector over-counts on traced geometry).
  - Confirm Singapore's direction (the source runs clockwise) before adding it.
  - Banking support (Zandvoort) if players notice.
  - Legal review of venue names before a commercial launch (DATA_SOURCES.md).

## ✅ Phase 2 — Browser prototype (built 2026-09-30; drawing replaced in 2b)

`apps/web` (Vite 8 + React 19 + Tailwind 4, Canvas 2D). All 12 real
circuits + Kestrel via a picker (`?track=`), Monza by default.

- **Drawing at 40 px track width** with a camera that looks ahead after each
  lift. One-finger drag off the dot pans, pinch/wheel/+/− zoom, minimap tap
  jumps, ALL shows the whole track.
- **Straight skipping:** tap further along a straight to jump there (no corner
  may be skipped). This cut a scripted Monza lap from 86 strokes to 28 drawn
  strokes + 29 taps.
- **Validation with a way out:** off-track or cut sections are highlighted
  in red, with "Redraw from T5", which rewinds to the stroke before the problem.
- **Fine-tune:** entry/apex/exit knot markers are draggable once the lap is complete.
- **Race:** car follows its simulated speed profile at ×5, follow-cam, speed and
  timer HUD, and the personal-best ghost car.
- **Result:** pit board (lap / target delta / PB delta) plus a per-corner
  heatmap in sector-timing colours and labels on the three worst corners.
  "Adjust line" goes back to the markers; "Draw new line" starts over.
- PBs in localStorage keyed by track, version and physics version; a local
  event log (`apex.events`) records the playtest metrics.

Playtest questions (the plan's "stop and test" gate):
- **Attempts per player** (1–2 weak … 10+ strong).
- How long does a first lap take to draw? (Target: under a minute; Monza
  needs ~25–40 gestures.) If too long, try corner-by-corner drawing or a
  lower default zoom for returning players.
- Do players use the markers (adjust) or redraw? The event log shows it.
- Is ×5 playback the right length (Monza ≈ 16 s, Spa ≈ 19 s)?

Known gaps: no sound or haptics; corner labels are detector numbers
(T-numbers don't match real ones yet); no onboarding beyond hints.

## ✅ Phase 2b — Input redesign: gates instead of drawing (2026-09-30)

Why: drawing couldn't be precise on both phone and PC. Finger pointing has
~1–1.5 mm absolute precision and needs ~8–10 mm targets (Fitts' law touch
studies), while the physics rewards ~5–10 cm precision on a 12–15 m track.
Mobile games solve this with coarse + fine controls (8 Ball Pool's aiming
wheel) and variable-gain sliders (iOS scrubbing). Racing theory already
splits a corner into turn-in / apex / exit, which is exactly our knot model.

What changed:
- **No drawing.** The line starts on the centerline (or your best line), so
  **the first race is one tap.**
- **Corner groups and gates:** only corners that slow the car (≥ 12 km/h
  speed drop) get gates; linked corners (chicanes, esses) share one group, at
  most 3 corners per group; straights are interpolated. Monza: 6 groups /
  27 gates; Monaco: 9 / 56.
- **Precision slider:** tap = absolute; drag = relative at half gain
  (≈ 12 cm per finger-σ); dragging away from the bar gives up to ~8× finer
  control (≈ 3 cm). Keyboard nudges of 5 cm / 50 cm.
- **Track-up camera:** the map rotates so you drive up the screen at the
  selected gate, so slider left = track left.
- **Results link to corners:** "T12 +0.90" jumps to the group that owns it.
- **Targets are computed in the same control space** (`expandGates`), so a
  perfect score is always reachable (tested for every track).

Verified: Monza centreline 1:23.86 → fixing the Ascari group alone gains
1.24 s; slider tap/drag/fine gains measured at −3.00 m / 2.62 m per 100 px /
0.59 m per 100 px.

## ▷ Phase 2 — original requirements (kept for reference)

Build `apps/web` (Vite + React + TS + Tailwind, Canvas 2D). One track
(suggest Monza or Spielberg: few corners, iconic, long straights make exit
speed obvious).

Requirements that come straight from Phase 1 findings:

1. **Draw zoomed, not whole-track.** Real circuits are ~70–130× bigger than
   the track is wide (Kestrel ~82×); a whole-track phone view makes the track ~7 px wide, where finger
   noise beats skill. Target ≥ 40–60 px track width while drawing. Options
   to prototype, in order:
   a. Camera follows the finger at ~4–5× zoom, with an overview minimap
      (recommended first).
   b. Corner-by-corner drawing: one corner complex per screen.
   c. Design tracks with a wider track-to-length ratio (compact, fewer
      corners, 15–20 m width).
2. **Draw, then fine-tune.** After the stroke is fitted, show each knot
   (entry/apex/exit) as a draggable handle. Retries become "move my T5
   apex 5 m later". This removes the remaining ~0.4 s noise floor. Test
   whether players prefer redraw or nudge.
3. Race animation driven by `samples.elapsedMs` / `speed` (not constant speed).
4. Result: lap time, delta to target, per-corner heatmap from `compareRuns`
   (don't reveal the optimal line).
5. Retry in under 1 s. Local PB in `localStorage`.
6. Pointer Events, `touch-action: none`, no scroll, no text selection.

**Stop after Phase 2 and playtest.** Metric: attempts per player
(1–2 weak, 3–5 interesting, 5–10 strong, 10+ investigate).

Questions for the playtest:
- Do players understand *why* a run was slow from the animation and heatmap?
- Freehand vs handles: which drives more retries?
- Is 34 s too long for the race animation? (Consider 2× playback speed.)

## Phase 3 — Feedback system
Target delta, sector/corner loss, heatmap polish, PB and improvement display.

## Phase 4 — Backend
Supabase, anonymous auth, `game_tracks`, `daily_challenges`, `runs`;
server validation in an Edge Function using `@apex/engine` unchanged
(ARCHITECTURE, server validation).

## Phase 5 — Competitive layer
Daily leaderboard, percentile, streaks, share text and card.

## Phase 6 — Viral layer
Friend challenges, ghosts (ghost = another run's `samples`), rematches.

## Phase 7 — Content
More original tracks. Each new track needs the Phase 1 invariants to pass
(`compare-lines` + `racing.test.ts` pattern): shortest ≠ fastest, late apex
beats early apex, graded mistakes. Then procedural generation (reject
tracks that fail these invariants) and Python ingestion tools (F1DB,
FastF1 calibration).

## Phase 8 — Monetization experiments
Only once retention is acceptable.

## Engine backlog (not blocking Phase 2)

- Bump physics to 0.2 only with a reason from playtests. Candidates:
  traction/braking ellipse (braking > acceleration grip), standing start.
- Variable track width.
- Faster optimizer (gradient via finite differences on knots) if tracks
  get more knots.
- Tune knot placement (lead distance, filler spacing) per track type.
- Add `trackVersion`/`physicsVersion` checks to a `validateSubmission()` helper.

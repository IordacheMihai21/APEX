# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Motorsport fans on their phones (and on PC), in short idle moments: commute,
queue, sofa during a race weekend. They know corners, apexes and pole laps
from TV and games, and they want a quick, repeatable skill test they can
share and brag about, not a sim-racing setup.

## Product Purpose
APEX is a daily racing-line game. Players set the line through each corner of
a real circuit and a deterministic physics engine turns it into a lap time.
Success = players come back daily and chase "the impossible" (a perfect lap)
until they get it, then share it.

## Positioning
The only line-choice game where the score is a real physics lap time. It
isn't a trivia quiz or a driving game: you *engineer* the lap corner by
corner, and one engine scores everyone identically (deterministic, same
result on every device).

## Operating Context
Modeled on the daily football-game ritual (playfootball.games, futbol11,
38-0): a hub of quick modes, a countdown to tomorrow's puzzle, a win/loss
record, a share grid, and one impossible goal.

Modes (confirmed 2026-10-01):
- **Daily Quali:** same circuit for everyone each day; **6 laps**, then
  locked until tomorrow. After each lap, every corner group gets a colour:
  purple = within 0.05 s of the target, green = close, yellow = slow,
  red = far off. Each lap earns a **medal** by lap time against per-circuit
  targets calibrated to the same driving precision (Bronze 1.5 m, Silver
  0.75 m, Gold 0.3 m of gate error); **Pole = a lap with every corner purple**,
  the impossible tier, and it ends the day. The streak counts days with at
  least Bronze. Shareable medal + emoji grid.
- **Perfect Season:** the 38-0 equivalent. 12 real circuits in random order,
  3 laps per round to beat a rival pole time that tightens every round.
  Goal: the impossible 12–0. Replayable endlessly.
- **Free Practice:** any circuit, unlimited laps, no pressure.

## Capabilities and Constraints
- 12 real circuits (venue names only, no series branding) + one original
  test circuit. Geometry: bacinger/f1-circuits (MIT).
- Line input = corner-group gates set with a precision slider; lines always
  valid; the target (perfect lap) is reachable by construction.
- Anonymous, local-first for now (localStorage); no accounts or backend yet.
- Deterministic engine shared by client and (future) server validation.
- Sound, if any, is opt-in.

## Brand Commitments
Name: APEX (working name). Independent game, not affiliated with Formula 1,
the FIA, teams or drivers. No F1 logos, team liveries, driver likenesses or
broadcast graphics copies. Venue names only.

## Evidence on Hand
Real-circuit geometry and calibrated physics (targets within about ±3% of real
2025 pole laps). No user testimonials, player counts or leaderboards exist
yet; never fabricate them.

## Product Principles
1. Quick: first lap within seconds, every attempt under ~30 s.
2. Scarcity creates the ritual: limited laps daily; unlimited only in practice.
3. The impossible must be possible: every target is reachable, just hard.
4. Feedback teaches: colours show where time was lost, not the answer.
5. Feel it: the car and timing must make a lap feel fast and consequential.

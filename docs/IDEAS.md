# What other F1 and racing-line projects do well, and what APEX should take

Research round, 2026-10-01. Complements [GAME_PLAN.md](GAME_PLAN.md) (whose
first sprint is done). Each idea names its source, why it fits APEX, and
rough effort (S ≤ a day, M = 2–4 days, L = a week+).

## What's out there

| Project | What it is | What it does well |
|---|---|---|
| [Track Bender](https://mysimrig.nl/en/tools/racing-line-simulator/) | Browser racing-line game: drag anchors and handles, deterministic lap | Plan → Run → Refine framing; ghost of your best; bronze/silver/gold; **speed trace to inspect corner speeds**; global top 10. The closest competitor: one fictional circuit, no daily, no real tracks. |
| [PolyTrack](https://www.switchbladegaming.com/indie-games/polytrack-complete-guide-2026/) | Browser time-trial racer (Trackmania-like) | Pick **any leaderboard entry as your ghost**; ghosts double as coaching; 10–90 s sessions; instant restart; **weekly curated short tracks**; track editor and shared codes. |
| [ReactionF1](https://reactionf1.com/f1-games), [F1 Start Lights](https://iloveclock.com/en/time-lab/f1), [Racing Start Simulator](https://mysimrig.nl/en/tools/racing-start-simulator/) | Five-light reaction tests | Huge search demand for "F1 reaction test"; jump-start detection; compare with an F1 driver's ~0.2 s; daily and weekly leaderboards. Cheap traffic that could feed the daily. |
| [Apexdle](https://www.apexdle.games/) | Daily F1 puzzles | Circuitle: guess the circuit from its shape in 6 tries; streaks and sharing; ad-free. |
| [F1 Play / F1 Predict](https://f1predict.formula1.com/), [Superbru](https://www.superbru.com/f1/) | Race-weekend prediction games | Tied to the real calendar: every Grand Prix weekend is an event, with leagues against friends. |
| [F1ReplayTiming](https://github.com/adn8naiagent/F1ReplayTiming), [f1-race-replay](https://github.com/DevGopi-16/f1-race-replay) | Replays of real sessions | Track map with interpolated cars, **speed/throttle/brake/gear traces against distance**, toggleable corner numbers, playback speed control. |
| [FastF1 track dominance](https://github.com/theOllieS/F1_Minisectors), [speed on track](https://docs.fastf1.dev/gen_modules/examples_gallery/plot_speed_on_track.html), [minisector](https://github.com/lennyocbot/minisector) | Telemetry visualisation | **Track map coloured by who was faster in each mini-sector**, and track maps coloured by speed: the most-shared F1 data images there are. |
| [f1-dash](https://github.com/slowlydev/f1-dash) | Live timing dashboard | Sector-coloured map, timing tower, mini-sectors. |
| [Wordle](https://www.moengage.com/blog/wordle-viral-growth-story/) | Daily puzzle | High-contrast colour mode; post-game answer reveal; stats with a distribution graph. |

## What APEX should take

### Quick wins (no server)

1. **Telemetry after every lap (speed trace).** From Track Bender and the replay
   tools: a speed-against-distance chart of your lap over the perfect lap,
   corner markers along the bottom, braking points visible as the drops. It
   makes the coach's "Braking 20 m early" something you can *see*. The data is
   already in every simulation. **M**
2. **S1 / S2 / S3 sector times, F1 style.** Every track already has three
   sectors. Show them in the HUD as each is completed (purple / green / yellow
   against the perfect lap) and on the result sheet. Instantly reads as F1. **S**
3. **"Beat the real pole."** The repo already holds each circuit's 2025 pole
   time (`REFERENCE_POLE_MS`), and the physics lands within about 2–3 %. Show
   "2025 pole 1:09.511" as a target beside the medals; beating it becomes a
   brag line in the share text. Times only, no driver names. **S**
4. **Post-game reveal: watch the perfect lap.** Wordle shows the answer once
   you're done. Once today's daily is locked (or won), unlock a replay of the
   perfect lap with its line drawn, plus a corner-by-corner comparison with
   your best. Answers "how was that possible?" and teaches for tomorrow. Never
   before the day is over. **S/M**
5. **Colour-blind and high-contrast mode.** Purple, green, yellow and red is
   hard for about 8 % of men. Wordle's fix: an alternate palette (blue, orange
   and shape cues) and patterns on the tiles and share emoji. **S**
6. **Stats page with a distribution chart.** Medal distribution across days,
   best laps per circuit, streak history, like Wordle's statistics panel. **S**
7. **Installable app (PWA).** Home-screen icon, offline play of cached
   circuits, a "new circuit is live" reminder where the platform allows. **S/M**

### Bigger features

8. **Mini-sector comparison maps.** From FastF1 track dominance: when racing a
   challenge link or your previous best, colour the map in two colours by who
   was faster in each mini-sector. With a speed-coloured map, this is the
   shareable image for the share card. **M**
9. **Lights-out reaction mini-game.** The search demand is real and the gantry
   already exists. A standalone "Lights out" page (five lights, jump-start
   detection, your average compared with an F1 driver's ~0.2 s) that funnels
   players into the daily. It also gives the ad layout a high-traffic page.
   Reaction stays out of the physics, so laps remain deterministic. **S/M**
10. **Race-weekend tie-in.** From F1 Play: when a real Grand Prix weekend is on
    at one of our 12 circuits, that circuit becomes the daily on Saturday
    (qualifying day), with a banner such as "This weekend: Monza". Free
    relevance at the moment fans are most engaged. **S**
11. **Weekly one-corner challenge.** From PolyTrack's weekly Shorts: one
    famous corner (Eau Rouge, Parabolica, 130R), unlimited tries, a weekly
    medal. A 20-second loop for players who've finished the daily. **M**
12. **Guess the circuit warm-up.** From Apexdle: a 6-try circuit-from-shape
    puzzle built from our own outlines, which draw a little more after each
    miss. Optional; it overlaps with Apexdle's core game, so treat it as a hub
    extra, not a pillar. **S/M**
13. **TV-style replay director.** From broadcast and replay tools: on lap
    replays, cut between the follow cam, a helicopter view and trackside cams
    at famous corners, with a speed-trap figure on the main straight. **M**

### Later (needs a server or larger scope)

14. **Pick a ghost from the leaderboard** (PolyTrack): race the player just
    above you, or the day's best. Needs the Phase B backend. **M** after the backend.
15. **Circuit editor and shared codes** (PolyTrack, Track Bender): the engine
    already builds tracks from control points (`tools/track-builder`). User
    circuits with share codes would add endless content, but needs moderation
    and is a big UI project. **L**
16. **Predictions for real races** (F1 Play, Superbru): out of scope for a
    racing-line game; skip.

## Status

Done 2026-10-01: sectors (2), beat the real pole (3), perfect-lap reveal (4),
speed trace (1), colour-blind mode (5). Note on the reveal: circuits repeat
every 12 days, so a revealed line could be remembered for the next visit;
rotating conditions per cycle (wet, low-downforce car; GAME_PLAN C13) keeps
repeat visits fresh.

## Recommended next batch

In order of value per effort:

1. S1 / S2 / S3 sectors.
2. Beat the real pole.
3. Post-game reveal of the perfect lap.
4. Speed trace.
5. Colour-blind mode.

Then the reaction mini-game, as a traffic source for launch.

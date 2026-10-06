# Lapdle game plan: better, more attractive, more interactive

Written 2026-10-01 after a research pass on daily games, time-attack racers and
draw-the-line racers. Guiding question stays the roadmap's: does this make
Set line → Race → Retry better?

## 1. What the research says

1. **Scarcity and ritual make the daily.** Wordle's breakthrough was one puzzle a
   day for everyone: a couple of minutes, then a shared result. Streaks work
   through loss aversion. Sharing works because everyone played the same thing.
   ([MoEngage on Wordle](https://www.moengage.com/blog/wordle-viral-growth-story/), [Udonis](https://www.blog.udonis.co/mobile-marketing/mobile-games/wordle))
2. **Time attack is addictive when the loop has no dead time and always a next target.**
   Trackmania restarts in about 1.5 s, gives four medal tiers (bronze, silver, gold,
   author) so every skill level has a goal, shows a ghost of the target time, and
   after the top medal switches to "drivers near you" and regional ranks.
   ([T. Parker on "one more run"](https://tparkergames.substack.com/p/trackmania-and-the-one-more-run-feeling))
3. **Comparison with other players is the second game.** Immaculate Grid's rarity
   score (how few people chose your answer) turned a solved puzzle into a
   competition people share in clubhouses.
   ([Wikipedia](https://en.wikipedia.org/wiki/Immaculate_Grid), [Glanville](https://dougglanville.substack.com/p/the-rarity-score))
4. **The impossible goal needs reachable steps.** 38-0 sells "the impossible"
   but every season still ends with a record you can compare and beat.
   ([38-0](https://38-0.app/), [HITC](https://www.hitc.com/footballs-wordle-how-to-play-the-viral-soccer-game-that-is-all-over-social-media/))
5. **Progressive hints keep players in flow without giving the answer away**
   (Clues by Sam: first hint says where to look, second says what follows).
   Flow breaks when it is too hard too early.
   ([Tau Games on hints](https://taugames.ca/blog/hints.html), [Supersonic on difficulty](https://supersonic.com/learn/blog/difficulty-curves/))
6. **Juice: feedback proportional to the moment, not everywhere.** Haptics, sound
   and visual punctuation at the meaningful beats.
   ([Design the Game](https://www.designthegame.com/learning/tutorial/how-tactile-interactions-game-juice-drive-player-engagement), [Wayline on over-juicing](https://www.wayline.io/blog/the-juice-problem-how-exaggerated-feedback-is-harming-game-design))
7. **The F1 daily space is all trivia.** Gridle, Paddockdle, Boxdle, Apexdle are
   guess-the-driver/circuit games. Nobody owns a *skill* daily with a real lap
   time. That is Lapdle's opening. (Note: "Apexdle" exists; check naming/SEO.)
   ([Gridle](https://playgridle.com/), [Apexdle](https://www.apexdle.games/))
8. **Draw-the-line racers validated the mechanic** (DrawRace 2: 30 tracks,
   180 challenges; LineRacer: stars and checkpoints), and RACELN shows people
   enjoy seeing an optimal line computed for real circuits.
   ([DrawRace 2](https://en.wikipedia.org/wiki/DrawRace_2), [LineRacer](https://play.google.com/store/apps/details?id=com.lineracer.app&hl=en_US), [RACELN](https://raceln.com/))

## 2. Where Lapdle stands

Strong: a real, deterministic physics lap time; 12 real circuits; the daily
format, lap grid and share grid; broadcast presentation.

Weak, in order of impact:

| Problem | Evidence | Research it breaks |
|---|---|---|
| **Too much work per lap for a daily.** | 37 gates on Interlagos, 56 on Monaco, across 9–11 corner groups, each a slider. | 1, 2 (minutes, no dead time) |
| **Binary win.** Only "every corner purple" counts; everything else is a loss. | Purple = within 0.05 s on every group, 6 laps. Most players will lose most days. | 2, 4 (reachable tiers) |
| **Feedback says how much, not why.** | Result shows time lost per corner, not "apex too wide" or "exit 9 km/h slow". | 5 (hints keep flow) |
| **The race is watched, not felt.** | ~18 s of follow-cam at ×4, then Skip. No splits, no ghost to beat. | 2 (ghost, splits) |
| **No one to compare with.** | Fully static app, no backend; PB ghost from Phase 2 no longer drawn. | 3 (second game) |
| **No first-run teaching.** | First screen is a slider on a corner group. | 5 (difficulty curve) |

## 3. The plan

Effort: S = a day or less, M = 2–4 days, L = a week+. "No backend" items ship first.

### Phase A: make each lap quick, readable and worth retrying (no backend)

1. **Line styles per corner, sliders for experts. (M)**
   Each corner group gets three one-tap choices drawn on the track: *Early apex*,
   *Geometric*, *Late apex* (computed from the optimizer as the three offsets
   that matter most), plus "Fine-tune" that opens today's gate sliders. A full
   lap becomes about 10 taps instead of about 40 drags; experts lose nothing.
   *Why:* principle 1. This is the single biggest change.
2. **Medals: Bronze, Silver, Gold, Pole. (S)**
   Lap within 1.5 % of perfect = bronze, 0.75 % = silver, 0.3 % = gold, all purple =
   Pole (the old win). The daily records your best medal; the streak survives on
   bronze or better. Share grid leads with the medal and lap time.
   *Why:* principles 2 and 4; everyone has a target, Pole stays impossible.
3. **Corner coach: the "why", as progressive hints. (M)**
   From data the engine already has (entry, minimum and exit speed vs the perfect
   lap, apex offset vs target), one plain line per bad corner: "T4: apex 1.1 m
   wide, exit 8 km/h slow". Hints unlock by lap: lap 2 shows *where* (the worst
   group pulses), lap 4 shows *which way* (an arrow on the gate). Using a hint
   is marked on the share grid, honestly.
   *Why:* principle 5.
4. **Race against ghosts, with live splits. (M)**
   Bring back the PB ghost and add the gold ghost (target-medal ghost, Trackmania
   style). At each corner group a broadcast split pops: "T4 +0.214" in its
   sector colour, the tower row flashes, a short haptic on purple. Replays 2+
   default to ×8 with a slow-mo on your worst corner.
   *Why:* principle 2; turns watching into rooting.
5. **Instant retry. (S)**
   One key/tap from the result straight back to the worst corner with lights
   already counting; no screen in between. Target: under 2 s from result to
   setting the next line.
6. **"Beat my lap" links. (S/M)**
   The engine is deterministic, so a lap is just its knot offsets. Share links
   carry them (`?vs=<encoded knots>`): a friend opens today's circuit and races
   your ghost, with your time as the target. Viral loop with no server.
   *Why:* principles 1 and 3 without a backend.
7. **First-run lesson on one corner. (S/M)**
   Kestrel T1, 30 seconds: "Move the apex in. Watch the time." Three steps,
   ends on a purple sector, then straight into today's daily.
8. **Juice at the right beats only. (S)**
   Haptic on purple sector and on lights out (`navigator.vibrate`, mobile); a
   short purple chime when sound is on; medal reveal as the share-card moment.
   Nothing on routine taps.

### Phase B: the second game (small backend: one table, one endpoint)

9. **Daily percentile and distribution. (M)**
   Submit (date, track, lap time, medal, knots hash). After a lap: "Faster than
   78 % of today's drivers". After the day: the histogram and where you sit.
10. **Line rarity. (M)**
    Immaculate Grid's twist for racing lines: per corner, how many players chose
    a line close to yours. "Your T1 was a 4 % line." A purple lap through rare
    lines is the brag.
11. **Daily leaderboard and "drivers near you". (M)**
    Anonymous handle (generated, editable), top 50 plus the five times around
    yours. No accounts.
12. **Share card image. (M)**
    OG image of the circuit painted in your sectors, medal and time, so shared
    links preview as a broadcast graphic rather than plain text.

### Phase C: depth and variety

13. **Weekend formats. (M)** Saturday "Wet quali" (lower grip), Sunday "Low-downforce
    spec" (Monza-style car). Same circuits, new optimal lines, the physics
    already supports it.
14. **One-corner sprint. (S)** A 20-second mini daily: one famous corner, three
    tries. Fills the gap for players who already finished the daily.
15. **Season rivals and cosmetics. (M)** Named fictional rivals with styles (late
    braker, smooth); unlockable car colours and helmet designs (no team
    liveries). A season record wall.
16. **Achievements tied to real places. (S)** "Purple at Eau Rouge", "Monaco
    without a red sector", "Pole at all 12".
17. **Career page. (S)** Medals per circuit, best laps, streak history.

## 4. First sprint (recommended order)

All five shipped on 2026-10-01:

1. ✅ Medals (A2): per-circuit times calibrated to equal driving precision
   (Bronze 2.0 m, Silver 0.75 m, Gold 0.3 m of gate error); Pole = all purple.
2. ✅ Line styles (A1): Early apex / Classic / Late apex per corner, fitted to
   the median shape of the optimal lines; the best style per corner reaches
   Bronze on 9 of 12 circuits. Sliders live behind Fine-tune.
3. ✅ Pace target and splits (A4) plus faster retries (A5): a ring at the next
   medal's pace rides your own line (never the perfect one), the PB ghost runs
   in every mode, broadcast splits per corner group, repeat-lap lights ~1.5 s,
   keys 1/2/3 for styles.
4. ✅ Corner coach (A3): the phase where time was lost, phrased like a race
   engineer ("Braking 20 m early for T10"); opt-in hints, counted in the daily.
5. ✅ Beat-my-lap links (A6): `?vs=<track>~<line>`, re-simulated on arrival
   (times can't be faked), raced as a pace marker so no line is revealed; the
   daily share text carries a "Race my best lap" link.

Next: A7 (first-run lesson), A8 (remaining juice), then Phase B.

## 5. How we'll know

Using the local event log now, the backend later:

- **Time to first lap** (target < 60 s for a new player).
- **Laps per daily** (healthy: 4–6) and **daily completion** (all laps used or Pole).
- **Medal distribution** (aim: about 70 % reach bronze, 25 % gold, under 3 % Pole).
- **D1 / D7 return** and **share rate**.
- **Retry latency** (result → next race).

## 6. Risks

- **Difficulty tuning needs data.** Medal thresholds and hint timing should be
  checked against real players before launch; start with the numbers above and
  log everything.
- **Line styles must stay honest.** The three presets cannot include the
  perfect line itself; they are starting points, and purple still needs
  fine-tuning.
- **Backend means privacy and cost decisions** (anonymous, no accounts, rate
  limits).
- **Naming:** check "Lapdle" against "Apexdle" and other daily F1 games before
  launch.

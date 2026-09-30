# APEX

**Find the perfect lap.** A daily racing-line game: everyone gets the same
circuit, sets their line through each corner, and a deterministic physics
engine turns it into a lap time.

Current status: **Phase 2 playable prototype.** Draw a line on any of 12 real
circuits, race it, see where you lost time, retry. See [docs/ROADMAP.md](docs/ROADMAP.md).

![Optimal lines on the real circuits](docs/img/real-circuits-optimal.png)

```bash
npm install
npm run dev           # play at http://localhost:5173 (?track=spa etc.)
npm test              # 107 tests: physics, limits, drawing fit, racing invariants, every track
npm run build:tracks  # regenerate data/tracks/*.json (geometry + optimal line); add ids to build a subset
npm run check         # quality gate for every track + pace vs real pole
npm run compare -- monza   # lap times for different racing lines + noise study
```

How to play: press **Race** straight away. Your first lap uses the centre of
the track. The pit board shows your time against the target, and the map
shows where you lost it. Tap a corner (e.g. **T5 +0.64**) to fix it. For each
point in the corner (approach, turn-in, apex, exit, track-out), place the
car across the track with the slider:
- **tap** to jump there;
- **drag** for fine control;
- slide your finger (or mouse) away from the bar for even finer control.

On PC: ←/→ nudge 5 cm (Shift: 50 cm), Tab or ↑/↓ changes point, [ / ]
changes corner, Enter races, Esc skips to the result, Ctrl+Z undoes.

Docs:
- [ARCHITECTURE.md](docs/ARCHITECTURE.md): layout, track format, decisions
- [PHYSICS.md](docs/PHYSICS.md): model, determinism, findings, results
- [DATA_SOURCES.md](docs/DATA_SOURCES.md): licences and what may ship
- [ROADMAP.md](docs/ROADMAP.md): phases and what's next

APEX is an independent game, not affiliated with Formula 1 or the FIA.
Circuit geometry: [bacinger/f1-circuits](https://github.com/bacinger/f1-circuits) (MIT).

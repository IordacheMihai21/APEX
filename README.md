# APEX

**Draw the perfect lap.** A daily racing-line game: everyone gets the same
circuit, draws their line, and a deterministic physics engine turns it into
a lap time.

Current status: **Phase 1 complete, plus 12 real circuits.** Physics engine,
tracks and tests are done; there's no UI yet. See [docs/ROADMAP.md](docs/ROADMAP.md).

![Optimal lines on the real circuits](docs/img/real-circuits-optimal.png)

```bash
npm install
npm test              # 92 tests: physics, limits, drawing fit, racing invariants, every track
npm run build:tracks  # regenerate data/tracks/*.json (geometry + optimal line); add ids to build a subset
npm run check         # quality gate for every track + pace vs real pole
npm run compare -- monza   # lap times for different racing lines + noise study
```

Docs:
- [ARCHITECTURE.md](docs/ARCHITECTURE.md): layout, track format, decisions
- [PHYSICS.md](docs/PHYSICS.md): model, determinism, findings, results
- [DATA_SOURCES.md](docs/DATA_SOURCES.md): licences and what may ship
- [ROADMAP.md](docs/ROADMAP.md): phases and what's next

APEX is an independent game, not affiliated with Formula 1 or the FIA.
Circuit geometry: [bacinger/f1-circuits](https://github.com/bacinger/f1-circuits) (MIT).

# Physics spike (Python, historical)

Phase 0 research code that answered "does a better line give a faster lap,
and does hand-drawn input work?" It is kept for reference and is **not
maintained**. The authoritative physics is `packages/engine` (TypeScript).

Run in order (numpy + scipy required):
- `experiments.py`: line comparison, resolution sensitivity, raw-input noise
- `fix_test.py`: fixed-metre curvature stencil, offset-space smoothing
- `corner_fit.py`: per-corner knot representation
- `lookahead.py`: speed-dependent curvature filtering (rejected: it also erases skill)
- `scale.py`: noise cost versus on-screen track width

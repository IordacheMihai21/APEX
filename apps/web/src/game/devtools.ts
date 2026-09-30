/**
 * Dev-only playtest helpers (never bundled in production builds).
 * In the browser console:
 *   __drawLap(noiseM?, skipStraights?, excursion?)
 *     draw the target line with hand-like wobble, stroke by stroke, like a
 *     player. excursion = [fromIndex, toIndex, metres] pushes that stretch
 *     sideways (e.g. off the track) to exercise validation.
 */
// Reaches into Game's private state on purpose: this is a test driver.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Internals = Record<string, any>;

function drawLap(noiseM = 0.6, skip = true, excursion?: [number, number, number]) {
  const g = (window as unknown as { __apex: Internals }).__apex;
  const cv = document.querySelector("canvas")!;
  const r = cv.getBoundingClientRect();
  const opt = g.reference.samples;
  const n: number = g.pt.n;
  const step: number = g.pt.step;
  const settle = () => g.camera.tick(performance.now() + 1e6);
  settle();
  const [mx, , , mh] = g.minimapRect();
  const ev = (type: string, sx: number, sy: number) =>
    cv.dispatchEvent(new PointerEvent(type, { clientX: r.left + sx, clientY: r.top + sy, pointerId: 7, bubbles: true, pointerType: "touch", isPrimary: true }));
  const onScreen = ([sx, sy]: number[]) =>
    sx > 30 && sy > 60 && sx < r.width - 30 && sy < r.height - 140 && !(sx > mx - 20 && sy < 16 + mh + 20) && !(sx < 70 && sy < 200);
  const pt = (k: number) => {
    const i = k % n;
    let noise = Math.sin(k * 0.37) * noiseM + (Math.random() - 0.5) * noiseM;
    if (excursion && k >= excursion[0] && k <= excursion[1]) noise += excursion[2];
    return g.camera.toScreen(opt.x[i] + g.pt.nx[i] * noise, opt.y[i] + g.pt.ny[i] * noise) as [number, number];
  };
  let idx = 0;
  let gestures = 0;
  let skips = 0;
  let stuck = 0;
  while (g.phase === "draw" && gestures < 300 && idx < n && stuck < 4) {
    const idx0 = idx;
    let down: [number, number] | null = null;
    if (skip && idx > 0) {
      const starts = g.track.corners.map((c: { startIndex: number }) => c.startIndex);
      const next = starts.filter((s: number) => s > idx + 5).sort((a: number, b: number) => a - b)[0] ?? n + starts[0];
      let k = Math.min(next - Math.round(25 / step), n);
      while (k > idx + Math.round(40 / step) && !onScreen(pt(k))) k -= 5;
      if (k > idx + Math.round(40 / step)) {
        const p = pt(k);
        const before = g.strokes.length;
        ev("pointerdown", p[0], p[1]);
        if (g.mode === "draw" && g.strokes.length > before) {
          idx = k;
          skips++;
          down = p;
        } else ev("pointerup", p[0], p[1]);
      }
    }
    if (!down) {
      down = g.camera.toScreen(g.head[0], g.head[1]) as [number, number];
      ev("pointerdown", down[0], down[1]);
    }
    let last = down;
    for (let q = 0; q < 3000 && idx + 1 <= n; q++) {
      const p = pt(idx + 1);
      if (!onScreen(p)) break;
      idx++;
      ev("pointermove", p[0], p[1]);
      last = p;
    }
    ev("pointerup", last[0], last[1]);
    gestures++;
    settle();
    stuck = idx === idx0 ? stuck + 1 : 0;
  }
  return { phase: g.phase, gestures, skips, hint: g.getSnapshot().hint?.text };
}

Object.assign(window, { __drawLap: drawLap });

export {};

import type { Condition } from "@apex/engine";
import { CornerScene } from "../game3d/cornerScene";
import { CornerRun, type CornerData, DT, idealCalls, perfectRun, scoreRun } from "../modes/makeCorner";
import index from "../game/corners/index.json";

/**
 * Dev-only preview of Make the corner's 3D scene (served by the dev server at
 * /dev/corner.html, not part of the site build): pick a corner and condition,
 * hold Space or a finger to brake, let go to roll, press again for throttle.
 */
const files = import.meta.glob<CornerData>("../game/corners/*-*.json", { import: "default" });
const canvas = document.getElementById("c") as HTMLCanvasElement;
const pick = document.getElementById("corner") as HTMLSelectElement;
const cond = document.getElementById("cond") as HTMLSelectElement;
const speedEl = document.getElementById("speed")!;
const statusEl = document.getElementById("status")!;
const params = new URLSearchParams(location.search);
for (const c of index) pick.add(new Option(c.name, c.id));
pick.value = params.get("corner") ?? index[0].id;
cond.value = params.get("cond") ?? "dry";

let scene: CornerScene | null = null;
let run: CornerRun | null = null;
let data: CornerData | null = null;
let auto = false;
let recording = false;
let last = 0;

async function load() {
  data = await files[`../game/corners/${pick.value}.json`]();
  scene?.dispose();
  scene = await CornerScene.create(canvas, data, cond.value as Condition);
  scene.resize(innerWidth, innerHeight);
  (window as unknown as { scene: CornerScene }).scene = scene; // for poking at in the console
  restart();
}
function restart() {
  if (!data) return;
  run = new CornerRun(data, cond.value as Condition);
  auto = false;
  last = performance.now();
  delete statusEl.dataset.done;
}

const press = (down: boolean) => run?.press(down);
addEventListener("keydown", (e) => e.code === "Space" && !e.repeat && (e.preventDefault(), press(true)));
addEventListener("keyup", (e) => e.code === "Space" && press(false));
canvas.addEventListener("pointerdown", () => press(true));
addEventListener("pointerup", () => press(false));
addEventListener("resize", () => scene?.resize(innerWidth, innerHeight));
pick.onchange = cond.onchange = () => void load();
document.getElementById("restart")!.onclick = restart;
document.getElementById("auto")!.onclick = () => {
  restart();
  auto = true;
};

function frame(now: number) {
  if (recording) return;
  requestAnimationFrame(frame);
  if (!scene || !run || !data) return;
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (auto) {
    // the ideal calls, for checking the scene against the perfect run
    const ideal = idealCalls(data, run.condition);
    if (run.phase === "approach" && run.s >= ideal.brakeS) run.press(true);
    else if (run.phase === "braking" && run.v <= ideal.minSpeed + 0.02) run.press(false);
    else if (run.phase === "rolling" && run.s >= ideal.throttleS) run.press(true);
  }
  run.advance(dt);
  scene.render(run.pose(), run.v, run.phase === "braking", dt);
  speedEl.textContent = `${Math.round(run.v * 3.6)} km/h`;
  if (run.outcome && !statusEl.dataset.done) {
    statusEl.dataset.done = "1";
    const score = scoreRun(run, perfectRun(data, run.condition));
    statusEl.textContent = `${run.outcome}: ${score.points} pts · brake ${score.brakeM?.toFixed(1) ?? "–"} m · min ${score.speedKmh?.toFixed(1) ?? "–"} km/h · throttle ${score.throttleM?.toFixed(1) ?? "–"} m`;
  } else if (!run.outcome) statusEl.textContent = `${run.phase} · ${Math.round(run.s)} / ${Math.round(run.length)} m`;
}
void load();
requestAnimationFrame(frame);

/**
 * For recording clips frame by frame (marketing/trailer-src): load a corner, then step the run by exactly one
 * video frame with the perfect calls and draw it; nothing runs on the real clock.
 */
(window as unknown as { dev: unknown }).dev = {
  async load(id: string, condition: Condition) {
    pick.value = id;
    cond.value = condition;
    await load();
    recording = true; // the live loop stops
    return true;
  },
  /** jump the car to s metres (driven there with the perfect calls, not drawn) */
  skipTo(s: number) {
    while (run && !run.outcome && run.s < s) step(DT);
  },
  /** one frame: the run advances `seconds` with the perfect calls, then the scene draws */
  frame(seconds: number) {
    if (!run || !scene) return null;
    step(seconds);
    scene.render(run.pose(), run.v, run.phase === "braking", seconds);
    return { s: run.s, v: run.v, phase: run.phase, outcome: run.outcome };
  },
  /** one frame with the car put at s metres and v m/s, no physics: for replaying a real car's data */
  place(s: number, v: number, braking: boolean, seconds: number) {
    if (!run || !scene) return null;
    run.s = s;
    run.v = v;
    scene.render(run.pose(), v, braking, seconds);
    return { s, v };
  },
  score() {
    return run && data ? scoreRun(run, perfectRun(data, run.condition)) : null;
  },
  ideal() {
    return data ? { ...idealCalls(data, cond.value as Condition), apexS: data.s[data.conditions[cond.value as Condition].apex] } : null;
  },
};

function step(seconds: number) {
  if (!run || !data) return;
  const ideal = idealCalls(data, run.condition);
  for (let t = 0; t < seconds - 1e-9 && !run.outcome; t += DT) {
    if (run.phase === "approach" && run.s >= ideal.brakeS) run.press(true);
    else if (run.phase === "braking" && run.v <= ideal.minSpeed + 0.02) run.press(false);
    else if (run.phase === "rolling" && run.s >= ideal.throttleS) run.press(true);
    run.advance(DT);
  }
}

import type { Condition } from "@apex/engine";
import { CornerScene } from "../game3d/cornerScene";
import { CornerRun, type CornerData, idealCalls, perfectRun, scoreRun } from "../modes/makeCorner";
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
let last = 0;

async function load() {
  data = await files[`../game/corners/${pick.value}.json`]();
  scene?.dispose();
  scene = new CornerScene(canvas, data, cond.value as Condition);
  scene.resize(innerWidth, innerHeight);
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
  scene.render(run.pose(), run.v, run.phase === "braking", 0, dt);
  speedEl.textContent = `${Math.round(run.v * 3.6)} km/h`;
  if (run.outcome && !statusEl.dataset.done) {
    statusEl.dataset.done = "1";
    const score = scoreRun(run, perfectRun(data, run.condition));
    statusEl.textContent = `${run.outcome}: ${score.points} pts · brake ${score.brakeM?.toFixed(1) ?? "–"} m · min ${score.speedKmh?.toFixed(1) ?? "–"} km/h · throttle ${score.throttleM?.toFixed(1) ?? "–"} m`;
  } else if (!run.outcome) statusEl.textContent = `${run.phase} · ${Math.round(run.s)} / ${Math.round(run.length)} m`;
}
void load();
requestAnimationFrame(frame);

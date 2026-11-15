/**
 * Dev page (dev/lap3d.html): the Daily Quali lap in 3D exactly as the game draws it (game3d/lapScene.ts), driven by a
 * clock of its own instead of the game's, with a simple timing and speed readout and the cameras cutting through the
 * lap, for showing it. window.demoFrame(tMs) draws one frame (for recording); otherwise it plays in real time.
 */
import { CONDITION_CARS, prepareTrack, simulateLap } from "@apex/engine";
import { loadTrack } from "../game/catalog";
import { type LapCamera, LapScene } from "../game3d/lapScene";

const params = new URLSearchParams(location.search);
const trackId = params.get("track") ?? "spa";
const canvas = document.getElementById("c") as HTMLCanvasElement;
const scene = await LapScene.create(canvas, trackId, "dry");
const track = await loadTrack(trackId);
const pt = prepareTrack(track);
const sim = simulateLap({ track: pt, line: track.optimalLine!, car: CONDITION_CARS.dry });
// the ghost: the same perfect line at Gold pace, about 1.5% slower
scene.setLap(sim, sim, 1.015);
const resize = () => scene.resize(innerWidth, innerHeight);
addEventListener("resize", resize);
resize();

// the cameras through the lap (seconds): chase, then TV, cockpit and back
const CUTS: [number, LapCamera][] = [[0, "chase"], [13, "tv"], [24, "tcam"], [34, "cockpit"], [44, "chase"], [56, "tv"], [66, "tcam"], [76, "chase"], [88, "tv"]];
const NAME: Record<LapCamera, string> = { chase: "Chase", tcam: "T-cam", cockpit: "Cockpit", tv: "TV" };
const $ = (id: string) => document.getElementById(id) as HTMLElement;
const lapMs = sim.rawLapTimeMs;
const fmt = (ms: number) => `${Math.floor(ms / 60000)}:${((ms % 60000) / 1000).toFixed(3).padStart(6, "0")}`;
/** the speed at a time (m/s), from the lap's samples */
const speedAt = (ms: number) => {
  const e = sim.samples.elapsedMs;
  let i = 0;
  while (i < e.length - 1 && e[i + 1] <= ms) i++;
  return sim.samples.speed[i];
};
const gearOf = (kmh: number) => (kmh < 2 ? "N" : String([0, 95, 130, 165, 200, 235, 270, 300].filter((g) => kmh >= g).length));
function demoFrame(tMs: number) {
  const t = Math.max(0, Math.min(lapMs, tMs));
  const cam = (params.get("cam") as LapCamera | null) ?? [...CUTS].reverse().find(([at]) => t / 1000 >= at)![1];
  scene.setCamera(cam);
  scene.frame(t);
  const kmh = Math.round(speedAt(t) * 3.6);
  $("lt").textContent = fmt(t);
  $("kmh").textContent = String(kmh);
  $("gear").textContent = gearOf(kmh);
  $("cam").textContent = `Camera: ${NAME[cam]}`;
}
(window as unknown as { demoFrame: typeof demoFrame; demoReady: boolean; lapMs: number }).demoFrame = demoFrame;
(window as unknown as { lapMs: number }).lapMs = lapMs;
if (params.get("hud") === "0") for (const el of document.querySelectorAll<HTMLElement>(".hud")) el.style.display = "none";
(window as unknown as { demoReady: boolean }).demoReady = true;
if (!params.has("still")) {
  const t0 = performance.now();
  const loop = () => {
    demoFrame((performance.now() - t0) % (lapMs + 2000));
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

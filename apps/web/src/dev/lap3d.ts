/**
 * Dev page (dev/lap3d.html): the Daily Quali lap in 3D exactly as the game draws it (game3d/lapScene.ts), driven by a
 * clock of its own instead of the game's, with a simple timing and speed readout and the cameras cutting through the
 * lap, for showing it. window.demoFrame(tMs) draws one frame (for recording); otherwise it plays in real time.
 */
import { CONDITION_CARS, prepareTrack, simulateLap } from "@apex/engine";
import { loadTrack } from "../game/catalog";
import { type LapCamera, LapScene } from "../game3d/lapScene";
import { LapSound } from "../game3d/lapSound";

const params = new URLSearchParams(location.search);
const trackId = params.get("track") ?? "spa";
const canvas = document.getElementById("c") as HTMLCanvasElement;
const condition = params.get("wet") === "1" ? "wet" : "dry";
const scene = await LapScene.create(canvas, trackId, condition);
const track = await loadTrack(trackId);
const pt = prepareTrack(track);
const sim = simulateLap({ track: pt, line: track.optimalLine!, car: CONDITION_CARS[condition] });
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
(window as unknown as { lapScene: LapScene }).lapScene = scene;
/**
 * The sound of the lap from t0 to t1 (s), rendered offline at 30 frames a second with the cameras as demoFrame cuts
 * them, as a WAV (base64), for putting under a recording.
 */
async function renderSound(t0: number, t1: number) {
  const rate = 44100;
  const off = new OfflineAudioContext(2, Math.ceil((t1 - t0) * rate), rate);
  const snd = new LapSound();
  await snd.start(off);
  for (let f = 0; f <= (t1 - t0) * 30; f++) {
    const t = t0 + f / 30;
    demoFrame(t * 1000);
    const tele = scene.telemetry;
    snd.update(tele.v, tele.along, { distance: tele.cameraDistance, onboard: tele.onboard }, tele.crowdNear, f / 30);
  }
  const buf = await off.startRendering();
  // 16-bit PCM WAV
  const n = buf.length;
  const out = new DataView(new ArrayBuffer(44 + n * 4));
  const w = (o: number, str: string) => [...str].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF");
  out.setUint32(4, 36 + n * 4, true);
  w(8, "WAVEfmt ");
  out.setUint32(16, 16, true);
  out.setUint16(20, 1, true);
  out.setUint16(22, 2, true);
  out.setUint32(24, rate, true);
  out.setUint32(28, rate * 4, true);
  out.setUint16(32, 4, true);
  out.setUint16(34, 16, true);
  w(36, "data");
  out.setUint32(40, n * 4, true);
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);
  for (let i = 0; i < n; i++) {
    out.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true);
    out.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true);
  }
  let bin = "";
  const bytes = new Uint8Array(out.buffer);
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
(window as unknown as { renderSound: typeof renderSound }).renderSound = renderSound;
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

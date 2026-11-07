import * as THREE from "three";
import { CornerScene } from "../game3d/cornerScene";
import { groundAt, toWorld } from "../game3d/geometry";
import type { CornerData } from "../modes/makeCorner";

/**
 * Dev-only: the early and late apex film for the marketing clip, shot frame by frame in the game's own 3D scene
 * (served at /dev/apex.html, not part of the site build). Two lines through a real corner: the corner's dry line with
 * its lateral profile moved earlier or later along the road, both driven through one small model (grip, brakes, power).
 */
const files = import.meta.glob<CornerData>("../game/corners/*-*.json", { import: "default" });
const canvas = document.getElementById("c") as HTMLCanvasElement;
for (const id of ["hud", "status", "speed"]) document.getElementById(id)?.remove();

type Run = { x: number[]; y: number[]; h: number[]; k: number[]; v: number[]; t: number[]; s: number[] };
const smooth = (a: number[], w: number, passes = 3) => {
  let o = a;
  for (let p = 0; p < passes; p++) {
    const src = o;
    o = src.map((_, i) => {
      let sum = 0;
      for (let k = -w; k <= w; k++) sum += src[Math.min(src.length - 1, Math.max(0, i + k))];
      return sum / (2 * w + 1);
    });
  }
  return o;
};
/** the line with its lateral profile shifted `shift` metres along the road (positive: everything happens sooner) */
function line(c: CornerData, shift: number): Run {
  const n = c.s.length, step = c.s[1] - c.s[0], off = Math.round(shift / step);
  const lat = c.x.map((_, i) => {
    const ex = c.rx[i] - c.lx[i], ey = c.ry[i] - c.ly[i];
    return ((c.x[i] - c.lx[i]) * ex + (c.y[i] - c.ly[i]) * ey) / (ex * ex + ey * ey);
  });
  const moved = smooth(lat.map((_, i) => Math.min(0.93, Math.max(0.07, lat[Math.min(n - 1, Math.max(0, i + off))]))), 3);
  const x = smooth(moved.map((f, i) => c.lx[i] + (c.rx[i] - c.lx[i]) * f), 2), y = smooth(moved.map((f, i) => c.ly[i] + (c.ry[i] - c.ly[i]) * f), 2);
  const ds = x.slice(1).map((_, i) => Math.hypot(x[i + 1] - x[i], y[i + 1] - y[i]));
  const s = [0];
  for (const d of ds) s.push(s[s.length - 1] + d);
  const h = x.map((_, i) => { const j = Math.min(n - 1, i + 1), q = Math.max(0, i - 1); return Math.atan2(y[j] - y[q], x[j] - x[q]); });
  const k = smooth(h.map((_, i) => { const j = Math.min(n - 1, i + 2), q = Math.max(0, i - 2); let d = h[j] - h[q]; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d / (s[j] - s[q] || 1); }), 2);
  const dry = c.conditions.dry;
  const grip = Math.max(...dry.speed.map((v, i) => v * v * Math.abs(dry.kappa[i]))); // the game's own grip at this corner
  const v = k.map((q) => Math.min(92, Math.sqrt(grip / Math.max(Math.abs(q), 1e-5))));
  v[0] = Math.min(v[0], dry.speed[0]);
  for (let i = 0; i < n - 1; i++) { const a = Math.min(13, 1500 / Math.max(v[i], 10)); v[i + 1] = Math.min(v[i + 1], Math.sqrt(v[i] ** 2 + 2 * a * ds[i])); }
  for (let i = n - 2; i >= 0; i--) v[i] = Math.min(v[i], Math.sqrt(v[i + 1] ** 2 + 2 * 40 * ds[i]));
  const t = [0];
  for (let i = 0; i < n - 1; i++) t.push(t[i] + ds[i] / ((v[i] + v[i + 1]) / 2));
  return { x, y, h, k, v, t, s };
}
const lerpAt = (r: Run, t: number) => {
  let a = 0, b = r.t.length - 1;
  while (b - a > 1) { const m = (a + b) >> 1; if (r.t[m] <= t) a = m; else b = m; }
  const f = Math.min(1, Math.max(0, (t - r.t[a]) / (r.t[b] - r.t[a] || 1)));
  const mix = (q: number[]) => q[a] + (q[b] - q[a]) * f;
  let dh = r.h[b] - r.h[a];
  while (dh > Math.PI) dh -= 2 * Math.PI;
  while (dh < -Math.PI) dh += 2 * Math.PI;
  return { i: a, x: mix(r.x), y: mix(r.y), heading: r.h[a] + dh * f, kappa: mix(r.k), v: mix(r.v), s: mix(r.s) };
};
const timeAt = (r: Run, s: number) => { const i = r.s.findIndex((q) => q >= s); return r.t[Math.max(0, i)]; };

let scene: any, E: Run, L: Run, carE: THREE.Group, carL: THREE.Group;
let ribE: THREE.Mesh, ribL: THREE.Mesh;
const wheelsOf = (g: THREE.Object3D) => { const w: THREE.Object3D[] = []; g.traverse((o) => { if (o.name.startsWith("wheel-")) w.push(o); }); return w; };
const ribbon = (r: Run, color: string) => {
  const n = r.x.length, pos = new Float32Array(n * 6), idx: number[] = [];
  for (let i = 0; i < n; i++) {
    const nx = -Math.sin(r.h[i]) * 0.22, ny = Math.cos(r.h[i]) * 0.22;
    const a = toWorld(r.x[i] + nx, r.y[i] + ny, 0.07), b = toWorld(r.x[i] - nx, r.y[i] - ny, 0.07);
    pos.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6);
    if (i < n - 1) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
  m.frustumCulled = false;
  return m;
};
const place = (car: THREE.Group, p: { x: number; y: number; heading: number; kappa: number; v: number }, turn: number) => {
  const dir = new THREE.Vector3(Math.cos(p.heading), 0, -Math.sin(p.heading));
  car.position.copy(toWorld(p.x, p.y));
  const ch = Math.cos(p.heading), sh = Math.sin(p.heading);
  const pitch = Math.atan2(groundAt(p.x + ch * 1.7, p.y + sh * 1.7) - groundAt(p.x - ch * 1.7, p.y - sh * 1.7), 3.4);
  const roll = Math.atan2(groundAt(p.x + sh * 0.8, p.y - ch * 0.8) - groundAt(p.x - sh * 0.8, p.y + ch * 0.8), 1.6);
  car.rotation.order = "YXZ";
  car.rotation.set(pitch, Math.atan2(-dir.x, -dir.z), roll);
  for (const w of wheelsOf(car)) { w.rotation.x = turn; if (w.name.startsWith("wheel-F")) w.rotation.y = Math.atan(3.4 * p.kappa); }
};
const apex = {
  async load(id: string) {
    const data = await files[`../game/corners/${id}.json`]();
    scene = await CornerScene.create(canvas, data, "dry");
    scene.resize(1080, 1920);
    E = line(data, 16); L = line(data, -16);
    scene.car.visible = false;
    carL = scene.car.clone(true); carE = scene.car.clone(true);
    carL.visible = carE.visible = true;
    carE.traverse((o: THREE.Object3D) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && (m.material as THREE.Material).name === "paint") { const p = (m.material as THREE.MeshPhysicalMaterial).clone(); p.color.set("#c9ced4"); p.metalness = 0.5; m.material = p; }
    });
    scene.scene.add(carL, carE);
    ribE = ribbon(E, "#e8ebef"); ribL = ribbon(L, "#ff6a13");
    scene.scene.add(ribE, ribL);
    const end = 640;
    return { early: { t: timeAt(E, end), min: Math.min(...E.v) * 3.6, exit: E.v[E.s.findIndex((q) => q >= 300)] * 3.6 }, late: { t: timeAt(L, end), min: Math.min(...L.v) * 3.6, exit: L.v[L.s.findIndex((q) => q >= 300)] * 3.6 }, apexS: data.conditions.dry.apex, stations: [100, 140, 183, 220, 300, 400, 500, 640].map((s) => [s, timeAt(E, s), timeAt(L, s)]) };
  },
  /** seconds on either car's clock at a metre mark */
  timeAt: (which: "E" | "L", s: number) => timeAt(which === "E" ? E : L, s),
  run: (which: "E" | "L") => (which === "E" ? E : L),
  /** one frame: where each car is on its clock (null hides it), how far its ribbon has run, and the camera */
  shot(o: { te: number | null; tl: number | null; focus: "E" | "L"; ribE: number; ribL: number; cam: { p: [number, number, number]; look: [number, number, number]; fov: number } }, dt = 1 / 30) {
    const pe = o.te === null ? null : lerpAt(E, o.te), pl = o.tl === null ? null : lerpAt(L, o.tl);
    carE.visible = !!pe; carL.visible = !!pl;
    if (pe) place(carE, pe, -(pe.s / 0.36));
    if (pl) place(carL, pl, -(pl.s / 0.36));
    ribE.geometry.setDrawRange(0, o.ribE < 0 ? 0 : Math.max(0, lerpAt(E, o.ribE).i) * 6);
    ribL.geometry.setDrawRange(0, o.ribL < 0 ? 0 : Math.max(0, lerpAt(L, o.ribL).i) * 6);
    const f = (o.focus === "E" ? pe : pl) ?? pe ?? pl!;
    const comp = scene.composer, real = comp?.render;
    if (comp) comp.render = () => {};
    scene.render({ x: f.x, y: f.y, heading: f.heading, kappa: f.kappa, s: f.s }, f.v, false, dt);
    if (comp) comp.render = real;
    const c = scene.camera as THREE.PerspectiveCamera;
    c.position.set(...o.cam.p); c.up.set(0, 1, 0); c.lookAt(...o.cam.look); c.fov = o.cam.fov; c.updateProjectionMatrix();
    scene.sky.position.set(c.position.x, 0, c.position.z);
    scene.hills?.position.set(c.position.x, 3, c.position.z);
    if (comp) comp.render(dt); else scene.renderer.render(scene.scene, c);
    return { e: pe && { s: pe.s, v: pe.v, x: pe.x, y: pe.y }, l: pl && { s: pl.s, v: pl.v, x: pl.x, y: pl.y } };
  },
  world: (x: number, y: number, h = 0) => toWorld(x, y, h).toArray(),
};
(window as unknown as { apex: typeof apex }).apex = apex;

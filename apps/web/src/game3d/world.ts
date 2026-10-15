import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { GameTrack } from "@apex/engine";
import type { CornerData } from "../modes/makeCorner";
import type { SceneryData } from "../game/surroundings";
import { FLORA_BY_TRACK, pickSpecies, type Species } from "../game/trees";
import { extrude, inside, polygon, strip, toWorld } from "./geometry";
import { type Surfaces, crowdTexture, surfaceTextures, windowsTexture } from "./textures";

/**
 * The world around the corner, in the corner's coordinates (metres from the
 * dry apex): the grass to the horizon, the rest of the circuit nearby, and the
 * real surroundings from OpenStreetMap (data/scenery, © OpenStreetMap
 * contributors, ODbL): buildings at their height, grandstands raked towards
 * the track and full of people, pit buildings, woods as 3D trees, water,
 * roads and the pit lane. Where the map has few trees, clumps of trees stand
 * in the fields, and a treeline closes the horizon.
 */
const RADIUS = 1100;

export interface World {
  group: THREE.Group;
  /** the circuit's centre line outside this corner's stretch (x, y pairs), for keeping barriers off it */
  others: number[];
  halfWidth: number;
  dispose(): void;
}

export function buildWorld(c: CornerData, track: GameTrack, osm: SceneryData | null, wet: boolean, street: boolean, photo: Surfaces): World {
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x);
  const [ox, oy] = c.origin;
  const near = (x: number, y: number, r = RADIUS) => x * x + y * y < r * r;
  const tex = surfaceTextures(wet);
  for (const t of Object.values(tex)) keep(t);

  // ---- the ground, to the horizon
  const ground = new THREE.PlaneGeometry(8000, 8000);
  ground.rotateX(-Math.PI / 2);
  const guv = ground.getAttribute("uv");
  const gpos = ground.getAttribute("position");
  for (let i = 0; i < guv.count; i++) guv.setXY(i, gpos.getX(i), -gpos.getZ(i));
  const grassMat = keep(new THREE.MeshStandardMaterial({ map: photo.grass.map, normalMap: photo.grass.normal, roughness: 1, color: wet ? "#9fae98" : "#d9e2cf" }));
  const groundMesh = new THREE.Mesh(keep(ground), grassMat);
  groundMesh.receiveShadow = true;
  group.add(groundMesh);

  // ---- the rest of the circuit: where this stretch is on the lap, and the road either side of it
  const cl = track.centerline;
  const N = cl.length;
  const nearestIndex = (x: number, y: number) => {
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < N; i++) {
      const d = (cl[i][0] - ox - x) ** 2 + (cl[i][1] - oy - y) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  };
  const midX = (i: number) => (c.lx[i] + c.rx[i]) / 2;
  const midY = (i: number) => (c.ly[i] + c.ry[i]) / 2;
  const last = c.s.length - 1;
  let i0 = nearestIndex(midX(0), midY(0));
  let i1 = nearestIndex(midX(last), midY(last));
  // the stretch runs forward from i0 to i1 (the short way round)
  if ((i1 - i0 + N) % N > N / 2) [i0, i1] = [i1, i0];
  const inStretch = (i: number, pad: number) => {
    const a = (i0 - pad + N) % N;
    const len = (i1 - i0 + N) % N + 2 * pad;
    return (i - a + N) % N <= len;
  };
  const step = track.lengthMeters / N;
  const others: number[] = [];
  for (let i = 0; i < N; i++) {
    const x = cl[i][0] - ox;
    const y = cl[i][1] - oy;
    if (near(x, y, RADIUS + 200) && !inStretch(i, Math.round(120 / step))) others.push(x, y);
  }
  const L = track.leftBoundary;
  const R = track.rightBoundary;
  const otherRoad: (null | { a: [number, number, number]; b: [number, number, number]; v: number })[] = [];
  const otherLines: (null | { a: [number, number, number]; b: [number, number, number]; v: number })[][] = [[], []];
  const shoulders: (null | { a: [number, number, number]; b: [number, number, number]; v: number })[][] = [[], []];
  for (let k = 0; k <= N; k++) {
    const i = k % N;
    const lx = L[i][0] - ox;
    const ly = L[i][1] - oy;
    const rx = R[i][0] - ox;
    const ry = R[i][1] - oy;
    const show = near(lx, ly) && !inStretch(i, -1);
    const v = k * step;
    otherRoad.push(show ? { a: [lx, ly, 0.022], b: [rx, ry, 0.022], v } : null);
    const w = Math.hypot(rx - lx, ry - ly) || 1;
    const ux = (rx - lx) / w;
    const uy = (ry - ly) / w;
    // edge lines and a tarmac shoulder on both sides
    otherLines[0].push(show ? { a: [lx + ux * 0.25, ly + uy * 0.25, 0.025], b: [lx + ux * 0.43, ly + uy * 0.43, 0.025], v } : null);
    otherLines[1].push(show ? { a: [rx - ux * 0.25, ry - uy * 0.25, 0.025], b: [rx - ux * 0.43, ry - uy * 0.43, 0.025], v } : null);
    shoulders[0].push(show ? { a: [lx, ly, 0.018], b: [lx - ux * 4, ly - uy * 4, 0.018], v } : null);
    shoulders[1].push(show ? { a: [rx, ry, 0.018], b: [rx + ux * 4, ry + uy * 4, 0.018], v } : null);
  }
  const roadMat = keep(
    new THREE.MeshStandardMaterial({
      map: photo.asphalt.map,
      normalMap: photo.asphalt.normal,
      roughness: wet ? 0.36 : 0.88,
      envMapIntensity: wet ? 0.9 : 0.4,
      color: new THREE.Color().setScalar(wet ? 2.6 : 7),
    }),
  );
  const runoffMat = keep(new THREE.MeshStandardMaterial({ map: tex.runoff, roughness: wet ? 0.45 : 0.9, envMapIntensity: 0.3 }));
  const lineMat = keep(new THREE.MeshStandardMaterial({ color: "#efefea", roughness: 0.6 }));
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material, cast = false) => {
    const x = new THREE.Mesh(keep(g), m);
    x.receiveShadow = true;
    x.castShadow = cast;
    group.add(x);
    return x;
  };
  mesh(strip(otherRoad), roadMat);
  for (const l of otherLines) mesh(strip(l), lineMat);
  for (const s of shoulders) mesh(strip(s), runoffMat);

  // everything the trees must keep clear of: the whole circuit
  const CELL = 25;
  const trackCells = new Set<string>();
  for (let i = 0; i < N; i++) {
    const x = cl[i][0] - ox;
    const y = cl[i][1] - oy;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) trackCells.add(`${Math.floor(x / CELL) + a},${Math.floor(y / CELL) + b}`);
  }
  const offTrack = (x: number, y: number) => !trackCells.has(`${Math.floor(x / CELL)},${Math.floor(y / CELL)}`);

  // ---- trees: instanced, three kinds
  const flora = FLORA_BY_TRACK[c.trackId] ?? "temperate";
  const trees: { x: number; y: number; s: Species; h: number; w: number; tint: number }[] = [];
  let seed = 1;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const plant = (x: number, y: number) => {
    if (!near(x, y) || !offTrack(x, y)) return;
    const s = pickSpecies(flora, rnd());
    const h = s === "conifer" ? 14 + rnd() * 14 : s === "palm" ? 7 + rnd() * 7 : 9 + rnd() * 12;
    trees.push({ x, y, s, h, w: s === "conifer" ? h * (0.22 + rnd() * 0.08) : s === "palm" ? 2.6 + rnd() : h * (0.32 + rnd() * 0.14), tint: rnd() });
  };

  const blockers: number[][] = [];
  if (osm) {
    const rel = (flat: number[]) => flat.map((v, i) => v - (i % 2 ? oy : ox));
    const touches = (flat: number[]) => {
      for (let i = 0; i < flat.length; i += 2) if (near(flat[i], flat[i + 1], RADIUS + 300)) return true;
      return false;
    };
    // land cover
    const waterMat = keep(new THREE.MeshStandardMaterial({ color: wet ? "#2c3d47" : "#24506a", roughness: 0.08, metalness: 0.3, envMapIntensity: 1.1 }));
    const pavingMat = keep(new THREE.MeshStandardMaterial({ map: tex.paving, roughness: 0.9 }));
    const sandMat = keep(new THREE.MeshStandardMaterial({ color: "#c9b48c", roughness: 1 }));
    const farmMat = keep(new THREE.MeshStandardMaterial({ map: photo.grass.map, color: "#e2d58e", roughness: 1 }));
    const layer: [keyof SceneryData["areas"], THREE.Material, number][] = [
      ["farm", farmMat, 0.004],
      ["urban", pavingMat, 0.006],
      ["parking", pavingMat, 0.008],
      ["pier", pavingMat, 0.3],
      ["sand", sandMat, 0.006],
      ["water", waterMat, 0.05],
    ];
    for (const [kind, mat, h] of layer)
      for (const area of osm.areas[kind] ?? []) {
        const flat = rel(area);
        if (!touches(flat)) continue;
        const g = polygon(flat, h);
        if (g) mesh(g, mat);
        if (kind !== "farm") blockers.push(flat);
      }
    // woods: trees around the edge and through the inside
    for (const area of osm.areas.wood ?? []) {
      const flat = rel(area);
      if (!touches(flat)) continue;
      for (let i = 0; i < flat.length; i += 2) {
        const ax = flat[i];
        const ay = flat[i + 1];
        const bx = flat[(i + 2) % flat.length];
        const by = flat[(i + 3) % flat.length];
        const len = Math.hypot(bx - ax, by - ay);
        for (let d = 0; d < len; d += 6) plant(ax + ((bx - ax) * d) / len + (rnd() - 0.5) * 3, ay + ((by - ay) * d) / len + (rnd() - 0.5) * 3);
      }
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (let i = 0; i < flat.length; i += 2) {
        minX = Math.min(minX, flat[i]);
        maxX = Math.max(maxX, flat[i]);
        minY = Math.min(minY, flat[i + 1]);
        maxY = Math.max(maxY, flat[i + 1]);
      }
      for (let x = Math.max(minX, -RADIUS); x < Math.min(maxX, RADIUS); x += 13)
        for (let y = Math.max(minY, -RADIUS); y < Math.min(maxY, RADIUS); y += 13) {
          const px = x + rnd() * 9;
          const py = y + rnd() * 9;
          if (inside(flat, px, py)) plant(px, py);
        }
    }
    for (const area of osm.areas.scrub ?? []) {
      const flat = rel(area);
      if (!touches(flat)) continue;
      for (let i = 0; i < flat.length; i += 8) plant(flat[i], flat[i + 1]);
    }
    for (let i = 0; i < osm.trees.length; i += 2) plant(osm.trees[i] - ox, osm.trees[i + 1] - oy);

    // roads and the pit lane
    const ribbon = (p: number[], w: number, h: number) => {
      const st: ({ a: [number, number, number]; b: [number, number, number]; v: number } | null)[] = [];
      let v = 0;
      for (let i = 0; i < p.length; i += 2) {
        const x = p[i] - ox;
        const y = p[i + 1] - oy;
        const j = i + 2 < p.length ? i : i - 2;
        const dx = p[j + 2] - p[j];
        const dy = p[j + 3] - p[j + 1];
        const d = Math.hypot(dx, dy) || 1;
        if (i) v += Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]);
        const nx = (-dy / d) * (w / 2);
        const ny = (dx / d) * (w / 2);
        st.push(near(x, y, RADIUS + 200) ? { a: [x + nx, y + ny, h], b: [x - nx, y - ny, h], v } : null);
      }
      return strip(st);
    };
    const streetMat = keep(new THREE.MeshStandardMaterial({ map: photo.asphalt.map, color: new THREE.Color().setScalar(7.5), roughness: 0.9 }));
    for (const r of osm.roads) mesh(ribbon(r.p, r.w, 0.012), streetMat);
    for (const r of osm.raceway) if (r.pit) mesh(ribbon(r.p, 12, 0.016), roadMat);
    for (const w of osm.waterways) if (w.w >= 6) mesh(ribbon(w.p, w.w, 0.04), waterMat);

    // buildings: at their height; grandstands raked towards the track and full of people
    const windows = keep(windowsTexture());
    const WALL_TINTS = street ? ["#efe3c8", "#e8cfa8", "#f2ede2", "#d9c2a0", "#e6d9c9"] : ["#e7e4dc", "#d6d2c8", "#c9c4b8", "#e2dccd"];
    const wallMats = WALL_TINTS.map((t) => keep(new THREE.MeshStandardMaterial({ map: windows, color: t, roughness: 0.85, side: THREE.DoubleSide })));
    const roofMat = keep(new THREE.MeshStandardMaterial({ color: "#6b6d70", roughness: 0.9, side: THREE.DoubleSide }));
    const standWallMat = keep(new THREE.MeshStandardMaterial({ map: tex.concrete, roughness: 0.9, side: THREE.DoubleSide }));
    const crowdMat = keep(new THREE.MeshStandardMaterial({ map: keep(crowdTexture()), roughness: 0.95, side: THREE.DoubleSide }));
    const pitsMat = keep(new THREE.MeshStandardMaterial({ color: "#e4e2dc", roughness: 0.7, side: THREE.DoubleSide }));
    const nearestTrack = (x: number, y: number): [number, number] => {
      let bd = Infinity;
      let best: [number, number] = [0, 0];
      for (let i = 0; i < N; i += 4) {
        const dx = cl[i][0] - ox - x;
        const dy = cl[i][1] - oy - y;
        const d = dx * dx + dy * dy;
        if (d < bd) {
          bd = d;
          best = [dx, dy];
        }
      }
      return best;
    };
    // buildings are merged per material: a few draw calls for a whole town
    const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
    const bucket = (m: THREE.Material, g: THREE.BufferGeometry) => {
      const l = buckets.get(m);
      if (l) l.push(g);
      else buckets.set(m, [g]);
    };
    for (const b of osm.buildings) {
      const flat = rel(b.p);
      let cx = 0;
      let cy = 0;
      for (let i = 0; i < flat.length; i += 2) {
        cx += flat[i];
        cy += flat[i + 1];
      }
      cx /= flat.length / 2;
      cy /= flat.length / 2;
      if (!near(cx, cy)) continue;
      blockers.push(flat);
      if (b.k === "stand") {
        // seats rise away from the track: 2 m at the front to the stand's height at the back
        const [tx, ty] = nearestTrack(cx, cy);
        const d = Math.hypot(tx, ty) || 1;
        const fx = -tx / d;
        const fy = -ty / d;
        let lo = Infinity;
        let hi = -Infinity;
        for (let i = 0; i < flat.length; i += 2) {
          const p = flat[i] * fx + flat[i + 1] * fy;
          lo = Math.min(lo, p);
          hi = Math.max(hi, p);
        }
        const top = Math.max(6, b.h);
        const rake = (x: number, y: number) => 2 + ((x * fx + y * fy - lo) / Math.max(1, hi - lo)) * (top - 2);
        const e = extrude(flat, rake);
        if (!e) continue;
        bucket(standWallMat, e.walls);
        bucket(crowdMat, e.roof);
      } else {
        const h = Math.max(3, b.h);
        const e = extrude(flat, () => h);
        if (!e) continue;
        bucket(b.k === "pits" ? pitsMat : wallMats[Math.floor(Math.abs(cx * 7 + cy * 13)) % wallMats.length], e.walls);
        bucket(roofMat, e.roof);
      }
    }
    for (const [m, geos] of buckets) {
      // walls are non-indexed, roofs indexed: merge each kind on its own terms
      const flat = geos.map((g) => (g.index ? g.toNonIndexed() : g));
      const merged = mergeGeometries(flat);
      for (const g of geos) g.dispose();
      for (const g of flat) g.dispose();
      if (merged) mesh(merged, m, true);
    }
  }

  // clumps of trees in the open fields, where the map has few (not on a street circuit)
  if (!street && trees.length < 900) {
    for (let k = 0; k < 140; k++) {
      const a = rnd() * Math.PI * 2;
      const r = 90 + rnd() * (RADIUS - 120);
      const cx = Math.cos(a) * r;
      const cy = Math.sin(a) * r;
      if (blockers.some((b) => inside(b, cx, cy))) continue;
      const count = 4 + Math.floor(rnd() * 14);
      for (let t = 0; t < count; t++) plant(cx + (rnd() - 0.5) * 34, cy + (rnd() - 0.5) * 34);
    }
  }

  // the nearest trees first, up to what a phone draws easily
  trees.sort((a, b) => a.x * a.x + a.y * a.y - (b.x * b.x + b.y * b.y));
  trees.length = Math.min(trees.length, 3200);
  // each tree is a photograph on two crossed upright quads (an "impostor"): from the chase camera it reads as a real
  // tree for four triangles. Lit from above, so both quads take the light alike; turned and mirrored at random.
  const quad = (aspect: number) => {
    const a = new THREE.PlaneGeometry(aspect, 1).translate(0, 0.5, 0);
    const b = a.clone().rotateY(Math.PI / 2);
    const g = mergeGeometries([a, b])!;
    a.dispose();
    b.dispose();
    const n = g.getAttribute("normal");
    for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
    return keep(g);
  };
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const col = new THREE.Color();
  for (const s of ["broad", "conifer", "palm"] as Species[]) {
    const pictures = photo.trees[s];
    pictures.forEach((pic, v) => {
      const mine = trees.filter((t, i) => t.s === s && i % pictures.length === v);
      if (!mine.length) return;
      const mat = keep(new THREE.MeshStandardMaterial({ map: pic.map, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1, color: wet ? "#c6cfc6" : "#ffffff" }));
      const mesh = new THREE.InstancedMesh(quad(pic.aspect), mat, mine.length);
      mine.forEach((t, k) => {
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.tint * 6.28);
        const flip = t.tint > 0.5 ? -1 : 1;
        m.compose(toWorld(t.x, t.y, 0), q, new THREE.Vector3(t.h * flip, t.h, t.h));
        mesh.setMatrixAt(k, m);
        // a little variety in the greens
        col.setHSL(0.25, 0.1, 0.88 + t.tint * 0.24);
        mesh.setColorAt(k, col);
      });
      mesh.receiveShadow = true;
      group.add(mesh);
    });
  }

  // a treeline on the horizon, softened by the haze
  {
    const c2 = document.createElement("canvas");
    c2.width = 1024;
    c2.height = 64;
    const g = c2.getContext("2d")!;
    g.fillStyle = street ? "#5b6268" : "#2f4a2c";
    let x = 0;
    while (x < 1024) {
      const w = 6 + rnd() * 18;
      const h = 18 + rnd() * 40;
      g.beginPath();
      g.ellipse(x, 64, w, h, 0, Math.PI, 0);
      g.fill();
      x += w * 0.9;
    }
    const t = keep(new THREE.CanvasTexture(c2));
    t.wrapS = THREE.RepeatWrapping;
    t.repeat.set(8, 1);
    t.colorSpace = THREE.SRGBColorSpace;
    const ring = new THREE.CylinderGeometry(1500, 1500, 60, 64, 1, true).translate(0, 30, 0);
    const mat = keep(new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.5, side: THREE.BackSide, fog: true }));
    group.add(new THREE.Mesh(keep(ring), mat));
  }

  return {
    group,
    others,
    halfWidth: track.widthMeters / 2,
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}

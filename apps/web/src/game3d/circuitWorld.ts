import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { GameTrack } from "@apex/engine";
import type { SceneryData } from "../game/surroundings";
import { FLORA_BY_TRACK, type Species, pickSpecies } from "../game/trees";
import { type Station, extrude, groundAt, inside, polygon, setGround, smooth, strip, toWorld, wall } from "./geometry";
import { type Surfaces, bandAlpha, boardTextures, crowdTexture, distanceBoard, fenceAlpha, kerbTexture, surfaceTextures } from "./textures";

/**
 * A whole circuit in 3D, for the full lap (Daily Quali): the real ground under it, the road all the way round with its
 * kerbs, run-off, gravel and barriers, the start line and the grid, and the real surroundings from OpenStreetMap
 * (data/scenery, © OpenStreetMap contributors, ODbL): woods as trees, grandstands full of people, buildings, water,
 * roads and the pit lane. Coordinates are the track's own metres (x east, y north), as three's (x, -z), y up; heights
 * are relative to the start line.
 */

// ---------------------------------------------------------------------------------------------------------------
// The ground (tools/track-builder/src/build-circuit-terrain.ts)
// ---------------------------------------------------------------------------------------------------------------
const grids = import.meta.glob<string>("../game/circuit3d/*.bin", { query: "?url", import: "default" });
const metas = import.meta.glob<CircuitGridMeta>("../game/circuit3d/*.json", { import: "default" });

interface CircuitGridMeta {
  x0: number;
  y0: number;
  step: number;
  nx: number;
  ny: number;
  /** the road's height at every centre-line point (decimetres) */
  road: number[];
}

export class CircuitGround {
  constructor(
    readonly meta: CircuitGridMeta,
    private readonly dm: Int16Array,
  ) {}

  /** The ground's height (m) at a point (track metres); outside the grid, the nearest edge. */
  at(x: number, y: number): number {
    const { x0, y0, step, nx, ny } = this.meta;
    const fx = Math.min(nx - 1.001, Math.max(0, (x - x0) / step));
    const fy = Math.min(ny - 1.001, Math.max(0, (y - y0) / step));
    const i = Math.floor(fx);
    const j = Math.floor(fy);
    const u = fx - i;
    const v = fy - j;
    const d = this.dm;
    const a = d[j * nx + i];
    const b = d[j * nx + i + 1];
    const c = d[(j + 1) * nx + i];
    const e = d[(j + 1) * nx + i + 1];
    return ((a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + e * u) * v) / 10;
  }

  /** The grid's extent (track metres). */
  get box(): [number, number, number, number] {
    const { x0, y0, step, nx, ny } = this.meta;
    return [x0, y0, x0 + (nx - 1) * step, y0 + (ny - 1) * step];
  }

  /** The mean height round the grid's edge: where the world beyond it sits. */
  edgeMean(): number {
    const { nx, ny } = this.meta;
    let s = 0;
    let n = 0;
    for (let i = 0; i < nx; i += 4) {
      s += this.dm[i] + this.dm[(ny - 1) * nx + i];
      n += 2;
    }
    for (let j = 0; j < ny; j += 4) {
      s += this.dm[j * nx] + this.dm[j * nx + nx - 1];
      n += 2;
    }
    return s / n / 10;
  }
}

/** A circuit's ground, or null where none was built. */
export async function loadCircuitGround(trackId: string): Promise<CircuitGround | null> {
  const bin = grids[`../game/circuit3d/${trackId}.bin`];
  const meta = metas[`../game/circuit3d/${trackId}.json`];
  if (!bin || !meta) return null;
  const [url, m] = await Promise.all([bin(), meta()]);
  const buf = await (await fetch(url)).arrayBuffer();
  return new CircuitGround(m, new Int16Array(buf));
}

// ---------------------------------------------------------------------------------------------------------------
// The world
// ---------------------------------------------------------------------------------------------------------------
export interface CircuitWorldOptions {
  wet: boolean;
  street: boolean;
  /** "full" on computers; "lite" on phones: a coarser ground and fewer trees */
  detail: "full" | "lite";
  /** at most this many trees (default by detail) */
  maxTrees?: number;
}

export interface CircuitWorld {
  group: THREE.Group;
  /** each side's barrier line (track metres), round the lap */
  barriers: [number, number][][];
  /** the centre line with its heights, for placing the car (track metres, metres up) */
  line: { x: number[]; y: number[]; h: number[]; s: number[] };
  dispose(): void;
}

const near2 = (ax: number, ay: number, bx: number, by: number) => (ax - bx) ** 2 + (ay - by) ** 2;

export function buildCircuitWorld(track: GameTrack, ground: CircuitGround | null, osm: SceneryData | null, photo: Surfaces, o: CircuitWorldOptions): CircuitWorld {
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x);
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material, opts: { cast?: boolean; order?: number } = {}) => {
    const x = new THREE.Mesh(keep(g), m);
    x.receiveShadow = true;
    x.castShadow = opts.cast ?? false;
    if (opts.order !== undefined) x.renderOrder = opts.order;
    group.add(x);
    return x;
  };
  setGround(ground ? (x, y) => ground.at(x, y) : () => 0);
  const tex = surfaceTextures(o.wet);
  for (const t of Object.values(tex)) keep(t);
  const wetRough = (r: number) => (o.wet ? r * 0.45 : r);

  const cl = track.centerline;
  const L = track.leftBoundary;
  const R = track.rightBoundary;
  const N = cl.length;
  const step = track.lengthMeters / N;
  const sAt = (i: number) => i * step;

  // the centre line in 25 m cells, for "how far from the track" and "which part of the lap is this"
  const CELL = 25;
  const cells = new Map<string, number[]>();
  for (let i = 0; i < N; i++) {
    const key = `${Math.floor(cl[i][0] / CELL)},${Math.floor(cl[i][1] / CELL)}`;
    const l = cells.get(key);
    if (l) l.push(i);
    else cells.set(key, [i]);
  }
  /** the nearest centre-line point within `r` metres, and its squared distance, or [-1, Infinity] */
  const nearestIndex = (x: number, y: number, r: number, skip?: (i: number) => boolean): [number, number] => {
    const gx = Math.floor(x / CELL);
    const gy = Math.floor(y / CELL);
    const k = Math.ceil(r / CELL);
    let best = -1;
    let bd = r * r;
    for (let a = -k; a <= k; a++)
      for (let b = -k; b <= k; b++)
        for (const i of cells.get(`${gx + a},${gy + b}`) ?? []) {
          if (skip?.(i)) continue;
          const d = near2(cl[i][0], cl[i][1], x, y);
          if (d < bd) {
            bd = d;
            best = i;
          }
        }
    return [best, best < 0 ? Infinity : bd];
  };
  // the distance to the track on a 10 m grid, out to 420 m (further is "far")
  const DF = 10;
  const DFR = 420;
  const [bx0, by0, bx1, by1] = ground ? ground.box : [-3000, -3000, 3000, 3000];
  const dfx = Math.ceil((bx1 - bx0) / DF) + 1;
  const dfy = Math.ceil((by1 - by0) / DF) + 1;
  const dfield = new Float32Array(dfx * dfy).fill(DFR * DFR);
  {
    const r = Math.ceil(DFR / DF);
    for (let i = 0; i < N; i += 2) {
      const ci = Math.round((cl[i][0] - bx0) / DF);
      const cj = Math.round((cl[i][1] - by0) / DF);
      for (let b = Math.max(0, cj - r); b <= Math.min(dfy - 1, cj + r); b++)
        for (let a = Math.max(0, ci - r); a <= Math.min(dfx - 1, ci + r); a++) {
          const d = near2(bx0 + a * DF, by0 + b * DF, cl[i][0], cl[i][1]);
          const k = b * dfx + a;
          if (d < dfield[k]) dfield[k] = d;
        }
    }
    for (let k = 0; k < dfield.length; k++) dfield[k] = Math.sqrt(dfield[k]);
  }
  /** about how far (m) a point is from the centre line, to within a few metres; DFR for anything further */
  const trackDist = (x: number, y: number) => {
    const fx = Math.min(dfx - 1.001, Math.max(0, (x - bx0) / DF));
    const fy = Math.min(dfy - 1.001, Math.max(0, (y - by0) / DF));
    const i = Math.floor(fx);
    const j = Math.floor(fy);
    const u = fx - i;
    const v = fy - j;
    const d = dfield;
    return (d[j * dfx + i] * (1 - u) + d[j * dfx + i + 1] * u) * (1 - v) + (d[(j + 1) * dfx + i] * (1 - u) + d[(j + 1) * dfx + i + 1] * u) * v;
  };
  const lapGap = (a: number, b: number) => {
    const d = Math.abs(a - b) % N;
    return Math.min(d, N - d);
  };

  // ---- the ground: the real terrain, a fine mesh along the track and a coarse one to the edge, and a plain beyond
  const grassMat = keep(new THREE.MeshStandardMaterial({ map: photo.grass.map, normalMap: photo.grass.normal, roughness: 1, vertexColors: true, color: o.wet ? "#9fae98" : "#d9e2cf" }));
  const [gx0, gy0, gx1, gy1] = ground ? ground.box : [-3000, -3000, 3000, 3000];
  const beyond = ground ? ground.edgeMean() - 1.5 : 0;
  {
    const outline = new THREE.Shape([new THREE.Vector2(-9000, -9000), new THREE.Vector2(9000, -9000), new THREE.Vector2(9000, 9000), new THREE.Vector2(-9000, 9000)]);
    if (ground) outline.holes.push(new THREE.Path([new THREE.Vector2(gx0 + 2, gy0 + 2), new THREE.Vector2(gx0 + 2, gy1 - 2), new THREE.Vector2(gx1 - 2, gy1 - 2), new THREE.Vector2(gx1 - 2, gy0 + 2)]));
    const plain = new THREE.ShapeGeometry(outline);
    plain.rotateX(-Math.PI / 2);
    plain.translate(0, beyond, 0);
    const puv = plain.getAttribute("uv");
    const ppos = plain.getAttribute("position");
    const col = new Float32Array(ppos.count * 3).fill(0.92);
    for (let i = 0; i < puv.count; i++) puv.setXY(i, ppos.getX(i), -ppos.getZ(i));
    plain.setAttribute("color", new THREE.BufferAttribute(col, 3));
    mesh(plain, grassMat);
  }
  // a gentle unevenness in the grass's colour over tens of metres, so the big fields don't read as one tiled photo
  const tint = (x: number, y: number) => 0.86 + 0.1 * Math.sin(x * 0.013 + Math.sin(y * 0.021) * 2) * Math.sin(y * 0.011 + x * 0.004) + 0.05 * Math.sin(x * 0.07 + y * 0.05);
  if (ground) {
    const NEAR = 160;
    const fineStep = o.detail === "full" ? 5 : 10;
    const coarseStep = 20;
    // the coarse mesh over the whole grid, sunk out of sight where the fine one lies
    const land = (stepM: number, only: ((x: number, y: number) => boolean) | null, sink: (x: number, y: number) => number) => {
      const nx = Math.floor((gx1 - gx0) / stepM) + 1;
      const ny = Math.floor((gy1 - gy0) / stepM) + 1;
      const index = new Int32Array(nx * ny).fill(-1);
      const pos: number[] = [];
      const uv: number[] = [];
      const col: number[] = [];
      const idx: number[] = [];
      const vert = (i: number, j: number) => {
        const k = j * nx + i;
        if (index[k] >= 0) return index[k];
        const x = gx0 + i * stepM;
        const y = gy0 + j * stepM;
        let h = ground.at(x, y) - 0.12 - sink(x, y);
        // the last 200 m ease to the plain beyond
        const edge = Math.min(x - gx0, gx1 - x, y - gy0, gy1 - y);
        const t = Math.min(1, Math.max(0, edge / 200));
        h = h * t + beyond * (1 - t);
        pos.push(x, h, -y);
        uv.push(x, y);
        const c = tint(x, y);
        col.push(c, c, c * 0.97);
        return (index[k] = pos.length / 3 - 1);
      };
      for (let j = 0; j < ny - 1; j++)
        for (let i = 0; i < nx - 1; i++) {
          if (only && !only(gx0 + (i + 0.5) * stepM, gy0 + (j + 0.5) * stepM)) continue;
          const a = vert(i, j);
          const b = vert(i + 1, j);
          const c = vert(i, j + 1);
          const d = vert(i + 1, j + 1);
          // faces up (y up, track y is -z)
          idx.push(a, b, c, b, d, c);
        }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      mesh(g, grassMat);
    };
    const nearTrack = (x: number, y: number, r: number) => trackDist(x, y) < r;
    land(fineStep, (x, y) => nearTrack(x, y, NEAR), () => 0);
    land(coarseStep, null, (x, y) => (nearTrack(x, y, NEAR - 2 * coarseStep) ? 5 : 0));
  }

  // ---- materials of the track
  const asphaltMat = keep(
    new THREE.MeshStandardMaterial({
      map: photo.asphalt.map,
      normalMap: photo.asphalt.normal,
      normalScale: new THREE.Vector2(o.wet ? 0.35 : 0.8, o.wet ? 0.35 : 0.8),
      roughness: o.wet ? 0.32 : 0.86,
      envMapIntensity: o.wet ? 0.9 : 0.4,
      color: new THREE.Color().setScalar(o.wet ? 2.6 : 7),
    }),
  );
  const runoffMat = keep(new THREE.MeshStandardMaterial({ map: tex.runoff, roughness: wetRough(0.9), envMapIntensity: 0.3 }));
  const gravelMat = keep(new THREE.MeshStandardMaterial({ map: photo.gravel.map, normalMap: photo.gravel.normal, roughness: 1, color: o.wet ? "#a99a7c" : "#d6c4a0" }));
  const paintMat = keep(new THREE.MeshStandardMaterial({ color: "#efefea", roughness: wetRough(0.6), polygonOffset: true, polygonOffsetFactor: -2 }));
  const kerbTex = keep(kerbTexture());
  kerbTex.repeat.set(1 / 5, 1);
  const kerbMat = keep(new THREE.MeshStandardMaterial({ map: kerbTex, roughness: wetRough(0.55) }));
  const astroMat = keep(new THREE.MeshStandardMaterial({ color: o.wet ? "#2c6a3c" : "#2f8a45", roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -1 }));
  const band = keep(bandAlpha());
  band.repeat.set(1 / 2, 1);
  band.wrapS = THREE.RepeatWrapping;
  const rubberMat = keep(new THREE.MeshBasicMaterial({ color: "#0b0b0c", alphaMap: band, transparent: true, opacity: 0.08, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }));
  const railMat = keep(new THREE.MeshStandardMaterial({ color: "#b9bec4", metalness: 0.75, roughness: 0.35, side: THREE.DoubleSide }));
  const postMat = keep(new THREE.MeshStandardMaterial({ color: "#7d8288", metalness: 0.5, roughness: 0.5 }));
  const wallMat = keep(new THREE.MeshStandardMaterial({ map: tex.concrete, roughness: 0.85, side: THREE.DoubleSide }));
  const fenceTex = keep(fenceAlpha());
  const fenceMat = keep(new THREE.MeshStandardMaterial({ color: "#8d949b", metalness: 0.5, roughness: 0.5, alphaMap: fenceTex, alphaTest: 0.35, side: THREE.DoubleSide }));
  const tecMat = keep(new THREE.MeshStandardMaterial({ roughness: 0.6 }));

  // ---- the road all the way round (k = N closes the loop)
  const st = (ax: number, ay: number, bx: number, by: number, ha: number, hb: number, v: number): Station => ({ a: [ax, ay, ha], b: [bx, by, hb], v });
  const loop = <T>(f: (i: number, k: number) => T) => Array.from({ length: N + 1 }, (_, k) => f(k % N, k));
  mesh(strip(loop((i, k) => st(L[i][0], L[i][1], R[i][0], R[i][1], 0.03, 0.03, sAt(k)))), asphaltMat);
  // the rubbered racing line: a darker band along the middle (the real line comes with the lap)
  const lineNormal = (i: number): [number, number] => {
    const a = cl[(i - 1 + N) % N];
    const b = cl[(i + 1) % N];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const d = Math.hypot(dx, dy) || 1;
    return [-dy / d, dx / d];
  };
  mesh(
    strip(
      loop((i, k) => {
        const [nx, ny] = lineNormal(i);
        return st(cl[i][0] - nx * 1.1, cl[i][1] - ny * 1.1, cl[i][0] + nx * 1.1, cl[i][1] + ny * 1.1, 0.031, 0.031, sAt(k));
      }),
    ),
    rubberMat,
    { order: 1 },
  );

  // ---- where the corners are: each corner's stretch, its direction (+1 left), and what's inside or outside
  const turn = new Int8Array(N); // +1 a left-hander, -1 a right-hander, 0 a straight
  const bites = new Uint8Array(N); // the kerbed part of a corner
  const exitFrom = new Int32Array(N).fill(-1); // the apex index of the corner this point belongs to
  for (const c of track.corners) {
    const sign = c.direction === "left" ? 1 : -1;
    for (let k = c.startIndex - 16; k <= c.endIndex + 10; k++) {
      const i = (k + N) % N;
      turn[i] = sign;
      exitFrom[i] = c.apexIndex;
    }
    for (let k = c.startIndex - 2; k <= c.endIndex + 3; k++) bites[(k + N) % N] = 1;
  }

  // each side: outward normals, from the other edge
  interface Side {
    sign: 1 | -1;
    px: number[];
    py: number[];
    nx: number[];
    ny: number[];
  }
  const side = (A: number[][], B: number[][], sign: 1 | -1): Side => {
    const s: Side = { sign, px: [], py: [], nx: [], ny: [] };
    for (let i = 0; i < N; i++) {
      const dx = A[i][0] - B[i][0];
      const dy = A[i][1] - B[i][1];
      const d = Math.hypot(dx, dy) || 1;
      s.px.push(A[i][0]);
      s.py.push(A[i][1]);
      s.nx.push(dx / d);
      s.ny.push(dy / d);
    }
    return s;
  };
  const sides = [side(L, R, 1), side(R, L, -1)];
  const at = (sd: Side, i: number, d: number): [number, number] => [sd.px[i] + sd.nx[i] * d, sd.py[i] + sd.ny[i] * d];
  const band_ = (sd: Side, i: number, d0: number, d1: number, h0: number, h1: number, k: number) => {
    const [ax, ay] = at(sd, i, d0);
    const [bx, by] = at(sd, i, d1);
    return st(ax, ay, bx, by, h0, h1, sAt(k));
  };
  const halfWidth = track.widthMeters / 2;
  /** another part of the lap within r of (x, y), not this stretch */
  const nearOther = (x: number, y: number, r: number, i: number) => nearestIndex(x, y, r, (j) => lapGap(i, j) < 60)[0] >= 0;

  const barriers: [number, number][][] = [];
  const posts: { x: number; y: number; h: number }[] = [];
  const tecproAt: { x: number; y: number; a: number; colour: number }[] = [];
  const boardSlots: [number, number][][] = [];

  for (const sd of sides) {
    const outside = (i: number) => turn[i] !== 0 && sd.sign === -turn[i];
    const target = smooth(
      Array.from({ length: N }, (_, i) => (o.street ? (outside(i) ? 9 : 1.1) : outside(i) ? 28 : turn[i] ? 9 : 13)),
      8,
    );
    const clear = Array.from({ length: N }, (_, i) => {
      for (let d = 1; d <= target[i]; d += 1) {
        const [x, y] = at(sd, i, d);
        if (nearOther(x, y, halfWidth + 5, i)) return Math.max(1, d - 2);
      }
      return target[i];
    });
    const barrier = smooth(
      target.map((t, i) => Math.min(t, clear[i])),
      2,
    );
    const tarmacTo = barrier.map((b, i) => (o.street ? b : Math.min(outside(i) ? 8 : 2.5, b - 0.4)));

    mesh(strip(loop((i, k) => band_(sd, i, -0.42, -0.24, 0.033, 0.033, k))), paintMat);
    mesh(strip(loop((i, k) => band_(sd, i, 0, tarmacTo[i], 0.026, 0.026, k))), runoffMat);
    if (!o.street)
      mesh(
        strip(loop((i, k) => (outside(i) && barrier[i] - 1.2 > tarmacTo[i] + 1 ? band_(sd, i, tarmacTo[i], barrier[i] - 1.2, 0.024, 0.024, k) : null))),
        gravelMat,
      );
    // kerbs: on the inside of the corner, and on the outside from the apex on (the exit kerb)
    const kerbHere = (i: number) => bites[i] === 1 && turn[i] !== 0 && (sd.sign === turn[i] || lapGap(i, exitFrom[i]) < 6 || (i - exitFrom[i] + N) % N < N / 2);
    mesh(
      strip(
        loop((i, k) => (kerbHere(i) ? band_(sd, i, -0.08, 1.15, 0.032, 0.085, k) : null)),
        false,
      ),
      kerbMat,
      { cast: true },
    );
    mesh(strip(loop((i, k) => (kerbHere(i) && sd.sign !== turn[i] ? band_(sd, i, 1.15, Math.min(3.2, tarmacTo[i]), 0.028, 0.028, k) : null))), astroMat);

    // the barrier line, and what stands on it
    const line = loop((i) => at(sd, i, barrier[i]));
    barriers.push(line);
    const isTec = (i: number) => outside(i);
    if (o.street) {
      mesh(wall(line, 0, 1.05, true), wallMat, { cast: true });
    } else {
      const armco = line.map((p, k) => (isTec(k % N) ? null : p));
      for (const [h0, h1] of [
        [0.4, 0.68],
        [0.76, 1.04],
      ])
        mesh(wall(armco, h0, h1), railMat, { cast: true });
      let acc = 0;
      for (let i = 1; i < N; i++) {
        acc += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
        if (acc >= 3 && !isTec(i)) {
          acc = 0;
          const [x, y] = at(sd, i, barrier[i] + 0.12);
          posts.push({ x, y, h: 1.05 });
        }
      }
    }
    {
      let acc = 0;
      let count = 0;
      for (let i = 1; i < N; i++) {
        acc += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
        if (acc < 1.5 || !isTec(i)) continue;
        acc = 0;
        const [x, y] = at(sd, i, barrier[i] + 0.5);
        const [x2, y2] = line[i + 1];
        tecproAt.push({ x, y, a: Math.atan2(y2 - line[i][1], x2 - line[i][0]), colour: count++ % 2 });
      }
    }
    const fenceLine = loop((i) => at(sd, i, barrier[i] + (isTec(i) ? 1.3 : 0.25)));
    mesh(wall(fenceLine, o.street ? 1.05 : 1.0, 4.2, true), fenceMat);
    {
      let acc = 0;
      for (let i = 1; i <= N; i++) {
        acc += Math.hypot(fenceLine[i][0] - fenceLine[i - 1][0], fenceLine[i][1] - fenceLine[i - 1][1]);
        if (acc < 4) continue;
        acc = 0;
        posts.push({ x: fenceLine[i][0], y: fenceLine[i][1], h: 4.3 });
      }
    }
    if (!o.street) {
      let run: [number, number][] = [];
      let len = 0;
      for (let i = 1; i < N; i++) {
        if (isTec(i) || turn[i]) {
          run = [];
          len = 0;
          continue;
        }
        const p = at(sd, i, barrier[i] - 0.18);
        if (run.length) len += Math.hypot(p[0] - run[run.length - 1][0], p[1] - run[run.length - 1][1]);
        run.push(p);
        if (len >= 6) {
          boardSlots.push(run);
          run = [];
          len = -3;
        }
      }
    }
  }

  if (tecproAt.length) {
    const blocks = new THREE.InstancedMesh(keep(new THREE.BoxGeometry(1.48, 1.0, 1.0)), tecMat, tecproAt.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const red = new THREE.Color("#c8312b");
    const blue = new THREE.Color("#2f5fae");
    tecproAt.forEach((b, k) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), b.a);
      m.compose(toWorld(b.x, b.y, 0.5), q, new THREE.Vector3(1, 1, 1));
      blocks.setMatrixAt(k, m);
      blocks.setColorAt(k, b.colour ? red : blue);
    });
    blocks.castShadow = blocks.receiveShadow = true;
    group.add(blocks);
  }
  if (posts.length) {
    const inst = new THREE.InstancedMesh(keep(new THREE.CylinderGeometry(0.045, 0.05, 1, 6)), postMat, posts.length);
    const m = new THREE.Matrix4();
    posts.forEach((p, k) => {
      m.compose(toWorld(p.x, p.y, p.h / 2), new THREE.Quaternion(), new THREE.Vector3(1, p.h, 1));
      inst.setMatrixAt(k, m);
    });
    inst.castShadow = true;
    group.add(inst);
  }
  boardTextures().forEach((t, k, all) => {
    keep(t);
    t.repeat.set(1 / 6, 1);
    const mat = keep(new THREE.MeshStandardMaterial({ map: t, roughness: 0.5, side: THREE.DoubleSide }));
    const mine = boardSlots.filter((_, i) => i % all.length === k);
    if (mine.length) mesh(wall(mine.flatMap((run) => [...run, null]), 0.12, 1.02), mat, { cast: true });
  });

  // braking boards before the tight corners, on the outside, counting down
  for (const c of track.corners) {
    const a = cl[c.startIndex];
    const b = cl[c.apexIndex];
    const e = cl[c.endIndex];
    // how sharp: the turn of the heading over the corner
    const h1 = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const h2 = Math.atan2(e[1] - b[1], e[0] - b[0]);
    let dh = Math.abs(h2 - h1);
    if (dh > Math.PI) dh = 2 * Math.PI - dh;
    if (dh < 0.9) continue;
    const sd = sides.find((s) => s.sign === (c.direction === "left" ? -1 : 1))!;
    for (const d of [150, 100, 50]) {
      const k = (c.startIndex - Math.round(d / step) + N) % N;
      const t = keep(distanceBoard(String(d)));
      const mat = keep(new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }));
      const board = new THREE.Mesh(keep(new THREE.BoxGeometry(2.2, 1.4, 0.1)), mat);
      const [bx, by] = at(sd, k, o.street ? 0.6 : 2.2);
      board.position.copy(toWorld(bx, by, 1.75));
      const ahead = toWorld(cl[(k + 1) % N][0], cl[(k + 1) % N][1]).sub(toWorld(cl[k][0], cl[k][1]));
      board.rotation.y = Math.atan2(-ahead.x, -ahead.z);
      board.castShadow = true;
      const post = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.06, 0.06, 1.05)), postMat);
      post.position.copy(toWorld(bx, by, 0.52));
      group.add(board, post);
    }
  }

  // ---- the start line and the grid: a white line across at the start, and twenty boxes behind it, staggered
  {
    const [nx, ny] = lineNormal(0);
    const dirX = ny;
    const dirY = -nx;
    // the lap runs from index 0 towards index 1
    const fwd = Math.sign((cl[1][0] - cl[0][0]) * dirX + (cl[1][1] - cl[0][1]) * dirY) || 1;
    const boxes: THREE.BufferGeometry[] = [];
    const quadAt = (cx: number, cy: number, along: number, across: number) => {
      // a flat white rectangle, `along` the lap and `across` it, centred on (cx, cy)
      const g = new THREE.PlaneGeometry(across, along);
      g.rotateX(-Math.PI / 2);
      // the plane's "along" (three's z) turned onto the lap's direction (track y is three's -z)
      g.rotateY(Math.atan2(dirX * fwd, -dirY * fwd));
      g.translate(cx, groundAt(cx, cy) + 0.034, -cy);
      boxes.push(g);
    };
    quadAt(cl[0][0], cl[0][1], 0.6, track.widthMeters - 0.6);
    for (let p = 0; p < 20; p++) {
      const back = 8 + p * 8;
      const k = (N - Math.round(back / step)) % N;
      const off = (p % 2 ? -1 : 1) * halfWidth * 0.45;
      const [nnx, nny] = lineNormal(k);
      const cx = cl[k][0] + nnx * off;
      const cy = cl[k][1] + nny * off;
      // the box's front bar and its two short sides
      quadAt(cx, cy, 0.2, 4.0);
    }
    const merged = mergeGeometries(boxes);
    for (const b of boxes) b.dispose();
    if (merged) mesh(merged, paintMat);
  }

  // ---- the surroundings (OpenStreetMap)
  const inBox = (x: number, y: number) => x > gx0 && x < gx1 && y > gy0 && y < gy1;
  const offTrack = (x: number, y: number, r = 30) => trackDist(x, y) > r;
  const flora = FLORA_BY_TRACK[track.id] ?? "temperate";
  const trees: { x: number; y: number; s: Species; h: number; tint: number; d: number }[] = [];
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const plant = (x: number, y: number) => {
    if (!inBox(x, y) || !offTrack(x, y)) return;
    const s = pickSpecies(flora, rnd());
    const h = s === "conifer" ? 16 + rnd() * 14 : s === "palm" ? 7 + rnd() * 7 : 11 + rnd() * 12;
    trees.push({ x, y, s, h, tint: rnd(), d: trackDist(x, y) });
  };
  const blockers: number[][] = [];
  if (osm) {
    const waterMat = keep(new THREE.MeshStandardMaterial({ color: o.wet ? "#2c3d47" : "#24506a", roughness: 0.08, metalness: 0.3, envMapIntensity: 1.1 }));
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
        const g = polygon(area, h, kind === "water");
        if (g) mesh(g, mat);
        if (kind !== "farm") blockers.push(area);
      }
    // woods: trees round the edge and through the inside (closer together near the track, where they're seen)
    for (const area of osm.areas.wood ?? []) {
      for (let i = 0; i < area.length; i += 2) {
        const ax = area[i];
        const ay = area[i + 1];
        const bx = area[(i + 2) % area.length];
        const by = area[(i + 3) % area.length];
        const len = Math.hypot(bx - ax, by - ay);
        for (let d = 0; d < len; d += 6) plant(ax + ((bx - ax) * d) / len + (rnd() - 0.5) * 3, ay + ((by - ay) * d) / len + (rnd() - 0.5) * 3);
      }
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (let i = 0; i < area.length; i += 2) {
        minX = Math.min(minX, area[i]);
        maxX = Math.max(maxX, area[i]);
        minY = Math.min(minY, area[i + 1]);
        maxY = Math.max(maxY, area[i + 1]);
      }
      for (let x = minX; x < maxX; x += 11)
        for (let y = minY; y < maxY; y += 11) {
          const px = x + rnd() * 8;
          const py = y + rnd() * 8;
          if (inside(area, px, py)) plant(px, py);
        }
    }
    for (const area of osm.areas.scrub ?? []) for (let i = 0; i < area.length; i += 8) plant(area[i], area[i + 1]);
    for (let i = 0; i < osm.trees.length; i += 2) plant(osm.trees[i], osm.trees[i + 1]);

    // roads, the pit lane and the rivers
    const ribbon = (p: number[], w: number, h: number) => {
      const s: (Station | null)[] = [];
      let v = 0;
      for (let i = 0; i < p.length; i += 2) {
        const j = i + 2 < p.length ? i : i - 2;
        const dx = p[j + 2] - p[j];
        const dy = p[j + 3] - p[j + 1];
        const d = Math.hypot(dx, dy) || 1;
        if (i) v += Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]);
        const nx = (-dy / d) * (w / 2);
        const ny = (dx / d) * (w / 2);
        s.push({ a: [p[i] + nx, p[i + 1] + ny, h], b: [p[i] - nx, p[i + 1] - ny, h], v });
      }
      return strip(s);
    };
    const streetMat = keep(new THREE.MeshStandardMaterial({ map: photo.asphalt.map, color: new THREE.Color().setScalar(7.5), roughness: 0.9 }));
    for (const r of osm.roads) mesh(ribbon(r.p, r.w, 0.012), streetMat);
    for (const r of osm.raceway) if (r.pit && r.p.length >= 4) mesh(ribbon(r.p, 12, 0.016), asphaltMat);
    for (const w of osm.waterways) if (w.w >= 6) mesh(ribbon(w.p, w.w, 0.04), waterMat);

    // buildings at their height; grandstands raked towards the track and full of people, under a light roof
    const windows = keep(glazingTexture());
    const wallMats = ["#d9d6cf", "#c8c4bb", "#b9b5ac", "#d2cbbd"].map((t) => keep(new THREE.MeshStandardMaterial({ map: windows, color: t, roughness: 0.8, side: THREE.DoubleSide })));
    const roofMat = keep(new THREE.MeshStandardMaterial({ color: "#6b6d70", roughness: 0.9, side: THREE.DoubleSide }));
    const standWallMat = keep(new THREE.MeshStandardMaterial({ map: tex.concrete, roughness: 0.9, side: THREE.DoubleSide }));
    const crowdMat = keep(new THREE.MeshStandardMaterial({ map: keep(crowdTexture()), roughness: 0.95, side: THREE.DoubleSide }));
    const canopyMat = keep(new THREE.MeshStandardMaterial({ color: "#d3d6da", emissive: "#7a7d82", roughness: 0.55, metalness: 0.2, side: THREE.DoubleSide }));
    const pitsMat = keep(new THREE.MeshStandardMaterial({ color: "#e4e2dc", roughness: 0.7, side: THREE.DoubleSide }));
    const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
    const bucket = (m: THREE.Material, g: THREE.BufferGeometry) => {
      const l = buckets.get(m);
      if (l) l.push(g);
      else buckets.set(m, [g]);
    };
    for (const b of osm.buildings) {
      const flat = b.p;
      let cx = 0;
      let cy = 0;
      for (let i = 0; i < flat.length; i += 2) {
        cx += flat[i];
        cy += flat[i + 1];
      }
      cx /= flat.length / 2;
      cy /= flat.length / 2;
      blockers.push(flat);
      if (b.k === "stand") {
        const [ti] = nearestIndex(cx, cy, 400);
        const tx = ti >= 0 ? cl[ti][0] - cx : 0;
        const ty = ti >= 0 ? cl[ti][1] - cy : 1;
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
        const cut = lo + 0.45 * (hi - lo);
        const keepPts: number[] = [];
        for (let i = 0; i < flat.length; i += 2) {
          const ax = flat[i];
          const ay = flat[i + 1];
          const bx = flat[(i + 2) % flat.length];
          const by = flat[(i + 3) % flat.length];
          const pa = ax * fx + ay * fy - cut;
          const pb = bx * fx + by * fy - cut;
          if (pa >= 0) keepPts.push(ax, ay);
          if (pa >= 0 !== pb >= 0) {
            const t = pa / (pa - pb);
            keepPts.push(ax + (bx - ax) * t, ay + (by - ay) * t);
          }
        }
        const canopy = keepPts.length >= 6 ? extrude(keepPts, (x, y) => rake(x, y) + 4.5) : null;
        if (canopy) {
          bucket(canopyMat, canopy.roof);
          canopy.walls.dispose();
          const pts: [number, number][] = [];
          for (let i = 0; i < flat.length; i += 2) pts.push([flat[i], flat[i + 1]]);
          const base = Math.min(...pts.map(([x, y]) => groundAt(x, y)));
          for (let i = 0; i < pts.length; i++) {
            const [ax, ay] = pts[i];
            const [bx, by] = pts[(i + 1) % pts.length];
            const back = (x: number, y: number) => x * fx + y * fy - lo > 0.75 * (hi - lo);
            if (!back(ax, ay) || !back(bx, by)) continue;
            const len = Math.hypot(bx - ax, by - ay);
            for (let k = 0; k <= Math.floor(len / 12); k++) {
              const t = len < 1 ? 0 : (k * 12) / len;
              const px = ax + (bx - ax) * t;
              const py = ay + (by - ay) * t;
              const post = new THREE.BoxGeometry(0.35, 4.5, 0.35);
              post.translate(px, base + rake(px, py) + 2.25, -py);
              bucket(postMat, post);
            }
          }
        }
      } else {
        const h = Math.max(3, b.h);
        const e = extrude(flat, () => h);
        if (!e) continue;
        bucket(b.k === "pits" ? pitsMat : wallMats[Math.floor(Math.abs(cx * 7 + cy * 13)) % wallMats.length], e.walls);
        bucket(roofMat, e.roof);
      }
    }
    for (const [m, geos] of buckets) {
      const flat = geos.map((g) => (g.index ? g.toNonIndexed() : g));
      const merged = mergeGeometries(flat);
      for (const g of geos) g.dispose();
      for (const g of flat) if (!geos.includes(g)) g.dispose();
      if (merged) mesh(merged, m, { cast: true });
    }
  }

  // ---- trees: photographs on two crossed quads, the nearest to the track first, up to what the device draws easily
  trees.sort((a, b) => a.d - b.d);
  trees.length = Math.min(trees.length, o.maxTrees ?? (o.detail === "full" ? 26000 : 9000));
  {
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
        const mat = keep(new THREE.MeshStandardMaterial({ map: pic.map, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1, color: o.wet ? "#c6cfc6" : "#ffffff" }));
        // the photos were cut out of a white background: their soft edges keep some of it, which drew a pale outline
        // round every tree against the sky. Shade the edge into the foliage instead.
        mat.onBeforeCompile = (sh) => {
          sh.fragmentShader = sh.fragmentShader.replace("#include <alphatest_fragment>", "#include <alphatest_fragment>\ndiffuseColor.rgb *= mix(0.45, 1.0, smoothstep(0.5, 0.95, diffuseColor.a));");
        };
        mat.customProgramCacheKey = () => "lapdle-tree-edge";
        const inst = new THREE.InstancedMesh(quad(pic.aspect), mat, mine.length);
        mine.forEach((t, k) => {
          q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.tint * 6.28);
          const flip = t.tint > 0.5 ? -1 : 1;
          m.compose(toWorld(t.x, t.y, -0.3), q, new THREE.Vector3(t.h * flip, t.h, t.h));
          inst.setMatrixAt(k, m);
          col.setHSL(0.25, 0.1, 0.86 + t.tint * 0.24);
          inst.setColorAt(k, col);
        });
        inst.receiveShadow = true;
        group.add(inst);
      });
    }
  }

  // ---- the line with its heights, for placing the car
  const line = { x: cl.map((p) => p[0]), y: cl.map((p) => p[1]), h: cl.map((p) => groundAt(p[0], p[1]) + 0.03), s: cl.map((_, i) => sAt(i)) };

  return {
    group,
    barriers,
    line,
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}

/**
 * Walls of the paddock buildings and hospitality blocks round a circuit: a storey every 3.5 m, each a long band of
 * dark glazing between mullions over a pale panel, a dark plinth at the foot. UVs are metres (u along, v up).
 */
function glazingTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d")!;
  // 256 px = 7 m along and 7 m up: two storeys
  g.fillStyle = "#f1efe9";
  g.fillRect(0, 0, 256, 256);
  for (const top of [18, 146]) {
    const grd = g.createLinearGradient(0, top, 0, top + 70);
    grd.addColorStop(0, "#56636d");
    grd.addColorStop(1, "#33404a");
    g.fillStyle = grd;
    g.fillRect(0, top, 256, 70);
    g.fillStyle = "rgba(225,228,230,0.9)";
    for (let x = 0; x < 256; x += 32) g.fillRect(x, top, 3, 70);
    g.fillStyle = "rgba(0,0,0,0.18)";
    g.fillRect(0, top + 70, 256, 4);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / 7, 1 / 7);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

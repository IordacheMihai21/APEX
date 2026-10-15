import * as THREE from "three";
import type { CornerData } from "../modes/makeCorner";
import { idealCalls } from "../modes/makeCorner";
import { type Station, smooth, strip, toWorld, wall } from "./geometry";
import { type Surfaces, bandAlpha, boardTextures, distanceBoard, fenceAlpha, kerbTexture, surfaceTextures } from "./textures";

/**
 * Everything between the grass and the road for one corner: the asphalt from
 * the circuit's real edges with a rubbered racing line and braking marks,
 * painted edge lines, raised kerbs where the corner bites and astroturf behind
 * the exit kerb, tarmac run-off and a gravel trap on the outside of the corner,
 * then the barrier: TecPro where cars go off, armco on posts elsewhere (walls
 * on a street circuit), with debris fencing above and Lapdle's own boards
 * along the armco. Barriers stop short of any other part of the circuit.
 */
export interface TracksideOptions {
  street: boolean;
  wet: boolean;
  /** the rest of the circuit's centre line (x, y pairs, the corner's coordinates), for keeping barriers off it */
  others: number[];
  /** half the circuit's width (m) */
  halfWidth: number;
  /** the photographed road, grass and gravel */
  photo: Surfaces;
}

interface Side {
  sign: 1 | -1;
  px: number[];
  py: number[];
  nx: number[];
  ny: number[];
}

export function buildTrackside(c: CornerData, o: TracksideOptions) {
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x);
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, opts: { shadow?: boolean; cast?: boolean; order?: number } = {}) => {
    const m = new THREE.Mesh(keep(geo), mat);
    m.receiveShadow = opts.shadow ?? true;
    m.castShadow = opts.cast ?? false;
    if (opts.order !== undefined) m.renderOrder = opts.order;
    group.add(m);
    return m;
  };
  const n = c.s.length;
  const tex = surfaceTextures(o.wet);
  for (const t of Object.values(tex)) keep(t);
  const wetRough = (r: number) => (o.wet ? r * 0.45 : r);

  // ---- materials
  // the photographed track asphalt is very dark (the photo, not the light): lifted to a mid grey in the dry, darker and glossy in the wet
  const asphaltMat = keep(
    new THREE.MeshStandardMaterial({
      map: o.photo.asphalt.map,
      normalMap: o.photo.asphalt.normal,
      normalScale: new THREE.Vector2(o.wet ? 0.35 : 0.8, o.wet ? 0.35 : 0.8),
      roughness: o.wet ? 0.32 : 0.86,
      envMapIntensity: o.wet ? 0.9 : 0.4,
      color: new THREE.Color().setScalar(o.wet ? 2.6 : 7),
    }),
  );
  const runoffMat = keep(new THREE.MeshStandardMaterial({ map: tex.runoff, roughness: wetRough(0.9), envMapIntensity: 0.3 }));
  const gravelMat = keep(new THREE.MeshStandardMaterial({ map: o.photo.gravel.map, normalMap: o.photo.gravel.normal, roughness: 1, color: o.wet ? "#a99a7c" : "#d6c4a0" }));
  const paintMat = keep(new THREE.MeshStandardMaterial({ color: "#efefea", roughness: wetRough(0.6), polygonOffset: true, polygonOffsetFactor: -2 }));
  const kerbTex = keep(kerbTexture());
  kerbTex.repeat.set(1 / 5, 1);
  const kerbMat = keep(new THREE.MeshStandardMaterial({ map: kerbTex, roughness: wetRough(0.55) }));
  const astroMat = keep(new THREE.MeshStandardMaterial({ color: o.wet ? "#2c6a3c" : "#2f8a45", roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -1 }));
  const band = keep(bandAlpha());
  band.repeat.set(1 / 2, 1);
  band.wrapS = THREE.RepeatWrapping;
  const rubberMat = keep(new THREE.MeshBasicMaterial({ color: "#0b0b0c", alphaMap: band, transparent: true, opacity: 0.16, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }));
  const markBand = keep(bandAlpha());
  markBand.repeat.set(1 / 0.35, 1);
  markBand.wrapS = THREE.RepeatWrapping;
  const marksMat = keep(new THREE.MeshBasicMaterial({ color: "#060606", alphaMap: markBand, transparent: true, opacity: 0.2, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
  const railMat = keep(new THREE.MeshStandardMaterial({ color: "#b9bec4", metalness: 0.75, roughness: 0.35, side: THREE.DoubleSide }));
  const postMat = keep(new THREE.MeshStandardMaterial({ color: "#7d8288", metalness: 0.5, roughness: 0.5 }));
  const wallMat = keep(new THREE.MeshStandardMaterial({ map: tex.concrete, roughness: 0.85, side: THREE.DoubleSide }));
  const fenceTex = keep(fenceAlpha());
  const fenceMat = keep(new THREE.MeshStandardMaterial({ color: "#8d949b", metalness: 0.5, roughness: 0.5, alphaMap: fenceTex, alphaTest: 0.35, side: THREE.DoubleSide }));
  const tecMat = keep(new THREE.MeshStandardMaterial({ roughness: 0.6 }));

  // ---- the road, its rubbered line and braking marks, and the edge lines
  const st = (ax: number, ay: number, bx: number, by: number, ha: number, hb: number, v: number): Station => ({ a: [ax, ay, ha], b: [bx, by, hb], v });
  add(
    strip(Array.from({ length: n }, (_, i) => st(c.lx[i], c.ly[i], c.rx[i], c.ry[i], 0.03, 0.03, c.s[i]))),
    asphaltMat,
  );
  const lineNormal = (i: number): [number, number] => {
    const a = Math.max(0, i - 1);
    const b = Math.min(n - 1, i + 1);
    const dx = c.x[b] - c.x[a];
    const dy = c.y[b] - c.y[a];
    const d = Math.hypot(dx, dy) || 1;
    return [-dy / d, dx / d];
  };
  const along = (off0: number, off1: number, from: number, to: number) =>
    Array.from({ length: n }, (_, i) => {
      if (i < from || i > to) return null;
      const [nx, ny] = lineNormal(i);
      return st(c.x[i] + nx * off0, c.y[i] + ny * off0, c.x[i] + nx * off1, c.y[i] + ny * off1, 0.031, 0.031, c.s[i]);
    });
  add(strip(along(-1, 1, 0, n - 1)), rubberMat, { order: 1 });
  const dry = c.conditions.dry;
  // lock-up and braking marks over the last part of the braking zone
  const brakeFrom = Math.round((dry.brake + dry.apex) / 2);
  for (const off of [-0.78, 0.78]) add(strip(along(off - 0.17, off + 0.17, brakeFrom, dry.apex + 4)), marksMat, { order: 2 });

  // each side: outward normals from the other edge
  const side = (ax: number[], ay: number[], bx: number[], by: number[], sign: 1 | -1): Side => {
    const nx: number[] = [];
    const ny: number[] = [];
    for (let i = 0; i < n; i++) {
      const dx = ax[i] - bx[i];
      const dy = ay[i] - by[i];
      const d = Math.hypot(dx, dy) || 1;
      nx.push(dx / d);
      ny.push(dy / d);
    }
    return { sign, px: ax, py: ay, nx, ny };
  };
  const sides = [side(c.lx, c.ly, c.rx, c.ry, 1), side(c.rx, c.ry, c.lx, c.ly, -1)];
  const at = (sd: Side, i: number, d: number): [number, number] => [sd.px[i] + sd.nx[i] * d, sd.py[i] + sd.ny[i] * d];
  const band_ = (sd: Side, i: number, d0: number, d1: number, h0: number, h1: number) => {
    const [ax, ay] = at(sd, i, d0);
    const [bx, by] = at(sd, i, d1);
    return st(ax, ay, bx, by, h0, h1, c.s[i]);
  };

  // where the corner bites (kappa > 0 bends left), widened a little before and well after for the run-off
  const kappa = smooth(dry.kappa, 5);
  const bites = kappa.map((k) => Math.abs(k) > 1 / 320);
  const zone = bites.map((_, i) => bites.slice(Math.max(0, i - 16), Math.min(n, i + 7)).some(Boolean));
  const turnSign = Math.sign(kappa[dry.apex]) || 1;

  // the rest of the circuit, in 20 m cells, for the barriers' clearance
  const CELL = 20;
  const cells = new Map<string, number[]>();
  for (let i = 0; i < o.others.length; i += 2) {
    const key = `${Math.floor(o.others[i] / CELL)},${Math.floor(o.others[i + 1] / CELL)}`;
    const l = cells.get(key);
    if (l) l.push(o.others[i], o.others[i + 1]);
    else cells.set(key, [o.others[i], o.others[i + 1]]);
  }
  const nearOther = (x: number, y: number, r: number) => {
    const gx = Math.floor(x / CELL);
    const gy = Math.floor(y / CELL);
    for (let a = -1; a <= 1; a++)
      for (let b = -1; b <= 1; b++) {
        const l = cells.get(`${gx + a},${gy + b}`);
        if (!l) continue;
        for (let k = 0; k < l.length; k += 2) if ((l[k] - x) ** 2 + (l[k + 1] - y) ** 2 < r * r) return true;
      }
    return false;
  };

  const tecproAt: { x: number; y: number; a: number; colour: number }[] = [];
  const posts: { x: number; y: number; h: number }[] = [];
  const boardSlots: [number, number][][] = [];
  const red = new THREE.Color("#c8312b");
  const blue = new THREE.Color("#2f5fae");

  for (const sd of sides) {
    const outside = (i: number) => zone[i] && sd.sign === -turnSign;
    // how far out the barrier goes, before smoothing; never into another part of the circuit
    const target = smooth(
      Array.from({ length: n }, (_, i) => (o.street ? (outside(i) ? 9 : 1.1) : outside(i) ? 30 : zone[i] ? 9 : 13)),
      8,
    );
    const clear = Array.from({ length: n }, (_, i) => {
      for (let d = 1; d <= target[i]; d += 1) {
        const [x, y] = at(sd, i, d);
        if (nearOther(x, y, o.halfWidth + 5)) return Math.max(1, d - 2);
      }
      return target[i];
    });
    const barrier = smooth(
      target.map((t, i) => Math.min(t, clear[i])),
      2,
    );
    const tarmacTo = barrier.map((b, i) => (o.street ? b : Math.min(outside(i) ? 8 : 2.5, b - 0.4)));

    // edge line, inside the road
    add(
      strip(Array.from({ length: n }, (_, i) => band_(sd, i, -0.42, -0.24, 0.033, 0.033))),
      paintMat,
    );
    // tarmac run-off
    add(
      strip(Array.from({ length: n }, (_, i) => band_(sd, i, 0, tarmacTo[i], 0.026, 0.026))),
      runoffMat,
    );
    // gravel on the outside of the corner, out to the barrier
    if (!o.street)
      add(
        strip(Array.from({ length: n }, (_, i) => (outside(i) && barrier[i] - 1.2 > tarmacTo[i] + 1 ? band_(sd, i, tarmacTo[i], barrier[i] - 1.2, 0.024, 0.024) : null))),
        gravelMat,
      );
    // kerbs where the corner bites: on the inside, and on the outside from the apex on (the exit kerb), raised to the outer edge
    const kerbHere = (i: number) => bites[i] && (sd.sign === turnSign || i >= dry.apex - 6);
    add(
      strip(
        Array.from({ length: n }, (_, i) => (kerbHere(i) ? band_(sd, i, -0.08, 1.15, 0.032, 0.085) : null)),
        false,
      ),
      kerbMat,
      { cast: true },
    );
    // astroturf behind the exit kerb
    add(
      strip(Array.from({ length: n }, (_, i) => (kerbHere(i) && sd.sign !== turnSign ? band_(sd, i, 1.15, Math.min(3.2, tarmacTo[i]), 0.028, 0.028) : null))),
      astroMat,
    );

    // the barrier line, and what stands on it
    const line = Array.from({ length: n }, (_, i) => at(sd, i, barrier[i]));
    const isTec = (i: number) => outside(i);
    if (o.street) {
      add(wall(line, 0, 1.05, true), wallMat, { cast: true });
    } else {
      const armco = line.map((p, i) => (isTec(i) ? null : p));
      for (const [h0, h1] of [
        [0.4, 0.68],
        [0.76, 1.04],
      ])
        add(wall(armco, h0, h1), railMat, { cast: true });
      let acc = 0;
      for (let i = 1; i < n; i++) {
        acc += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
        if (acc >= 3 && !isTec(i)) {
          acc = 0;
          const [x, y] = at(sd, i, barrier[i] + 0.12);
          posts.push({ x, y, h: 1.05 });
        }
      }
    }
    // TecPro blocks along the outside of the corner, 1.5 m each, red and blue
    {
      let acc = 0;
      let count = 0;
      for (let i = 1; i < n; i++) {
        acc += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
        if (acc < 1.5 || !isTec(i)) continue;
        acc = 0;
        const [x, y] = at(sd, i, barrier[i] + 0.5);
        const [x2, y2] = line[Math.min(n - 1, i + 1)];
        tecproAt.push({ x, y, a: Math.atan2(y2 - line[i][1], x2 - line[i][0]), colour: count++ % 2 });
      }
    }
    // debris fence above it all
    const fenceLine = line.map((_, i) => at(sd, i, barrier[i] + (isTec(i) ? 1.3 : 0.25)));
    add(wall(fenceLine, o.street ? 1.05 : 1.0, 4.2, true), fenceMat, { cast: false });
    {
      let acc = 0;
      for (let i = 1; i < n; i++) {
        acc += Math.hypot(fenceLine[i][0] - fenceLine[i - 1][0], fenceLine[i][1] - fenceLine[i - 1][1]);
        if (acc < 4) continue;
        acc = 0;
        posts.push({ x: fenceLine[i][0], y: fenceLine[i][1], h: 4.3 });
      }
    }
    // boards along the armco (not in front of TecPro): 6 m panels with gaps
    if (!o.street) {
      let run: [number, number][] = [];
      let len = 0;
      for (let i = 1; i < n; i++) {
        if (isTec(i) || zone[i]) {
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
          len = -3; // a gap before the next board
        }
      }
    }
  }

  // TecPro blocks and posts, instanced
  if (tecproAt.length) {
    const geo = keep(new THREE.BoxGeometry(1.48, 1.0, 1.0));
    const blocks = new THREE.InstancedMesh(geo, tecMat, tecproAt.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
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
    const geo = keep(new THREE.CylinderGeometry(0.045, 0.05, 1, 6));
    const mesh = new THREE.InstancedMesh(geo, postMat, posts.length);
    const m = new THREE.Matrix4();
    posts.forEach((p, k) => {
      m.compose(toWorld(p.x, p.y, p.h / 2), new THREE.Quaternion(), new THREE.Vector3(1, p.h, 1));
      mesh.setMatrixAt(k, m);
    });
    mesh.castShadow = true;
    group.add(mesh);
  }
  const boardTex = boardTextures();
  boardTex.forEach((t, k) => {
    keep(t);
    t.repeat.set(1 / 6, 1);
    const mat = keep(new THREE.MeshStandardMaterial({ map: t, roughness: 0.5, side: THREE.DoubleSide }));
    const mine = boardSlots.filter((_, i) => i % boardTex.length === k);
    if (!mine.length) return;
    add(wall(mine.flatMap((run) => [...run, null]), 0.12, 1.02), mat, { cast: true });
  });

  // braking boards before the turn-in, on the outside, counting down
  const ideal = idealCalls(c, "dry");
  const boardSide = sides.find((s) => s.sign === -turnSign) ?? sides[0];
  for (const d of [300, 200, 100, 50]) {
    const k = c.s.findIndex((s) => s >= ideal.releaseS - d);
    if (k <= 0) continue;
    const t = keep(distanceBoard(String(d)));
    const mat = keep(new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }));
    const board = new THREE.Mesh(keep(new THREE.BoxGeometry(2.2, 1.4, 0.1)), mat);
    const [bx, by] = at(boardSide, k, o.street ? 0.6 : 2.2);
    board.position.copy(toWorld(bx, by, 1.75));
    const ahead = toWorld(c.x[Math.min(n - 1, k + 1)], c.y[Math.min(n - 1, k + 1)]).sub(toWorld(c.x[k], c.y[k]));
    board.rotation.y = Math.atan2(-ahead.x, -ahead.z);
    board.castShadow = true;
    const post = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.06, 0.06, 1.05)), postMat);
    post.position.copy(toWorld(bx, by, 0.52));
    group.add(board, post);
  }

  return {
    group,
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}

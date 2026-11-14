import * as THREE from "three";

/**
 * A grandstand built as the real ones are, from its OpenStreetMap footprint: the rectangle of the footprint turned to
 * the track, concrete tiers stepping up row by row from a front wall, a row of seats on each tier, aisles of steps
 * every 12 m, and, on a deep stand, a roof cantilevered from columns at the back high over the seats (as at Spa's new
 * Raidillon stand). The people in the seats come back as a list of places for the crowd (instanced in buildCrowd).
 * Coordinates are track metres (x east, y north); three's (x, -y).
 */
export interface StandParts {
  concrete: THREE.BufferGeometry[];
  seats: THREE.BufferGeometry[];
  steel: THREE.BufferGeometry[];
  roof: THREE.BufferGeometry[];
  /** where people sit (track metres, height) and which way they face (radians, three's y rotation) */
  people: { x: number; y: number; h: number; face: number }[];
}

/** a box in the stand's frame: centred at (t along the stand, f away from the track), from h0 to h1 up */
function boxAt(parts: THREE.BufferGeometry[], o: Frame, t: number, f: number, len: number, depth: number, h0: number, h1: number) {
  if (h1 - h0 < 0.01 || len < 0.01 || depth < 0.01) return;
  const g = new THREE.BoxGeometry(len, h1 - h0, depth);
  g.rotateY(o.angle);
  const x = o.ox + o.tx * t + o.fx * f;
  const y = o.oy + o.ty * t + o.fy * f;
  g.translate(x, o.base + (h0 + h1) / 2, -y);
  parts.push(g);
}

interface Frame {
  ox: number;
  oy: number;
  tx: number;
  ty: number;
  fx: number;
  fy: number;
  angle: number;
  base: number;
}

/**
 * @param flat the footprint (x, y pairs)
 * @param away the unit direction from the track towards the back of the stand (track metres)
 * @param height the stand's height (m)
 * @param base the ground under it (m)
 * @param rnd a seeded random number
 * @param occupancy the share of seats taken
 */
export function buildGrandstand(flat: number[], away: [number, number], height: number, base: number, rnd: () => number, occupancy = 0.72): StandParts | null {
  const [fx, fy] = away;
  const tx = -fy;
  const ty = fx;
  let fLo = Infinity;
  let fHi = -Infinity;
  let tLo = Infinity;
  let tHi = -Infinity;
  for (let i = 0; i < flat.length; i += 2) {
    const f = flat[i] * fx + flat[i + 1] * fy;
    const t = flat[i] * tx + flat[i + 1] * ty;
    fLo = Math.min(fLo, f);
    fHi = Math.max(fHi, f);
    tLo = Math.min(tLo, t);
    tHi = Math.max(tHi, t);
  }
  const depth = fHi - fLo;
  const len = tHi - tLo;
  if (depth < 3 || len < 6) return null;
  // the frame: origin at the front-left corner (track metres), t along the front, f back from the track
  const o: Frame = { ox: tx * tLo + fx * fLo, oy: ty * tLo + fy * fLo, tx, ty, fx, fy, angle: Math.atan2(ty, tx), base };
  const parts: StandParts = { concrete: [], seats: [], steel: [], roof: [], people: [] };

  // the tiers: a 1.4 m front wall, then rows 0.85 m deep rising to the stand's height at the back
  const front = 1.0;
  const rowDepth = 0.85;
  const rows = Math.max(3, Math.floor((depth - front - 0.6) / rowDepth));
  const top = Math.max(5, Math.min(30, height));
  const rise = Math.min(0.55, Math.max(0.3, (top - 1.4) / rows));
  boxAt(parts.concrete, o, len / 2, front / 2, len, front, 0, 1.4);
  // aisles every 12 m: the seats stop for a metre of steps
  const aisle = (t: number) => {
    const k = (t - 6) / 12;
    return Math.abs(k - Math.round(k)) * 12 < 0.6;
  };
  const face = Math.atan2(-fx, fy); // the seats face the track: three's y rotation that turns +z towards -f
  for (let r = 0; r < rows; r++) {
    const f0 = front + r * rowDepth;
    const h = 1.4 + (r + 1) * rise;
    // the tier: solid concrete down to the ground, its tread at h
    boxAt(parts.concrete, o, len / 2, f0 + rowDepth / 2, len, rowDepth, 0, h);
    // the seat row: a blue bench with a low back at the front of the tread, broken by the aisles
    let t = 0.4;
    while (t < len - 0.4) {
      const start = t;
      while (t < len - 0.4 && !aisle(t)) t += 0.5;
      const runLen = t - start;
      if (runLen > 0.6) {
        boxAt(parts.seats, o, start + runLen / 2, f0 + 0.32, runLen, 0.42, h, h + 0.42);
        boxAt(parts.seats, o, start + runLen / 2, f0 + 0.55, runLen, 0.06, h + 0.42, h + 0.72);
        for (let p = start + 0.25; p < t - 0.2; p += 0.52) {
          if (rnd() > occupancy) continue;
          const x = o.ox + tx * p + fx * (f0 + 0.36);
          const y = o.oy + ty * p + fy * (f0 + 0.36);
          parts.people.push({ x, y, h: base + h + 0.42, face });
        }
      }
      while (t < len - 0.4 && aisle(t)) t += 0.5;
    }
  }
  const backH = 1.4 + rows * rise;
  const fBack = front + rows * rowDepth;
  // the back wall, a parapet with a rail at the top, and the end walls
  boxAt(parts.concrete, o, len / 2, fBack + 0.15, len, 0.3, 0, backH + 1.1);
  for (const t of [0.15, len - 0.15]) {
    const g = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(fBack + 0.3, 0), new THREE.Vector2(fBack + 0.3, backH + 1.1), new THREE.Vector2(front, 1.4 + rise), new THREE.Vector2(0, 1.4)]);
    const side = new THREE.ExtrudeGeometry(g, { depth: 0.3, bevelEnabled: false });
    // the shape's x is back from the track, its y up, the extrusion 0.3 m across: laid into the stand's frame at t
    const pos = side.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      const fLocal = pos.getX(i);
      const tLocal = t - 0.15 + pos.getZ(i);
      const x = o.ox + tx * tLocal + fx * fLocal;
      const y = o.oy + ty * tLocal + fy * fLocal;
      pos.setXYZ(i, x, base + pos.getY(i), -y);
    }
    side.computeVertexNormals();
    parts.concrete.push(side);
  }
  // a front rail
  boxAt(parts.steel, o, len / 2, 0.05, len, 0.05, 1.4, 2.4);

  // the roof: on a stand deep enough, a thin canopy cantilevered forward from columns at the back, high over the seats,
  // tilted up a little at the front, with a fascia along its edge
  if (depth > 9) {
    const roofH = backH + 4.2;
    const reach = Math.min(fBack - 1, 0.8 * fBack + 3);
    const fFront = fBack - reach;
    const g = new THREE.BoxGeometry(len + 1, 0.25, reach + 0.6);
    g.rotateX(-0.06);
    g.rotateY(o.angle);
    const cf = (fFront + fBack) / 2;
    g.translate(o.ox + tx * (len / 2) + fx * cf, base + roofH + 0.3, -(o.oy + ty * (len / 2) + fy * cf));
    parts.roof.push(g);
    boxAt(parts.steel, o, len / 2, fFront, len + 1, 0.15, roofH, roofH + 0.9);
    for (let t = 0.5; t <= len - 0.5 + 1e-6; t += Math.max(6, len / Math.max(1, Math.round(len / 9)))) {
      boxAt(parts.steel, o, t, fBack + 0.5, 0.45, 0.45, 0, roofH + 0.3);
      // a rafter from the column forward under the roof
      boxAt(parts.steel, o, t, (fFront + fBack + 0.5) / 2, 0.25, reach + 0.5, roofH - 0.35, roofH + 0.15);
    }
  }
  return parts;
}

/**
 * The crowd: a person per place, sitting (torso and head), a few standing, shirts in every colour and a few in the
 * teams' colours, as two instanced meshes.
 */
export function buildCrowd(people: StandParts["people"], rnd: () => number, detail: "full" | "lite" = "full", origin = new THREE.Vector3()): { group: THREE.Group; dispose(): void } {
  // faces per person: about 190 on a computer, 70 on a phone (tens of thousands of people)
  const fine = detail === "full";
  const group = new THREE.Group();
  // a seated person: a rounded torso a little flattened front to back, shoulders, a head with hair or a cap, forearms on
  // the lap; all soft shapes (boxes read as toy bricks up close)
  const torsoGeo = new THREE.CapsuleGeometry(0.17, 0.28, fine ? 2 : 1, fine ? 8 : 5);
  torsoGeo.scale(1.15, 1, 0.72);
  torsoGeo.translate(0, 0.32, 0);
  const headGeo = new THREE.SphereGeometry(0.105, fine ? 8 : 5, fine ? 6 : 4);
  headGeo.scale(0.92, 1.08, 1);
  const hairGeo = new THREE.SphereGeometry(0.11, fine ? 8 : 5, fine ? 3 : 2, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const armsGeo = new THREE.CapsuleGeometry(0.05, 0.36, 1, 4);
  armsGeo.rotateZ(Math.PI / 2);
  armsGeo.translate(0, 0, 0.12);
  const torsoMat = new THREE.MeshStandardMaterial({ roughness: 0.92 });
  const headMat = new THREE.MeshStandardMaterial({ roughness: 0.7 });
  const n = people.length;
  const torsos = new THREE.InstancedMesh(torsoGeo, torsoMat, n);
  const heads = new THREE.InstancedMesh(headGeo, headMat, n);
  const hair = new THREE.InstancedMesh(hairGeo, torsoMat, n);
  const arms = new THREE.InstancedMesh(armsGeo, torsoMat, n);
  // a real crowd is mostly dark, white, grey and navy, with patches of colour: at Spa, a lot of orange (the Dutch
  // fans), the red of Ferrari, team shirts (weights: how often each turns up)
  const palette: [string, number][] = [
    ["#1b1c20", 16], ["#2a2d33", 10], ["#e9e7e1", 12], ["#bfc2c6", 7], ["#6d7178", 7], ["#232c44", 9], ["#3b4f72", 5],
    ["#5a4a3a", 4], ["#3d5a3a", 3], ["#ff6a13", 10], ["#c8262b", 5], ["#e10600", 3], ["#f2c230", 2], ["#00a19b", 2], ["#1e5bd6", 3],
  ];
  const total = palette.reduce((a, [, w]) => a + w, 0);
  const pick = () => {
    let r = rnd() * total;
    for (const [c, w] of palette) if ((r -= w) <= 0) return c;
    return palette[0][0];
  };
  const skins = ["#f1c7a5", "#e0ac83", "#c68b62", "#a86b45", "#7a4a2c", "#f5d6bd"];
  const hairs = ["#1c1712", "#3b2a1c", "#5e4128", "#8a6a45", "#b9a07a", "#2a2a2a", "#d8d3c8"];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const col = new THREE.Color();
  people.forEach((p, k) => {
    const standing = rnd() < 0.08;
    const lift = standing ? 0.42 : 0;
    q.setFromAxisAngle(up, p.face + (rnd() - 0.5) * 0.35);
    const sc = 0.9 + rnd() * 0.18;
    const scale = new THREE.Vector3(sc, sc, sc);
    m.compose(new THREE.Vector3(p.x - origin.x, p.h + lift - 0.04 - origin.y, -p.y - origin.z), q, scale);
    torsos.setMatrixAt(k, m);
    const shirt = pick();
    torsos.setColorAt(k, col.set(shirt));
    const cheer = rnd() < 0.05;
    m.compose(new THREE.Vector3(p.x - origin.x, p.h + lift + (cheer ? 0.85 : 0.2) * sc - origin.y, -p.y - origin.z), q, scale);
    arms.setMatrixAt(k, m);
    arms.setColorAt(k, col.set(cheer ? skins[Math.floor(rnd() * skins.length)] : shirt));
    const headY = p.h + lift + 0.76 * sc;
    m.compose(new THREE.Vector3(p.x - origin.x, headY - origin.y, -p.y - origin.z), q, scale);
    heads.setMatrixAt(k, m);
    heads.setColorAt(k, col.set(skins[Math.floor(rnd() * skins.length)]));
    // hair, or a cap in a team's colour
    const cap = rnd() < 0.3;
    m.compose(new THREE.Vector3(p.x - origin.x, headY + 0.01 - origin.y, -p.y - origin.z), q, scale);
    hair.setMatrixAt(k, m);
    hair.setColorAt(k, col.set(cap ? pick() : hairs[Math.floor(rnd() * hairs.length)]));
  });
  for (const mesh of [torsos, heads, hair, arms]) {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    // culled with the stand's own bounds, not the whole circuit's
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  return {
    group,
    dispose() {
      torsoGeo.dispose();
      headGeo.dispose();
      hairGeo.dispose();
      armsGeo.dispose();
      torsoMat.dispose();
      headMat.dispose();
    },
  };
}

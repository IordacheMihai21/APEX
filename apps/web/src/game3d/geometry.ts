import * as THREE from "three";

/**
 * Geometry builders for the 3D corner. The track's (x, y) plane is three's
 * (x, -z), y up; every builder writes UVs in metres, so textures tile by
 * their own size (textures.ts).
 */

/** The ground's height at a point (track metres), set by the scene while it builds a corner; flat until then. */
let ground: (x: number, y: number) => number = () => 0;
export function setGround(fn: (x: number, y: number) => number) {
  ground = fn;
}
export const groundAt = (x: number, y: number) => ground(x, y);

/** A point `h` metres above the ground. */
export const toWorld = (x: number, y: number, h = 0) => new THREE.Vector3(x, h + ground(x, y), -y);

/** A pair of points across a strip at one station: (x, y, height) each, and how far along it is (m). */
export interface Station {
  a: [number, number, number];
  b: [number, number, number];
  v: number;
}

/**
 * A strip through stations, split wherever `keep` is false. u runs across
 * (0 at a, its width in metres at b), v along. Triangles face up.
 */
export function strip(stations: (Station | null)[], uAcross = true): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  let prev = -1;
  for (const st of stations) {
    if (!st) {
      prev = -1;
      continue;
    }
    const width = Math.hypot(st.b[0] - st.a[0], st.b[1] - st.a[1]);
    const base = pos.length / 3;
    pos.push(st.a[0], st.a[2] + ground(st.a[0], st.a[1]), -st.a[1], st.b[0], st.b[2] + ground(st.b[0], st.b[1]), -st.b[1]);
    if (uAcross) uv.push(0, st.v, width, st.v);
    else uv.push(st.v, 0, st.v, 1);
    if (prev >= 0) {
      // wind each quad so it faces up
      const [ax, , az] = [pos[prev * 3], 0, pos[prev * 3 + 2]];
      const [bx, , bz] = [pos[prev * 3 + 3], 0, pos[prev * 3 + 5]];
      const [cx, , cz] = [pos[base * 3], 0, pos[base * 3 + 2]];
      const up = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
      if (up >= 0) idx.push(prev, prev + 1, base, prev + 1, base + 1, base);
      else idx.push(prev, base, prev + 1, prev + 1, base, base + 1);
    }
    prev = base;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * A vertical wall along a line of points (x, y), from h0 to h1, split where a
 * point is null. u runs along it in metres, v up it (0..1 for a texture across
 * the height, or metres with `vMetres`). Seen from both sides with a DoubleSide material.
 */
export function wall(line: ([number, number] | null)[], h0: number, h1: number, vMetres = false): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  let prev = -1;
  let u = 0;
  let last: [number, number] | null = null;
  for (const p of line) {
    if (!p) {
      prev = -1;
      last = null;
      continue;
    }
    if (last) u += Math.hypot(p[0] - last[0], p[1] - last[1]);
    last = p;
    const base = pos.length / 3;
    const g = ground(p[0], p[1]);
    pos.push(p[0], h0 + g, -p[1], p[0], h1 + g, -p[1]);
    uv.push(u, vMetres ? h0 : 0, u, vMetres ? h1 : 1);
    if (prev >= 0) idx.push(prev, base, prev + 1, prev + 1, base, base + 1);
    prev = base;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * A polygon (x, y pairs) h metres above the ground, UVs in metres. `level` lays it flat at its lowest ground point
 * instead of draping it over the slope (water).
 */
export function polygon(flat: number[], h: number, level = false): THREE.BufferGeometry | null {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < flat.length; i += 2) pts.push(new THREE.Vector2(flat[i], flat[i + 1]));
  if (pts.length > 2 && pts[0].equals(pts[pts.length - 1])) pts.pop();
  if (pts.length < 3) return null;
  const tris = THREE.ShapeUtils.triangulateShape(pts, []);
  if (!tris.length) return null;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const lowest = level ? Math.min(...pts.map((p) => ground(p.x, p.y))) : 0;
  const vertex = (x: number, y: number) => {
    pos.push(x, h + (level ? lowest : ground(x, y)), -y);
    uv.push(x, y);
    return pos.length / 3 - 1;
  };
  for (const [a0, b0, c0] of tris) {
    // face up: counter-clockwise seen from above
    const cross = (pts[b0].x - pts[a0].x) * (pts[c0].y - pts[a0].y) - (pts[b0].y - pts[a0].y) * (pts[c0].x - pts[a0].x);
    const [a, b, c] = cross >= 0 ? [pts[a0], pts[b0], pts[c0]] : [pts[a0], pts[c0], pts[b0]];
    // draped on the ground, a big area is cut into triangles of about 8 m so it follows a slope instead of spanning
    // it as one flat slab
    const longest = Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a));
    const n = level ? 1 : Math.min(40, Math.max(1, Math.ceil(longest / 8)));
    const row: number[][] = [];
    for (let i = 0; i <= n; i++) {
      row.push([]);
      for (let j = 0; j <= n - i; j++) row[i].push(vertex(a.x + ((b.x - a.x) * i + (c.x - a.x) * j) / n, a.y + ((b.y - a.y) * i + (c.y - a.y) * j) / n));
    }
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n - i; j++) {
        idx.push(row[i][j], row[i + 1][j], row[i][j + 1]);
        if (j < n - i - 1) idx.push(row[i + 1][j], row[i + 1][j + 1], row[i][j + 1]);
      }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * A building: walls up from the ground and a roof, from its footprint. The
 * roof height can vary per corner (`heightAt`), which makes a grandstand's
 * raked seating. Returns the walls and the roof separately (two materials). On a slope it stands on its lowest
 * ground point, the walls going a metre below it so no gap shows.
 */
export function extrude(flat: number[], heightAt: (x: number, y: number) => number): { walls: THREE.BufferGeometry; roof: THREE.BufferGeometry } | null {
  const pts: [number, number][] = [];
  for (let i = 0; i < flat.length; i += 2) pts.push([flat[i], flat[i + 1]]);
  if (pts.length > 2 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop();
  if (pts.length < 3) return null;
  const roofFlat = pts.flat();
  const roof = polygon(roofFlat, 0);
  if (!roof) return null;
  const base = Math.min(...pts.map(([x, y]) => ground(x, y)));
  const rp = roof.getAttribute("position");
  for (let i = 0; i < rp.count; i++) rp.setY(i, base + heightAt(rp.getX(i), -rp.getZ(i)));
  roof.computeVertexNormals();
  // walls: one quad per footprint edge, from the ground to the roof's edge
  const pos: number[] = [];
  const uv: number[] = [];
  let u = 0;
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % pts.length];
    const len = Math.hypot(bx - ax, by - ay);
    const ha = heightAt(ax, ay);
    const hb = heightAt(bx, by);
    const quad = [
      [ax, base - 1, ay, u, 0],
      [bx, base - 1, by, u + len, 0],
      [bx, base + hb, by, u + len, hb + 1],
      [ax, base + ha, ay, u, ha + 1],
    ];
    for (const k of [0, 1, 2, 0, 2, 3]) {
      const [x, h, y, uu, vv] = quad[k];
      pos.push(x, h, -y);
      uv.push(uu, vv);
    }
    u += len;
  }
  const walls = new THREE.BufferGeometry();
  walls.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  walls.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  walls.computeVertexNormals();
  return { walls, roof };
}

/** Moving average of a series over ±w samples. */
export function smooth(a: number[], w: number): number[] {
  return a.map((_, i) => {
    let s = 0;
    let n = 0;
    for (let k = Math.max(0, i - w); k <= Math.min(a.length - 1, i + w); k++) {
      s += a[k];
      n++;
    }
    return s / n;
  });
}

/** Even-odd test: is (x, y) inside the polygon (flat x, y pairs)? */
export function inside(flat: number[], x: number, y: number): boolean {
  let hit = false;
  for (let i = 0, j = flat.length - 2; i < flat.length; j = i, i += 2) {
    const yi = flat[i + 1];
    const yj = flat[j + 1];
    if (yi > y !== yj > y && x < ((flat[j] - flat[i]) * (y - yi)) / (yj - yi) + flat[i]) hit = !hit;
  }
  return hit;
}

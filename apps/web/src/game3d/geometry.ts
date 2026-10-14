import * as THREE from "three";

/**
 * Geometry builders for the 3D corner. The track's (x, y) plane is three's
 * (x, -z), y up; every builder writes UVs in metres, so textures tile by
 * their own size (textures.ts).
 */
export const toWorld = (x: number, y: number, h = 0) => new THREE.Vector3(x, h, -y);

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
    pos.push(st.a[0], st.a[2], -st.a[1], st.b[0], st.b[2], -st.b[1]);
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
    pos.push(p[0], h0, -p[1], p[0], h1, -p[1]);
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

/** A flat polygon (x, y pairs) at height h, UVs in metres. */
export function polygon(flat: number[], h: number): THREE.BufferGeometry | null {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < flat.length; i += 2) pts.push(new THREE.Vector2(flat[i], flat[i + 1]));
  if (pts.length > 2 && pts[0].equals(pts[pts.length - 1])) pts.pop();
  if (pts.length < 3) return null;
  const tris = THREE.ShapeUtils.triangulateShape(pts, []);
  if (!tris.length) return null;
  const pos: number[] = [];
  const uv: number[] = [];
  for (const p of pts) {
    pos.push(p.x, h, -p.y);
    uv.push(p.x, p.y);
  }
  const idx: number[] = [];
  for (const [a, b, c] of tris) {
    // face up: counter-clockwise seen from above
    const cross = (pts[b].x - pts[a].x) * (pts[c].y - pts[a].y) - (pts[b].y - pts[a].y) * (pts[c].x - pts[a].x);
    if (cross >= 0) idx.push(a, b, c);
    else idx.push(a, c, b);
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
 * raked seating. Returns the walls and the roof separately (two materials).
 */
export function extrude(flat: number[], heightAt: (x: number, y: number) => number): { walls: THREE.BufferGeometry; roof: THREE.BufferGeometry } | null {
  const pts: [number, number][] = [];
  for (let i = 0; i < flat.length; i += 2) pts.push([flat[i], flat[i + 1]]);
  if (pts.length > 2 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop();
  if (pts.length < 3) return null;
  const roofFlat = pts.flat();
  const roof = polygon(roofFlat, 0);
  if (!roof) return null;
  const rp = roof.getAttribute("position");
  for (let i = 0; i < rp.count; i++) rp.setY(i, heightAt(rp.getX(i), -rp.getZ(i)));
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
      [ax, 0, ay, u, 0],
      [bx, 0, by, u + len, 0],
      [bx, hb, by, u + len, hb],
      [ax, ha, ay, u, ha],
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

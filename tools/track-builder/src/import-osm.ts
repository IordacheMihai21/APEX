/**
 * Real surroundings for each circuit from OpenStreetMap: buildings and
 * grandstands, woods and single trees, water and the sea, sand, parks,
 * parking, roads, rail, piers, other raceway (pit lanes, old layouts) and a
 * few landmarks (big wheels, towers, artworks). Projected into the track's
 * frame (see circuitFrame), simplified, and stripped of anything that would
 * sit on the racing surface.
 *
 * Output: data/scenery/<id>.json. The data is © OpenStreetMap contributors,
 * available under the ODbL; see docs/DATA_SOURCES.md.
 *
 * Usage: npx tsx tools/track-builder/src/import-osm.ts [id...]
 * (network; respects the public Overpass servers with one request per circuit)
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { GameTrack, Vec2 } from "@apex/engine";
import { circuitFrame, loadFeatures } from "./import-geojson";
import { REAL_CIRCUITS } from "./real-circuits";

const MIRRORS = ["https://overpass-api.de/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const MARGIN_M = 450;
const ROOT = resolve(import.meta.dirname, "../../..");

type Tags = Record<string, string>;
interface LatLon {
  lat: number;
  lon: number;
}
interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  tags?: Tags;
  geometry?: LatLon[];
  members?: { type: string; role: string; geometry?: LatLon[] }[];
}

/** One request per circuit; everything the renderer can use, with geometry inline. */
function query([s, w, n, e]: number[]): string {
  const b = `(${s},${w},${n},${e})`;
  const area = (k: string, v: string) => `way["${k}"~"${v}"]${b};relation["${k}"~"${v}"]${b};`;
  return `[out:json][timeout:180];(
    way["building"]${b};relation["building"]${b};
    ${area("landuse", "^(forest|grass|meadow|recreation_ground|village_green|residential|commercial|retail|industrial|farmland|orchard|vineyard|allotments)$")}
    ${area("natural", "^(wood|water|scrub|heath|sand|beach|grassland|wetland|bare_rock)$")}
    ${area("leisure", "^(park|marina|garden|pitch|swimming_pool|stadium)$")}
    ${area("water", ".")}
    way["waterway"~"^(riverbank|river|stream|canal)$"]${b};
    way["natural"="tree_row"]${b};
    way["amenity"="parking"]${b};
    way["man_made"~"^(pier|breakwater|groyne)$"]${b};
    way["natural"="coastline"]${b};
    way["highway"="raceway"]${b};
    way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|living_street|pedestrian)$"]${b};
    way["railway"="rail"]${b};
    node["natural"="tree"]${b};
    node["attraction"="big_wheel"]${b};way["attraction"="big_wheel"]${b};
    node["man_made"="tower"]${b};way["man_made"="tower"]${b};
    node["tourism"="artwork"]${b};way["tourism"="artwork"]${b};
  );out geom;`;
}

async function overpass(q: string): Promise<OsmElement[]> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const url = MIRRORS[attempt % MIRRORS.length];
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "APEX-track-builder/0.1" },
        body: `data=${encodeURIComponent(q)}`,
        signal: AbortSignal.timeout(180_000),
      });
      if (res.ok) return ((await res.json()) as { elements: OsmElement[] }).elements;
      console.warn(`  ${url}: HTTP ${res.status}`);
    } catch (err) {
      console.warn(`  ${url}: ${(err as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)));
  }
  throw new Error("all Overpass mirrors failed");
}

// ------------------------------------------------------------------ geometry
const dist2 = (a: Vec2, b: Vec2) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;

/** Douglas–Peucker. */
function simplify(pts: Vec2[], tol: number): Vec2[] {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const len = Math.hypot(bx - ax, by - ay) || 1e-9;
    let best = -1;
    let bestD = tol;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / len;
      if (d > bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best >= 0) {
      keep[best] = 1;
      stack.push([a, best], [best, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

/** Simplify a closed ring: split at the point farthest from the start so neither half is degenerate. */
function simplifyRing(ring: Vec2[], tol: number): Vec2[] {
  const pts = dist2(ring[0], ring[ring.length - 1]) < 1e-6 ? ring.slice(0, -1) : ring;
  if (pts.length < 4) return pts;
  let far = 1;
  for (let i = 1; i < pts.length; i++) if (dist2(pts[0], pts[i]) > dist2(pts[0], pts[far])) far = i;
  const a = simplify(pts.slice(0, far + 1), tol);
  const b = simplify(pts.slice(far).concat([pts[0]]), tol);
  return a.concat(b.slice(1, -1));
}

/** Join open way geometries end to end into rings/chains (multipolygon members, coastline). */
function joinChains(ways: Vec2[][], eps = 0.5): Vec2[][] {
  const pool = ways.map((w) => w.slice());
  const out: Vec2[][] = [];
  const e2 = eps * eps;
  while (pool.length) {
    let chain = pool.pop()!;
    let grown = true;
    while (grown && dist2(chain[0], chain[chain.length - 1]) > e2) {
      grown = false;
      for (let k = 0; k < pool.length; k++) {
        const w = pool[k];
        if (dist2(chain[chain.length - 1], w[0]) <= e2) chain = chain.concat(w.slice(1));
        else if (dist2(chain[chain.length - 1], w[w.length - 1]) <= e2) chain = chain.concat(w.slice(0, -1).reverse());
        else if (dist2(chain[0], w[w.length - 1]) <= e2) chain = w.slice(0, -1).concat(chain);
        else if (dist2(chain[0], w[0]) <= e2) chain = w.slice(1).reverse().concat(chain);
        else continue;
        pool.splice(k, 1);
        grown = true;
        break;
      }
    }
    out.push(chain);
  }
  return out;
}

/**
 * Sea polygons from coastline chains (land on the left, sea on the right),
 * closed along the clip box clockwise. Chains are first clipped to the box.
 */
function seaFromCoast(chains: Vec2[][], box: [number, number, number, number]): Vec2[][] {
  const [x0, y0, x1, y1] = box;
  const inside = (p: Vec2) => p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1;
  // split chains into in-box runs, each starting and ending on the box edge
  const runs: Vec2[][] = [];
  const closed: Vec2[][] = [];
  const clampTo = (p: Vec2): Vec2 => [Math.max(x0, Math.min(x1, p[0])), Math.max(y0, Math.min(y1, p[1]))];
  for (const c of chains) {
    const ring = dist2(c[0], c[c.length - 1]) < 1 && c.every(inside);
    if (ring) {
      closed.push(c); // an island or a fully enclosed lagoon edge
      continue;
    }
    let run: Vec2[] = [];
    for (let i = 0; i < c.length; i++) {
      if (inside(c[i])) {
        if (!run.length && i > 0) run.push(clampTo(c[i - 1]));
        run.push(c[i]);
      } else if (run.length) {
        run.push(clampTo(c[i]));
        runs.push(run);
        run = [];
      }
    }
    if (run.length > 1) runs.push(run);
  }
  if (!runs.length) return [];
  // perimeter position measured clockwise from the top-left corner (y up)
  const W = x1 - x0;
  const H = y1 - y0;
  const perim = ([x, y]: Vec2) => {
    if (Math.abs(y - y1) < 0.5) return x - x0; // top, left → right
    if (Math.abs(x - x1) < 0.5) return W + (y1 - y); // right, top → bottom
    if (Math.abs(y - y0) < 0.5) return W + H + (x1 - x); // bottom, right → left
    return 2 * W + H + (y - y0); // left, bottom → top
  };
  const corner = (t: number): Vec2 => (t < W ? [x1, y1] : t < W + H ? [x1, y0] : t < 2 * W + H ? [x0, y0] : [x0, y1]);
  const cornerT = [W, W + H, 2 * W + H, 2 * W + 2 * H];
  const L = 2 * W + 2 * H;
  const polys: Vec2[][] = [];
  const used = new Set<number>();
  for (let s = 0; s < runs.length; s++) {
    if (used.has(s)) continue;
    const poly: Vec2[] = [];
    let k = s;
    for (let guard = 0; guard < runs.length + 1; guard++) {
      used.add(k);
      poly.push(...runs[k]);
      // walk clockwise from this run's exit to the nearest run start
      const tExit = perim(runs[k][runs[k].length - 1]);
      let next = -1;
      let best = Infinity;
      runs.forEach((r, j) => {
        const d = (perim(r[0]) - tExit + L) % L;
        if (d < best) {
          best = d;
          next = j;
        }
      });
      for (const ct of cornerT) {
        const d = (ct - tExit + L) % L;
        if (d > 0 && d < best) poly.push(corner(ct - 1e-6));
      }
      if (next === s || used.has(next)) break;
      k = next;
    }
    polys.push(poly);
  }
  return polys.concat(closed);
}

// ------------------------------------------------------------------ classify
type Kind = "water" | "wood" | "scrub" | "sand" | "grass" | "farm" | "urban" | "parking" | "pier";
const AREA_KIND = (t: Tags): Kind | null => {
  if (t.natural === "water" || t.water || t.waterway === "riverbank" || t.leisure === "marina" || t.leisure === "swimming_pool") return "water";
  if (t.natural === "wood" || t.landuse === "forest") return "wood";
  if (t.natural === "scrub" || t.natural === "heath" || t.natural === "wetland") return "scrub";
  if (t.natural === "sand" || t.natural === "beach" || t.natural === "bare_rock") return "sand";
  if (["grass", "meadow", "recreation_ground", "village_green"].includes(t.landuse) || ["park", "garden", "pitch", "stadium"].includes(t.leisure) || t.natural === "grassland") return "grass";
  if (["farmland", "orchard", "vineyard", "allotments"].includes(t.landuse)) return "farm";
  if (["residential", "commercial", "retail", "industrial"].includes(t.landuse)) return "urban";
  if (t.amenity === "parking") return "parking";
  if (["pier", "breakwater", "groyne"].includes(t.man_made)) return "pier";
  return null;
};

const ROAD_WIDTH: Record<string, number> = { motorway: 14, trunk: 12, primary: 10, secondary: 8.5, tertiary: 7.5, residential: 6, unclassified: 6, living_street: 5, pedestrian: 5 };

const r1 = (v: number) => Math.round(v * 10) / 10;
const flat = (p: Vec2[]) => p.flatMap(([x, y]) => [r1(x), r1(y)]);

async function importCircuit(id: string) {
  const c = REAL_CIRCUITS.find((r) => r.id === id)!;
  const feature = loadFeatures(resolve(ROOT, "data/raw/bacinger/f1-circuits.geojson")).get(c.sourceId)!;
  const frame = circuitFrame(feature, c);
  const track: GameTrack = JSON.parse(readFileSync(resolve(ROOT, `data/tracks/${id}.v1.json`), "utf8"));
  const [s, w, n, e] = frame.bbox;
  const dLat = MARGIN_M / 111_320;
  const dLon = MARGIN_M / (111_320 * Math.cos((((s + n) / 2) * Math.PI) / 180));
  const els = await overpass(query([s - dLat, w - dLon, n + dLat, e + dLon]));

  // clip box in track space (a little inside the queried area)
  const cl = track.centerline;
  const box: [number, number, number, number] = [
    Math.min(...cl.map((p) => p[0])) - MARGIN_M + 30,
    Math.min(...cl.map((p) => p[1])) - MARGIN_M + 30,
    Math.max(...cl.map((p) => p[0])) + MARGIN_M - 30,
    Math.max(...cl.map((p) => p[1])) + MARGIN_M - 30,
  ];
  const inBox = (p: Vec2) => p[0] >= box[0] && p[0] <= box[2] && p[1] >= box[1] && p[1] <= box[3];

  // distance to the racing surface, via a coarse grid of centreline points
  const CELL = 20;
  const grid = new Map<string, Vec2[]>();
  for (const p of cl) {
    const k = `${Math.floor(p[0] / CELL)},${Math.floor(p[1] / CELL)}`;
    (grid.get(k) ?? grid.set(k, []).get(k)!).push(p);
  }
  const nearTrack = (p: Vec2, d: number) => {
    const gx = Math.floor(p[0] / CELL);
    const gy = Math.floor(p[1] / CELL);
    const r = Math.ceil(d / CELL);
    for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) for (const q of grid.get(`${gx + a},${gy + b}`) ?? []) if (dist2(p, q) < d * d) return true;
    return false;
  };
  const half = track.widthMeters / 2;

  const proj = (g: LatLon[]) => g.map((q) => frame.toTrack(q.lon, q.lat));
  const rings = (el: OsmElement): Vec2[][] => {
    if (el.type === "way" && el.geometry) return [proj(el.geometry)];
    if (el.type === "relation" && el.members) {
      const outers = el.members.filter((m) => m.role !== "inner" && m.geometry).map((m) => proj(m.geometry!));
      return joinChains(outers).filter((r) => r.length > 3);
    }
    return [];
  };

  const areas: Record<Kind, number[][]> = { water: [], wood: [], scrub: [], sand: [], grass: [], farm: [], urban: [], parking: [], pier: [] };
  const buildings: { p: number[]; h: number; k?: "stand" | "pits" }[] = [];
  const trees: number[] = [];
  const roads: { w: number; p: number[] }[] = [];
  const rail: number[][] = [];
  const raceway: { pit: boolean; p: number[] }[] = [];
  const landmarks: { k: "wheel" | "tower" | "art"; x: number; y: number; r: number; name?: string }[] = [];
  const coast: Vec2[][] = [];
  const waterways: { w: number; p: number[] }[] = [];

  for (const el of els) {
    const t = el.tags ?? {};
    if (el.type === "node") {
      const p = frame.toTrack(el.lon!, el.lat!);
      if (!inBox(p)) continue;
      if (t.natural === "tree" && !nearTrack(p, half + 5)) trees.push(r1(p[0]), r1(p[1]));
      else if (t.attraction === "big_wheel") landmarks.push({ k: "wheel", x: r1(p[0]), y: r1(p[1]), r: 25, name: t.name });
      else if (t.man_made === "tower") landmarks.push({ k: "tower", x: r1(p[0]), y: r1(p[1]), r: 8, name: t.name });
      else if (t.tourism === "artwork" && t.name) landmarks.push({ k: "art", x: r1(p[0]), y: r1(p[1]), r: 8, name: t.name });
      continue;
    }
    if (t.natural === "coastline" && el.geometry) {
      coast.push(proj(el.geometry));
      continue;
    }
    const lines = el.geometry ? [proj(el.geometry)] : [];
    if (t.highway === "raceway") {
      for (const l of lines) {
        // keep only the parts that aren't our racing line: pit lanes, old and alternative layouts
        let run: Vec2[] = [];
        const flush = () => {
          if (run.length > 1) raceway.push({ pit: /pit/i.test(t.name ?? "") || t.service === "pit_lane", p: flat(simplify(run, 0.4)) });
          run = [];
        };
        for (const p of l) {
          if (!inBox(p) || nearTrack(p, half + 3)) flush();
          else run.push(p);
        }
        flush();
      }
      continue;
    }
    if (t.highway && ROAD_WIDTH[t.highway]) {
      for (const l of lines) {
        let run: Vec2[] = [];
        const flush = () => {
          if (run.length > 1) roads.push({ w: ROAD_WIDTH[t.highway], p: flat(simplify(run, 0.6)) });
          run = [];
        };
        for (const p of l) {
          if (!inBox(p) || nearTrack(p, half + ROAD_WIDTH[t.highway] / 2 + 2)) flush();
          else run.push(p);
        }
        flush();
      }
      continue;
    }
    if (t.railway === "rail") {
      for (const l of lines) if (l.some(inBox)) rail.push(flat(simplify(l.filter(inBox), 0.6)));
      continue;
    }
    if (t.natural === "tree_row") {
      for (const l of lines)
        for (let i = 0; i < l.length - 1; i++) {
          const len = Math.sqrt(dist2(l[i], l[i + 1]));
          for (let d = 0; d < len; d += 8) {
            const p: Vec2 = [l[i][0] + ((l[i + 1][0] - l[i][0]) * d) / len, l[i][1] + ((l[i + 1][1] - l[i][1]) * d) / len];
            if (inBox(p) && !nearTrack(p, half + 5)) trees.push(r1(p[0]), r1(p[1]));
          }
        }
      continue;
    }
    if (t.waterway && t.waterway !== "riverbank") {
      for (const l of lines) if (l.some(inBox)) waterways.push({ w: t.waterway === "river" ? 18 : t.waterway === "canal" ? 10 : 4, p: flat(simplify(l, 0.8)) });
      continue;
    }
    if (t.attraction === "big_wheel" || t.man_made === "tower" || (t.tourism === "artwork" && t.name)) {
      for (const r of rings(el)) {
        const cx = r.reduce((a, p) => a + p[0], 0) / r.length;
        const cy = r.reduce((a, p) => a + p[1], 0) / r.length;
        const rad = Math.max(...r.map((p) => Math.hypot(p[0] - cx, p[1] - cy)));
        if (inBox([cx, cy])) landmarks.push({ k: t.attraction === "big_wheel" ? "wheel" : t.man_made === "tower" ? "tower" : "art", x: r1(cx), y: r1(cy), r: r1(rad), name: t.name });
      }
      if (!t.building) continue;
    }
    if (t.building) {
      for (const r of rings(el)) {
        if (!r.some(inBox) || r.some((p) => nearTrack(p, half + 1.5))) continue;
        // sheds add nothing from the air; far-off blocks need less detail
        const areaM2 = Math.abs(r.reduce((a, p, i) => a + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1], 0)) / 2;
        if (areaM2 < 30) continue;
        const far = !r.some((p) => nearTrack(p, 250));
        const levels = Number(t["building:levels"]) || (t.height ? Number.parseFloat(t.height) / 3.2 : 0);
        const stand = t.building === "grandstand" || /tribun|grandstand|stand/i.test(t.name ?? "");
        const pits = /pit|box/i.test(t.name ?? "");
        const h = r1(levels ? levels * 3.2 : stand ? 12 : 7);
        buildings.push({ p: flat(simplifyRing(r, far ? 1.2 : 0.35)), h, ...(stand ? { k: "stand" as const } : pits ? { k: "pits" as const } : {}) });
      }
      continue;
    }
    const kind = AREA_KIND(t);
    if (kind) for (const r of rings(el)) if (r.length > 3 && r.some(inBox)) areas[kind].push(flat(simplifyRing(r, kind === "pier" ? 0.3 : 0.8)));
  }

  for (const sea of seaFromCoast(joinChains(coast), box)) areas.water.push(flat(simplifyRing(sea, 0.8)));

  const out = {
    attribution: "© OpenStreetMap contributors (ODbL)",
    box: box.map(r1),
    areas,
    buildings,
    trees,
    roads,
    rail,
    raceway,
    waterways,
    landmarks,
  };
  mkdirSync(resolve(ROOT, "data/scenery"), { recursive: true });
  const json = JSON.stringify(out);
  writeFileSync(resolve(ROOT, `data/scenery/${id}.json`), json);
  const count = (k: Kind) => areas[k].length;
  console.log(
    `${id.padEnd(14)} ${(json.length / 1024).toFixed(0).padStart(5)} kB  buildings ${buildings.length} (stands ${buildings.filter((b) => b.k === "stand").length})  trees ${trees.length / 2}  wood ${count("wood")}  water ${count("water")}  roads ${roads.length}  raceway ${raceway.length} (pit ${raceway.filter((r) => r.pit).length})  landmarks ${landmarks.map((l) => l.k + (l.name ? `:${l.name}` : "")).join(", ")}`,
  );
}

const only = process.argv.slice(2);
for (const c of REAL_CIRCUITS) {
  if (only.length && !only.includes(c.id)) continue;
  try {
    await importCircuit(c.id);
  } catch (err) {
    console.error(`${c.id}: ${(err as Error).message}`);
  }
  await new Promise((r) => setTimeout(r, 2000));
}

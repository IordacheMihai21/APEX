import * as THREE from "three";
import type { Condition } from "@apex/engine";
import type { CornerData } from "../modes/makeCorner";
import { idealCalls } from "../modes/makeCorner";
import { buildCar } from "./car";

/**
 * The 3D corner for Make the corner: the road built from the circuit's real
 * edges, kerbs where the corner bites, run-off, grass and barriers, braking
 * boards before the corner, and the car on the racing line with a chase
 * camera. World units are metres; the track's (x, y) plane is three's (x, -z),
 * y up. Only this module and the car import three, so it loads with the game.
 */

const toWorld = (x: number, y: number, h = 0) => new THREE.Vector3(x, h, -y);

/** A small tiling texture drawn on a canvas: noise over a base colour (asphalt, grass, gravel). */
function noiseTexture(base: [number, number, number], spread: number, size = 128, repeat = 1): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const img = g.createImageData(size, size);
  let seed = 1234567;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < size * size; i++) {
    const n = (rnd() - 0.5) * spread;
    img.data[i * 4] = base[0] + n;
    img.data[i * 4 + 1] = base[1] + n;
    img.data[i * 4 + 2] = base[2] + n;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** A braking board: the distance in big black numbers on white, with a red border. */
function boardTexture(label: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 160;
  const g = c.getContext("2d")!;
  g.fillStyle = "#f4f4f2";
  g.fillRect(0, 0, 256, 160);
  g.strokeStyle = "#d22";
  g.lineWidth = 14;
  g.strokeRect(7, 7, 242, 146);
  g.fillStyle = "#111";
  g.font = "900 96px Archivo, Arial, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(label, 128, 84);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Turn every triangle of a flat strip to face up (which way it winds depends on which edge it follows). */
function faceUp(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const p = geo.getAttribute("position");
  const index = geo.getIndex();
  const tri = index ? (index.array as ArrayLike<number> & { [i: number]: number }) : null;
  const count = tri ? tri.length : p.count;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let t = 0; t < count; t += 3) {
    const i = tri ? tri[t] : t;
    const j = tri ? tri[t + 1] : t + 1;
    const k = tri ? tri[t + 2] : t + 2;
    a.fromBufferAttribute(p, i);
    b.fromBufferAttribute(p, j);
    c.fromBufferAttribute(p, k);
    const up = (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z);
    if (up >= 0) continue;
    if (tri) {
      tri[t + 1] = k;
      tri[t + 2] = j;
    } else
      for (const attr of Object.values(geo.attributes)) {
        for (let n = 0; n < attr.itemSize; n++) {
          const v = attr.getComponent(j, n);
          attr.setComponent(j, n, attr.getComponent(k, n));
          attr.setComponent(k, n, v);
        }
      }
  }
  geo.computeVertexNormals();
  return geo;
}

interface Side {
  /** points along an edge and the unit vector pointing away from the road */
  px: number[];
  py: number[];
  nx: number[];
  ny: number[];
}

/** A flat strip along an edge, from `from` to `to` metres outwards, at height h, coloured per segment. */
function edgeStrip(side: Side, from: number, to: number, h: number, colour: (k: number) => THREE.Color, keep: (k: number) => boolean): THREE.BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  for (let k = 0; k < side.px.length - 1; k++) {
    if (!keep(k)) continue;
    const a = (j: number, d: number) => toWorld(side.px[j] + side.nx[j] * d, side.py[j] + side.ny[j] * d, h);
    const p = [a(k, from), a(k, to), a(k + 1, to), a(k + 1, from)];
    for (const i of [0, 1, 2, 0, 2, 3]) pos.push(p[i].x, p[i].y, p[i].z);
    const c = colour(k);
    for (let i = 0; i < 6; i++) col.push(c.r, c.g, c.b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  return faceUp(geo);
}

export class CornerScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(58, 1, 0.1, 2500);
  private readonly car: THREE.Group;
  private readonly wheels: THREE.Object3D[];
  private readonly rainLight: THREE.Mesh;
  private readonly sun: THREE.DirectionalLight;
  private readonly camPos = new THREE.Vector3();
  private readonly camLook = new THREE.Vector3();
  private camReady = false;
  private wheelTurn = 0;
  private readonly disposables: { dispose(): void }[] = [];

  constructor(canvas: HTMLCanvasElement, c: CornerData, condition: Condition) {
    const wet = condition === "wet";
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = wet ? 0.9 : 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    const sky = new THREE.Color(wet ? "#8d969f" : "#a9c7e4");
    this.scene.background = sky;
    this.scene.fog = new THREE.Fog(sky, wet ? 90 : 180, wet ? 520 : 900);
    this.scene.add(new THREE.HemisphereLight(wet ? "#c9d0d6" : "#dcebff", "#3d5a2a", wet ? 1.4 : 1.1));
    this.sun = new THREE.DirectionalLight(wet ? "#e8edf2" : "#fff3e0", wet ? 0.9 : 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -40;
    sc.right = sc.top = 40;
    sc.near = 1;
    sc.far = 200;
    this.sun.shadow.bias = -0.0004;
    this.scene.add(this.sun, this.sun.target);

    // ---- the ground
    const grassTex = noiseTexture(wet ? [62, 92, 46] : [74, 118, 52], 26, 128, 220);
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 }));
    grass.rotation.x = -Math.PI / 2;
    grass.receiveShadow = true;
    this.scene.add(grass);
    this.track(grass.geometry, grass.material as THREE.Material, grassTex);

    // ---- the road from the real edges
    const n = c.s.length;
    const pos: number[] = [];
    const uv: number[] = [];
    for (let i = 0; i < n; i++) {
      const L = toWorld(c.lx[i], c.ly[i], 0.03);
      const R = toWorld(c.rx[i], c.ry[i], 0.03);
      pos.push(L.x, L.y, L.z, R.x, R.y, R.z);
      uv.push(0, c.s[i] / 4, 3, c.s[i] / 4);
    }
    const idx: number[] = [];
    for (let i = 0; i < n - 1; i++) idx.push(2 * i, 2 * i + 2, 2 * i + 1, 2 * i + 1, 2 * i + 2, 2 * i + 3);
    const roadGeo = new THREE.BufferGeometry();
    roadGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    roadGeo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    roadGeo.setIndex(idx);
    faceUp(roadGeo);
    const asphalt = noiseTexture(wet ? [52, 55, 60] : [66, 68, 72], 22, 256, 1);
    asphalt.repeat.set(1, 1);
    const roadMat = new THREE.MeshStandardMaterial({ map: asphalt, roughness: wet ? 0.5 : 0.9 });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.receiveShadow = true;
    this.scene.add(road);
    this.track(roadGeo, roadMat, asphalt);

    // ---- each side of the road: outward normals from the other edge
    const side = (ax: number[], ay: number[], bx: number[], by: number[]): Side => {
      const nx: number[] = [];
      const ny: number[] = [];
      for (let i = 0; i < n; i++) {
        const dx = ax[i] - bx[i];
        const dy = ay[i] - by[i];
        const d = Math.hypot(dx, dy) || 1;
        nx.push(dx / d);
        ny.push(dy / d);
      }
      return { px: ax, py: ay, nx, ny };
    };
    const left = side(c.lx, c.ly, c.rx, c.ry);
    const right = side(c.rx, c.ry, c.lx, c.ly);
    const kappa = c.conditions.dry.kappa;
    const vertexColours = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
    this.track(vertexColours);
    const white = new THREE.Color("#eeeeea");
    const red = new THREE.Color("#c8241c");
    const runoff = new THREE.Color(wet ? "#3b3e43" : "#55585d");
    const gravel = new THREE.Color("#b9a27a");
    // the corner bends towards one side: kerbs on both edges where it bites, gravel on the outside
    const bites = (k: number) => Math.abs(kappa[k]) > 1 / 300;
    for (const [sd, sign] of [
      [left, 1],
      [right, -1],
    ] as const) {
      // painted edge line just inside the road
      const line = new THREE.Mesh(edgeStrip(sd, -0.45, -0.25, 0.045, () => white, () => true), vertexColours);
      line.receiveShadow = true;
      // run-off: tarmac, and gravel beyond it where the corner pushes cars outwards (curvature away from this side)
      const outside = (k: number) => Math.sign(kappa[k]) === -sign && bites(k);
      const tarmac = new THREE.Mesh(edgeStrip(sd, 0, 7, 0.02, () => runoff, () => true), vertexColours);
      const trap = new THREE.Mesh(edgeStrip(sd, 7, 22, 0.015, () => gravel, outside), vertexColours);
      tarmac.receiveShadow = trap.receiveShadow = true;
      // kerbs: red and white blocks of 2.5 m where the corner bites
      const kerb = new THREE.Mesh(
        edgeStrip(sd, 0, 1.1, 0.06, (k) => (Math.floor(c.s[k] / 2.5) % 2 ? red : white), bites),
        vertexColours,
      );
      kerb.receiveShadow = true;
      this.scene.add(line, tarmac, trap, kerb);
      this.track(line.geometry, tarmac.geometry, trap.geometry, kerb.geometry);
      // barrier: a low wall beyond the run-off, blue and white
      const wallGeo = new THREE.BoxGeometry(1, 1, 1);
      const wallMat = new THREE.MeshStandardMaterial({ roughness: 0.6 });
      const walls = new THREE.InstancedMesh(wallGeo, wallMat, n);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const dist = (k: number) => (outside(k) ? 24 : 9);
      let count = 0;
      for (let k = 0; k < n - 1; k++) {
        const a = toWorld(sd.px[k] + sd.nx[k] * dist(k), sd.py[k] + sd.ny[k] * dist(k), 0.6);
        const b = toWorld(sd.px[k + 1] + sd.nx[k + 1] * dist(k + 1), sd.py[k + 1] + sd.ny[k + 1] * dist(k + 1), 0.6);
        const len = a.distanceTo(b);
        if (len < 0.01 || len > 20) continue;
        q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), b.clone().sub(a).normalize());
        m.compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(len + 0.05, 1.2, 0.8));
        walls.setMatrixAt(count, m);
        walls.setColorAt(count, Math.floor(c.s[k] / 4) % 2 ? new THREE.Color("#2152a8") : new THREE.Color("#e9ecef"));
        count++;
      }
      walls.count = count;
      walls.castShadow = walls.receiveShadow = true;
      this.scene.add(walls);
      this.track(wallGeo, wallMat);
    }

    // ---- braking boards before the corner, on its outside, counting down to the turn-in
    const ideal = idealCalls(c, "dry");
    const turnIn = ideal.releaseS;
    const boardSide = kappa[c.conditions.dry.apex] < 0 ? left : right;
    for (const d of [300, 200, 100, 50]) {
      const at = turnIn - d;
      const k = c.s.findIndex((s) => s >= at);
      if (k <= 0) continue;
      const tex = boardTexture(String(d));
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 });
      const board = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.5, 0.12), mat);
      const base = toWorld(boardSide.px[k] + boardSide.nx[k] * 3, boardSide.py[k] + boardSide.ny[k] * 3, 1.6);
      board.position.copy(base);
      // facing the oncoming cars
      const ahead = toWorld(c.x[Math.min(n - 1, k + 1)], c.y[Math.min(n - 1, k + 1)]).sub(toWorld(c.x[k], c.y[k]));
      board.rotation.y = Math.atan2(-ahead.x, -ahead.z);
      board.castShadow = true;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.9), new THREE.MeshStandardMaterial({ color: "#888" }));
      post.position.set(base.x, 0.45, base.z);
      this.scene.add(board, post);
      this.track(board.geometry, mat, tex, post.geometry, post.material as THREE.Material);
    }

    // ---- the car
    const built = buildCar();
    this.car = built.car;
    this.wheels = built.wheels;
    this.rainLight = built.rainLight;
    this.scene.add(this.car);
    this.track(built);
  }

  private track(...things: { dispose(): void }[]) {
    this.disposables.push(...things);
  }

  resize(width: number, height: number) {
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    // keep at least ~78° across, so a phone held upright still sees the corner coming
    const across = 2 * Math.atan(Math.tan((78 * Math.PI) / 360) / this.camera.aspect);
    this.camera.fov = Math.min(88, Math.max(58, (across * 180) / Math.PI));
    this.camera.updateProjectionMatrix();
  }

  /** Put the car where the run is and draw: pose on the line, speed (m/s), braking (rain light), and how far it has slid off (m). */
  render(pose: { x: number; y: number; heading: number }, speed: number, braking: boolean, slide = 0, dt = 1 / 60) {
    const dir = new THREE.Vector3(Math.cos(pose.heading), 0, -Math.sin(pose.heading));
    const sideways = new THREE.Vector3(dir.z, 0, -dir.x);
    const p = toWorld(pose.x, pose.y).addScaledVector(sideways, slide);
    this.car.position.copy(p);
    this.car.rotation.y = Math.atan2(-dir.x, -dir.z) + slide * 0.02;
    // wheels roll with the speed (radius 0.36 m)
    this.wheelTurn -= (speed * dt) / 0.36;
    for (const w of this.wheels) w.rotation.x = this.wheelTurn;
    (this.rainLight.material as THREE.MeshStandardMaterial).emissiveIntensity = braking ? 6 : 0.4;

    // chase camera: behind and above, looking down the road, eased so it swings smoothly through the corner
    // upright phones: a little higher and tilted down, so the road fills the view rather than the sky
    const tall = this.camera.aspect < 1;
    const wantPos = p.clone().addScaledVector(dir, tall ? -6.4 : -7.2).add(new THREE.Vector3(0, tall ? 3.1 : 2.3, 0));
    const wantLook = p.clone().addScaledVector(dir, tall ? 11 : 14).add(new THREE.Vector3(0, tall ? -0.4 : 0.6, 0));
    const ease = this.camReady ? 1 - Math.exp(-dt * 6) : 1;
    this.camPos.lerp(wantPos, ease);
    this.camLook.lerp(wantLook, ease);
    this.camReady = true;
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    // the sun's shadow box follows the car
    this.sun.position.copy(p).add(new THREE.Vector3(60, 90, 30));
    this.sun.target.position.copy(p);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    for (const d of this.disposables) d.dispose();
    this.renderer.dispose();
  }
}

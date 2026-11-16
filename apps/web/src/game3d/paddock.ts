import * as THREE from "three";

/**
 * An F1 pit garage round the car, built in code after photos of real ones (no team's marks copied): a white epoxy
 * floor polished like glass with the car's bay painted on it (a long outline in black with an inner line in the car's
 * paint, pointed towards the pit lane, the name in the middle), the red pit-lane line along the front, white walls with
 * a band of the paint at their foot, a beam over the opening in the paint with the number on it, a ceiling of square
 * light panels, workbenches with monitors at the back, and tyre sets on the softs, some in their blankets.
 * The car stands at the origin, nose to +z (towards the pit lane). setLook() repaints everything that wears the paint.
 * Cheap on purpose: no real-time shadows (a soft painted one under the car), few draw calls.
 */
export function buildPaddock() {
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => {
    disposables.push(x);
    return x;
  };
  const mat = (o: THREE.MeshStandardMaterialParameters) => keep(new THREE.MeshStandardMaterial(o));
  const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number) => {
    const b = new THREE.Mesh(keep(new THREE.BoxGeometry(w, h, d)), m);
    b.position.set(x, y, z);
    group.add(b);
    return b;
  };
  const canvasTex = (w: number, h: number) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const tex = keep(new THREE.CanvasTexture(c));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return { c, g: c.getContext("2d")!, tex };
  };
  const W = 3.8; // half the garage's width
  const BACK = -6.5;
  const FRONT = 4.2;
  const H = 3.4;

  // the floor: white epoxy with a clear coat, mirroring the light panels
  const floorMat = keep(new THREE.MeshPhysicalMaterial({ color: "#e4e6e8", roughness: 0.18, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04 }));
  const floor = new THREE.Mesh(keep(new THREE.PlaneGeometry(2 * W, FRONT - BACK + 2)), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = (FRONT + BACK) / 2 + 1;
  group.add(floor);

  // the bay painted on the floor, and the car's soft shadow on it
  const bay = canvasTex(512, 1024);
  const bayMesh = new THREE.Mesh(keep(new THREE.PlaneGeometry(3.6, 7.2)), keep(new THREE.MeshStandardMaterial({ map: bay.tex, transparent: true, roughness: 0.3 })));
  bayMesh.rotation.x = -Math.PI / 2;
  bayMesh.position.set(0, 0.003, 0.2);
  group.add(bayMesh);
  const shadow = canvasTex(256, 512);
  {
    const grd = shadow.g.createRadialGradient(128, 256, 10, 128, 256, 128);
    grd.addColorStop(0, "rgba(0,0,0,0.55)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    shadow.g.setTransform(1, 0, 0, 2, 0, -256);
    shadow.g.fillStyle = grd;
    shadow.g.fillRect(0, 0, 256, 1024);
  }
  const shadowMesh = new THREE.Mesh(keep(new THREE.PlaneGeometry(2.6, 6.4)), keep(new THREE.MeshBasicMaterial({ map: shadow.tex, transparent: true, depthWrite: false })));
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = 0.006;
  group.add(shadowMesh);

  // the pit-lane line along the front of the garage
  const lane = canvasTex(2048, 128);
  lane.g.fillStyle = "#d4131b";
  lane.g.fillRect(0, 0, 2048, 128);
  lane.g.fillStyle = "#ffffff";
  lane.g.font = "italic 900 84px Archivo, 'Arial Black', Arial, sans-serif";
  lane.g.textAlign = "center";
  lane.g.textBaseline = "middle";
  lane.g.translate(1024, 64);
  lane.g.rotate(Math.PI); // it reads from the pit lane, as on the real line
  lane.g.fillText("PIT-LANE", 0, 4);
  const laneMesh = new THREE.Mesh(keep(new THREE.PlaneGeometry(2 * W, 0.3)), keep(new THREE.MeshStandardMaterial({ map: lane.tex, roughness: 0.45 })));
  laneMesh.rotation.x = -Math.PI / 2;
  laneMesh.position.set(0, 0.004, FRONT);
  group.add(laneMesh);

  // the walls: white, a band of the paint at their foot, a dark recess of screens along the left
  const white = mat({ color: "#eceef0", roughness: 0.55 });
  const paintMat = mat({ color: "#ff6a13", roughness: 0.45 });
  box(0.1, H, FRONT - BACK, white, -W, H / 2, (FRONT + BACK) / 2);
  box(0.1, H, FRONT - BACK, white, W, H / 2, (FRONT + BACK) / 2);
  box(2 * W, H, 0.1, white, 0, H / 2, BACK);
  for (const x of [-W + 0.06, W - 0.06]) box(0.04, 0.22, FRONT - BACK, paintMat, x, 0.11, (FRONT + BACK) / 2);
  box(2 * W, 0.22, 0.04, paintMat, 0, 0.11, BACK + 0.06);
  const glass = mat({ color: "#0d0f12", roughness: 0.15, metalness: 0.2 });
  box(0.05, 0.9, 4.2, glass, -W + 0.08, 1.75, -1.4);

  // the beam over the opening, in the paint, carrying the number
  const beam = canvasTex(2048, 160);
  const beamMesh = new THREE.Mesh(keep(new THREE.BoxGeometry(2 * W, 0.42, 0.3)), [paintMat, paintMat, paintMat, paintMat, keep(new THREE.MeshStandardMaterial({ map: beam.tex, roughness: 0.45 })), paintMat]);
  beamMesh.position.set(0, H - 0.21, FRONT - 0.15);
  group.add(beamMesh);
  // the ceiling and its square light panels
  box(2 * W, 0.06, FRONT - BACK, mat({ color: "#2a2d32", roughness: 0.8 }), 0, H, (FRONT + BACK) / 2);
  const panel = mat({ color: "#ffffff", emissive: "#fffaf2", emissiveIntensity: 2.6 });
  for (let z = BACK + 1; z < FRONT - 0.6; z += 1.5) for (const x of [-2.2, 0, 2.2]) box(1.0, 0.03, 1.0, panel, x, H - 0.04, z);

  // workbenches with monitors along the back wall
  const bench = mat({ color: "#f4f5f6", roughness: 0.4 });
  const drawer = mat({ color: "#2b2f35", roughness: 0.5 });
  box(5.4, 0.95, 0.75, bench, -0.6, 0.475, BACK + 0.5);
  for (let k = 0; k < 6; k++) box(0.82, 0.03, 0.02, drawer, -3 + k * 0.9, 0.62, BACK + 0.88);
  const screen = canvasTex(512, 288);
  screen.g.fillStyle = "#06080b";
  screen.g.fillRect(0, 0, 512, 288);
  screen.g.lineWidth = 3;
  for (const [color, phase] of [
    ["#22d3d3", 0],
    ["#ffffff", 1.7],
    ["#a855f7", 3.1],
  ] as const) {
    screen.g.strokeStyle = color;
    screen.g.beginPath();
    for (let x = 0; x <= 512; x += 6) screen.g.lineTo(x, 144 + Math.sin(x / 38 + phase) * 52 * Math.cos(x / 130));
    screen.g.stroke();
  }
  const screenMat = keep(new THREE.MeshBasicMaterial({ map: screen.tex, toneMapped: false }));
  for (const x of [-2.4, -0.6, 1.2]) {
    box(1.2, 0.7, 0.05, drawer, x, 1.45, BACK + 0.32);
    const s = new THREE.Mesh(keep(new THREE.PlaneGeometry(1.1, 0.62)), screenMat);
    s.position.set(x, 1.45, BACK + 0.35);
    group.add(s);
  }

  // tyre sets on the softs, stacked four high, some in their blankets
  const rubber = mat({ color: "#141518", roughness: 0.85 });
  const soft = mat({ color: "#e8121b", roughness: 0.5 });
  const blanket = mat({ color: "#1c1f24", roughness: 0.9 });
  const tyre = keep(new THREE.CylinderGeometry(0.36, 0.36, 0.34, 28));
  const wrap = keep(new THREE.CylinderGeometry(0.378, 0.378, 0.27, 28, 1, true));
  const stripe = keep(new THREE.TorusGeometry(0.31, 0.014, 6, 32));
  for (const [x, z, wrapped] of [
    [2.95, -4.6, true],
    [2.95, -3.7, false],
    [2.95, -2.8, true],
  ] as const) {
    for (let k = 0; k < 4; k++) {
      const y = 0.17 + k * 0.35;
      const t = new THREE.Mesh(tyre, rubber);
      t.position.set(x, y, z);
      group.add(t);
      if (wrapped) {
        const b = new THREE.Mesh(wrap, blanket);
        b.position.set(x, y, z);
        group.add(b);
        // the blankets' band in the paint
        const s = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.381, 0.381, 0.05, 28, 1, true)), paintMat);
        s.position.set(x, y, z);
        group.add(s);
      } else {
        const s = new THREE.Mesh(stripe, soft);
        s.rotation.x = Math.PI / 2;
        s.position.set(x, y + 0.172, z);
        group.add(s);
      }
    }
  }

  let shown = "";
  return {
    group,
    /** everything that wears the car's paint: the wall bands, the beam, the blankets' bands, the bay's inner line */
    setLook(paint: string, number: number | null) {
      const key = `${paint}|${number}`;
      if (key === shown) return;
      shown = key;
      paintMat.color.set(paint);
      const c = new THREE.Color(paint);
      const ink = c.r * 0.299 + c.g * 0.587 + c.b * 0.114 > 0.55 ? "#141518" : "#ffffff";
      // the beam
      beam.g.fillStyle = paint;
      beam.g.fillRect(0, 0, 2048, 160);
      beam.g.fillStyle = ink;
      beam.g.font = "italic 900 92px Archivo, 'Arial Black', Arial, sans-serif";
      beam.g.textAlign = "center";
      beam.g.textBaseline = "middle";
      beam.g.fillText(number ? `LAPDLE  ·  ${number}` : "LAPDLE", 1024, 84);
      beam.tex.needsUpdate = true;
      // the bay: a long outline pointed at the pit lane, black outside and the paint inside, the name in the middle
      const g = bay.g;
      g.clearRect(0, 0, 512, 1024);
      const outline = (inset: number) => {
        g.beginPath();
        g.moveTo(40 + inset, 40 + inset);
        g.lineTo(472 - inset, 40 + inset);
        g.lineTo(472 - inset, 840 - inset * 0.6);
        g.lineTo(256, 990 - inset * 1.6);
        g.lineTo(40 + inset, 840 - inset * 0.6);
        g.closePath();
      };
      g.lineJoin = "miter";
      g.lineWidth = 46;
      g.strokeStyle = "#16171a";
      outline(0);
      g.stroke();
      g.lineWidth = 16;
      g.strokeStyle = paint;
      outline(34);
      g.stroke();
      g.fillStyle = "rgba(22,23,26,0.85)";
      g.font = "italic 900 64px Archivo, 'Arial Black', Arial, sans-serif";
      g.textAlign = "center";
      g.fillText("LAPDLE", 256, 660);
      bay.tex.needsUpdate = true;
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}

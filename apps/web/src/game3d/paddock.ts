import * as THREE from "three";

/**
 * An F1 pit garage round the car, built in code: a glossy grey epoxy floor with the box's painted lines, a back wall of
 * white panels with a band in the car's paint and its number big on it, strip lights overhead, tyre sets in their
 * blankets on racks to the sides, a tool trolley and a timing monitor. No team's livery or logos copied.
 * setLook() repaints the band and the wall number with the car.
 */
export function buildPaddock() {
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => {
    disposables.push(x);
    return x;
  };
  const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(keep(new THREE.BoxGeometry(w, h, d)), mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    return m;
  };

  // the floor: grey epoxy with a clear coat, reflecting the lights
  const floorMat = keep(new THREE.MeshPhysicalMaterial({ color: "#3d4147", roughness: 0.32, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08 }));
  const floor = new THREE.Mesh(keep(new THREE.PlaneGeometry(14, 12)), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);
  // the box's lines: white round the car's bay, yellow where the crew stands
  const lineMat = keep(new THREE.MeshStandardMaterial({ color: "#e9eae6", roughness: 0.5 }));
  const yellowMat = keep(new THREE.MeshStandardMaterial({ color: "#f2c21b", roughness: 0.5 }));
  const line = (w: number, d: number, x: number, z: number, mat: THREE.Material) => {
    const m = new THREE.Mesh(keep(new THREE.PlaneGeometry(w, d)), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.002, z);
    m.receiveShadow = true;
    group.add(m);
  };
  line(3.4, 0.07, 0, -3.4, lineMat);
  line(3.4, 0.07, 0, 3.4, lineMat);
  line(0.07, 6.8, -1.7, 0, lineMat);
  line(0.07, 6.8, 1.7, 0, lineMat);
  for (const x of [-2.4, 2.4]) line(0.05, 6.8, x, 0, yellowMat);

  // the back wall: white panels, a darker plinth, and a band in the car's paint carrying its number
  const wallMat = keep(new THREE.MeshStandardMaterial({ color: "#d9dce0", roughness: 0.7 }));
  const plinthMat = keep(new THREE.MeshStandardMaterial({ color: "#23262b", roughness: 0.6 }));
  for (let i = -3; i <= 3; i++) box(1.96, 3.6, 0.08, wallMat, i * 2, 1.8, -5.2);
  box(14, 0.5, 0.12, plinthMat, 0, 0.25, -5.13);
  const bandCanvas = document.createElement("canvas");
  bandCanvas.width = 2048;
  bandCanvas.height = 256;
  const bandTex = keep(new THREE.CanvasTexture(bandCanvas));
  bandTex.colorSpace = THREE.SRGBColorSpace;
  const bandMat = keep(new THREE.MeshStandardMaterial({ map: bandTex, roughness: 0.55 }));
  box(14, 0.9, 0.04, bandMat, 0, 2.3, -5.1);
  // the side walls, plain, so the room closes in the camera's view
  for (const x of [-6.6, 6.6]) {
    const side = box(0.08, 3.6, 10.4, wallMat, x, 1.8, 0);
    side.receiveShadow = true;
  }

  // strip lights overhead, and their glow
  const stripMat = keep(new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#fff6ea", emissiveIntensity: 3 }));
  for (const z of [-3, 0, 3]) {
    const s = new THREE.Mesh(keep(new THREE.BoxGeometry(5, 0.05, 0.25)), stripMat);
    s.position.set(0, 3.55, z);
    group.add(s);
  }

  // tyre sets in their blankets on two racks, four high
  const tyreMat = keep(new THREE.MeshStandardMaterial({ color: "#16171a", roughness: 0.85 }));
  const blanketMat = keep(new THREE.MeshStandardMaterial({ color: "#8f1d1d", roughness: 0.9 }));
  const bandYellow = keep(new THREE.MeshStandardMaterial({ color: "#f5c518", roughness: 0.6 }));
  const tyreGeo = keep(new THREE.CylinderGeometry(0.36, 0.36, 0.34, 28));
  const blanketGeo = keep(new THREE.CylinderGeometry(0.375, 0.375, 0.26, 28, 1, true));
  const stripeGeo = keep(new THREE.TorusGeometry(0.33, 0.012, 6, 32));
  for (const [x, z, wrapped] of [
    [-5.4, -2.2, true],
    [-5.4, -0.9, false],
    [5.4, -2.2, true],
    [5.4, -0.9, true],
  ] as const) {
    for (let k = 0; k < 4; k++) {
      const y = 0.17 + k * 0.35;
      const t = new THREE.Mesh(tyreGeo, tyreMat);
      t.position.set(x, y, z);
      t.castShadow = t.receiveShadow = true;
      group.add(t);
      if (wrapped) {
        const b = new THREE.Mesh(blanketGeo, blanketMat);
        b.position.set(x, y, z);
        group.add(b);
      } else {
        // the compound's band on the sidewall, seen on the bare set
        const s = new THREE.Mesh(stripeGeo, bandYellow);
        s.rotation.x = Math.PI / 2;
        s.position.set(x, y + 0.172, z);
        group.add(s);
      }
    }
  }

  // a tool trolley, drawers and all
  const trolleyMat = keep(new THREE.MeshStandardMaterial({ color: "#2b2f35", roughness: 0.45, metalness: 0.4 }));
  const handleMat = keep(new THREE.MeshStandardMaterial({ color: "#a7adb5", roughness: 0.3, metalness: 0.9 }));
  box(1.2, 1.0, 0.6, trolleyMat, -3.6, 0.55, -4.2);
  for (let k = 0; k < 4; k++) box(1.0, 0.02, 0.02, handleMat, -3.6, 0.25 + k * 0.22, -3.89);
  box(1.2, 0.04, 0.6, handleMat, -3.6, 1.07, -4.2);

  // a timing monitor on its stand, its screen lit with the lap's traces
  const screenCanvas = document.createElement("canvas");
  screenCanvas.width = 512;
  screenCanvas.height = 300;
  const sc = screenCanvas.getContext("2d")!;
  sc.fillStyle = "#07090c";
  sc.fillRect(0, 0, 512, 300);
  sc.lineWidth = 3;
  for (const [color, phase, amp] of [
    ["#22d3d3", 0, 60],
    ["#ff6a13", 1.7, 45],
    ["#a855f7", 3.1, 35],
  ] as const) {
    sc.strokeStyle = color;
    sc.beginPath();
    for (let x = 0; x <= 512; x += 6) {
      const y = 150 + Math.sin(x / 38 + phase) * amp * Math.cos(x / 120);
      if (x === 0) sc.moveTo(x, y);
      else sc.lineTo(x, y);
    }
    sc.stroke();
  }
  const screenTex = keep(new THREE.CanvasTexture(screenCanvas));
  screenTex.colorSpace = THREE.SRGBColorSpace;
  box(0.08, 1.4, 0.08, handleMat, 3.6, 0.7, -4.3);
  box(1.1, 0.68, 0.06, trolleyMat, 3.6, 1.6, -4.3);
  const screen = new THREE.Mesh(keep(new THREE.PlaneGeometry(1.0, 0.58)), keep(new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false })));
  screen.position.set(3.6, 1.6, -4.26);
  group.add(screen);

  let shown = { paint: "", number: null as number | null };
  return {
    group,
    /** the band on the wall in the car's paint, with its number */
    setLook(paint: string, number: number | null) {
      if (paint === shown.paint && number === shown.number) return;
      shown = { paint, number };
      const g = bandCanvas.getContext("2d")!;
      g.fillStyle = paint;
      g.fillRect(0, 0, 2048, 256);
      g.fillStyle = "rgba(0,0,0,0.18)";
      g.fillRect(0, 200, 2048, 56);
      const c = new THREE.Color(paint);
      g.fillStyle = c.r * 0.299 + c.g * 0.587 + c.b * 0.114 > 0.55 ? "#141518" : "#f2f2ee";
      g.font = "italic 900 170px Archivo, system-ui, sans-serif";
      g.textBaseline = "middle";
      g.fillText(number ? String(number) : "", 940, 120);
      g.font = "italic 800 64px Archivo, system-ui, sans-serif";
      g.fillText("LAPDLE", 120, 110);
      bandTex.needsUpdate = true;
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}

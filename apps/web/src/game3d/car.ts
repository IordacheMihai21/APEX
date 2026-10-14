import * as THREE from "three";

/**
 * A generic open-wheel formula car, built from simple shapes: no real team's
 * car or livery. About 5.5 m long and 2 m wide, nose along local -z, wheels
 * of 0.36 m radius on the ground (y = 0). Lapdle's colours: a dark body with
 * a yellow stripe.
 */
export function buildCar() {
  const car = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const mat = (m: THREE.Material) => (mats.push(m), m);
  const body = mat(new THREE.MeshStandardMaterial({ color: "#1b1d22", roughness: 0.35, metalness: 0.3 }));
  const accent = mat(new THREE.MeshStandardMaterial({ color: "#f5c518", roughness: 0.4, metalness: 0.2 }));
  const carbon = mat(new THREE.MeshStandardMaterial({ color: "#0c0c0e", roughness: 0.55 }));
  const tyre = mat(new THREE.MeshStandardMaterial({ color: "#151515", roughness: 0.9 }));
  const rim = mat(new THREE.MeshStandardMaterial({ color: "#8a8f96", roughness: 0.3, metalness: 0.8 }));
  const helmetMat = mat(new THREE.MeshStandardMaterial({ color: "#f2f2f2", roughness: 0.25, metalness: 0.1 }));

  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = car) => {
    geos.push(geo);
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };

  // the tub: a tapered box from the cockpit back to the gearbox
  const tub = new THREE.BoxGeometry(0.85, 0.5, 2.6);
  add(tub, body, 0, 0.42, 0.3);
  // the nose: a long narrowing wedge down to the front wing
  const nose = new THREE.CylinderGeometry(0.12, 0.34, 1.9, 4, 1);
  nose.rotateY(Math.PI / 4);
  nose.rotateX(-Math.PI / 2);
  nose.scale(1.15, 0.7, 1);
  add(nose, body, 0, 0.36, -1.95);
  const stripe = new THREE.BoxGeometry(0.16, 0.02, 2.4);
  add(stripe, accent, 0, 0.68, -0.6);
  // sidepods, each side of the cockpit
  for (const sx of [-1, 1]) {
    const pod = new THREE.BoxGeometry(0.5, 0.42, 1.7);
    add(pod, body, sx * 0.62, 0.36, 0.45);
    const inlet = new THREE.BoxGeometry(0.46, 0.3, 0.05);
    add(inlet, carbon, sx * 0.62, 0.4, -0.42);
  }
  // engine cover and airbox behind the driver
  const cover = new THREE.CylinderGeometry(0.06, 0.32, 1.6, 4, 1);
  cover.rotateY(Math.PI / 4);
  cover.rotateX(Math.PI / 2);
  cover.scale(1, 1.3, 1);
  add(cover, body, 0, 0.78, 1.0);
  const airbox = new THREE.BoxGeometry(0.26, 0.3, 0.3);
  add(airbox, carbon, 0, 0.98, 0.25);
  // floor
  const floor = new THREE.BoxGeometry(1.5, 0.05, 3.2);
  add(floor, carbon, 0, 0.12, 0.35);

  // the driver: helmet in the cockpit, and the halo over it
  const helmet = new THREE.SphereGeometry(0.15, 20, 14);
  add(helmet, helmetMat, 0, 0.82, -0.2);
  const visor = new THREE.BoxGeometry(0.2, 0.05, 0.05);
  add(visor, carbon, 0, 0.84, -0.34);
  const halo = new THREE.TorusGeometry(0.3, 0.035, 8, 24, Math.PI);
  halo.rotateX(-Math.PI / 2);
  halo.scale(1, 1, 1.25);
  add(halo, carbon, 0, 0.92, -0.18);
  const pylon = new THREE.BoxGeometry(0.05, 0.28, 0.05);
  add(pylon, carbon, 0, 0.78, -0.58);

  // front wing: main plane, a flap and the endplates
  const fw = new THREE.BoxGeometry(1.9, 0.04, 0.45);
  add(fw, carbon, 0, 0.12, -2.85);
  const flap = new THREE.BoxGeometry(1.8, 0.03, 0.22);
  const flapMesh = add(flap, accent, 0, 0.2, -2.75);
  flapMesh.rotation.x = 0.35;
  for (const sx of [-1, 1]) {
    const ep = new THREE.BoxGeometry(0.03, 0.22, 0.55);
    add(ep, carbon, sx * 0.95, 0.18, -2.83);
  }
  // rear wing: two planes between endplates, on a pillar
  const rw = new THREE.BoxGeometry(1.0, 0.04, 0.38);
  add(rw, carbon, 0, 0.98, 2.3);
  const rwFlap = new THREE.BoxGeometry(1.0, 0.03, 0.2);
  const rwFlapMesh = add(rwFlap, accent, 0, 1.08, 2.42);
  rwFlapMesh.rotation.x = -0.4;
  for (const sx of [-1, 1]) {
    const ep = new THREE.BoxGeometry(0.03, 0.5, 0.6);
    add(ep, carbon, sx * 0.51, 0.88, 2.33);
  }
  const pillar = new THREE.BoxGeometry(0.06, 0.4, 0.1);
  add(pillar, carbon, 0, 0.72, 2.2);

  // the rain light, at the back under the wing: bright while braking
  const rainMat = mat(new THREE.MeshStandardMaterial({ color: "#300", emissive: "#ff2a1a", emissiveIntensity: 0.4 }));
  const rainGeo = new THREE.BoxGeometry(0.16, 0.08, 0.04);
  const rainLight = add(rainGeo, rainMat, 0, 0.5, 2.48);
  rainLight.castShadow = false;

  // wheels: fat tyres with a rim face, rear wider than front; suspension arms to the tub
  const wheels: THREE.Object3D[] = [];
  for (const [z, width] of [
    [-1.75, 0.32],
    [1.55, 0.4],
  ] as const) {
    for (const sx of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(sx * 0.82, 0.36, z);
      car.add(pivot);
      const t = new THREE.CylinderGeometry(0.36, 0.36, width, 28);
      t.rotateZ(Math.PI / 2);
      add(t, tyre, 0, 0, 0, pivot);
      const r = new THREE.CylinderGeometry(0.22, 0.22, width + 0.01, 10);
      r.rotateZ(Math.PI / 2);
      add(r, rim, 0, 0, 0, pivot);
      // a dark spoke so the roll shows
      const spoke = new THREE.BoxGeometry(width + 0.02, 0.05, 0.4);
      add(spoke, carbon, 0, 0, 0, pivot);
      wheels.push(pivot);
      for (const dy of [-0.08, 0.08]) {
        const arm = new THREE.CylinderGeometry(0.018, 0.018, 0.5, 6);
        arm.rotateZ(Math.PI / 2);
        add(arm, carbon, sx * 0.5, 0.36 + dy, z);
      }
    }
  }

  return {
    car,
    wheels,
    rainLight,
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
    },
  };
}

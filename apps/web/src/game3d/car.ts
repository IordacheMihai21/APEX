import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import carUrl from "./car.glb?url";

/**
 * The car: "F1 2026 concept (polygon model)" by Qvist_designs, CC BY 4.0
 * (credited on the Legal page and under the game), an original design with no
 * team or sponsor, painted in Lapdle's colours and cut down for phones by
 * tools/track-builder/src/build-car.ts. Nose along local -z, ground at y = 0,
 * four wheels about their hubs. The model loads separately; `ready` says when
 * it is in.
 */
export const CAR_CREDIT = {
  title: "F1 2026 concept (polygon model)",
  author: "Qvist_designs",
  url: "https://sketchfab.com/3d-models/f1-2026-concept-polygon-model-ea3bde709b1e4dc9b0ec8557d106ed42",
  license: "CC BY 4.0",
} as const;

export function buildCar() {
  const car = new THREE.Group();
  const wheels: THREE.Object3D[] = [];
  /** the front wheels, which also steer */
  const front: THREE.Object3D[] = [];
  const geos: THREE.BufferGeometry[] = [];
  const mats = new Set<THREE.Material>();

  // the rain light, at the back under the rear wing: bright while braking
  const rainMat = new THREE.MeshStandardMaterial({ color: "#300", emissive: "#ff2a1a", emissiveIntensity: 0.4 });
  const rainGeo = new THREE.BoxGeometry(0.14, 0.07, 0.03);
  const rainLight = new THREE.Mesh(rainGeo, rainMat);
  rainLight.position.set(0, 0.42, 2.36);
  car.add(rainLight);
  geos.push(rainGeo);
  mats.add(rainMat);

  let disposed = false;
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const ready = loader.loadAsync(carUrl).then((gltf) => {
    if (disposed) return;
    gltf.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        // the model has no normals: shade it smooth across curves and sharp at its edges
        const g = toCreasedNormals(o.geometry, (35 * Math.PI) / 180);
        o.geometry.dispose();
        o.geometry = g;
        geos.push(g);
        let m = o.material as THREE.MeshStandardMaterial;
        if (m.name === "paint") {
          // racing paint: a satin orange base under a glossy clear coat, so the sky slides over it like on a real car
          const paint = new THREE.MeshPhysicalMaterial({ name: "paint", color: m.color, metalness: 0.05, roughness: 0.5, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 0.55 });
          m.dispose();
          o.material = m = paint;
        } else {
          m.envMapIntensity = m.name === "rim" ? 0.9 : 0.4;
          if (m.name === "carbon") m.roughness = 0.55;
        }
        mats.add(m);
        o.castShadow = true;
        o.receiveShadow = true;
      }
      if (o.name.startsWith("wheel-")) {
        wheels.push(o);
        if (o.name.startsWith("wheel-F")) front.push(o);
        // roll about the hub, then steer about the vertical: steering is the outer turn
        o.rotation.order = "YXZ";
      }
    });
    car.add(gltf.scene);
  });

  return {
    car,
    wheels,
    front,
    rainLight,
    /** resolves once the model is in (the scene waits for it, so a run never starts without the car) */
    ready,
    dispose() {
      disposed = true;
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
    },
  };
}

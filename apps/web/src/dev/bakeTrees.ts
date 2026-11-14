/**
 * Dev page (dev/bake-trees.html): bakes the games' trees into impostor atlases. A scanned tree from Poly Haven (CC0,
 * hundreds of MB, millions of triangles) is lit as the circuit lights it (the day sun, the sky, its own shadows inside
 * the crown) and photographed with an orthographic camera from N x N directions over the upper hemisphere (a
 * hemi-octahedral grid). The frames go into one atlas, colour and alpha, that game3d/treeImpostors.ts draws on a
 * billboard turned to the camera: a forest that looks like the scanned trees from any side for two triangles a tree.
 *
 * window.bake(name, url, alphaUrl, alphaMaterial, frames, px, node?) resolves to { png, size, height, centreY }.
 * The models live outside the app (marketing/models/polyhaven, not in git); the runner serves them by routing
 * /ph/* to that folder (marketing/trailer-src/bake-trees.mjs).
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/** the circuit's day light (dev/circuit3d.ts): the sun's direction and colours */
export const BAKE_SUN = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 38), THREE.MathUtils.degToRad(215));

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.setClearColor(0x000000, 0);
document.body.append(renderer.domElement);

/** The direction (y up) at a point of the hemi-octahedral square, u and v in 0..1. */
export function hemiOctDir(u: number, v: number): THREE.Vector3 {
  const x = u * 2 - 1;
  const z = v * 2 - 1;
  const px = (x + z) / 2;
  const pz = (x - z) / 2;
  return new THREE.Vector3(px, 1 - Math.abs(px) - Math.abs(pz), pz).normalize();
}

async function bake(name: string, url: string, alphaUrl: string, alphaMaterial: string, frames: number, px: number, nodeName?: string) {
  const gltf = await new GLTFLoader().loadAsync(url);
  const alpha = await new THREE.TextureLoader().loadAsync(alphaUrl);
  alpha.colorSpace = THREE.NoColorSpace;
  alpha.flipY = false;
  const tree = new THREE.Group();
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    if (nodeName && !o.name.startsWith(nodeName) && !(o.parent && o.parent.name.startsWith(nodeName))) return;
    const m = o.clone();
    m.matrix.copy(o.matrixWorld);
    m.matrixAutoUpdate = false;
    // each variant stands at its own origin: the file lines them up 6 m apart along x
    if (nodeName) m.matrix.premultiply(new THREE.Matrix4().makeTranslation(-o.getWorldPosition(new THREE.Vector3()).x, 0, 0));
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats as THREE.MeshStandardMaterial[]) {
      if (mat.name === alphaMaterial) {
        mat.alphaMap = alpha;
        mat.transparent = false;
        mat.alphaTest = 0.5;
        mat.side = THREE.DoubleSide;
      }
      mat.envMapIntensity = 0.6;
    }
    m.castShadow = true;
    m.receiveShadow = true;
    tree.add(m);
  });
  const box = new THREE.Box3().setFromObject(tree);
  const centre = box.getCenter(new THREE.Vector3());
  const height = box.max.y - Math.max(0, box.min.y);
  // the billboard's half-size: the furthest point of the tree from its centre, so it fits every view and no more
  let r2 = 0;
  const v = new THREE.Vector3();
  tree.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const p = o.geometry.getAttribute("position");
    for (let k = 0; k < p.count; k += 3) {
      v.fromBufferAttribute(p, k).applyMatrix4(o.matrix);
      r2 = Math.max(r2, v.distanceToSquared(centre));
    }
  });
  const radius = Math.sqrt(r2) * 1.01;

  const scene = new THREE.Scene();
  scene.add(tree);
  scene.add(new THREE.HemisphereLight("#dce9f7", "#55603f", 1.1));
  const sun = new THREE.DirectionalLight("#fff1dc", 3.2);
  sun.position.copy(centre).addScaledVector(BAKE_SUN, radius * 3);
  sun.target.position.copy(centre);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -radius, right: radius, top: radius, bottom: -radius, near: 0.1, far: radius * 6 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);

  const size = frames * px;
  renderer.setSize(px, px);
  const atlas = document.createElement("canvas");
  atlas.width = atlas.height = size;
  const ctx = atlas.getContext("2d")!;
  const cam = new THREE.OrthographicCamera(-radius, radius, radius, -radius, 0.1, radius * 4);
  for (let j = 0; j < frames; j++)
    for (let i = 0; i < frames; i++) {
      const d = hemiOctDir(i / (frames - 1), j / (frames - 1));
      cam.position.copy(centre).addScaledVector(d, radius * 2);
      // up: the world's up, or north when looking straight down
      cam.up.set(0, 1, 0);
      if (Math.abs(d.y) > 0.999) cam.up.set(0, 0, -1);
      cam.lookAt(centre);
      renderer.render(scene, cam);
      ctx.drawImage(renderer.domElement, i * px, j * px);
    }
  return { name, png: atlas.toDataURL("image/png"), size, frames, height, centreY: centre.y - Math.max(0, box.min.y), radius };
}

(window as unknown as { bake: typeof bake }).bake = bake;
(window as unknown as { bakeReady: boolean }).bakeReady = true;

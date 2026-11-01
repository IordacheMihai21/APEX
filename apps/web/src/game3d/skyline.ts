import * as THREE from "three";

/**
 * The hills and mountains on the horizon, from the real skyline round the corner (game/skyline, built by
 * tools/track-builder/src/build-skyline.ts): two rings, the nearer hills in front of the far mountains, each a
 * silhouette at the right height in every direction. They stand far off, so they move with the camera like the sky,
 * lit by the sun from the side it shines on, and fade into the haze towards their foot and with distance, the far
 * ring more than the near one.
 */
export type SkylineData = { near: number[]; far: number[] };

const files = import.meta.glob<SkylineData>("../game/skyline/*.json", { import: "default" });
export async function loadSkyline(cornerId: string): Promise<SkylineData | null> {
  const load = files[`../game/skyline/${cornerId}.json`];
  return load ? load() : null;
}

/** where each ring stands (m): inside the sky (2000 m) and far beyond the ground the scene builds */
const RADIUS = { near: 1700, far: 1900 };
/** columns per degree of bearing, and how deep each column reaches below the horizon (hidden by the ground) */
const PER_DEG = 2;
const FOOT = -260;

type Tone = { base: string; haze: number };
const TONES: Record<"golden" | "wet", Record<"near" | "far", Tone>> = {
  golden: { near: { base: "#3f4b26", haze: 0.12 }, far: { base: "#6b6c58", haze: 0.42 } },
  wet: { near: { base: "#3f4a41", haze: 0.45 }, far: { base: "#717a83", haze: 0.7 } },
};

export function buildSkyline(data: SkylineData, opts: { wet: boolean; horizon: string; sunDir: THREE.Vector3 }): { group: THREE.Group; dispose(): void } {
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  // the far ring first, so the near hills draw over it
  for (const layer of ["far", "near"] as const) {
    const deg = data[layer].map((a) => a / 100);
    // nothing to see: a flat horizon (a few hundredths of a degree is the ground's own haze)
    if (Math.max(...deg) < 0.15) continue;
    const r = RADIUS[layer];
    const n = 360 * PER_DEG;
    // the angle at every column, between the measured degrees, with a little roughness on the near hills (woods on the
    // ridges) where there is a hill at all
    const angle = (k: number) => {
      const b = k / PER_DEG;
      const i = Math.floor(b);
      const f = b - i;
      const a = deg[i % 360] * (1 - f) + deg[(i + 1) % 360] * f;
      const rough = layer === "near" && a > 0.25 ? 0.035 * (Math.sin(k * 2.7) + 0.6 * Math.sin(k * 7.3 + 1.1)) : 0;
      return Math.max(-0.5, a + rough);
    };
    const pos: number[] = [];
    const normal: number[] = [];
    const crest: number[] = [];
    const index: number[] = [];
    for (let k = 0; k <= n; k++) {
      const b = (k / n) * Math.PI * 2;
      const out = new THREE.Vector3(Math.sin(b), 0, -Math.cos(b));
      const along = new THREE.Vector3(Math.cos(b), 0, Math.sin(b));
      const top = r * Math.tan((angle(k) * Math.PI) / 180);
      // the face looks back towards the camera, turned along the ridge by its slope (a peak's two sides catch the sun
      // differently) and tipped up a little
      const slope = ((angle(k + 1) - angle(k - 1)) * Math.PI) / 180 / ((2 * Math.PI) / n);
      const nv = out.clone().negate().addScaledVector(along, -slope * 4).add(new THREE.Vector3(0, 0.7, 0)).normalize();
      for (const y of [top, FOOT]) {
        pos.push(out.x * r, y, out.z * r);
        normal.push(nv.x, nv.y, nv.z);
        crest.push(Math.max(top, 1));
      }
      if (k < n) {
        const a = k * 2;
        index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(normal, 3));
    geo.setAttribute("crest", new THREE.Float32BufferAttribute(crest, 1));
    geo.setIndex(index);
    const tone = TONES[opts.wet ? "wet" : "golden"][layer];
    const mat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      fog: false,
      uniforms: {
        base: { value: new THREE.Color(tone.base) },
        horizon: { value: new THREE.Color(opts.horizon) },
        haze: { value: tone.haze },
        sun: { value: opts.sunDir.clone().normalize() },
        lit: { value: opts.wet ? 0.25 : 0.75 },
      },
      // the scene's depth buffer is logarithmic: the rings write the same kind of depth, or the sky draws over them
      vertexShader: `
        #include <common>
        #include <logdepthbuf_pars_vertex>
        attribute float crest;
        varying vec3 vNormal;
        varying float vUp;
        void main() {
          vNormal = normal;
          vUp = clamp(position.y / crest, 0.0, 1.0);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: `
        #include <logdepthbuf_pars_fragment>
        uniform vec3 base; uniform vec3 horizon; uniform float haze; uniform vec3 sun; uniform float lit;
        varying vec3 vNormal;
        varying float vUp;
        void main() {
          #include <logdepthbuf_fragment>
          float light = 0.62 + lit * max(dot(normalize(vNormal), sun), 0.0);
          vec3 c = base * light;
          // thicker haze towards the foot of the hills, where the air between is deepest
          float h = mix(min(1.0, haze + 0.5), haze, smoothstep(0.0, 0.45, vUp));
          gl_FragColor = vec4(mix(c, horizon, h), 1.0);
          #include <colorspace_fragment>
        }`,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = -1;
    group.add(mesh);
    disposables.push(geo, mat);
  }
  return { group, dispose: () => disposables.forEach((d) => d.dispose()) };
}

import * as THREE from "three";
import { asphalt, concrete, grass, gravel } from "../game/materials";

/**
 * Textures for the 3D corner. The surfaces reuse the satellite view's
 * procedural materials (tileable fractal noise, game/materials.ts); the rest
 * (kerbs, crowd, fence mesh, boards, windows) are small canvases drawn here.
 * Geometry carries UVs in metres, so `metres` is how much ground one tile covers.
 */
const tile = (c: HTMLCanvasElement, metres: number, srgb = true): THREE.CanvasTexture => {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / metres, 1 / metres);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
};

const draw = (w: number, h: number, paint: (g: CanvasRenderingContext2D) => void): HTMLCanvasElement => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  paint(c.getContext("2d")!);
  return c;
};

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function surfaceTextures(wet: boolean) {
  return {
    grass: tile(grass(41, wet), 22),
    asphalt: tile(asphalt([58, 60, 64], 51, wet), 7),
    runoff: tile(asphalt([82, 85, 90], 57, wet), 9),
    gravel: tile(gravel(61, wet), 5),
    concrete: tile(concrete([150, 148, 140], 71, 64), 12),
    paving: tile(concrete([96, 95, 90], 73, 48), 16),
  };
}

/** Kerb blocks: red and white, 2.5 m each, with a worn, rubbered look and ridges across. */
export function kerbTexture(): THREE.CanvasTexture {
  const c = draw(128, 64, (g) => {
    const r = rng(5);
    for (const [x, col] of [
      [0, "#c8241c"],
      [64, "#d8d7d0"],
    ] as const) {
      g.fillStyle = col;
      g.fillRect(x, 0, 64, 64);
    }
    // ridges across the kerb, and grime
    for (let x = 0; x < 128; x += 8) {
      g.fillStyle = "rgba(0,0,0,0.13)";
      g.fillRect(x, 0, 2, 64);
    }
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(20,20,20,${r() * 0.12})`;
      g.fillRect(r() * 128, r() * 64, 1 + r() * 3, 1 + r() * 2);
    }
  });
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** A soft band across (u 0..1): the rubbered racing line and tyre marks, darkest in the middle. */
export function bandAlpha(): THREE.CanvasTexture {
  const c = draw(64, 4, (g) => {
    const grad = g.createLinearGradient(0, 0, 64, 0);
    grad.addColorStop(0, "#000");
    grad.addColorStop(0.3, "#9a9a9a");
    grad.addColorStop(0.5, "#fff");
    grad.addColorStop(0.7, "#9a9a9a");
    grad.addColorStop(1, "#000");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 4);
  });
  return new THREE.CanvasTexture(c);
}

/** Debris fence: a fine diamond wire mesh (alpha), tiling every 30 cm. */
export function fenceAlpha(): THREE.CanvasTexture {
  const c = draw(64, 64, (g) => {
    g.fillStyle = "#000";
    g.fillRect(0, 0, 64, 64);
    g.strokeStyle = "#fff";
    g.lineWidth = 2;
    g.beginPath();
    for (let i = -64; i <= 64; i += 32) {
      g.moveTo(i, 0);
      g.lineTo(i + 64, 64);
      g.moveTo(i + 64, 0);
      g.lineTo(i, 64);
    }
    g.stroke();
  });
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / 0.3, 1 / 0.3);
  return t;
}

/** A grandstand full of people: rows of seats, a dot of colour for each fan. */
export function crowdTexture(): THREE.CanvasTexture {
  const c = draw(256, 256, (g) => {
    const r = rng(11);
    g.fillStyle = "#4a4f57";
    g.fillRect(0, 0, 256, 256);
    const shirts = ["#e9e6df", "#c8241c", "#1d3f86", "#f2c500", "#ff6a13", "#1b1b1b", "#3f8a3c", "#8a8f99", "#d8d2c4", "#7a1f1f"];
    for (let y = 0; y < 256; y += 8) {
      g.fillStyle = "rgba(0,0,0,0.35)";
      g.fillRect(0, y + 6, 256, 2);
      for (let x = 0; x < 256; x += 5) {
        if (r() < 0.12) continue; // an empty seat
        g.fillStyle = shirts[Math.floor(r() * shirts.length)];
        g.fillRect(x + r(), y + 1.5, 3.5, 4);
        g.fillStyle = r() < 0.5 ? "#e0b48f" : "#8a5a3c";
        g.fillRect(x + 0.8, y, 2.4, 2);
      }
    }
  });
  return tile(c, 14);
}

/** Office and house walls: storeys of windows in a pale render, tinted per building by the material's colour. */
export function windowsTexture(): THREE.CanvasTexture {
  const c = draw(128, 128, (g) => {
    const r = rng(17);
    g.fillStyle = "#f4f1ea";
    g.fillRect(0, 0, 128, 128);
    for (let y = 10; y < 128; y += 32)
      for (let x = 6; x < 128; x += 21) {
        g.fillStyle = r() < 0.3 ? "#6f7d88" : "#46525c";
        g.fillRect(x, y, 11, 15);
        g.fillStyle = "rgba(0,0,0,0.12)";
        g.fillRect(x - 1, y + 15, 13, 2);
      }
  });
  return tile(c, 12);
}

/** Trackside boards: Lapdle's own, dark with the orange name, and white with the address. */
export function boardTextures(): THREE.CanvasTexture[] {
  const make = (bg: string, fg: string, text: string, size: number) => {
    const c = draw(512, 96, (g) => {
      g.fillStyle = bg;
      g.fillRect(0, 0, 512, 96);
      g.fillStyle = fg;
      g.font = `900 ${size}px Archivo, Arial, sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(text, 256, 52);
    });
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  };
  return [make("#0a0b0d", "#ff6a13", "LAPDLE", 74), make("#f2f2ee", "#0a0b0d", "lapdle.com", 64), make("#ff6a13", "#0a0b0d", "LAPDLE", 74)];
}

/** A braking board: the distance in big black numbers on white, with a red border. */
export function distanceBoard(label: string): THREE.CanvasTexture {
  const c = draw(256, 160, (g) => {
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
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** The leaves of a tree crown: dappled greens, lit at the top. */
export function leavesTexture(hue: "broad" | "conifer" | "palm", wet: boolean): THREE.CanvasTexture {
  const base = { broad: [62, 96, 44], conifer: [38, 66, 40], palm: [78, 108, 52] }[hue];
  const k = wet ? 0.8 : 1;
  const c = draw(128, 128, (g) => {
    const r = rng(hue.length * 31);
    g.fillStyle = `rgb(${base.map((v) => v * k).join(",")})`;
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 1400; i++) {
      const l = (r() - 0.45) * 46;
      g.fillStyle = `rgb(${base.map((v) => Math.max(0, (v + l) * k)).join(",")})`;
      g.beginPath();
      g.arc(r() * 128, r() * 128, 1.5 + r() * 3.5, 0, Math.PI * 2);
      g.fill();
    }
  });
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// n8ao ships no type declarations: the parts the corner scene uses.
declare module "n8ao" {
  import type { Camera, Scene } from "three";
  import type { Pass } from "postprocessing";

  export class N8AOPostPass extends Pass {
    constructor(scene: Scene, camera: Camera, width?: number, height?: number);
    configuration: {
      aoRadius: number;
      distanceFalloff: number;
      intensity: number;
      halfRes: boolean;
      gammaCorrection: boolean;
      [key: string]: unknown;
    };
    setQualityMode(mode: "Performance" | "Low" | "Medium" | "High" | "Ultra"): void;
    setSize(width: number, height: number): void;
  }
}

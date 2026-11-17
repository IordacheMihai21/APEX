import { bakedMaterialJobs, sharedBakedMaterialJobs } from "./materials";

const pending = new Map<string, Promise<void>>();

async function load(name: string, put: (canvas: HTMLCanvasElement) => void) {
  const url = `${import.meta.env.BASE_URL}materials/${name}.webp`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Material ${name}: ${response.status}`);
  const blob = await response.blob();
  let source: ImageBitmap | HTMLImageElement;
  if (typeof createImageBitmap === "function") {
    try {
      source = await createImageBitmap(blob);
    } catch {
      source = await imageFromBlob(blob);
    }
  } else {
    source = await imageFromBlob(blob);
  }
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  canvas.getContext("2d")!.drawImage(source, 0, 0);
  if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap) source.close();
  put(canvas);
}

async function imageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Decode off the main thread and seed the same canvases used by map and 3D. */
export async function loadBakedMaterials(trackId: string, wet: boolean) {
  const jobs = [...bakedMaterialJobs(wet), ...sharedBakedMaterialJobs()].filter((job) =>
    trackId === "monaco" ? job.name !== "water-dry" : job.name !== "water-monaco",
  );
  await Promise.all(jobs.map((job) => {
    let task = pending.get(job.name);
    if (!task) {
      task = load(job.name, job.put).catch(() => {
        // A missing image is harmless: its memoised procedural generator remains available.
      });
      pending.set(job.name, task);
    }
    return task;
  }));
}

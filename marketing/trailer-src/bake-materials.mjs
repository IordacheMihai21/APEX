// Run with the web Vite dev server at http://127.0.0.1:5173.
// Keeps the checked-in images in sync with the deterministic canvas generators.
import { chromium } from "playwright-core";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const output = fileURLToPath(new URL("../../apps/web/public/materials/", import.meta.url));
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:5173/");
  await mkdir(output, { recursive: true });
  const names = await page.evaluate(async () => {
    const m = await import("/src/game/materials.ts");
    return [...m.bakedMaterialJobs(false), ...m.bakedMaterialJobs(true), ...m.sharedBakedMaterialJobs()].map((job) => job.name);
  });
  for (const name of names) {
    const data = await page.evaluate(async (target) => {
      const m = await import("/src/game/materials.ts");
      const job = [...m.bakedMaterialJobs(false), ...m.bakedMaterialJobs(true), ...m.sharedBakedMaterialJobs()].find((x) => x.name === target);
      if (!job) throw new Error(`Unknown material: ${target}`);
      return job.make().toDataURL("image/webp", 0.9).split(",")[1];
    }, name);
    await writeFile(new URL(`../../apps/web/public/materials/${name}.webp`, import.meta.url), Buffer.from(data, "base64"));
    process.stdout.write(`${name}\n`);
  }
} finally {
  await browser.close();
}

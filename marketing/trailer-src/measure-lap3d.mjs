// Run against `npx vite preview --host 127.0.0.1 --port 4173` from apps/web.
// Measures the first lap on a phone-sized viewport with 6x CPU slowdown.
import { chromium } from "playwright-core";

const CHROME = process.env.CHROME ?? "/Users/mi/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const track = process.argv[2] ?? "spa";
const browser = await chromium.launch({ executablePath: CHROME, headless: false });
try {
  const context = await browser.newContext({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true });
  await context.addInitScript(() => {
    localStorage.setItem("apex.lap3d", "1");
    window.__longTasks = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__longTasks.push(Math.round(entry.duration));
    }).observe({ type: "longtask", buffered: true });
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: Number(process.env.CPU ?? 6) });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${process.env.BASE ?? "http://127.0.0.1:4173"}/?play=practice&track=${track}`);
  const button = page.getByRole("button", { name: "Lights out" }).first();
  await button.waitFor({ timeout: 60000 });
  await button.click();
  const clickedAt = Date.now();
  let visible = false;
  try {
    await page.waitForFunction(() => {
      const canvas = document.querySelector('canvas[aria-label="The lap in 3D"]');
      return canvas && getComputedStyle(canvas.parentElement).visibility === "visible";
    }, null, { timeout: 30000 });
    visible = true;
  } catch { /* the map remains usable if 3D does not become ready */ }
  const readyMs = Date.now() - clickedAt;
  const result = await page.evaluate(async (visible) => {
    const frames = [];
    if (visible) {
      await new Promise((resolve) => {
        let start = 0;
        let last = 0;
        const tick = (time) => {
          if (!start) start = time;
          if (last) frames.push(time - last);
          last = time;
          if (time - start < 5000) requestAnimationFrame(tick);
          else resolve();
        };
        requestAnimationFrame(tick);
      });
    }
    frames.sort((a, b) => a - b);
    return {
      fps: frames.length ? Math.round(frames.length / 5) : 0,
      p95FrameMs: frames.length ? Math.round(frames[Math.floor(frames.length * 0.95)]) : null,
      longTasks: window.__longTasks.filter((ms) => ms > 50),
    };
  }, visible);
  console.log(JSON.stringify({ track, visible, readyMs, ...result, errors }));
} finally {
  await browser.close();
}

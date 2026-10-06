// Writes a static HTML page for every content route (How to play, About):
// dist/index.html with that page's title, description, canonical and preview
// tags, and its rendered markup inside #root. Run after `vite build` and
// `vite build --ssr src/ssg/entry.tsx --outDir dist-ssr` (see package.json).
// Cloudflare Pages serves dist/about.html at /about and
// dist/how-to-play/mystery.html at /how-to-play/mystery.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
const ssr = resolve(root, "dist-ssr");
const { routes, render } = await import(pathToFileURL(resolve(ssr, "entry.js")).href);

const template = readFileSync(resolve(dist, "index.html"), "utf8");
const attr = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const text = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** Replace one tag's attribute value, and fail loudly if the template no longer has that tag. */
function set(html, pattern, value) {
  if (!pattern.test(html)) throw new Error(`prerender: index.html lost ${pattern}`);
  return html.replace(pattern, (_, head) => `${head}${value}`);
}

for (const route of routes) {
  const { html, title, description } = render(route);
  const url = `https://lapdle.com${route}`;
  let page = template.replace(/<title>[^<]*<\/title>/, `<title>${text(title)}</title>`);
  page = set(page, /(<meta name="description" content=")[^"]*/, attr(description));
  page = set(page, /(<link rel="canonical" href=")[^"]*/, url);
  page = set(page, /(<meta property="og:url" content=")[^"]*/, url);
  page = set(page, /(<meta property="og:title" content=")[^"]*/, attr(title));
  page = set(page, /(<meta property="og:description" content=")[^"]*/, attr(description));
  page = set(page, /(<meta name="twitter:title" content=")[^"]*/, attr(title));
  page = set(page, /(<meta name="twitter:description" content=")[^"]*/, attr(description));
  if (!page.includes('<div id="root"></div>')) throw new Error("prerender: index.html lost its empty #root");
  page = page.replace('<div id="root"></div>', `<div id="root">${html}</div>`);

  const file = resolve(dist, `.${route}.html`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, page);
  console.log(`prerendered ${route}`);
}

rmSync(ssr, { recursive: true, force: true });

// Writes a static HTML page for every content route (How to play, About) and
// every page of the app itself (hub, games, archive…, see src/content/Landing.tsx):
// dist/index.html with that page's title, description, canonical and preview
// tags, and its rendered markup inside #root. The hub's text goes into
// dist/index.html itself, which keeps its own title and description. Run after `vite build` and
// `vite build --ssr src/ssg/entry.tsx --outDir dist-ssr` (see package.json).
// Cloudflare Pages serves dist/about.html at /about and
// dist/how-to-play/mystery.html at /how-to-play/mystery.
//
// Every page with a Spanish version (all but the circuit guides, trivia and About)
// is written a second time under /es, rendered in Spanish (dist/es.html is /es,
// dist/es/mystery.html is /es/mystery), and both versions name each other with
// hreflang links. The Spanish pass loads its own copy of the bundle, with the
// language set before it loads (the bundle reads it once, see src/i18n.ts).
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
const ssr = resolve(root, "dist-ssr");
const entry = pathToFileURL(resolve(ssr, "entry.js")).href;
const en = await import(entry);
globalThis.__LAPDLE_LANG__ = "es";
const es = await import(`${entry}?lang=es`);
delete globalThis.__LAPDLE_LANG__;

const template = readFileSync(resolve(dist, "index.html"), "utf8");
const attr = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const text = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** Replace one tag's attribute value, and fail loudly if the template no longer has that tag. */
function set(html, pattern, value) {
  if (!pattern.test(html)) throw new Error(`prerender: index.html lost ${pattern}`);
  return html.replace(pattern, (_, head) => `${head}${value}`);
}

const site = "https://lapdle.com";
const esPath = (route) => (route === "/" ? "/es" : `/es${route}`);
/** The hreflang links for a page that has both languages. */
const alternates = (route) =>
  [`<link rel="alternate" hreflang="en" href="${site}${route}" />`, `<link rel="alternate" hreflang="es" href="${site}${esPath(route)}" />`, `<link rel="alternate" hreflang="x-default" href="${site}${route}" />`].join("\n    ");

const pages = (b) => [...b.routes.map((route) => [route, b.render]), ...b.landingRoutes.map((route) => [route, b.renderLanding])];
const jobs = [
  ...pages(en).map(([route, renderPage]) => ({ route, path: route, lang: "en", renderPage })),
  ...pages(es)
    .filter(([route]) => es.hasSpanish(route))
    .map(([route, renderPage]) => ({ route, path: esPath(route), lang: "es", renderPage })),
];
for (const { route, path, lang, renderPage } of jobs) {
  const { html, title, description } = renderPage(route);
  const url = `${site}${path}`;
  let page = template;
  if (path !== "/") {
    page = page.replace(/<title>[^<]*<\/title>/, `<title>${text(title)}</title>`);
    page = set(page, /(<meta name="description" content=")[^"]*/, attr(description));
    page = set(page, /(<link rel="canonical" href=")[^"]*/, url);
    page = set(page, /(<meta property="og:url" content=")[^"]*/, url);
    page = set(page, /(<meta property="og:title" content=")[^"]*/, attr(title));
    page = set(page, /(<meta property="og:description" content=")[^"]*/, attr(description));
    page = set(page, /(<meta name="twitter:title" content=")[^"]*/, attr(title));
    page = set(page, /(<meta name="twitter:description" content=")[^"]*/, attr(description));
  }
  if (lang === "es") {
    page = set(page, /(<html lang=")[^"]*/, "es");
    page = set(page, /(<meta property="og:locale" content=")[^"]*/, "es_ES");
  }
  if (en.hasSpanish(route)) page = page.replace("</head>", `    ${alternates(route)}\n  </head>`);
  if (!page.includes('<div id="root"></div>')) throw new Error("prerender: index.html lost its empty #root");
  page = page.replace('<div id="root"></div>', `<div id="root">${html}</div>`);

  const file = resolve(dist, path === "/" ? "index.html" : `.${path}.html`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, page);
  console.log(`prerendered ${path}`);
}

rmSync(ssr, { recursive: true, force: true });

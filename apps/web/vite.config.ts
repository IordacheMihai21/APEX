import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * Build-time additions to the static SEO in index.html and public/
 * (robots.txt, sitemap.xml): a preload for the display font, and AdSense
 * (account tag, script, ads.txt) from VITE_ADSENSE_CLIENT (ca-pub-… becomes pub-…).
 */
function launchFiles(env: Record<string, string>): Plugin {
  const client = env.VITE_ADSENSE_CLIENT ?? "";
  return {
    name: "apex-launch-files",
    transformIndexHtml(html, ctx) {
      // the display font is found only once the CSS loads: preload the Latin cut so text paints sooner
      const font = Object.keys(ctx.bundle ?? {}).find((f) => /archivo-latin-wdth-normal-.*\.woff2$/.test(f));
      const preload = font ? `<link rel="preload" href="/${font}" as="font" type="font/woff2" crossorigin />` : "";
      const tags = [
        preload,
        // AdSense: the account tag (site verification) and Google's script, which also runs
        // the consent message; it shows no ads by itself, only the ad units in the page do
        client && `<meta name="google-adsense-account" content="${client}" />`,
        client && `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}" crossorigin="anonymous"></script>`,
      ].filter(Boolean);
      return html.replace("</head>", `    ${tags.join("\n    ")}\n  </head>`);
    },
    generateBundle() {
      if (client) this.emitFile({ type: "asset", fileName: "ads.txt", source: `google.com, ${client.replace(/^ca-/, "")}, DIRECT, f08c47fec0942fa0\n` });
    },
  };
}

/**
 * The service worker's precache: every file of the app's code (scripts, styles,
 * the Latin fonts, the small circuit maps) is fetched when the app installs, so
 * every game opens offline. Circuit data (tracks and scenery, ~1.5 MB) stays
 * cached on first use. The list and a build id are written into dist/sw.js, so
 * each deploy is a new service worker that refreshes the code.
 */
function precache(): Plugin {
  let files: string[] = [];
  let ssr = false;
  let out = "";
  return {
    name: "apex-precache",
    apply: "build",
    configResolved(config) {
      ssr = !!config.build.ssr;
      out = resolve(config.root, config.build.outDir);
    },
    generateBundle(_, bundle) {
      if (ssr) return;
      const heavy = (ids: string[]) => ids.some((id) => /\/data\/(tracks|scenery)\//.test(id));
      files = Object.values(bundle)
        .filter((f) => (f.type === "chunk" ? !heavy(f.moduleIds) : /\.(css|js)$|latin-(ext-)?wdth.*\.woff2$/.test(f.fileName)))
        .map((f) => `/${f.fileName}`)
        .sort();
    },
    closeBundle() {
      if (ssr || !files.length) return;
      const sw = resolve(out, "sw.js");
      const src = readFileSync(sw, "utf8");
      const build = createHash("sha256").update(files.join("\n")).digest("hex").slice(0, 10);
      if (!src.includes('const BUILD = "dev";') || !src.includes("const PRECACHE = [];")) throw new Error("precache: sw.js lost its placeholders");
      writeFileSync(sw, src.replace('const BUILD = "dev";', `const BUILD = "${build}";`).replace("const PRECACHE = [];", `const PRECACHE = ${JSON.stringify(files)};`));
    },
  };
}

/** lapdle.com's AdSense publisher ID: public (it is in ads.txt and every ad), so it lives here. */
const ADSENSE_PUBLISHER = "ca-pub-2515595867377612";
/** lapdle.com's Plausible site and its own script: public too (every visitor's browser loads it). */
const PLAUSIBLE_DOMAIN = "lapdle.com";
const PLAUSIBLE_SRC = "https://plausible.io/js/pa-KS7GUtru6oEsZyJ5DKZDM.js";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  // production builds carry the publisher ID unless the host sets another; dev never loads ads
  if (mode === "production" && !env.VITE_ADSENSE_CLIENT) env.VITE_ADSENSE_CLIENT = ADSENSE_PUBLISHER;
  // production builds count visits with lapdle.com's Plausible site unless the host sets another
  if (mode === "production" && !env.VITE_PLAUSIBLE_DOMAIN) {
    env.VITE_PLAUSIBLE_DOMAIN = PLAUSIBLE_DOMAIN;
    env.VITE_PLAUSIBLE_SRC ||= PLAUSIBLE_SRC;
  }
  return {
    plugins: [react(), tailwindcss(), launchFiles(env), precache()],
    define: {
      "import.meta.env.VITE_ADSENSE_CLIENT": JSON.stringify(env.VITE_ADSENSE_CLIENT ?? ""),
      "import.meta.env.VITE_PLAUSIBLE_DOMAIN": JSON.stringify(env.VITE_PLAUSIBLE_DOMAIN ?? ""),
      "import.meta.env.VITE_PLAUSIBLE_SRC": JSON.stringify(env.VITE_PLAUSIBLE_SRC ?? ""),
    },
    // Track JSON lives in the repo-level data/ folder.
    server: { fs: { allow: ["../.."] }, port: 5173 },
  };
});

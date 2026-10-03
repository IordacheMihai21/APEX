import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/** Every page a visitor can land on; the SPA serves them all from index.html. */
const ROUTES = ["/", "/corner", "/archive", "/mystery", "/higher-lower", "/pit-stop", "/reaction", "/privacy"];

/**
 * Launch files, driven by env vars (see .env.example):
 * - link previews (Open Graph / Twitter card) in index.html, with absolute URLs
 *   once VITE_SITE_URL is set;
 * - robots.txt and sitemap.xml (sitemap only with VITE_SITE_URL);
 * - ads.txt from VITE_ADSENSE_CLIENT (ca-pub-… becomes pub-…).
 */
function launchFiles(env: Record<string, string>): Plugin {
  const site = (env.VITE_SITE_URL ?? "").replace(/\/$/, "");
  const abs = (path: string) => (site ? `${site}${path}` : path);
  return {
    name: "apex-launch-files",
    transformIndexHtml(html, ctx) {
      // the display font is found only once the CSS loads: preload the Latin cut so text paints sooner
      const font = Object.keys(ctx.bundle ?? {}).find((f) => /archivo-latin-wdth-normal-.*\.woff2$/.test(f));
      const preload = font ? `<link rel="preload" href="/${font}" as="font" type="font/woff2" crossorigin />` : "";
      const title = "APEX: find the perfect lap";
      const description = "A daily racing-line game on real circuits. Set your line corner by corner, race the lap, earn a medal, chase the perfect time.";
      const tags = [
        preload,
        site && `<link rel="canonical" href="${site}/" />`,
        `<meta property="og:type" content="website" />`,
        `<meta property="og:site_name" content="APEX" />`,
        `<meta property="og:title" content="${title}" />`,
        `<meta property="og:description" content="${description}" />`,
        site && `<meta property="og:url" content="${site}/" />`,
        `<meta property="og:image" content="${abs("/og.png")}" />`,
        `<meta property="og:image:width" content="1200" />`,
        `<meta property="og:image:height" content="630" />`,
        `<meta property="og:image:alt" content="APEX: a circuit drawn as a timing map, with the lap painted in sector colours" />`,
        `<meta name="twitter:card" content="summary_large_image" />`,
        `<meta name="twitter:title" content="${title}" />`,
        `<meta name="twitter:description" content="${description}" />`,
        `<meta name="twitter:image" content="${abs("/og.png")}" />`,
      ].filter(Boolean);
      return html.replace("</head>", `    ${tags.join("\n    ")}\n  </head>`);
    },
    generateBundle() {
      const robots = ["User-agent: *", "Allow: /", site ? `Sitemap: ${site}/sitemap.xml` : ""].filter(Boolean).join("\n");
      this.emitFile({ type: "asset", fileName: "robots.txt", source: robots + "\n" });
      if (site) {
        const urls = ROUTES.map((r) => `  <url><loc>${site}${r}</loc><changefreq>${r === "/" || r === "/mystery" || r === "/pit-stop" ? "daily" : "weekly"}</changefreq></url>`);
        this.emitFile({
          type: "asset",
          fileName: "sitemap.xml",
          source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`,
        });
      }
      const client = env.VITE_ADSENSE_CLIENT ?? "";
      if (client) this.emitFile({ type: "asset", fileName: "ads.txt", source: `google.com, ${client.replace(/^ca-/, "")}, DIRECT, f08c47fec0942fa0\n` });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  return {
    plugins: [react(), tailwindcss(), launchFiles(env)],
    // Track JSON lives in the repo-level data/ folder.
    server: { fs: { allow: ["../.."] }, port: 5173 },
  };
});

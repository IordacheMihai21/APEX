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

/** lapdle.com's AdSense publisher ID: public (it is in ads.txt and every ad), so it lives here. */
const ADSENSE_PUBLISHER = "ca-pub-2515595867377612";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  // production builds carry the publisher ID unless the host sets another; dev never loads ads
  if (mode === "production" && !env.VITE_ADSENSE_CLIENT) env.VITE_ADSENSE_CLIENT = ADSENSE_PUBLISHER;
  return {
    plugins: [react(), tailwindcss(), launchFiles(env)],
    define: { "import.meta.env.VITE_ADSENSE_CLIENT": JSON.stringify(env.VITE_ADSENSE_CLIENT ?? "") },
    // Track JSON lives in the repo-level data/ folder.
    server: { fs: { allow: ["../.."] }, port: 5173 },
  };
});

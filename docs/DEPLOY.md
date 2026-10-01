# Deploying the web app

`npm run build:web` produces a static site in `apps/web/dist`.

## Routes

The app is a single page, but two addresses must serve `index.html`:

| Path | Screen |
|---|---|
| `/` | the hub (also `?play=practice&track=…`, `?vs=…` challenge links) |
| `/reaction` | the lights-out reaction test (its own title, for search) |

Configure the host's SPA fallback so `/reaction` returns `index.html`:

- **Netlify:** `apps/web/public/_redirects` with `/reaction /index.html 200`
- **Vercel:** `"rewrites": [{ "source": "/reaction", "destination": "/index.html" }]`
- **Cloudflare Pages:** single-page apps fall back to `index.html` automatically
- **nginx:** `try_files $uri /index.html;`

## Installable app (PWA)

`public/manifest.webmanifest`, the icons and `public/sw.js` ship as-is. The
service worker registers in production builds only: pages are network-first
(a new build arrives at once), hashed assets cache-first, other origins (ads)
untouched. Serve `sw.js` from the site root with `Cache-Control: no-cache` so
browsers pick up new versions. Bump `CACHE` in `sw.js` to force a clean cache.

## Before launch

- Ads: see [ADS.md](ADS.md) (AdSense client, slots, `ads.txt`, consent message).
- Attribution: OpenStreetMap credit is shown in-app; keep it.

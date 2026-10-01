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

## Before launch

- Ads: see [ADS.md](ADS.md) (AdSense client, slots, `ads.txt`, consent message).
- Attribution: OpenStreetMap credit is shown in-app; keep it.

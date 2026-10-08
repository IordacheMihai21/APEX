# Deploying the web app

`npm run build:web` produces a static site in `apps/web/dist`.

## Routes

Every address is a real file in `dist`: the content pages and every page of
the app itself (hub, games, archive, records, privacy, legal) are pre-rendered
by `scripts/prerender.mjs`, so `/mystery` is `dist/mystery.html` with its own
title, canonical and text, and the app takes over in the browser. The hub's
query links (`/?play=practice&track=…&cond=…`, `/?vs=…` challenges) are served
by `dist/index.html`. Nothing needs rewriting:

- **Cloudflare Pages / Netlify:** clean URLs serve `x.html` at `/x` (and
  redirect `/x/` to `/x`); `apps/web/public/_redirects` is empty on purpose and
  `_headers` sets caching and security headers.
- **Vercel:** `apps/web/vercel.json` (rewrites plus cache headers). Set the project's root directory to `apps/web`.
- **nginx:** `try_files $uri $uri.html /index.html;`, and `Cache-Control: no-cache` on `/sw.js`.

## Installable app (PWA)

`public/manifest.webmanifest`, the icons and `public/sw.js` ship as-is. The
service worker registers in production builds only: pages are network-first
(a new build arrives at once), hashed assets cache-first, other origins (ads)
untouched. Serve `sw.js` from the site root with `Cache-Control: no-cache` so
browsers pick up new versions. Bump `CACHE` in `sw.js` to force a clean cache.

## Launch checklist

Set these for the production build (host dashboard, or `apps/web/.env.production`; see `apps/web/.env.example`):

| Variable | What it does |
|---|---|
| `VITE_SITE_URL` | The public address. Absolute link-preview URLs, the canonical link, `sitemap.xml`. |
| `VITE_LAUNCH_DATE` | Day No. 1 (YYYY-MM-DD). Numbering, the circuit and condition rotation, and the archive count from it. **Set it to launch day**, or the first public day will be "No. N" with an archive of test days. |
| `VITE_ADSENSE_CLIENT`, `VITE_ADSENSE_SLOT_RAIL`, `VITE_ADSENSE_SLOT_INLINE` | Ads (see [ADS.md](ADS.md)). The client id also generates `ads.txt`. |
| `VITE_PLAUSIBLE_DOMAIN` | Cookieless visit statistics with Plausible (page views per screen; events per game, see docs/ANALYTICS.md). |
| `VITE_CONTACT_EMAIL` | Contact address on the privacy page. |

SEO is static: `index.html` holds the title, description, robots, canonical (updated per page by the app), Open Graph, Twitter card and WebApplication structured data for https://lapdle.com; `public/robots.txt` and `public/sitemap.xml` list the public pages (add new routes there). The build adds `ads.txt` (with an AdSense client), the AdSense tags and a preload for the display font.

Outside the code, for you to do:

1. **Domain.** lapdle.com (checked free on 6 October 2026; no other game uses the name). Buy it at Cloudflare Registrar (at cost).
2. **Host.** Connect the repo (Vercel or Cloudflare Pages), root `apps/web`, build `npm run build -w @apex/web` from the repo root (or `npm run build` in `apps/web`), output `apps/web/dist`.
3. **AdSense.** Apply with the live domain; once approved, create the two ad units and set the env vars. Turn on the **GDPR consent message** in AdSense (Privacy & messaging): serving ads in the EEA, UK and Switzerland needs a Google-certified consent platform, and Google's own is free. The privacy page's "Change cookie choices" button opens it.
4. **Plausible.** Add the site in Plausible and set `VITE_PLAUSIBLE_DOMAIN`.
5. **Privacy page.** It describes what the app does (`/privacy`); have it read over before launch, and set a contact email.
6. **Phones.** Play a Daily Quali, the pit stop and the archive on a real iPhone (Safari) and an Android phone (Chrome), and install it to the home screen once.
7. **Share preview.** Paste the live URL into WhatsApp, Discord or X to check the card.

Lighthouse (mobile, production build, 3 October 2026): Performance 96, Accessibility 100, Best Practices 100, SEO 100.

## Before launch

- Ads: see [ADS.md](ADS.md) (AdSense client, slots, `ads.txt`, consent message).
- Attribution: OpenStreetMap credit is shown in-app; keep it.

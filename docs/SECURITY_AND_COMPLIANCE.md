# Security, privacy and legal: what APEX needs

Research done 4 October 2026 for a free, ad-funded browser game run from
Romania, with an anonymous online leaderboard. Not legal advice: have the
privacy page and terms read by a lawyer before launch, especially once ads run.

Status key: **Done** (in the code), **You** (needs you), **Later**.

## 1. Web security

| Item | Why | Status |
|---|---|---|
| HTTPS everywhere, HSTS 2 years | OWASP baseline | **Done** (`vercel.json`, `public/_headers`) |
| `frame-ancestors 'none'` + `X-Frame-Options: DENY` | Stops clickjacking (the site can't be framed by others) | **Done** |
| CSP: `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `upgrade-insecure-requests` | Closes plugin, base-tag and form-hijack vectors | **Done** |
| CSP `script-src` allowlist | Google supports only a nonce-based strict CSP for AdSense (its domains change); a static host can't add per-request nonces, so scripts are not domain-restricted. The app has no user-generated HTML, no `innerHTML` with user data, and no third-party scripts besides AdSense and Plausible. | Accepted trade-off; revisit if moving to an edge-rendered host |
| `Permissions-Policy` (camera, microphone, geolocation, payment, USB… off) | Least privilege; ad-related features left alone so ads still work | **Done** |
| `Cross-Origin-Opener-Policy: same-origin-allow-popups` | Isolation without breaking ad clicks (COEP left off, it would block ads) | **Done** |
| `X-Content-Type-Options`, `Referrer-Policy` | Baseline | **Done** |
| Dependencies | `npm audit --omit=dev`: 0 vulnerabilities; runtime deps are MIT/OFL | **Done**; re-run before each release |
| Secrets | Only the Supabase *publishable* key is in the app (it's meant to be public); the service-role key stays on the server; `.env*.local` ignored by git | **Done** |

Sources: [OWASP HTTP Headers Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html), [AdSense and CSP](https://support.google.com/adsense/answer/16283098?hl=en).

## 2. Leaderboard (Supabase)

| Item | Status |
|---|---|
| Table unreadable/unwritable with the public key (RLS on, no policies) | **Done**, verified with a live request |
| Server re-simulates the submitted line; times can't be forged | **Done** |
| Strict input validation (day window, circuit list, UUID, knot count and range), 16 kB body limit | **Done** |
| Rate limits: 60 submissions per device per day, 300 per IP per hour (IP stored only as a salted daily SHA-256 hash) | **Done**, deployed |
| CORS restricted to the site's origin | **You**: once the domain exists, set the function secret `ALLOWED_ORIGINS=https://yourdomain` (Supabase dashboard → Edge Functions → Secrets) |
| Right to erasure ("Delete my leaderboard results" on /privacy) and 30-day retention | **You**: approve the migration that adds `forget_device` and `prune_leaderboard` (it contains DELETE statements, so it waits for your OK). The button and the function are already deployed. |
| `rls_auto_enable()` advisor warning | Supabase's own event-trigger helper (turns RLS on for new tables); it can't be called as an API. Harmless, left as is. |

Sources: [Supabase rate limits](https://supabase.com/docs/guides/auth/rate-limits), [anon key and RLS](https://www.stingrai.io/blog/supabase-powerful-but-one-misconfiguration-away-from-disaster).

## 3. GDPR and ePrivacy

- **Local storage counts as "storing information on the device"** under
  ePrivacy art. 5(3) ([EDPB Guidelines 2/2023](https://www.edpb.europa.eu/system/files/2024-10/edpb_guidelines_202302_technical_scope_art_53_eprivacydirective_v2_en_0.pdf)).
  Game progress, settings and streaks are *strictly necessary* for the game the
  player asked for, so no consent is needed. **Done** (explained on /privacy).
- **The device id is personal data** (pseudonymous, GDPR recital 26), so the
  leaderboard needs: a legal basis (legitimate interest, art. 6(1)(f)), a
  notice, a retention limit, and a way to delete. **Done** in the code
  (notice, 30 days stated, delete button); **You**: approve the migration above.
  Players see only aggregates, never ids or lines.
- **Plausible** is cookieless and keeps no personal data; it's widely treated
  as consent-free ([Plausible's legal assessment](https://plausible.io/blog/legal-assessment-gdpr-eprivacy)),
  though some argue ePrivacy has no anonymous-data exemption
  ([discussion](https://github.com/plausible/analytics/discussions/1963)). Low
  risk; described on /privacy.
- **AdSense needs a Google-certified CMP (IAB TCF) in the EEA, UK and
  Switzerland** since January 2024, with Consent Mode v2; ads to EU users stop
  without it ([Google](https://support.google.com/adsense/answer/13554116?hl=en)).
  **You**: turn on AdSense's own GDPR message (Privacy & messaging) before ads
  go live. The "Change cookie choices" button on /privacy already opens it.
- **Privacy notice (art. 13)**: who the controller is, purposes, legal bases,
  retention, recipients (Supabase EU, Google, Plausible), rights, complaint to
  [ANSPDCP](https://www.dataprotection.ro). **Done**, except the operator's
  identity: **You** set `VITE_OPERATOR_NAME`, `VITE_OPERATOR_ADDRESS`,
  `VITE_CONTACT_EMAIL` (and `VITE_OPERATOR_REGISTRATION` for a company/PFA).
- **Children**: Romania's age of digital consent is 16 (GDPR art. 8). The game
  is general-audience, has no accounts and asks for nothing; personalised ads
  rely on the CMP consent. The proposed Romanian "digital majority" law
  (Senate, October 2025; still before the Chamber of Deputies) targets account
  creation; APEX has no accounts. **Later**: re-check when it passes.

## 4. Romanian / EU site obligations

- **Law 365/2002 art. 5 (e-Commerce)**: an ad-funded site is an information
  society service and must show the operator's name, address and a direct
  contact (and registration number if registered), permanently and visibly.
  **Done**: `/legal` and the footer link; **You**: fill the env vars.
- **Digital Services Act**: intermediary services must publish a single point
  of contact (arts. 11-12). APEX stores no user content beyond anonymous lap
  lines, so this is light: the contact email on /legal covers it.
- **Terms of use**: fair play, no automation, leaderboard may be reset, no
  warranty, consumer rights untouched, Romanian law. **Done** (`/legal`).

## 5. Trademarks, data and licences

- **Formula 1 marks**: F1's guidelines say its word marks "cannot be used to
  brand any game", nor in domain names of commercial sites; editorial,
  descriptive use is tolerated ([F1 guidelines](https://www.formula1.com/en/information/guidelines.4EOKE9RRqevL4niTK9kWyt)).
  **Done**: "F1" removed from page titles and game copy; the official
  disclaimer is on /legal. **You**: never use F1/Formula 1/Grand Prix in the
  name, domain, app-store listings or ads.
- **Name check**: "Apexdrawn" is a track-drawing driving game; **You**: check
  "APEX" against EUIPO/national registers before buying the domain.
- **OpenStreetMap (ODbL)**: credit must be visible without clicking whenever
  the map shows, linked to the licence; the extracted scenery is a derivative
  database that must be available under the ODbL on request
  ([OSMF attribution guidelines](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines)).
  **Done**: credit now shows in every phase, /legal offers the data.
- **Software**: React, React DOM, Phosphor Icons (MIT), Archivo (SIL OFL 1.1,
  bundling allowed, [OFL](https://openfontlicense.org/open-font-license-official-text/)).
  **Done**: listed on /legal.

## 6. Ads policy

- AdSense strongly recommends ads at least **150 px away from games** to avoid
  accidental clicks ([Google](https://support.google.com/adsense/answer/2768340?hl=en)).
  **Done**: side rails are off on the race screen (you drag points across the
  whole map); they stay on the hub, minigames and pages. Never put ads next to
  controls; never ask for clicks.

## How the football daily-game sites do it

[futbol11](https://futbol11.com/privacy-policy): progress stays in local
storage, a third-party consent tool with a "Manage Consent" button, a contact
email. [playfootball.games](https://playfootball.games/privacy/): a privacy
policy naming the operating company and country. APEX now covers the same
ground, plus server-side cheat protection and a self-service delete button.

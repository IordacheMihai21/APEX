# Lapdle growth audit and 30-day plan (8 Oct – 6 Nov 2026)

Objective: real organic players and more daily returning players, minimal spend.
Skills applied: product-marketing, seo-audit, analytics, referrals, marketing-ideas.

**How to read this.** Every finding is tagged:

- **[V] Verified**: seen in the code or on the live site on 8 Oct 2026, with the evidence.
- **[H] Hypothesis**: a judgement to test, not a fact.

No search volumes, traffic numbers or conversion rates appear here, because none
were measured. I had no access to Plausible, Google Search Console or Bing
Webmaster Tools. The site has been live since 6 Oct (`modes/schedule.ts`, Day 1),
so there is no baseline yet. The October targets in `LAUNCH_PLAN.md` are goals,
not forecasts. Re-base them after week 1 (see KPIs).

---

## 1. Summary

The product already has the right growth parts: a daily set, streaks, share text
on every game, a share image and a "beat my lap" link on the Quali, a PWA install
prompt, and per-game analytics. Three gaps stop those parts from compounding:

1. **The growth loop can't be measured.** Shared links carry no source tag, and
   the app sends page views without the query string, so campaign tags would be
   dropped too. Group-chat traffic, the main channel for daily games, will look
   like "Direct".
2. **The referral landing goes nowhere.** A "beat my lap" link opens a
   *practice* lap on the sender's circuit. Nothing then points the new player
   to today's daily set, which is what brings people back.
3. **Search can't see most of the site.** All 10 game pages and `/records`
   serve the homepage's HTML: the same title, `canonical=/`, and an empty body.
   The sitemap still lists them, so its signals contradict the pages. The
   homepage itself has no text or links in its static HTML.

Fix these in week 1. They are cheap, they are code, and everything else in the
plan depends on them. Weeks 2–4 then run the existing launch plan, with
measurement in place, around two race weekends that the code already handles:
Austin (23–25 Oct) and Interlagos (6–8 Nov).

---

## 2. Verified findings

### Acquisition and SEO

| # | Finding | Evidence | Impact |
|---|---|---|---|
| S1 | `/mystery`, `/pit-stop`, `/higher-lower`, `/braking-point`, `/corner-order`, `/speed-trap`, `/line-up`, `/aerial`, `/reaction`, `/corner` and `/records` all return the homepage HTML: the same title, `<link rel="canonical" href="https://lapdle.com/">`, and an empty `#root`. | `curl` of the live pages; `public/_redirects` rewrites them to `/` with a 200; `scripts/prerender.mjs` only renders `CONTENT_ROUTES`. | High. Google is told these pages are duplicates of `/`. They can't rank for their own names ("guess the circuit", "braking point game", …). |
| S2 | `sitemap.xml` lists those 11 URLs, but each one's canonical points to `/`. | `public/sitemap.xml` against the live HTML. | Medium. The sitemap and canonicals contradict each other, so Search Console will likely report "Alternate page with proper canonical" or "Duplicate". |
| S3 | The homepage's static HTML has an empty `<div id="root"></div>`: no H1, no text, no internal links. Google renders JavaScript, but other crawlers and AI crawlers often don't. | `curl https://lapdle.com/`. | Medium. |
| S4 | The content pages are pre-rendered correctly, each with its own title, description and canonical: 12 circuit guides, 12 trivia quizzes, 11 how-to pages and About. A circuit guide is about 400 words of visible text. | `curl` of `/circuits/spa`, `/trivia/monza`, `/how-to-play/quali`. | These are the indexable assets that exist today. |
| S5 | `www` and `http` both 301 to `https://lapdle.com/`. HSTS and security headers are set. robots.txt allows everything and points to the sitemap. | `curl -I`; `public/_headers`; `public/robots.txt`. | Good. No action needed. |
| S6 | `site:lapdle.com` returned no lapdle.com results on 8 Oct. That is expected two days after launch. The search tool isn't Google, so check Search Console to confirm. | Web search, 8 Oct. | Organic search is currently zero, so its effect in 30 days will be small. |
| S7 | The homepage has `WebApplication` JSON-LD and full Open Graph/Twitter tags with a 1200×630 image. Content pages get their own OG title and description. | `index.html`, `prerender.mjs`. | Good. Link previews in group chats work. |
| S8 | Minor: `apple-mobile-web-app-capable` and `…-status-bar-style` appear twice in `index.html`. The manifest description names only 5 of the 10 games. | `index.html`, `manifest.webmanifest`. | Low. Tidy them when convenient. |

### Analytics

| # | Finding | Evidence | Impact |
|---|---|---|---|
| A1 | `pageview()` sends `location.origin + location.pathname`, so the query string is dropped. Plausible reads `utm_*` and `ref` from the URL it's given, so tagged links (`?utm_source=reddit`, `?ref=…`) lose their tag. Confirm with one tagged visit in Plausible's realtime view. | `src/analytics.ts`, `pageview()`. | High. Campaigns can't be told apart. Only the HTTP referrer survives, and mobile apps and messengers usually strip it. |
| A2 | Shared links carry no source tag. The Quali share uses `?vs=…`; every other game shares a plain `lapdle.com/<game>`. | `modes/daily.ts` `shareText`, `ui/*` `shareText=`. | High. Visits from shares can't be counted, so the referral loop is invisible. |
| A3 | `?vs=` challenge visits are recorded as `Game started` with mode `practice`, the same as any practice lap. No event records that a challenge was opened, beaten or lost. | `App.tsx` `initialScreen()`, `games/events.ts`. | High. The main referral mechanic can't be measured. |
| A4 | Retention signals are already well designed: `Visit` carries `last_played` and `player` buckets, and `Daily set done`, `Share`, `App installed` and `Install prompt` exist. | `games/events.ts`, `install.ts`, `docs/ANALYTICS.md`. | Good. Day-1 return and the habit mix can be read without cookies. |
| A5 | Day-1 return as defined in `ANALYTICS.md` (yesterday-visits on day N ÷ finishers on day N−1) is an approximation. It counts devices, not people, and a clear-storage or second device looks new. That's fine for trends; don't use it as an absolute figure. | `ANALYTICS.md`. | Read trends only. |

### Retention and referral (product)

| # | Finding | Evidence | Impact |
|---|---|---|---|
| R1 | A challenge link opens a practice lap on the sender's track, with the sender's lap as a pace marker. Nothing then sends the newcomer to today's daily. | `App.tsx` lines ~76–78 (`vs` → `mode: "practice"`). | High. The referral loop's "convert" step goes to a mode with no daily return hook. |
| R2 | Only the Quali share includes an image card and a personal "race my best lap" link. The other 9 games share text plus a plain link. | `Dialogs.tsx`, `ui/*`. | Medium. Mini-game shares give the recipient nothing personal to beat. |
| R3 | There is no channel to remind a player to come back: no web push, no email, no social account linked yet (footer links wait for `VITE_SOCIAL_*`). The only return triggers are the player's own memory, the installed app icon and group-chat shares. | grep for notification, push and email; `LAUNCH_PLAN.md`. | High for retention. |
| R4 | Streaks (with "play one today to keep it"), a "Today x/y" count, a countdown to tomorrow, an archive of past days and race-week banners already exist. | `ui/Hub.tsx`, `modes/schedule.ts`. | Good. The habit mechanics are there; the gap is the external reminder (R3). |
| R5 | The race-week banner and Saturday switch are coded for Austin (23–25 Oct) and Interlagos (6–8 Nov) inside this window. These dates come from the code; check them against the official calendar. | `modes/schedule.ts` `RACE_WEEKENDS`. | Two natural, free moments for content. |

### Brand and compliance

| # | Finding | Evidence |
|---|---|---|
| C1 | Product copy never says "F1", "Formula 1" or "FIA". It uses "Grand Prix" descriptively, and non-affiliation notices appear in the footer, Legal, Privacy and About. | grep of `src/`. Keep it this way. |
| C2 | Share text says "Faster than the real 2025 pole by …". That is a factual comparison and implies no affiliation. Keep the wording neutral. | `modes/daily.ts`. |

---

## 3. Hypotheses (to test, not assume)

- **H1.** For daily games, shared results in group chats are the biggest organic
  channel. This matches `LAUNCH_PLAN.md`'s research, but for Lapdle it only
  becomes testable once A1–A3 are fixed.
- **H2.** A newcomer who arrives on a challenge link and then plays today's
  Quali returns the next day more often than one who only plays the practice
  challenge. Test it with the new events (cohort by `player=new` and `via`).
- **H3.** "It's the one where you drive" (the racing line plus physics) is the
  message that sets Lapdle apart from trivia-style racing dailies, for example
  Sportdle's motorsport modes ([alternativeto.net/software/sportdle](https://alternativeto.net/software/sportdle/about/),
  [sportsdle.com/dle-games](https://sportsdle.com/dle-games)). Test it with community-post response and
  share rate, not by assuming.
- **H4.** Game-name pages ("guess the circuit from above", "braking point game")
  and circuit pages ("[circuit] racing line") can win long-tail search. There is
  no volume data. Make the pages indexable (cheap), then let Search Console
  impressions decide whether to invest further.
- **H5.** Web push to the *installed* app is the cheapest reminder channel.
  iOS supports it only for home-screen web apps. Check what share of
  `Visit` events has `app=true` before building it.
- **H6.** Race weekends lift interest in that circuit. Use the Austin weekend
  as the test: compare Visits and Sources against the week before.

---

## 4. Opportunities, ranked

The ranking is my judgement on impact, confidence and effort; it isn't measured.

| Rank | Opportunity | Why | Effort |
|---|---|---|---|
| 1 | **Make the loop measurable** (A1, A2, A3) | Without it, weeks 2–4 can't tell what worked. | ~half a day |
| 2 | **Challenge landing → today's daily** (R1, H2) | It converts referred newcomers into daily players. | ~1 day |
| 3 | **Fix the game-page SEO** (S1–S3) | Turns 11 duplicate URLs into indexable pages and gives the homepage crawlable text. The SSG already exists. | ~1 day |
| 4 | **Daily social post as a reminder channel** (R3) | One post a day ("Today: Austin, wet. Perfect lap 1:3x.xxx") on accounts already planned. Free, and it creates a return trigger. | 10 min/day |
| 5 | **Community launch, staggered and tagged** | The existing `LAUNCH_PLAN.md` drafts, each link tagged, one sub per day, with the replies. | 2–3 h/post |
| 6 | **Race-week pushes** (R5, H6) | Austin and Interlagos: posts, short videos, creator DMs. | 1 day each |
| 7 | **Personal challenge in mini-game shares** (R2) | "Beat my 412/500" with a link to the same day. | ~1 day |
| 8 | **Search Console + Bing setup and indexing requests** (S6) | Required just to see search data. | 30 min |
| 9 | **Web push for the installed app** (H5) | Build it only if installed-app share justifies it. | 2–3 days |
| Later | Deeper circuit guides, an embeddable daily widget for creators, more circuits | Wait for Search Console and Plausible data. | |

Ideas considered and rejected for now:
- **Paid ads**: they don't fit "minimal spending" and wouldn't produce organic players.
- **Reward-based referral programme**: there is nothing to reward with. The challenge link is the right, product-native mechanic.
- **Programmatic SEO at scale**: the content (12 circuits) and the demand data aren't there yet.

---

## 5. The 30-day plan

### Week 1 (8–14 Oct): measure, fix, index. Code first.

| Task | Detail | Done when |
|---|---|---|
| 1.1 Keep the query string in page views | In `pageview()`, send `location.href`, or at least the `utm_*` and `ref` params, on the first page view. Capture them before any `replaceState` drops them. | One visit to `/?utm_source=test` shows up under Sources → test in Plausible. |
| 1.2 Tag every shared link | Add `?ref=share-<game>` to all share URLs; the Quali challenge gets `&ref=challenge`. Keep canonicals clean (they already ignore query). | The share text in each game contains the ref. A test share shows in Plausible Sources. |
| 1.3 Challenge events | `Challenge opened` (track, player); `Challenge finished` (`beat`: yes/no, laps). Add `via: challenge` to the newcomer's later `Game started`/`Game finished` in that page load. | Events visible in Plausible; goals and props added in its settings. |
| 1.4 Challenge → daily | On the challenge result, make the primary button "Play today's Quali" (with circuit and conditions) and keep "Try again" second. Show the Today x/y bar. | Manual run of a `?vs=` link ends one tap from today's daily. |
| 1.5 Pre-render the game pages | Give each game route its own HTML: title from the registry, description, self-canonical, an H1, the how-to text and links to its guide and to `/`. Write `dist/<route>.html` and remove the 200 rewrites for routes that now have a file (check that Cloudflare serves `x.html` at `/x`, as it already does for `/about`). | `curl /mystery` shows its own title, canonical and text. The build test still checks the sitemap against the registry. |
| 1.6 Static homepage text | Pre-render a lightweight hub shell into `/`: an H1 ("Lapdle: a daily racing-line game"), a one-paragraph explainer, links to each game, circuit guides and how-to. The app replaces it on load. | `curl /` shows H1, text and links. Check that Lighthouse CLS doesn't get worse. |
| 1.7 Search Console + Bing | Verify the domain (DNS TXT in Cloudflare), submit the sitemap, request indexing for `/`, `/circuits`, `/how-to-play` and 3 game pages after 1.5 ships. | Sitemap status "Success"; coverage report readable. |
| 1.8 Social accounts live | Create the `@lapdle` accounts per `LAUNCH_PLAN.md`, set the `VITE_SOCIAL_*` variables, and redeploy. | Footer links work. |
| 1.9 Seed the first players | Send the group-chat message to your own chats, using a real share result. No public posts yet. | 0 public launches before 1.1–1.4 are live. |
| 1.10 Baseline | On 14 Oct, write down the 7-day numbers for every KPI in §6. | A baseline table appended to this doc. |

Run `npm run build -w @apex/web` before every commit (repo rule).

### Week 2 (15–21 Oct): community launch with measurement

- One community post a day, from the `LAUNCH_PLAN.md` drafts: r/WebGames → r/simracing → r/F1Technical → r/formula1 → Show HN (a weekday, US morning) → r/SideProject. Read each subreddit's rules on the day you post.
- Tag each link (`?utm_source=reddit&utm_campaign=wk2&utm_content=<sub>`, `utm_source=hn`, and so on). Reply to comments for 2 hours after each post.
- Start the daily social post: today's circuit and conditions, plus yesterday's perfect lap. Track `utm_source=x|instagram|tiktok`.
- Start short videos (one per weekday; formats in `LAUNCH_PLAN.md`). Put the tagged link in the bio, using a `utm_campaign` per platform.
- Submit to directories (12+ per the plan), each with `?ref=<directory>`.
- Ship 1.7 indexing requests for the new game pages if not done.
- **Midweek check (Thu 18):** which source gives the most `Game finished` per visit? Shift the remaining posts toward what works.

### Week 3 (22–28 Oct): Austin race week (per `RACE_WEEKENDS`)

- Mon–Fri: short videos on the Austin circuit guide, its braking point and an aerial view. Point posts at `/circuits/austin` and the Saturday Daily Quali.
- Sat 24 (Daily Quali = Austin): post "today's perfect lap at Austin is X: within a second?" in the sim-racing and technical communities you've already posted in, where the rules allow a follow-up. Otherwise post on your own social accounts only.
- Send 15–25 creator DMs (by hand, never automated) using the plan's DM text. Give each creator their own `?ref=<creator>` link.
- Ship task 7 (personal "beat my score" in mini-game shares), if week 1–2 data shows share rate is the bottleneck.
- Our own copy says "Austin" and "race weekend". Never use series logos, team names or driver names in images or video.

### Week 4 (29 Oct – 6 Nov): review, double down, Interlagos

- **Review on 31 Oct**, with Plausible open:
  - Sources ranked by players and by return visits (`Visit last_played=yesterday` filtered by source, where it can be filtered).
  - Completion per game.
  - Challenge funnel.
  - Search Console impressions per page.
- Keep the two best channels and drop the rest.
- Fix the game with the lowest completion rate (the biggest drop between `Game started` and `Game finished`).
- Interlagos race week (6–8 Nov): repeat the Austin playbook with the week-3 learnings.
- Decide on web push (H5), based on the `app=true` share of Visits.

---

## 6. KPIs

All are measurable in Plausible or Search Console after week 1. Set the targets on
14 Oct as a multiple of the baseline. The `LAUNCH_PLAN.md` targets stay as stretch
goals.

| KPI | Definition | Source | Leading or lagging |
|---|---|---|---|
| **Daily players** (north star) | Unique visitors with `Game started` per day | Plausible goal, unique conversions | Lagging |
| **Day-1 return** | `Visit` with `last_played=yesterday` on day N ÷ unique `Game finished` (mode daily) on N−1. Trend only (A5). | Plausible | Lagging |
| **Regulars share** | Share of `Visit` with `player` ≥ "4-7 days" | Plausible props | Lagging |
| **Share rate** | `Share` ÷ `Game finished` (daily) | Plausible | Leading |
| **Share-driven visits** | Visits with source `share-*` or `challenge` | Plausible Sources (after 1.1/1.2) | Leading |
| **Challenge conversion** | `Challenge finished` ÷ `Challenge opened`; then the share of those newcomers who start today's Quali | Plausible (after 1.3/1.4) | Leading |
| **Games per visit** | `Game finished` ÷ visits; `Daily set done` ÷ players | Plausible | Leading |
| **Channel yield** | Players and day-1 returns per `utm_source` | Plausible | Leading |
| **Indexed pages** | Indexed URLs out of about 50 in the sitemap | Search Console | Leading |
| **Organic impressions and clicks** | Per page and query | Search Console | Lagging (slow) |

Activity inputs, which you control: posts published, videos published, DMs sent,
directories listed, days with a social post.

---

## 7. Assumptions

1. The site went live on 6 Oct 2026 and has no audience yet (from `schedule.ts` and the 8 Oct site search). If players already exist, set the baseline from Plausible first.
2. Plausible's goals and custom properties have been set up per `ANALYTICS.md`. If not, do it on day 1, because nothing is reported until then.
3. Plausible attributes a visit from the `utm_*`/`ref` params in the URL passed to `plausible()`. Check this with a single tagged visit (task 1.1).
4. Cloudflare Pages serves `dist/<route>.html` at `/<route>` once the 200 rewrite is removed. It does this today for `/about` and `/circuits/*`.
5. Time budget: about 1–2 hours a day of founder time, plus about 3 days of engineering in week 1. Spend: €0, apart from existing hosting.
6. The race weekend dates are as coded in `RACE_WEEKENDS`. Check them against the official calendar before planning content.
7. Subreddit rules on self-promotion change. The drafts are only drafts.

---

## 8. Guardrails

- Never imply an official link to Formula 1, the FIA, any team or any driver.
  Use "racing", "real circuits" and "race weekend". Never use series names,
  logos, fonts or livery in our own copy, images or videos. The game's existing
  copy already follows this (C1).
- Use hashtags that describe the topic, not the brand (#racing #motorsport #simracing).
- Post in your own voice, disclose that you made it, never automate DMs, and never use bought or fake engagement.
- No dark patterns in the streak or reminder copy.

---

## 9. Product-marketing context (draft for `.agents/product-marketing.md`)

- **One-liner:** A free daily racing-line game. You set the line through each corner of a real circuit, and a physics car drives it.
- **Category:** daily browser puzzle game ("-dle" games), sports/racing.
- **Audience:** racing fans who play daily games; sim racers; people who like motorsport technically.
- **Differentiator:** you *drive*, not just guess: a deterministic physics lap on real circuits, plus 9 short daily extras.
- **Business model:** free, ad-supported (AdSense pending). No account needed, cookieless analytics, installable.
- **Key conversions:** play today's Quali → finish the daily set → come back tomorrow → share.
- **Proof points:** none yet. Collect real player quotes from the week 2 threads.

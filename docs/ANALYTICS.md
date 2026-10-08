# Analytics

Lapdle counts with [Plausible](https://plausible.io): no cookies, no personal
data, no consent banner. Production builds use lapdle.com's Plausible site and
its own script (`pa-KS7GUtru6oEsZyJ5DKZDM.js`, set in `vite.config.ts`; both are
public, every visitor's browser loads them), and only on lapdle.com itself:
development, Cloudflare preview deployments and local copies of a production
build never send anything. `VITE_PLAUSIBLE_DOMAIN` and `VITE_PLAUSIBLE_SRC`
override the site and script. With a `pa-….js` script the app calls
`plausible.init` with automatic page views off and sends them itself; an older
`data-domain` script (`script.manual.js`) works too.

A visit's source comes from its referrer or from tagged links (`?ref=tiktok`,
`?utm_source=reddit&utm_campaign=…`). The app reads those parameters when the
page loads, before it rewrites its own address, and sends them with the first
page view (`sourceQuery` in `src/analytics.ts`); its own parameters (`vs`,
`play`, `track`) never go to Plausible. Shared results carry their own tag
(`?ref=share-mystery`, `?ref=share-trivia`…, and `&ref=challenge` on a "beat
my lap" link, `shareLink` in `src/shareLink.ts`), so visits from shares show
under Sources as `share-…` and `challenge`.

Plausible can't follow a person across days, so the events carry coarse
buckets worked out on the device from what it already stores (see
`apps/web/src/games/events.ts`). No ids, dates or times are sent.

## Events

| Event | When | Properties |
| --- | --- | --- |
| `pageview` | every screen (sent by hand, the app changes its address in place) | |
| `Visit` | once per page load | `last_played`: never / yesterday / 2-7 days ago / 8+ days ago; `player`: new / 2-3 days / 4-7 days / 8-30 days / 31+ days |
| `Game started` | first move in a game | `game`, `mode` (daily, practice, endless, archive), `player` |
| `Game finished` | a game's result is in | `game`, `mode`, `player`, `today` (daily set done, e.g. `3/5`), plus a result: Quali `medal` and `laps`; Mystery `solved` and `guesses`; Higher or lower `score` or `streak`; Pit stop `penalty`; Braking point `score` band or `off`; Lights out `band`; trivia `circuit` and `score` |
| `Daily set done` | the last game of today's set is finished | `player` |
| `Share` | a result is shared | `what` |
| `Challenge opened` | a "beat my lap" link is opened (once per page load) | `circuit`, `player` |
| `Challenge raced` | the first lap against that challenge | `circuit`, `beat` (true/false), `player` |
| `Challenge beaten` | the first lap that beats it | `circuit`, `player` |

`game` is one of `quali`, `mystery`, `pit-stop`, `higher-lower`,
`braking-point`, `reaction`, `trivia`.

## One-time setup in Plausible

1. Site settings > Goals: add custom event goals `Visit`, `Game started`,
   `Game finished`, `Daily set done`, `Share`, `Challenge opened`,
   `Challenge raced`, `Challenge beaten`.
2. Site settings > Custom properties: add `game`, `mode`, `player`,
   `last_played`, `today`, `medal`, `score`, `streak`, `solved`, `guesses`,
   `penalty`, `off`, `band`, `circuit`, `what`, `beat`.

## The numbers partners ask for

- **Completion per game:** `Game finished` ÷ `Game started`, filtered by
  `game` (and `mode` = daily for the daily set).
- **Day-1 retention:** `Visit` with `last_played` = yesterday on day N, ÷
  unique visitors with a finished daily game on day N−1. Week-level return:
  the 2-7 days bucket.
- **Games per visit:** `Game finished` events ÷ visits; the spread of `today`
  on `Game finished` shows how deep into the set people go, and `Daily set
  done` how many finish it.
- **Habit:** the `player` bucket on any event shows how much of the audience
  is new and how much is regular.

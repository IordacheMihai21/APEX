# Analytics

Lapdle counts with [Plausible](https://plausible.io): no cookies, no personal
data, no consent banner. It's on when the build has `VITE_PLAUSIBLE_DOMAIN`
(set it in Cloudflare Pages to `lapdle.com`), and never in development.

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

`game` is one of `quali`, `mystery`, `pit-stop`, `higher-lower`,
`braking-point`, `reaction`, `trivia`.

## One-time setup in Plausible

1. Site settings > Goals: add custom event goals `Visit`, `Game started`,
   `Game finished`, `Daily set done`, `Share`.
2. Site settings > Custom properties: add `game`, `mode`, `player`,
   `last_played`, `today`, `medal`, `score`, `streak`, `solved`, `guesses`,
   `penalty`, `off`, `band`, `circuit`, `what`.

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

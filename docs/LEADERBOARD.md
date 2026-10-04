# Daily leaderboard

"Faster than 73% of today's 412 players." Anonymous, and built so a time on
the board can't be made up.

## How it works

- **The app sends a line, never a time.** After each Daily Quali lap it posts
  today's date, the circuit, the conditions, the day's best line (knot
  offsets) and a random device id made on the device (`apex.device` in local
  storage) to the `submit-lap` edge function.
- **The server times it.** `supabase/functions/submit-lap` bundles the game's
  own engine and circuits, applies the same track-limit projection the game
  does (`expandGates`), and simulates the lap with that condition's car. The
  physics is deterministic, so the server's time is exactly the game's.
- **One row per device per day** (`public.daily_laps`), keeping only the
  fastest lap (`record_daily_lap`). Only today's daily (±36 h for time zones)
  is accepted; archive replays are never sent.
- **Nobody can read the rows.** Row-level security is on with no policies: the
  public key can't select, insert or update. The edge function writes with the
  service role. Players see only aggregates through `daily_standing` (players,
  how many were faster, best, median); no device ids, no lines.

## Deploying the function

Once, in a terminal at the repo root (opens the browser to sign in):

```bash
npx supabase@2 login
```

Then, after any change to the engine, the circuits or the function:

```bash
npm run deploy:functions
```

That bundles `src.ts` into `index.ts` (`npm run build:functions`) and deploys it
to the APEX project with JWT checks off (the publishable key isn't a JWT; the
function validates every field itself).

The app needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`
(`apps/web/.env.local` for development, the host's env vars for the live site).

## Limits to know

- The perfect line ships with the game (it grades your corners), so anyone
  determined can submit it: such laps can only ever equal the perfect lap, so
  the board's best may show the perfect time. Ranks below it stay honest. If it
  becomes a problem: rate-limit per IP in the function, or cap submissions per
  device per day.
- No names, so no public table of who's who; the comparison is percentile and
  median only.

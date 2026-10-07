# Lapdle launch plan: October 2026

How daily games grow, from the research: a shareable result spreads through
group chats; one post in the right community (Immaculate Grid: r/baseball) or
one big share lights the fuse; football dailies live on short video (creators
filming themselves playing); directories and traffic swaps bring a steady
trickle; SEO compounds slowly. No paid ads.

Lapdle's edge over the trivia-style racing dailies: **it's the one where you
drive.** Lead every post with the racing line and the physics, not "another
racing wordle". Our own copy never names a series, team or driver.

## October goals (by the 31st)

| Result | Base | Target | Stretch |
| --- | --- | --- | --- |
| Players on a typical day | 100 | **300** | 2,000+ |
| Unique visitors in October | 3,000 | **10,000** | 50,000+ |
| Come back next day | 25% | **30%+** | 40% |
| Come back after a week | 8% | **12%+** | 20% |
| Games per visit | 1.5 | **2+** | 3 |
| Finished dailies shared | 3% | **5%+** | 10% |

Actions (what we control): 12+ directory listings · 6 community posts · 20
short videos · 25 creator DMs · one race-weekend push (Austin, 23–25 Oct).

## The four weeks

- **Week 1 (7–13): foundations.** Directories ✅ · first players from group
  chats · social accounts · play daily yourself.
- **Week 2 (14–20): community launch.** One post a day (below), two hours of
  replying after each. Daily short videos start.
- **Week 3 (21–27): Austin race week.** Videos on the Austin Quali, its braking
  point and an aerial view; creator DMs ("beat my lap at Austin"). On Saturday
  the 24th the Daily Quali is Austin.
- **Week 4 (28–31): review.** Read Plausible, double down on what worked, fix
  what loses players.

## Directory listing text

> **Lapdle**: https://lapdle.com
> A daily racing-line game. Set your line through every corner of a real
> circuit, then watch a physics-driven car drive it and chase the perfect lap.
> Plus daily mini-games: guess the circuit, braking points, pit stops, corner
> order and more.
> Categories: Sports, Trivia, Geography · Tags: racing, motorsport, circuits, daily puzzle

## Group-chat message (week 1)

> Made a daily racing game: you pick your line through each corner of a real
> circuit and a physics car drives it. Today's is [circuit]. My best is
> [your time], beat it 👇 https://lapdle.com

Send your own share grid instead when you have one: a result is more inviting
than a link.

## Social accounts

Same handle everywhere (`@lapdle`, or `@lapdlegame` if taken). Picture:
`apps/web/public/icon-512.png`. Link: https://lapdle.com

> Bio: Daily racing-line game. Pick your line, a physics car drives it, chase
> the perfect lap. New circuit every day 🏁

Then set the links in Cloudflare (`VITE_SOCIAL_X`, `VITE_SOCIAL_INSTAGRAM`,
`VITE_SOCIAL_TIKTOK`, `VITE_SOCIAL_YOUTUBE`, `VITE_SOCIAL_DISCORD`) and redeploy;
they appear in the footer.

## Short videos (from week 2, one per weekday)

Vertical, 20–30 s, a screen recording with a big caption. Show the guessing
moment, then the reveal. Same clip to TikTok, Shorts and Reels.

- **Aerial view:** "Which circuit is this?" Zoom-out, pause, reveal.
- **Speed trap:** "How fast is the car here?" Slider, then the speedometer.
- **Braking point:** "When would you brake?" The run, the brake, the result.
- **Daily Quali:** "Today's perfect lap is 1:09.296. Can you get within a second?"
- **Order the corners / Line-up:** "Only real fans get this."

Caption: one question, then `lapdle.com`. Hashtags: #racing #motorsport
#simracing #dailygame #puzzle.

## Community posts (week 2): one a day, read each sub's rules first

Post in your own voice; these are drafts to edit. Always add a short GIF or
screenshot. Reply to every comment for the first two hours; take criticism as
a gift ("good point, fixing that").

### r/formula1 (self-promotion allowed; descriptive title, no clickbait)

**Title:** I built a free daily game where you set the racing line on real circuits and a physics car drives it

> Every day there's one circuit (today it's [circuit, conditions]).
> You choose how to take each corner (early apex, classic, late, or drag every
> point yourself), hit lights out, and the car drives your line with real grip,
> braking and power limits. Each corner is coloured by how much time it lost
> to the perfect lap; you get six laps to earn a medal.
>
> There are some quick extras around it: guess the circuit from its
> surroundings, find the braking point, a pit stop, put a circuit's corners in
> lap order, and a few more.
>
> No account, no download, free: https://lapdle.com
>
> It's a fan project, not affiliated with anyone. I'd love to hear which
> circuits feel off and what you'd add.

### r/F1Technical (the physics angle; check the self-promo rules first)

**Title:** I modelled racing lines and lap times for 12 real circuits as a daily game: how close can you get to the optimal line?

> The car is a point-mass model with a friction circle (grip shared between
> braking and cornering), downforce that grows with speed, drag and a power
> limit. The speed profile is a forward/backward pass over the line's
> curvature, and the "perfect lap" is a line optimiser running inside the same
> corner controls the player gets. Wet and low-downforce days change the grip
> and aero, so the best line and the braking points move.
>
> Circuits are traced from OpenStreetMap and scaled to their official lengths.
> Happy to go into any part of it. Play: https://lapdle.com

### r/simracing

**Title:** Daily racing-line puzzle for the days you can't get on the rig

> Short daily challenge: one real circuit, you set the line through every
> corner, a physics car drives it and each corner shows the time lost to the
> optimal line. Today's is [circuit, conditions]. Free, in
> the browser: https://lapdle.com. Curious how sim racers' instincts
> compare to the optimiser.

### r/WebGames

**Title:** Lapdle: a daily racing-line puzzle (set the line, a physics car drives it)

> One circuit a day, six laps to find the fastest line, plus small daily
> extras (guess the circuit from above, braking points, pit stop). Free, no
> sign-up, works on phones: https://lapdle.com

### Show HN (weekday, ~8–10am US Eastern)

**Title:** Show HN: Lapdle – a daily racing-line puzzle with a deterministic physics engine

> Lapdle is a daily game: you set the racing line through a real circuit and a
> point-mass car drives it. A few things that were fun to build:
>
> - Circuits from OpenStreetMap, resampled and scaled to official lengths; the
>   map with buildings, trees and water is drawn on a 2D canvas.
> - A deterministic engine (only + − × ÷ √ in the timing path), so the
>   leaderboard server re-simulates the submitted line instead of trusting a
>   time.
> - The "perfect lap" is a line optimiser constrained to the player's own
>   corner controls, so it's always reachable.
> - Mini-games generated from the same data: braking zones and speed traps
>   taken from the optimal lap, a daily grouping puzzle that's only accepted if
>   it has exactly one answer.
>
> No account, cookieless analytics, installable and playable offline.
> https://lapdle.com

### r/SideProject (or r/IndieGaming)

**Title:** Launched my daily racing game this week: 11 games, 12 circuits, no account needed

> Short story of what it is, one screenshot, what's next, and an honest ask:
> "What would make you come back tomorrow?"

## Creator DMs (week 3; send yourself, never automated)

Small to mid racing creators (5k–100k): TikTok, YouTube, Twitch sim-racing streamers.

> Hey [name], love your [specific video]. I made a free daily racing-line game
> where you set the line and a physics car drives it. Today's is Austin and the
> perfect lap is [time]. Think you could beat [your time] on stream? No strings,
> just thought you'd enjoy it: https://lapdle.com

## Weekly check (Plausible)

- Visitors and players per day; where they came from (Sources).
- Next-day return: Visit with `last_played` = yesterday.
- Completion per game: Game finished ÷ Game started by `game`.
- Shares ÷ finished daily games.

## When AdSense approves

Create three display units (rail, in-content, phone anchor) and set
`VITE_ADSENSE_SLOT_RAIL`, `VITE_ADSENSE_SLOT_INLINE`, `VITE_ADSENSE_SLOT_ANCHOR`
in Cloudflare, then redeploy.

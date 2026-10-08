# Lapdle social plan: what to post, where, how (8 Oct – 8 Nov 2026)

Uses: social, community-marketing, video and launch practice from marketing-skills,
plus `LAUNCH_PLAN.md` and `GROWTH_AUDIT.md`. Accounts: Instagram, TikTok, YouTube
(Shorts), Reddit. The circuits and conditions below come from the game's own
schedule (`modes/schedule.ts`). A day starts at the player's local midnight, so
post "today's circuit" content in the European morning or midday, when Europe and
the Americas share the date.

## 0. Three things to settle before the first post

1. **Label the trailer as AI-generated.** Its footage is AI video (Veo), not the
   game. TikTok ("AI-generated" toggle), YouTube ("altered or synthetic content":
   yes) and Instagram ("AI info" label) all ask for this on realistic AI video.
   It costs nothing, and it avoids takedowns and "fake trailer" comments.
2. **Check the car's look.** An orange open-wheel car can remind people of a real
   team's livery. You decide whether it's distinct enough. Either way, captions
   and comments never name a series, team or driver. If anyone asks, the answer
   is "a fan-made game, not affiliated with anyone".
3. **The trailer sells the feeling; the gameplay clips sell the game.** The game
   is a top-down map with a racing line. Someone who taps through from the
   cinematic trailer expecting a 3D racer may leave. So the trailer is a single
   *pinned* post, and everything after it is a real screen recording. On Reddit,
   use only gameplay GIFs and screenshots. Reddit will call a cinematic AI
   trailer misleading.

**Tracking.** Every link uses a tag: `lapdle.com/?ref=tiktok`, `?ref=instagram`,
`?ref=youtube`, `?ref=reddit-<sub>`. The app currently drops these tags before
they reach Plausible (audit task 1.1). Fix that before the first link goes out,
or the platforms can't be compared.

---

## 1. Each platform's job

| Platform | Role | Rhythm | What goes there |
|---|---|---|---|
| **TikTok** | Discovery: strangers see you | 1 clip a day, Mon–Sat | 15–25 s gameplay clip with a question ("which circuit is this?") |
| **Instagram** | Discovery (Reels) + **daily reminder (Stories)** | Same Reel as TikTok + 1 Story a day | The Story is "Today: Spa, wet" with a link sticker. Your returning players see it and come back. |
| **YouTube** | Search: Shorts with searchable titles | Same clip, 4–6 a week | The title is the search phrase ("Suzuka racing line: when would you brake?") |
| **Reddit** | Communities: a few big posts, many good comments | 1 post a day in launch week (week 2), then race weekends | Self-posts with a GIF, written in your own voice, from your **personal** account |

One recording makes the TikTok, Reel and Short. Make it once, export once, and
post it three times with platform-specific captions. Expect about 30–40 minutes a
day, plus 2 hours on a Reddit launch day.

### Profile setup (do today)

- **Name:** Lapdle · **Handles:** TikTok [@lapdle](https://www.tiktok.com/@lapdle), YouTube [@lapdle](https://www.youtube.com/@lapdle), Instagram [@_lapdle_](https://www.instagram.com/_lapdle_/). Instagram has underscores on both sides, so write `@_lapdle_` whenever you tag or mention the Instagram account; "@lapdle" there is someone else's handle or nobody's.
- **Bio:**
  > Daily racing-line game. Pick your line, a physics car drives it. New circuit every day. Free, no sign-up.
- **Link:** `https://lapdle.com/?ref=<platform>`
- **Pinned:** the trailer (TikTok: pin; Instagram: pin to grid; YouTube: set as the channel trailer and pin a comment with the link).
- **Instagram Highlights:** "How to play", "Today", "Records". Fill them as Stories go up.
- Set `VITE_SOCIAL_INSTAGRAM`, `VITE_SOCIAL_TIKTOK` and `VITE_SOCIAL_YOUTUBE` in Cloudflare and redeploy, so the footer links to them.

---

## 2. The trailer post (Thu 8 or Fri 9 Oct)

Post the same day on TikTok, Reels and Shorts. Turn on the AI label. Pin it.

**TikTok**
> Pick your line through every corner of a real circuit. A physics car drives it. Can you find the perfect lap? New circuit every day, free at lapdle.com (link in bio)
> #racing #motorsport #simracing #dailygame #racingline

**Instagram Reel**
> A new circuit every day. You pick the line through every corner, a physics car drives it, and the map shows where you lost time. Six laps to find the perfect one.
> Free in your browser, link in bio.
> Trailer made with AI video; the game is at lapdle.com.
> #racing #motorsport #simracing #dailygame #racingline #puzzlegame

**YouTube Short**
- Title: `Lapdle: the daily racing-line game (trailer)`
- Description: `Pick your line through every corner of a real circuit and a physics car drives it. New circuit every day, free: https://lapdle.com/?ref=youtube`

Don't post the trailer to Reddit.

---

## 3. The recurring series (all real gameplay)

How to record: on your phone, open lapdle.com in portrait, use the screen
recorder, then trim and caption in CapCut. 15–25 s. In the first second, show
the game moment with large text. Pause on the question for 2 s so viewers can
guess. Reveal. End with a 2 s card: "New circuit every day · lapdle.com". Keep
text in the upper-middle of the frame, away from TikTok's right-side buttons and
the bottom caption area. Use the game's own sound or quiet music, and nothing
loud over the reveal.

| Series | Hook text (first second) | Body | Why it works |
|---|---|---|---|
| **A. Which circuit is this?** (Aerial view) | "Name this circuit from above" | Zoom out in steps, 2 s pause, reveal the circuit drawn in | Viewers answer in the comments; replays to check the answer |
| **B. When would you brake?** (Braking point) | "Brake at the last possible metre" | The run toward the boards, freeze, then your brake and the "x m from perfect" | One clear question, satisfying result |
| **C. How fast here?** (Speed trap) | "Guess the speed through this corner" | Slider moving, freeze, speedometer reveal | A number people argue about |
| **D. Today's perfect lap** (Daily Quali) | "Today's perfect lap at Suzuka is 1:xx.xxx" | Your lap 1 (red corners) → lap 6 (purple). Show the corner colours. | The core game, and a challenge |
| **E. Early or late apex?** (Quali, physics) | "Same corner. Which line is faster?" | Two laps of one corner side by side, then the timing | Teaches the game; genuine debate |
| **F. Wet day** (when conditions = wet) | "It rained at Spa. The line moved." | Dry line against the wet line on one corner | Shows the physics is real |
| **G. Build story** (once a week) | "I built a physics engine for a daily game" | Point at the screen: how the car's speed comes from the line, the optimiser, the leaderboard checking laps | Founder content; also suits r/SideProject and YouTube |

Captions follow one pattern: **one question, then the answer prompt, then the link.**
- "Which circuit is this? Answer before the reveal. Today's game: link in bio."
- "Where would you brake? I was 14 m late. Play today's at lapdle.com"

Hashtags (3–5): #racing #motorsport #simracing #dailygame plus the circuit
(#suzuka, #spa, #monza). Leave series, team and driver hashtags off this account.

**Comments:** reply to every comment in the first hour. When someone gets the
answer, pin their comment. When someone says "too easy", answer with the next
day's harder one. That gives you the next video.

---

## 4. Instagram Story every day (the return trigger)

Each morning: a screenshot of the hub or today's Quali map, with this text and a
link sticker to `lapdle.com/?ref=ig-story`:

> Today: Suzuka. Perfect lap 1:xx.xxx. Six laps to beat it.

On wet or low-downforce days, lead with it ("Wet at Spa today"). After posting a
Reel, share it to the Story too. Stories reach your existing followers, which is
the "come back tomorrow" job. Reels are the "find new people" job.

---

## 5. Reddit (community-marketing approach)

**Before posting:** use your personal account, not a brand-new "lapdle" one. New
accounts with no history are often filtered by spam rules and subreddit
karma/age limits. This week, leave 10–15 genuine comments in r/simracing,
r/F1Technical and r/WebGames: answer questions and give real opinions, with no
links. Read each sub's self-promotion rules on the day you post.

**Week 2 schedule** (drafts are in `LAUNCH_PLAN.md`; edit them into your own words):

| Day | Sub | Angle | Media |
|---|---|---|---|
| Thu 15 Oct | r/WebGames | the game itself | GIF of a lap with the corner colours |
| Fri 16 Oct (Spa, wet) | r/simracing | "the daily for the days you can't get on the rig" | GIF: wet Spa line |
| Mon 19 Oct | r/F1Technical | the physics model (check the promo rules first; if not allowed, skip it) | Screenshot of the speed trace |
| Tue 20 Oct | Show HN (news.ycombinator.com, ~14:00–16:00 CET) | the deterministic engine | Link only |
| Wed 21 Oct | r/formula1 | "I built a free daily game…" (fan project, says it's not affiliated) | GIF |
| Sat 24 Oct (Austin) | r/SideProject or r/IndieGaming | build story + "what would make you come back tomorrow?" | Screenshot |

The rules for every post:
- Disclose that you made it.
- Put the link inside the post with its `?ref=reddit-<sub>` tag.
- Reply for 2 hours.
- Fix one thing people complain about, and then say so in the thread.
- Never ask friends to upvote.

---

## 6. Calendar

Same clip on TikTok + Reel + Short unless noted. Story = the Instagram daily Story (every day, not repeated below).

**Week 1: set up, trailer, first clips**

| Date | Today's circuit | Post |
|---|---|---|
| Thu 8 Oct | Suzuka | Profiles, bio and links. Trailer on all 3 (pinned, AI-labelled). |
| Fri 9 | Barcelona, **wet** | F: "It rained at Barcelona. The line moved." |
| Sat 10 | Austin | A: "Name this circuit from above" (Austin) |
| Sun 11 | Spielberg, wet | Rest day for short video; Story only |
| Mon 12 | Silverstone, low downforce | D: today's perfect lap at Silverstone |
| Tue 13 | Monza | B: "Brake at the last metre: Monza T1" |
| Wed 14 | Zandvoort, low downforce | E: early or late apex at Zandvoort's banked corner. **First weekly review** (§8). |

**Week 2: Reddit launch week** (Reddit posts in §5)

| Date | Circuit | Post |
|---|---|---|
| Thu 15 | Hungaroring | C: speed trap |
| Fri 16 | Spa, wet | F: wet Spa |
| Sat 17 | Monaco, wet | A: "Name this circuit" (Monaco is quickly guessed, so use a tight zoom) |
| Mon 19 | Interlagos | G: build story #1 (physics) |
| Tue 20 | Monza, wet | D: today's perfect lap, wet Monza |
| Wed 21 | Silverstone | the best-performing series so far, again |

**Week 3: Austin race week** (the hub shows the race-week banner; Saturday's Quali is Austin)

| Date | Circuit | Post |
|---|---|---|
| Thu 22 | Imola | B: braking point at Imola |
| Fri 23 | Spielberg, low downforce | "Saturday's circuit is Austin. Practise it now" (Austin circuit guide + practice link) |
| Sat 24 | **Austin** | D: today's perfect lap at Austin. Story + Reel + Short. Creator DMs go out today with a personal `?ref=<creator>` link. |
| Sun 25 | Monaco, low downforce | A: aerial view, Austin's surroundings |
| Mon 26 – Wed 28 | Barcelona / Suzuka (wet) / Hungaroring (wet) | Two wet-day clips (F) and one build story (G) |

**Week 4: double down, Interlagos weekend**

| Date | Circuit | Post |
|---|---|---|
| Thu 29 – Sat 31 | Spa (low df), Spa, Hungaroring (low df) | Only the 2 best series from the review |
| Sun 1 – Thu 5 Nov | Silverstone (wet), Imola (wet), Suzuka (low df), Zandvoort (wet), Monza (low df) | Same, plus "Interlagos this weekend" on Thu 5 |
| Fri 6 – Sat 7 | **Interlagos** (Sat = race-weekend Quali) | Austin playbook again |

---

## 7. Daily routine (about 40 minutes)

1. **5 min:** play today's Quali. Note the circuit, conditions and perfect-lap time.
2. **5 min:** post the Instagram Story.
3. **15 min:** record and caption the clip (or batch three clips on Sunday).
4. **5 min:** post it to TikTok, Reels and Shorts with the platform captions.
5. **10 min:** reply to every comment from yesterday and today. Leave 3–5 real comments on other racing creators' posts.

---

## 8. What to measure, and when to change course

Platform stats (each app's analytics), per post:

- **Hold rate:** the share still watching after 3 s; TikTok and YouTube show the retention curve. A low hold rate means the hook is wrong.
- **Average watch %:** a low figure means the clip is too long or too slow.
- **Shares and saves, then comments.** These matter more than likes.
- **Profile visits and link clicks.**

On the site (Plausible, once the tags work):

- Visits and `Game finished` per `ref` (`tiktok`, `instagram`, `ig-story`, `youtube`, `reddit-*`).
- `Visit last_played=yesterday` while daily Stories run, to see whether reminders bring people back.

Decision rules:

- **After 10 posts of a series,** compare each series' median hold rate and link clicks. Keep the best two and drop the worst.
- **If a clip clearly beats the rest,** make 3 variations of it within a week: same series, a different circuit, a new hook.
- **Don't judge a platform on fewer than about 15 posts.** Early reach on new accounts is noisy.

The first review is Wed 14 Oct, then every Wednesday. Log it in a simple table:
date, series, platform, views, hold %, shares, clicks.

---

## 9. Don'ts

- Don't use series or team names, logos, liveries or driver names in our posts, thumbnails or hashtags.
- Don't post the AI trailer without its label, and don't post it anywhere as gameplay.
- Don't post the same Reddit post to several subs on one day, and don't post from a new account.
- Don't buy followers or views, and don't use engagement pods. They kill reach on new accounts.
- Don't post captions that sound generated: no "Say goodbye to…", no emoji bullets, no em dashes.

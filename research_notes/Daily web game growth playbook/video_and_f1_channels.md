# Short-form video and F1 community channels as growth levers for Lapdle

Research date: 2026-11-11. About 16 search and fetch calls. Reddit itself (old.reddit) and Indie Hackers returned errors or 403 to the fetch tool, so firsthand Reddit launch threads and r/formula1's live rules page could **not** be read directly. That is the biggest gap in these notes.

## Q1. Why short-form video brings few site visits, and what converts views into visits

### Takeaway
A large view-to-visit loss is normal, and it gets worse for a web product. Short-form viewers are in "entertain me in-app" mode. Links are gated or not clickable on every platform. Much of the real effect shows up as untracked branded search, not bio-link clicks. The levers with evidence behind them:
- a name people can remember and type in, with a clear on-screen CTA held for about 3 seconds;
- homemade-feeling gameplay clips posted consistently;
- a share or search path that does not depend on the bio link.

### Cited Findings
- **Funnel benchmark (vendor estimate, not measured data):** roughly 2-5% of viewers visit the profile, and 1-3% of those click the bio link. Taken together that is about 0.02-0.15% of views. At 20-30K views this means single-digit to low-double-digit clicks, which fits Lapdle's 1-4 visits per week. — [linkie.bio](https://linkie.bio/blog/how-to-drive-traffic-from-tiktok) (vendor blog; treat as rough)
- **Views and visits measure different things.** A video can have strong watch time while website sessions barely move. — [Trollishly research via The Rooftop Guide](https://www.therooftopguide.com/features/trollishly-research-why-tiktok-views-do-not-always-turn-into-profile-visits.html) (marketing vendor)
- **TikTok bio-link gate.** A clickable website field generally needs 1,000+ followers or a registered business account. Sources conflict on whether it is "either/or" or "both". A URL typed into the bio text renders as plain, non-tappable text. You cannot add the link from desktop. — [Buffer](https://buffer.com/resources/how-to-put-a-link-in-tiktok-bio); [Mobilocard](https://www.mobilocard.com/post/how-to-add-a-link-to-tiktok-bio) (says both are required); [link.boo](https://link.boo/for/tiktok). I could not reach TikTok's own help page; verify there.
- **YouTube Shorts links.** URLs in a Short's title, description or comments are not clickable. The native "Related video" link can only point to your own YouTube content (a long-form video, live stream or another Short), not an external URL. The usual workaround is Short → Related video (a long-form video with the link in its description), or the channel header link. — [YouTube Blog](https://blog.youtube/creator-and-artist-stories/youtube-related-videos-traffic-guide/); [ferryman.io](https://ferryman.io/blog/youtube-shorts-description-links-not-clickable); [ytsaave](https://ytsaave.substack.com/p/how-to-post-links-on-youtube-shorts). Sources conflict on details such as whether advanced features are required and whether it is desktop-only.
- **Branded search shows up as "invisible" conversion (firsthand developer data, Feb 2022).** The Steam game *I Just Want to be Single!!* (Tsunderestudio):
  - The viral TikTok was a clip of the game's main menu: 571K views and over 2,900 wishlists. Total wishlists went from 3K to 6K in about a month. That works out to about 0.5% of views, a wishlist not a visit.
  - The second-largest traffic source after TikTok was Steam search. Zukowski explains this as people who "see something cool on their phone… walk over to their PC and type in the game's name".
  - UTM links in the TikTok bio captured only about 10% of real traffic.
  - Source: [How To Market A Game, Chris Zukowski, 2022-02-07](https://howtomarketagame.com/2022/02/07/seven-great-tips-for-marketing-your-indie-game-on-tiktok/)
- **Format lessons from the same case:**
  - The developer filmed the monitor with a phone and used text-to-speech. Higher production value performed worse.
  - Keep videos as short as possible, hook in the first second, and loop seamlessly.
  - Show a big, clear CTA on screen for about 3 seconds.
  - Momentum carried over between videos: view counts ran 191.9K, 569.7K, 434.9K, 87.7K, 94.4K and 29.1K.
  - Keep posting through a weak first week.
  - The article does not address on-camera face vs no face.
  - Source: [howtomarketagame.com](https://howtomarketagame.com/2022/02/07/seven-great-tips-for-marketing-your-indie-game-on-tiktok/)
- **Gameplay vs explainer.** The case above is gameplay or UI footage, not an explainer. A second account (itch.io, Sept 2025) reports a breakout boss-fight clip with about 500K views in 48 hours around day 10 of daily posting, and an install rate that "tripled" that week. It also used challenge clips, a branded challenge hashtag and a "tag someone who could beat this" CTA. **Low reliability:** the post is self-reported, gives no click data, and reads as possibly promotional. — [itch.io blog](https://itch.io/blog/1032829/how-i-used-tiktok-to-drive-traffic-to-my-game)
- **TikTok search to Google search.** An Indie Hackers post reports that a TikTok clip multiplied the author's site traffic *and Google Search clicks*. The page returned 403, so the numbers could not be read; the search snippet says results were modest and the post is about 4 years old. — [Indie Hackers](https://www.indiehackers.com/post/this-simple-tiktok-clip-multiplied-my-website-traffic-and-google-search-clicks-cc79426a92)
- **Comment-keyword → DM (Instagram):**
  - Vendors claim 15-65% of DM recipients click the link, against roughly 1-3% for link-in-bio.
  - These numbers are all unverified vendor marketing with no methodology, and they conflict with each other.
  - One example model: 25 commenters → 15 clicks.
  - A ManyChat user reports that automation fired on only a small share of comments on a viral Reel.
  - One practitioner says click-through fell from over 70% to under 20% when the link was sent immediately instead of behind an opt-in button.
  - Sources: [CreatorFlow](https://creatorflow.so/blog/comment-link-instagram-strategy); [ReplyRush](https://www.replyrush.com/post/instagram-auto-dm); [ManyChat community](https://community.manychat.com/general-q-a-43/instagram-reel-automation-only-triggered-for-a-small-percentage-of-comments-on-a-viral-post-8118); [nowbam](https://nowbam.com/the-broke-agent-shares-the-manychat-dm-sequence-that-took-his-instagram-click-through-rate-from-under-20-back-above-70/)
- **The daily-game precedent: sharing, not video, drove Wordle.**
  - About 90 players around Nov 1, 2021, and over 300K daily players by late December, after the spoiler-free emoji share grid was added. Sources disagree on whether that was in November or December.
  - Wardle deliberately kept it to one puzzle per day.
  - Sources: [BuzzFeed News](https://www.buzzfeednews.com/article/stefficao/how-wordle-went-viral-strategy); [The Spinoff](https://thespinoff.co.nz/business/13-01-2022/those-coloured-boxes-on-twitter-are-new-zealands-fault); [TechCrunch interview](https://techcrunch.com/2022/01/12/josh-wardle-interview-wordle/)

### Inferences
- With a faceless explainer format, 20-30K views and 1-4 tracked visits per week is close to what the funnel benchmarks predict. It is not necessarily a broken funnel. Some visits are probably arriving as Google "lapdle" searches or direct type-ins that are not credited to TikTok or Instagram (compare the roughly 10% UTM capture in the Steam case). Check Search Console for branded "lapdle" impressions and clicks on the days after posts.
- Explainers teach *about* the game. Gameplay or "can you beat this line?" clips make the viewer want to *play*, and that desire is what makes someone type a URL. The evidence favours raw gameplay or UI with a clear challenge and a URL burned into the video, for example "LAPDLE.COM" on the end frame for about 3 seconds.
- Platform-specific fixes:
  - **TikTok:** confirm the bio website field is actually live (business account or 1K followers). Pin a comment with the URL spelled out.
  - **YouTube:** make one evergreen long-form "How to play Lapdle" video with the link in its description, and set it as the Related video on every Short.
  - **Instagram:** a comment-keyword DM ("comment LINE") is the strongest-claimed lever, but the data is unverified, so A/B test it.
- A share-result card (a Wordle-style grid for racing lines) probably matters more for growth than video does. Video should seed the share loop, not stand in for it.
- Faceless vs face: I found **no** firsthand data comparing them for games. The "homemade beats polished" finding suggests that authenticity matters more than having a face.

### Gaps
- No dated firsthand case of a *browser daily puzzle* (as opposed to Steam or mobile) growing through TikTok with click numbers. The relevant Reddit and Indie Hackers pages were blocked from fetch.
- No data on the "search X on Google" CTA, or on posting-frequency thresholds beyond anecdotes (daily posting; "consistent schedule").
- No independent study of comment-to-DM conversion.

## Q2. Which F1 fan channels and event moments a small F1 game can realistically use

### Takeaway
I could verify very little firsthand.
- r/formula1 applies self-promotion rules even to fan-made content, and its rules page could not be fetched.
- Reddit's general norm is that 10% or less of your activity should be self-links.
- Smaller F1 subreddits (r/formulaone) explicitly welcome project posts.
- Some game subs (r/F1Manager) ban Shorts and TikTok links outright.
- I found no evidence that PlanetF1, GPFans, The Race or RaceFans cover indie fan games. Their coverage of F1 "games" is official titles and licensed tie-ins.
- Off-season data specific to Dec-Feb was not found.

### Cited Findings
- **r/formula1:** its flair guide states fan-made content (posters) is "subject to the self-promotion guidelines" on the main rules page. The rules text was not retrievable (old.reddit is blocked for the fetch tool; only mirrors were indexed). — [r/formula1 flair guide (mirror)](https://lr.us.psf.lt/r/formula1/wiki/flairguide)
- **Reddit-wide norm (cited by F1-adjacent subs such as r/WEC):** "10% or less of your posting… should link to your own content." — [r/WEC wiki (mirror)](https://rl.klein.ruhr/r/wec/wiki/index)
- **r/formulaone** (the smaller sister sub) says "you're welcome to promote your projects here". — [r/FormulaOne (mirror, Mar 2026)](https://r.datuan.dev/r/FormulaOne)
- **r/F1Manager** bars links to YouTube Shorts, TikTok and playthroughs. Do not cross-post reels to F1 game subs. — [r/F1Manager rules (mirror)](https://axebps-redlib.hf.space/r/F1Manager/wiki/index/rules)
- **r/F1Game** runs a Discord ("rF1Game F1 and simracing") that could be a softer place to share. — [Discord listing](https://discord.com/servers/rf1game-f1-and-simracing-644238627110518836)
- **F1 media coverage:**
  - Searches of PlanetF1 and GPFans for fan-made games returned only official-game news, for example GPFans on the F1 25 cover stars and the F1 Monopoly tie-in.
  - Formula1.com runs its own quizzes, for example an emoji "guess the driver" quiz, so official F1 competes in this format.
  - Sources: [GPFans F1 25](https://www.gpfans.com/en/f1-news/1044952/controversial-f1-25-game-cover-stars-carlos-sainz-oliver-bearman-oscar-piastri-fans-stunned/); [GPFans Monopoly](https://www.gpfans.com/en/f1-news/1084147/f1-iconic-board-game-monopoly/); [Formula1.com emoji quiz](https://www.formula1.com/en/latest/article.emoji-quiz-guess-the-f1-team-or-driver-from-the-emojis-displayed.QSnneZng6gBr82PUMlB4Z.html)
- **F1 social interest follows the competitive narrative.**
  - Buzz Radar reported F1 mentions down about 70%, new followers down about 46% and reach down about 64% for Jan-May 2023 vs 2022. It blamed Red Bull dominance.
  - F1 disputed this and said active engagement was up 4%.
  - Contested data, and not off-season-specific.
  - Sources: [BlackBook Motorsport](https://www.blackbookmotorsport.com/news/f1-social-engagement-decline-first-time-liberty-media-era/); [PlanetF1 on F1's rebuttal](https://www.planetf1.com/news/f1-respond-social-media-decline-reports)

### Inferences
- Realistic channel order for an anonymous small game (my judgement, not verified):
  1. r/formulaone and the r/F1Game Discord: project posts are allowed.
  2. r/formula1: read the rules or message the mods first. A post tied to a moment (for example "today's line is the Las Vegas Strip, can you beat the pole lap?") is more likely to be seen as content than as an ad.
  3. F1 X/Bluesky race-weekend conversations: reply with a share card under trending session posts.
  4. Direct outreach to F1 newsletters and small F1 YouTubers or podcasters (no evidence found that any feature fan games).
- Event timing: post the track-specific puzzle before qualifying and race day, when interest in the circuit is highest. For Las Vegas (20-22 Nov 2026) that means Las Vegas Strip content Thu-Sat, with a race-day share hook on Sunday. Then a season finale (Abu Dhabi), then the off-season. This is an inference; I found no data on spikes by session.
- Off-season (Dec-Feb): with no race hooks, lean on evergreen "classic laps" and historic circuits, on-the-day news moments (car launches in Feb, testing), and SEO. This is opinion, with no data found.

### Gaps
- r/formula1's actual self-promotion text, its designated threads, and examples of fan-game posts that did well: Reddit could not be fetched.
- Whether F1 YouTubers or podcasters, newsletters, RaceFans or The Race have ever featured fan web games: nothing found.
- Bluesky and X F1 community norms: not researched due to budget.
- Race-weekend traffic spike data (e.g., Google Trends by session): not found.

## Q3. Case examples of F1 fan web games that grew, and how

### Takeaway
There are many F1 "-dle" games (Gridle, Paddockdle, Sportsdle F1, Driverle, Formudle, Stewardle), but I found no independent, firsthand growth numbers or growth stories for any of them. Available claims come from competitors' comparison pages. They show a crowded driver-guessing niche, and they suggest Lapdle's racing-line angle is a point of difference.

### Cited Findings
- **Gridle:** a Wordle-style F1 driver identification game. Wrong guesses reveal clues; 6 guesses, one round per day. Covered by a repost-style article; no user figures. — [lavendertron (repost)](https://lavendertron.pages.dev/posts/wordle-fan-makes-formula-1-themed-version-of-the-game)
- **Paddockdle:** daily driver guessing with Classic, Pixel and Career modes. Called "one of the fastest-growing" by competitor Sportsdle (marketing claim). — [Sportsdle comparison](https://sportsdle.com/blog/paddockdle-vs-sportsdle)
- **Sportsdle F1:** driver-attribute guessing, an Immaculate Grid mode and a user challenge maker (user-generated puzzles as a sharing loop). Uses competitor-comparison blog posts as SEO, for example "best F1 wordle games" and "X vs Sportsdle" pages. — [Sportsdle F1 wordle maker](https://sportsdle.com/f1/wordle-maker); [Best F1 Wordle games](https://sportsdle.com/blog/best-f1-wordle-games)
- **Driverle:** built on Formula1points.com statistics, so it is distributed through an existing stats site's audience. — [Formula1points](https://www.formula1points.com/what-is-driverle)
- **F1 Typer** and **Lights Out** (an F1 start-lights reaction game) launched on Product Hunt. No traction data found. — [Product Hunt F1 Typer](https://www.producthunt.com/products/f1-typer-al); [Product Hunt Lights Out](https://www.producthunt.com/products/lights-out-2/launches)

### Inferences
- The visible growth tactics in this niche are:
  - **SEO comparison and listicle pages** (Sportsdle ranks for "Paddockdle vs…", "best F1 wordle games").
  - **Piggybacking on an existing F1 site audience** (Driverle on Formula1points).
  - **User-generated challenge makers** for sharing.
- Lapdle could get listed in the "best F1 wordle / daily F1 games" roundups, and publish its own "F1 daily games" comparison page.
- Because the driver-guessing niche is saturated, video and Reddit posts should lead with what is unique: "guess the racing line" or "drive the line", not "another F1dle".

### Gaps
- No player counts, traffic data or launch-thread histories for any F1 fan game. These would need Reddit search, Similarweb, or contacting the developers directly.
- No F1 reflex test or start-lights game with documented viral spread was found.

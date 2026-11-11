# Distribution tactics for small, anonymous, free daily web games (post-launch growth)

Context: Lapdle (lapdle.com), anonymous daily F1 racing-line games, no account, about 10-20 DAU after a launch spike of about 50. Already done: several dle directories (The DLES, Playlin, Listdle, Dle Hunt, browse.games, itch.io) and Product Hunt. Show HN was rejected because the account is new. Reddit posts are made by hand.

Evidence labels: **[Evidence]** means a firsthand account or data with numbers. **[Opinion]** means guidance or an assertion without data. Research was done 2026-11-11 under a budget of about 15 tool calls. Reddit pages could not be fetched directly (blocked), so some subreddit rules are secondhand.

## Reddit: subreddits, formats, self-promotion rules, timing, avoiding bans

### Takeaway
The best firsthand evidence for daily web games is that a **niche, topic-native subreddit** gives early momentum and a generic dev/web subreddit gives almost nothing. Globle got "absolutely zero traffic" from r/webdev but "immediately got some momentum" on r/geography. Waffle grew from two Reddit posts. For Lapdle, the equivalents of r/geography are F1 and sim-racing communities, not r/webdev or r/SideProject. Mods check the poster's history, so a clean, mostly non-promotional account matters more than any posting format.

### Cited Findings
- **[Evidence]** Globle (2022): the creator posted on r/webdev and got "absolutely zero traffic". On r/geography it "immediately got some momentum". He read commenters' complaints (missing countries, confusion about how to play) as engagement. He credits luck with the first players and says most subreddits discourage or ban self-promotion. — [hey.gg interview with Trainwreck Labs](https://www.hey.gg/blog/trainwrecklabs); also summarized in [search snippet of the hey.gg podcast](https://hey.gg/podcast/trainwrecklabs)
- **[Evidence]** Waffle (Feb 2022): James Robinson posted it on Reddit "in two channels" and says growth was "very organic". Dropping it into Twitter conversations gave "nothing more than that for a long time." — [mobilegamer.biz](https://mobilegamer.biz/daily-word-game-studio-waffle-is-the-latest-small-dev-to-find-a-big-audience)
- **[Evidence]** Wordle's creator Josh Wardle had worked at Reddit (r/Place, r/TheButton). Wordle grew by word of mouth and the emoji share grid, not a Reddit launch post: from 90 players on Nov 1, 2021 to over 300k by Jan 2, 2022. — [Wikipedia: Wordle](https://en.wikipedia.org/wiki/Wordle); [TechCrunch interview](https://techcrunch.com/2022/01/12/josh-wardle-interview-wordle/)
- **[Evidence]** A two-person team got 11,000 Steam wishlists from one Reddit post. Moderators checked the poster's profile, saw he had never self-promoted, and decided he wasn't a spammer. — [howtomarketagame.com (Jan 2022)](https://howtomarketagame.com/2022/01/10/how-a-two-person-team-earned-11000-wishlists-with-one-reddit-post/)
- **[Opinion/Rule]** r/Games has a 10% rule of thumb: when self-promotion goes over 10% of a user's Reddit activity, further promo is removed. — [r/Games FAQ mirror](https://axebps-redlib.hf.space/r/Games/wiki/faq)
- **[Opinion]** Chris Zukowski: the big gaming subreddits are "VERY VERY strict" about self-promo, the tone has to be right, and an older post gives the 1 promo per 10 generic posts guideline plus r/Games Indie Sunday once a month. — [howtomarketagame.com](https://howtomarketagame.com/?p=1731); [howtomarketagame.com](https://howtomarketagame.com/?p=1825)
- **[Opinion]** Reddit's official 10:1 self-promotion guideline was retired years ago, but its spirit survives in subreddit rules and mod judgment. Brand-new accounts with no history that post something to sell are exactly what automod and mods catch. — [bugnet.io guide](https://bugnet.io/blog/reddit-marketing-for-indie-games-without-getting-banned); [gtstu.com guide](https://gtstu.com/promote-indie-game-reddit-without-ban/)
- **[Rule]** r/indiegames forbids promotion "under the guise of asking for feedback". r/gamedev removes posts it finds too self-serving. — [search summary of subreddit rules](https://redlib.belloworld.it/r/indiegames); [r/gamedev wiki mirror](https://cal1.lr.ggtyler.dev/r/gamedev/wiki/good_posts)
- **[Evidence, ambiguous channel]** Xordle's biggest traffic spike came from a TikTok creator who played it, not from the dev's own posts. — [hey.gg Xordle interview](https://www.hey.gg/blog/xordle)
- **[Evidence]** Several F1 daily games already exist: F1DLE, Driverle (run by formula1points.com), Boxdle, Driverdle, and PaddockDle (made by the Paddock Talk F1 podcast team). Lapdle posts in F1 subs are competing with these for novelty. — [f1dle.com](https://f1dle.com/car); [formula1points.com Driverle](https://www.formula1points.com/driverle/); [playpaddockdle.com](https://playpaddockdle.com/); [boxboxd.fun](https://boxboxd.fun/boxdle)

### Inferences
- Rank the subreddits by topic fit, not game fit. For a racing-line game that means r/formula1 (strict, large), r/F1Game, r/simracing, r/F1Technical (racing lines suit its technical bent), and track or series communities. r/WebGames is a reasonable secondary. r/SideProject and r/webdev are likely near-zero for players, judging by Globle's r/webdev result.
- Lead with the content (a GIF or still of the racing line challenge, or "can you beat the pro line through Eau Rouge?"), not "I made a game". Be open that you made it, because mods check history and hidden promotion gets punished harder. This follows the Zukowski and rules evidence, not a measured A/B test.
- Follow-up posts should carry new content for that community, such as a new circuit tied to that weekend's Grand Prix, or data like "players' average line vs the real pole lap". A plain "update" post probably won't work. Tying posts to the race calendar (Monday after a GP, or race week) is an inference with no measured evidence.
- Spend time participating in F1 subs (non-promo comments) so the account passes a profile check. This matters more for an anonymous account.

### Gaps
- Could not fetch r/formula1, r/F1Game, r/simracing or r/WebGames rules pages (Reddit blocks the fetcher). The user should read each sidebar or wiki by hand. Many big subs limit self-promotion to designated threads or days or require mod approval.
- No firsthand data found on best posting times for game posts, or on dev vs. "player" persona results. Posting as a fake player is astroturfing and against Reddit rules. No source endorses it.
- No numbers found for "I made X, here are the stats" follow-up posts for web games.

## Hacker News: Show HN practice, new-account limits, what reaches the front page

### Takeaway
Daily web games do well on Show HN when they are novel, free of signups, and post an interesting mechanic. At least 14 daily or puzzle Show HNs from 2022-2026 passed 100 points, with peaks of 417 and 320. The main risks are vote-ring flags from sharing the link, and new-account filtering.

### Cited Findings
- **[Rule]** Show HN needs something people can try, "ideally without barriers such as signups or emails". It must be non-trivial, built by you, with you around to discuss it. No landing pages. Routine updates don't qualify (a major overhaul may). "Don't ask friends to upvote or comment." — [HN Show HN guidelines](https://news.ycombinator.com/showhn.html)
- **[Evidence]** Daily-game Show HNs over 100 points, from the HN Algolia API: Figure daily logic puzzle, 417 pts (Aug 2022); Putt.day daily mini golf, 320 pts (Jun 2026); Gerrymandle daily districting puzzle, 244 pts (Jun 2026); Perfect Pitch Puzzle, 225 pts (Nov 2023); Three Magic Words, 204 (Feb 2022); Countle, 152 (Sep 2022); Wonderhop, 124 (Oct 2026); Bracket City, 109 (Feb 2025); Qwertle, 103 (Jan 2024); Hidden Mirrors, 126 (May 2024); Whittle, 141 (Aug 2025). — [HN Algolia search](https://hn.algolia.com/api/v1/search?query=Show%20HN%20daily%20game&tags=show_hn&numericFilters=points%3E100&hitsPerPage=30)
- **[Evidence]** A solo browser tower defense had its Show HN flagged within hours (Jul 2026), likely because the author shared the direct link, which HN reads as vote manipulation. — [itch.io postmortem](https://itch.io/t/6645181/launch-week-postmortem-solo-browser-td-product-hunt-a-portal-rejection-and-a-flagged-show-hn-numbers-inside)
- **[Evidence, secondhand]** An Ask HN post (as mirrored) said all new-user comments are now hidden from public view, and new users wrongly marked [dead] can ask admins through the contact page. These are mirrors, not official HN pages. — [frontpage mirror](https://frontpage-app.vercel.app/news/45887709); [FeedBagel summary](https://feedbagel.com/post/discussion-on-restricting-new-account-posting-on-hacker-news)
- **[Evidence]** HN front-page traffic varies by rank: around 40,000 visits at #28 in one case. A rough guide puts the top 1-5 at 20k-100k+ visits over 24-48h. It fades within hours to a day, and caching or a CDN prevents outages. — [Reproof](https://www.reproof.app/blog/the-hacker-news-effect); [Nick Lafferty](https://nicklafferty.com/blog/what-happens-when-you-re-on-the-front-page-of-hacker-news/); [thehftguy](https://thehftguy.com/2017/09/26/hitting-hacker-news-front-page-how-much-traffic-do-you-get/)
- **[Evidence]** "HN Arcade" is a community directory of games from Show HN posts, which gives successful posts a second home. — [hn.svelte.dev mirror of Show HN: The HN Arcade](https://hn.svelte.dev/item/46793693); [HN Arcade newsletter](https://buttondown.com/andrewgy8/archive/issue-1/)

### Inferences
- Lapdle fits Show HN well: it has no signup, a novel mechanic (racing lines rather than word guessing), and an interesting technical story (line physics, how the "ideal line" is scored). The successful titles follow the pattern "Show HN: X – a daily [unusual thing] game".
- The new-account rejection probably means the account needs real comment history first. Wait, comment normally for a few weeks, then resubmit. Possibly email hn@ycombinator.com (the contact route mentioned in the mirror) to ask whether a repost is OK. HN's mods are known to invite reposts, but I did not verify that here.
- Never share the HN link to get votes. Share the game URL only.
- The Cloudflare proxy (recent commit "Cloudflare Proxy Fix") should be set to cache static assets before any HN attempt.

### Gaps
- No official HN page found that states new-account submission limits. Karma or age thresholds are not documented publicly.
- No firsthand traffic or retention numbers found from the daily-game Show HN authors above.

## Directories and aggregators: which send traffic for daily/dle games

### Takeaway
I found no firsthand evidence that dle directories send meaningful traffic. The tens to hundreds of thousands of DAU in the successful cases came from press, organic search and word of mouth. Big portals (Poki, CrazyGames) are curated and suit session-based games, so they fit a one-a-day game poorly. Unblocked-style search ("X unblocked") is a documented niche channel for school Chromebooks.

### Cited Findings
- **[Evidence]** DLEDB tracks 1,600+ daily games with traffic estimates, which shows how crowded the category is. — [DLEDB](https://dledb.com/)
- **[Evidence]** Playlin's creators page offers maker profiles, "Meet the Makers" interviews and social-channel promotion, but publishes no traffic, embed or revenue terms. — [Playlin creators](https://playlin.io/creators/)
- **[Evidence]** The WordGuessr clone's notable traffic came from being unblocked on school networks, through Chromebook searches for "Wordle Unblocked". — [Engaging Data](https://engaging-data.com/wordguessr-wordle/)
- **[Evidence]** War Clicks: launching on Armor Games through an iframe led many other game sites to pick it up and embed it, which brought "an unexpected amount of traffic" early on. — [Game Developer postmortem](https://www.gamedeveloper.com/business/from-a-prototype-to-one-of-the-biggest-idle-games-in-3-years-postmortem)
- **[Evidence]** CrazyGames rejected a 2026 browser TD before launch as "too close to existing titles". itch.io was the easiest launch, with the kindest community. Product Hunt ranked low without an audience, though its comments were useful. Launch-day players halved every day after (55, then about 100 over 2.5 days, 2% D1 retention). — [itch.io postmortem](https://itch.io/t/6645181/launch-week-postmortem-solo-browser-td-product-hunt-a-portal-rejection-and-a-flagged-show-hn-numbers-inside)
- **[Opinion/secondhand]** Poki is curated and invite-only. Reported terms: 50/50 on Poki-sourced players, 100% on your own traffic, sometimes web exclusivity. CrazyGames reviews in 1-3 days, and full monetization reportedly unlocks around 50k plays. Web game earnings are "wildly top-heavy" and the median is near zero. These are third-party guides that conflict with each other. — [Cinevva Poki guide](https://app.cinevva.com/guides/publish-game-poki); [Playgama comparison](https://playgama.com/blog/business-faqs/poki-vs-crazygames-vs-gamedistribution-revenue-share/); [Cinevva CrazyGames guide](https://app.cinevva.com/guides/publish-game-crazygames)
- **[Evidence]** Waffle made no SEO effort but became the top Google result for "Waffle" and ranks for "word game" and "daily puzzle". The creator credits word of mouth and organic searches. — [mobilegamer.biz](https://mobilegamer.biz/daily-word-game-studio-waffle-is-the-latest-small-dev-to-find-a-big-audience)
- **[Evidence]** A non-game directory (OpenAlternative) reached 1M uniques in 2025, mostly through programmatic SEO pages. This is indirect evidence that SEO compounds where directories don't. — [Indie Hackers 2025 review](https://www.indiehackers.com/post/79k-from-side-projects-in-2025-my-year-in-review-e145b2fa95)
- **[Evidence]** Editorial "games like Wordle" lists exist and are updated: PC Gamer, Pocket Tactics, Thinky Games, Summer Engine 2026. Getting onto these is effectively press. — [PC Gamer](https://www.pcgamer.com/best-games-like-wordle); [Pocket Tactics](https://www.pockettactics.com/games-like-wordle); [Thinky Games](https://thinkygames.com/features/tired-of-wordle-and-connections-try-these-6-fun-daily-puzzle-games-that-will-get-you-thinking/); [Summer Engine](https://www.summerengine.com/blog/games-like-wordle)

### Inferences
- Directory submissions are cheap backlinks and SEO signals. Expect a trickle, not growth, and do them once rather than iterating on them.
- An F1 analogue of "unblocked" or evergreen search is per-circuit pages ("Monza racing line", "how to drive Suzuka") that rank on Google and funnel to the game. That is SEO territory, and probably covered by an adjacent researcher.
- Poki and CrazyGames: low fit for a once-a-day game with a few minutes per session, and CrazyGames rejects derivative-looking titles. A permanent "practice/unlimited" mode might fit portals better.
- AlternativeTo and Newgrounds: no evidence found either way.

### Gaps
- No referral numbers found from The DLES, Playlin, Listdle, Dle Hunt, browse.games or AlternativeTo. Lapdle's own Umami referrer data is the best source for this.
- No data on Newgrounds for daily games.

## Press and newsletters: pitching, success rates, anonymity

### Takeaway
Press is the channel with the strongest evidence for permanent step-ups in a daily game's DAU. Waffle: "For every bit of positive PR our DAU jumped to a new level, and stayed there." The realistic targets for Lapdle are F1 media and newsletters, puzzle/thinky-game outlets, and "games like Wordle" list maintainers. Big outlets like The Verge or Polygon tend to cover a game after it is already trending.

### Cited Findings
- **[Evidence]** Waffle: PC Gamer, CNET and Lifehacker coverage brought players looking for more Wordle-likes. DAU rose to about 400k fast and settled at about 475k. "None of it [TikTok, Meta, Google Ads] compares to those early PR boosts." — [mobilegamer.biz](https://mobilegamer.biz/daily-word-game-studio-waffle-is-the-latest-small-dev-to-find-a-big-audience)
- **[Evidence]** Niche newsletters that cover daily games exist: Thinky Games (biweekly, free thinky game plus news), Indie Game Preachers (has featured a daily guess-the-indie-game browser game), and Amuse Labs' PuzzleBuzz (monthly, puzzles and publishing). — [Thinky Games](https://thinkygames.com/features/tired-of-wordle-and-connections-try-these-6-fun-daily-puzzle-games-that-will-get-you-thinking/); [Indie Game Preachers #136](https://indie-game-preachers.beehiiv.com/p/indie-game-preachers-edition-136); [Amuse Labs PuzzleBuzz](https://amuselabs.com/resources/puzzlebuzz/%f0%9f%a7%a9-the-next-wordle/)
- **[Evidence]** Creator-interview outlets for daily games exist (hey.gg runs a blog and podcast interviewing makers of Globle, Xordle, Squeezy). — [hey.gg Squeezy](https://www.hey.gg/blog/squeezy); [hey.gg Globle](https://www.hey.gg/blog/trainwrecklabs)
- **[Evidence]** PC Gamer has covered free daily puzzle collections and individual daily games (Knotwords, Merriam-Webster dailies). — [PC Gamer Knotwords](https://www.pcgamer.com/knotwords-might-replace-wordle-as-my-favorite-daily-word-puzzle); [PC Gamer Merriam-Webster](https://www.pcgamer.com/games/i-only-just-noticed-this-but-merriam-webster-has-put-together-a-solid-collection-of-free-daily-puzzle-browser-games)
- **[Evidence]** Big publications make games but "barely cover" them, so mainstream coverage of a small game is rare. — [Aftermath](https://aftermath.site/new-york-times-wordle-connections-puzzmo-games/)
- **[Evidence]** Heardle's creator stayed anonymous through rapid growth and Spotify's acquisition (Jul 2022). Anonymity didn't stop coverage or a deal, though reports of the creator's identity were inconsistent. — [WION](https://www.wionews.com/world/what-is-heardle-heres-what-you-need-to-know-about-new-viral-game-459275)

### Inferences
- Pitch angle: "a daily game where you drive the racing line, not guess a driver". That separates Lapdle from the many F1 driver-guessing dles. Tie pitches to the race calendar (Las Vegas or a new circuit before race week).
- Anonymous pitching is workable through a project email (hello@lapdle.com) and a press page with GIFs. Heardle shows anonymity didn't block coverage, but expect lower reply rates from journalists who want a human story. No data found.
- F1 podcasts are a concrete partnership lever. The Paddock Talk F1 podcast built its own dle (PaddockDle), which shows F1 podcasts value daily-game engagement.

### Gaps
- No pitch-to-coverage success rates found for daily web games.
- No firsthand data on niche F1 blogs or newsletters (e.g., F1 fan Substacks) covering fan-made games.

## Embeds and partnerships: publisher embeds, cross-promotion, creators/streamers

### Takeaway
Embedding is real at the top end: Wordle on the NYT, Puzzmo under Hearst, Flying Comet Games making dailies for publications, Waffle courted by acquirers and Miniclip. For a tiny game the more realistic levers are (a) making the game easy to iframe so sites embed it, as War Clicks benefited from, (b) partnering with an F1 podcast, YouTuber or site that wants a daily engagement widget (formula1points.com runs Driverle, Paddock Talk runs PaddockDle), and (c) creators or streamers playing it (Xordle's TikTok spike).

### Cited Findings
- **[Evidence]** The NYT bought Wordle for "low seven figures" (Jan 2022). — [Aftermath](https://aftermath.site/new-york-times-wordle-connections-puzzmo-games/)
- **[Evidence]** Puzzmo (Zach Gage) launched under Hearst ownership and is meant to "exist across countless publications". — [Game Developer](https://www.gamedeveloper.com/design/puzzmo-co-creator-zach-gage-on-building-newspaper-games-that-can-last-forever)
- **[Evidence]** Media companies are investing in daily games (overview of "media titans" and daily gaming). — [Speedrun Substack](https://speedrun.substack.com/p/the-media-titans-driving-a-daily-gaming-revolution)
- **[Evidence]** FandomWire launched its own daily puzzle lineup, and Merriam-Webster runs free dailies. Publishers want daily games on their own sites. — [FandomWire](https://fandomwire.com/fandomwire-play-daily-puzzle-games-lineup/); [PC Gamer](https://www.pcgamer.com/games/i-only-just-noticed-this-but-merriam-webster-has-put-together-a-solid-collection-of-free-daily-puzzle-browser-games)
- **[Evidence]** F1 sites and podcasts already run their own dles: formula1points.com runs Driverle, and the Paddock Talk F1 podcast made PaddockDle. — [Driverle](https://www.formula1points.com/driverle/); [PaddockDle](https://playpaddockdle.com/)
- **[Evidence]** War Clicks' iframe build led to many third-party game sites embedding it, which brought unexpected early traffic. — [Game Developer](https://www.gamedeveloper.com/business/from-a-prototype-to-one-of-the-biggest-idle-games-in-3-years-postmortem)
- **[Evidence]** Xordle's biggest spike came from a TikTok creator playing it. — [hey.gg Xordle](https://www.hey.gg/blog/xordle)
- **[Evidence]** Waffle had an acquisition offer in summer 2022 and a Miniclip soft launch from Jan 2024. — [mobilegamer.biz](https://mobilegamer.biz/daily-word-game-studio-waffle-is-the-latest-small-dev-to-find-a-big-audience)

### Inferences
- Offer F1 fan sites, podcasts and YouTubers (sim-racing creators especially, since racing lines are their topic) a free embeddable "Lapdle of the day" widget or a co-branded circuit, with a link back. formula1points.com and Paddock Talk show F1 outlets want this kind of thing. No outreach success rates found.
- Sim-racing streamers are a natural fit: a short "can a sim racer beat today's line" segment. This is an inference based on Xordle's creator-driven spike. No F1-game-specific evidence found.
- Cross-promotion among dle games, such as a "more daily games" footer swap with other F1 dles or racing games, is common practice in the dle scene but has no measured evidence. It's cheap to try.

### Gaps
- No firsthand account found of a small dle game negotiating a publisher embed, or the terms.
- No data on cross-promotion swaps between dle games.

## What doesn't work or wastes time

### Takeaway
The strongest negative evidence: paid ads (TikTok, Meta, Google) did not move DAU for a daily game with 475k DAU. Generic dev subreddits sent zero players to Globle. Launch platforms (Product Hunt, Show HN with link-sharing) produce one-day spikes with steep decay and can backfire.

### Cited Findings
- **[Evidence]** Waffle: "We have never been able to noticeably increase our DAU through our own efforts", after trying TikTok, Meta and Google Ads. — [mobilegamer.biz](https://mobilegamer.biz/daily-word-game-studio-waffle-is-the-latest-small-dev-to-find-a-big-audience)
- **[Evidence]** Globle on r/webdev: "absolutely zero traffic". — [hey.gg](https://www.hey.gg/blog/trainwrecklabs)
- **[Evidence]** Browser TD launch (Jul 2026): Product Hunt ranked low without an audience, Show HN was flagged after the link was shared, and launch traffic halved every day with 2% D1 retention. Players who bounced in the first two minutes never came back after patches. The lesson: fix the first session before driving traffic. — [itch.io postmortem](https://itch.io/t/6645181/launch-week-postmortem-solo-browser-td-product-hunt-a-portal-rejection-and-a-flagged-show-hn-numbers-inside)
- **[Evidence]** A 2026 web game reached about 130k MAU with $0 marketing, from accidental multi-language versions (Spanish first) and SEO fixes. Reddit, portals and directories played no part. — [DEV Community](https://dev.to/yitao/post-mortem-how-my-web-game-hit-130k-mau-with-0-marketing-and-survived-an-adsense-ban-883)
- **[Opinion]** Brand-new promo-only accounts get caught by automod and mods. Disguised "feedback" promo is banned on r/indiegames. — [bugnet.io](https://bugnet.io/blog/reddit-marketing-for-indie-games-without-getting-banned); [r/indiegames mirror](https://redlib.belloworld.it/r/indiegames)
- **[Evidence, dated]** Before 2016 one indie dev called paid CPMStar ads crucial, for a paid or monetized game, which doesn't translate to a free, anonymous daily game today. — [Ask HN thread](https://news.ycombinator.com/item?id=12720636)
- **[Opinion, weak]** One guide claims Indie Hackers launches convert 3-8x better than Product Hunt, citing an unverified "OpenHunts 2024 study". Weight it lightly. — [awesome-directories.com](https://awesome-directories.com/blog/indie-hackers-launch-strategy-guide-2025/)

### Inferences
- For Lapdle at 10-20 DAU, the highest-leverage order seems to be: (1) first-session clarity and share-grid virality, since Wordle and Waffle grew by sharing; (2) topic-native Reddit posts with real content, spaced out and tied to race weekends; (3) pitches to F1 and puzzle media and newsletters; (4) Show HN once the account is established; (5) embed and podcast partnerships. Paid ads and more directory submissions rank last.
- Multi-language versions are a cheap test given the DEV case, since F1 is popular in Spanish, Portuguese, Italian and Dutch-speaking markets. This rests on one anecdote.

### Gaps
- No controlled comparisons across channels for daily games. Everything is anecdotal, and the successful cases are biased toward survivors (Wordle, Waffle, Globle, Heardle all rode the early-2022 Wordle wave, which may not repeat in 2026).
- No 2025-2026 firsthand account of a daily game growing from about 20 DAU through Reddit specifically.

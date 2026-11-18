/**
 * What's new in Lapdle, newest first: what changed for players, written from the change history (the git log), at
 * /updates. A new entry goes at the top when an update players can see goes live.
 */
export type Update = { date: string; title: string; body: string[]; links?: [string, string][]; /** a clip under the text: /media/<name>.mp4 with its .jpg poster */ video?: string };

export const UPDATES: Update[] = [
  {
    date: "2026-11-18",
    title: "Guides for the new racing games",
    body: ["Perfect Season, Setup Sprint, The Fast Detective and Racing Context now have the same in-game How to play card and full guide as the other Lapdle games. Each guide covers the rules, scoring and tips."],
    links: [["Browse the guides", "/how-to-play"]],
  },
  {
    date: "2026-11-18",
    title: "Corner clues come alive",
    body: [
      "The Fast Detective now shows the actual corner shape. Weather, approach speed, braking, apex and power appear on the same diagram as each clue unlocks, followed by a replay you can watch again.",
      "Racing Context now animates each new similarity bar and moves guesses smoothly into rank order. Reduced-motion settings are respected.",
    ],
    links: [["Solve The Fast Detective", "/fast-detective"], ["Find the driver", "/racing-context"]],
  },
  {
    date: "2026-11-18",
    title: "Perfect Season now starts with a team draft",
    body: [
      "Spin a real constructor and season, draft two drivers and five parts of your team's performance, then simulate twelve races to chase 12-0. Choose an era, difficulty, car philosophy and draft order before you start. The one-choice-per-circuit prototype is now Setup Sprint.",
      "Racing Context guesses now have a coloured proximity bar: green is closest, then yellow, orange and red. The best-ranked guesses appear first. Optional career diagrams unlock after every four guesses.",
    ],
    links: [["Build your team", "/season"], ["Play Setup Sprint", "/setup-season"], ["Find the driver", "/racing-context"]],
  },
  {
    date: "2026-11-18",
    title: "Four quicker ways to race and guess",
    body: [
      "Perfect Season is now a quick 12-round strategy game: choose one of three car setups at each circuit and chase 12-0. The original lap-by-lap season is still available as Classic Season.",
      "The Fast Detective gives you five clues to decide if a car makes a corner. Racing Context asks you to find a secret driver from similarity ranks. Line-up is now called Racing Connections, with the same daily puzzle and saved progress.",
    ],
    links: [["Play Perfect Season", "/season"], ["Solve The Fast Detective", "/fast-detective"], ["Find the driver", "/racing-context"], ["Play Racing Connections", "/line-up"]],
  },
  {
    date: "2026-11-18",
    title: "Pulse livery and your car colours in the standings",
    body: [
      "When one friend you invited plays a daily game, the ultraviolet and lime Pulse livery unlocks in your 3D Garage. Neon still unlocks after three friends.",
      "Named drivers' chosen Garage paint and second colour now appear on their cars in the Daily Quali and Championship standings.",
    ],
  },
  {
    date: "2026-11-18",
    title: "Rev lights match the steering wheel; Braking Point retires",
    body: [
      "During a Daily Quali 3D lap, the green and blue rev lights on the race screen now follow the steering wheel through every gear, including fifth and above.",
      "Braking Point has been removed from the games and its old links now lead to Make the corner. Past Braking Point results still count toward your streak.",
    ],
  },
  {
    date: "2026-11-18",
    title: "The Daily Quali gear display follows the steering wheel",
    body: ["During a 3D lap, the gear shown on the race screen now changes with the steering wheel's gear on both upshifts and downshifts."],
  },
  {
    date: "2026-11-18",
    title: "Imola's start straight looks more like Imola",
    body: [
      "The 3D start bridge now names the circuit, and its control tower has Imola's white floors, dark windows and red top. The track layout and driving stay the same.",
    ],
  },
  {
    date: "2026-11-17",
    title: "Imola joins Daily Quali 3D",
    body: [
      "Imola now has its full 3D circuit, with real terrain heights, trackside scenery and the same cameras, car and sound as Spa and Interlagos. The 3D view is available by default when you race Imola, including tomorrow's Daily Quali.",
    ],
  },
  {
    date: "2026-11-17",
    title: "More responsive 3D circuit loading",
    body: [
      "The circuit terrain now builds in smaller steps, keeping the setup screen responsive while its 3D world prepares. Repeated terrain calculations have also been removed without changing the circuit's detail or graphics.",
    ],
  },
  {
    date: "2026-11-17",
    title: "Steadier 3D lap playback",
    body: [
      "The map stays in control at real-time lap speed until the 3D circuit has finished preparing its shaders, textures and sound. The lap switches over when the scene is ready, avoiding a stutter at the start.",
      "Returning to the game after switching tabs no longer mistakes the pause for a slow device, and resolution can recover after performance improves. Interlagos also avoids downloading tree textures it never draws.",
    ],
  },
  {
    date: "2026-11-17",
    title: "Smoother setup on phones",
    body: [
      "The 3D circuit now waits for a pause and prepares its world in smaller steps, so drawing a racing line on the map stays responsive. Its ground textures are preloaded and phones use lighter scene effects. If you press Lights out first, the lap starts on the map and switches to 3D when the scene is ready.",
      "A tap after dragging the phone panel now reaches its button on the first try.",
    ],
  },
  {
    date: "2026-11-17",
    title: "A cleaner 3D lap on phones, and the map answers your finger everywhere",
    body: [
      "On a phone the 3D lap now looks more like a broadcast: the corner list folds away while the lap runs, the camera, speed and sound controls are a slim row of chips, and the speed and gear sit in a compact graphic with Skip beside it, so the car fills the screen.",
      "Before Lights out, dragging the map on the right-hand side of the screen did nothing: the 3D and Garage buttons were catching the touches around them. They don't any more.",
    ],
  },
  {
    date: "2026-11-16",
    title: "Daily Quali 3D is live",
    body: [
      "At the circuits with a 3D world, Spa and Interlagos for now, your lap now plays in 3D: draw your line as before, press Lights out, and watch it driven from the chase camera, the T-cam, the cockpit or the TV cameras round the track. It's a flying lap, as in qualifying: the car comes up to the line at speed and the timing starts as it crosses. It plays in real time, or twice as fast, and Skip still ends it. The engine sound changes gear with the car, and on wet days there's rain and spray.",
      "Once your laps are done, Watch your lap vs the leader replays your best lap with the day's fastest as a ghost. The Garage button by the 3D switch sets your car's paint, second colour and race number; number 1 is for whoever set yesterday's fastest lap, and three friends who play from your link unlock the Neon livery. The 2D view is still one tap away. Daily Quali plays in 3D on the days it's at Spa or Interlagos, next on 24 November, and every circuit to come gets its 3D world in turn.",
    ],
    links: [["The team", "/team"]],
  },
  {
    date: "2026-11-16",
    title: "100 drivers in a day: Daily Quali 3D is on its way",
    body: [
      "On 15 November 101 of you played Lapdle in a single day. Thank you. Daily Quali in 3D comes with this update: your line driven on a real circuit. It isn't switched on yet; we'll say here when it is. Here's a first look.",
    ],
    video: "/media/daily-quali-3d-teaser",
  },
  {
    date: "2026-11-14",
    title: "Vice City week: Lapdle goes neon until 23 November",
    body: [
      "GTA 6 comes out on 19 November and the Las Vegas Grand Prix races on the 21st, so the neon look starts today instead of on the 19th: a violet night, a pastel sunset with palm trees behind the page, and your line in hot pink. The switch on the home page still keeps the classic look.",
      "This week only, bring three friends who play from your link and your car on the team grid can go Neon, hot pink at the nose fading to turquoise. Whoever picks it keeps it after the week.",
    ],
    links: [["The team", "/team"]],
  },
  {
    date: "2026-11-14",
    title: "The team: your car on the Road to 1,000 grid",
    body: [
      "A new page, The team, shows the Road to 1,000 as a starting grid. Every driver who plays a daily game puts one car on that day's grid, in the order they joined: named drivers with their name above the car, drivers without a name in grey. There's one grid for every day of the challenge, from Day 1 on 13 November.",
      "Cars race Papaya. Bring three friends who play from your link and you pick your car's colour from eleven, and it shows on the grid. Magenta for your line still comes with the first friend.",
    ],
    links: [["The team", "/team"]],
  },
  {
    date: "2026-11-13",
    title: "Two leaderboards: the Championship and the fastest today",
    body: [
      "The Championship and today's fastest Daily Quali laps each have their own page: a podium, P2, P1 and P3, a few figures (drivers, the leader, your place), and every driver below, with a search box and a Find me button. On the home page the two boards sit side by side, each with its Full standings.",
      "Every driver now has a place of their own. On the day's board a tie goes to whoever set the lap first; in the Championship it goes to the longer run of days in a row, then to more daily games played this month, then to whoever started first.",
    ],
    links: [["Championship", "/championship"], ["Fastest today", "/fastest"]],
  },
  {
    date: "2026-11-13",
    title: "Keep your name and streak on any browser",
    body: [
      "The menu has a new Your progress section with your restore link. Open it in another browser or on another phone and you're the same player there: your racing name, your Grands Prix in the Championship and your streak come back.",
      "Opening Lapdle from Instagram, TikTok or Facebook uses the app's own browser, which forgets the site between visits. Lapdle now says so there and copies your link, so you can carry on in Safari or Chrome without starting again. Thanks to the player who told us about it.",
    ],
  },
  {
    date: "2026-11-13",
    title: "Reminders after the Daily Quali, and friends count from their first lap",
    body: [
      "The daily reminder is now offered right after your Daily Quali result too, not only after the other daily games: pick an hour and Lapdle tells you when tomorrow's games are out. On iPhone and iPad it works once Lapdle is added to the Home Screen, and the offer now says so.",
      "A friend who opens your link now counts from their first Daily Quali lap, so you unlock Magenta as soon as they've driven one, without waiting for all six laps.",
    ],
  },
  {
    date: "2026-11-11",
    title: "Las Vegas gets its surroundings",
    body: [
      "The Las Vegas circuit now has the real buildings, trees, roads and water around it, from OpenStreetMap: the hotel towers along the Strip now stand beside the track on the map.",
    ],
  },

  {
    date: "2026-11-11",
    title: "Every Daily Quali lap counts on the road to 1,000",
    body: [
      "Your first Daily Quali lap of the day now counts you on the road to 1,000 and as a Grand Prix in the monthly Championship, even if you don't use all six laps. Finishing any other daily game counts as before.",
    ],
  },
  {
    date: "2026-11-11",
    title: "A circuit guide for Las Vegas",
    body: [
      "Las Vegas has its own guide, like the other twelve circuits: the facts, a lap of the circuit from the first corner to the run down the Strip, how to drive it in Lapdle, the perfect lap in numbers and the history of Grand Prix racing in the city.",
    ],
    links: [["Las Vegas guide", "/circuits/las-vegas"]],
  },
  {
    date: "2026-11-11",
    title: "Your racing name and the monthly Championship",
    body: [
      "After your first daily game, Lapdle now asks what to call you, with a racing name filled in that you can keep or change. It's optional: skip it and nothing changes. The same name shows on the Daily Quali board and in the menu, where you can change it any time.",
      "The home page has a Championship for each month: a Grand Prix is a day you finish a daily game, and the named players with the most Grands Prix this month lead, ties going to the longer run of days in a row. It starts again on the 1st, so a new player can top it in their first month.",
    ],
    links: [["Play today's games", "/"]],
  },
  {
    date: "2026-11-10",
    title: "Las Vegas joins Lapdle",
    body: [
      "The Las Vegas street circuit is in the game: 6.2 km, the long run down the Strip and the tight section round the Sphere. Drive it any time in Free Practice, dry, wet or with low downforce.",
      "On Saturday 21 November, qualifying day of the Las Vegas Grand Prix, the Daily Quali moves to Las Vegas for everyone, in the dry. The rest of the daily rotation keeps its twelve circuits.",
    ],
    links: [["Free Practice", "/"]],
  },
  {
    date: "2026-11-10",
    title: "Names on the board, the road to 1,000, and colours for bringing friends",
    body: [
      "The Daily Quali board now shows names. Add a nickname under today's result and your best lap appears by name with your position among everyone who drove; change it or take it off any time. No account needed.",
      "The home page shows how many people have played today on the road to 1,000. The day 1,000 players finish a daily game, a new circuit joins Lapdle for everyone.",
      "Every link you share now counts the friends who come in on it and play a daily game. One friend unlocks a Magenta line colour, three unlock Cyan, and ten put a gold star next to your name on the board. The friend gets Magenta too. Pick your colour in the menu.",
    ],
    links: [["Play today's games", "/"]],
  },
  {
    date: "2026-11-10",
    title: "Challenge a friend",
    body: [
      "Every daily game's result card now has a Challenge a friend button. It sends your result with a link straight into the same game, and your friend plays the same round you did. When they open it, a strip at the top says what to beat, and their own result card shows your score next to theirs.",
    ],
    links: [["Play today's games", "/"]],
  },
  {
    date: "2026-11-10",
    title: "A daily reminder, if you want one",
    body: [
      "After a daily game, the result card now offers a reminder when tomorrow's games are out, at an hour you pick. It's one notification a day saying which circuit and conditions the Daily Quali has, and it skips any day you've already played. You can change the hour or turn it off in the menu.",
      "It works in Chrome, Edge, Firefox and Samsung Internet on phones and computers, and on iPhone and iPad once Lapdle is added to the Home Screen. Nothing is asked for besides the hour: no account or email.",
    ],
    links: [["Play today's games", "/"]],
  },
  {
    date: "2026-11-09",
    title: "Vegas Night, 19 to 23 November",
    body: [
      "For the Las Vegas Grand Prix week Lapdle goes neon: a violet night, the player's line in hot pink, a pastel sunset over the water behind the page, with palm trees leaning in from the edges. It starts by itself on 19 November and ends after the race weekend. The timing colours stay the same, and a switch on the home page keeps the classic look if you prefer it.",
    ],
    links: [["Play today's games", "/"]],
  },
  {
    date: "2026-11-08",
    title: "Share your result as a picture",
    body: [
      "Every game's finish card now draws your result as a picture: the game and its number, your verdict, the score, your result grid and your stats. Share sends it with the text, so a group chat or a story shows how you did without anyone opening a link. Where a phone or browser can't share pictures, Share sends the text as before.",
    ],
    links: [["Play today's games", "/"]],
  },
  {
    date: "2026-11-02",
    title: "Corner of the week explained",
    body: ["The Corner of the week page now says how the game works: one famous corner from Monday to Sunday, the rest of the lap on the perfect line so everyone arrives at the same speed, unlimited tries and a medal for your best run of the week. It links to the guide for every corner in the rotation."],
    links: [["Corner of the week", "/corner"]],
  },
  {
    date: "2026-11-01",
    title: "Daily Quali: no circuit two days running",
    body: [
      "From 3 November the Daily Quali never puts the same circuit on two days in a row. The rotation used to let one through when a cycle's last circuit opened the next, or when a race weekend's circuit fell next to its own turn in the cycle.",
      "Each day now takes the next circuit of its cycle that wasn't yesterday's and isn't tomorrow's race-Saturday circuit. Every day already played stays exactly as it was, so the archive and the records don't change.",
    ],
    links: [["Today's Daily Quali", "/"]],
  },
  {
    date: "2026-11-01",
    title: "Monaco starts on the start line",
    body: [
      "The map data Monaco is traced from begins at Casino Square, so Lapdle's lap ran from Casino to Casino and the corner numbers were off: Sainte Dévote came late in the lap and Rascasse looked far too fast. The lap now starts on the real start straight, checked against the speed trace of a real pole lap, and Sainte Dévote is Turn 1 again.",
      "The perfect laps for Monaco were worked out again, so they are new targets: 1:07.115 in the dry, 1:19.804 in the wet and 1:09.469 with low downforce.",
    ],
    links: [["Monaco circuit guide", "/circuits/monaco"]],
  },
  {
    date: "2026-11-01",
    title: "Make the corner looks like a real circuit",
    body: [
      "The hills and mountains on the horizon are now the real ones around each corner, built from real elevation data out to 45 km: the Alps around Spielberg, the hills behind Monaco, the flat dunes at Zandvoort. They fade into the haze and turn misty on wet days.",
      "The car is a new 2026-style model, in Lapdle orange with bare carbon wings and no team or sponsor marks, and it sits further back in the picture. The grandstands have stepped rows of red seats and a roof over the back rows.",
    ],
    links: [["Play Make the corner", "/make-the-corner"]],
  },
  {
    date: "2026-11-01",
    title: "Guides to twelve famous corners",
    body: [
      "Every corner in Corner of the week has its own guide: where it is and why it is famous, how to drive it, what the rain changes, the usual mistakes, and the corner in numbers from Lapdle's physics, from the approach speed and braking distance to the slowest point.",
    ],
    links: [["Famous corners", "/corners"]],
  },
  {
    date: "2026-11-01",
    title: "Learn: eleven articles on the racing line",
    body: [
      "The Learn section started on 31 October with five articles and now has eleven, from what a racing line is and early against late apexes to trail braking, low downforce, driving in the wet and why Monaco is different. Each uses numbers from the game's own physics.",
      "The circuit guides were rewritten at the same time: each now takes a lap corner by corner, says where the time is, and covers the circuit's history as a venue.",
    ],
    links: [
      ["Learn the racing line", "/learn"],
      ["Circuit guides", "/circuits"],
    ],
  },
  {
    date: "2026-10-31",
    title: "Golden hour and a racing dash",
    body: ["Dry and low-downforce days in Make the corner are now driven in a low late-afternoon sun, with a smooth hazy sky. A dash with shift lights, the pedals, the speed and the gear sits on screen, and the picture is smoother on both phones and computers."],
  },
  {
    date: "2026-10-30",
    title: "Tomorrow's circuit on every finish card",
    body: ["Every finish card, the finished Daily Quali and the home page now name tomorrow's Daily Quali, circuit and conditions, so you know what's coming."],
  },
  {
    date: "2026-10-29",
    title: "Share your whole day",
    body: ["One share for the whole daily set: a line for each game with your result, then the link. It's offered on the home page, on every finish card and on the finished Daily Quali."],
  },
  {
    date: "2026-10-25",
    title: "Lapdle in Spanish",
    body: ["Lapdle now plays in Spanish at /es, in time for the Mexico City Grand Prix: the home page, every game with its how-to card, finish card and share text, the archive and the lap records. The guides and articles stay in English."],
    links: [["Lapdle en español", "/es"]],
  },
  {
    date: "2026-10-24",
    title: "The corner that cost you most",
    body: ["After each Daily Quali lap the result now leads with the corner where you lost the most time against the perfect line, and by how much, so the next lap has something to fix."],
  },
  {
    date: "2026-10-16",
    title: "Make the corner joins the daily set, on real ground",
    body: [
      "Make the corner is now one of the daily games, in Braking point's place; Braking point stays as an extra and the days you finished it still count for your streak.",
      "During a Grand Prix week the game runs that circuit's corners in turn. And every corner now stands on its real ground, from elevation data on a 20 m grid, so the road rises and falls as the real one does.",
    ],
  },
  {
    date: "2026-10-15",
    title: "Make the corner: feel the speed",
    body: ["The view widens with speed, nods under braking, leans into the corner and shakes over the kerbs. The road, grass and gravel are photographed surfaces, the trees are photographs of whole trees, the camera sits closer behind the car, and the engine is a V8."],
  },
  {
    date: "2026-10-14",
    title: "Make the corner: a famous corner in 3D",
    body: ["A new game: one famous corner a day in 3D, the same for everyone. Brake where you dare, carry the speed and power out, against the perfect time through that corner. The road is built from the circuit's real edges, with kerbs where the corner bites and gravel on the outside."],
    links: [["Play Make the corner", "/make-the-corner"]],
  },
  {
    date: "2026-10-14",
    title: "Line-up's second edition and a new menu",
    body: ["Line-up now mixes drivers, teams, title-winning cars, circuits and corners, one group of each colour from easy yellow to tricky purple. The menu on the home page opens every game in one list, with today's daily games first."],
    links: [["Play Line-up", "/line-up"]],
  },
  {
    date: "2026-10-06",
    title: "Lapdle launches",
    body: [
      "Day 1 of Lapdle: the Daily Quali on a real circuit every day, with a daily leaderboard, plus a set of daily games around it: Mystery circuit, Pit stop, Higher or lower, Braking point, Order the corners, Speed trap, Line-up, Aerial view and Lights out.",
      "Also live from the first day: a guide to each circuit, a quiz on each, the lap records, the archive of every past Daily Quali, and an app you can install from the browser.",
    ],
    links: [
      ["How to play", "/how-to-play"],
      ["About Lapdle", "/about"],
    ],
  },
];

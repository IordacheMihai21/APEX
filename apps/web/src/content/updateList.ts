/**
 * What's new in Lapdle, newest first: what changed for players, written from the change history (the git log), at
 * /updates. A new entry goes at the top when an update players can see goes live.
 */
export type Update = { date: string; title: string; body: string[]; links?: [string, string][] };

export const UPDATES: Update[] = [
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

import type { GameId } from "../games/registry";

/**
 * What each game is about in the real sport, shown under the game (GameAbout.tsx) and on its static page: two short
 * paragraphs of background, and the Learn articles that go deeper. The English is the key for the Spanish (i18n/es.ts).
 */
export const GAME_ABOUT: Record<GameId, { about: string[]; learn: string[] }> = {
  quali: {
    about: [
      "Qualifying is the part of a race weekend where a driver is alone with the circuit: one lap, as fast as the car will go, with nobody to race and nothing to hide behind. The order of those laps sets the starting grid, and on many circuits it decides the race before it starts. The difference between pole and tenth is often less than a second over a lap of five kilometres.",
      "Most of that difference is the line. Where the car brakes, how deep it turns in, where it touches the apex and how early it can get back on the power: each corner is a handful of decisions, and a lap is a chain of them. The Daily Quali lets you make those decisions on a real circuit and drives your line with real physics, so every hundredth you find comes from a better line.",
    ],
    learn: ["what-is-a-racing-line", "early-vs-late-apex", "learning-a-circuit"],
  },
  mystery: {
    about: [
      "Drivers who know a circuit well can name it from a single corner: the sharp right after a long straight, the fast sweep over a crest, the tight hairpin at the end of the lap. Every circuit has a shape of its own, and most of its corners are known by name to anyone who follows racing.",
      "Mystery circuit shows that shape a few corners at a time, drawn to scale from the real track. The first corners are often the hardest to place; by the fourth or fifth the lap usually gives itself away. Learning the circuits this way, by their corners rather than their names, is also how drivers start to learn a new track.",
    ],
    learn: ["learning-a-circuit", "corner-types"],
  },
  "pit-stop": {
    about: [
      "A modern pit stop is one of the fastest pieces of teamwork in sport. About twenty mechanics stand round the car: three for each wheel (one on the wheel gun, one to take the old tyre off, one to put the new one on), a jack at each end and people to steady the car. A good stop changes all four tyres in about two seconds, and the fastest are under that. Refuelling during the race has been banned in Formula 1 since 2010, so the stop is only the tyres.",
      "Most of the time in a stop is lost to one slow wheel. The car goes only when the last wheel is on and the last gun is up, which is why crews train the same stop hundreds of times a season. Pit stop gives you the four wheels one after another and the green light at the end: the same race against the slowest wheel.",
    ],
    learn: [],
  },
  "higher-lower": {
    about: [
      "Every racing circuit has its numbers: how long a lap is, how many corners it has, when it first held a Grand Prix and how fast the pole lap was. They are the facts commentators reach for and the ones that make one circuit feel different from another. A long lap with few corners is a fast circuit; a short one with many is a slow, twisting one.",
      "Higher or lower turns those numbers into quick calls between two circuits at a time. Some answers are obvious; others surprise even fans who have followed the sport for years.",
    ],
    learn: ["why-monaco-is-slow", "learning-a-circuit"],
  },
  "braking-point": {
    about: [
      "The biggest stops on a racing circuit take a car from well over 300 km/h to under 100 km/h in about three seconds. Drivers pick a fixed point to brake at, often a marker board counting down to the corner, and the best of them brake at the same spot to within a metre or two, lap after lap.",
      "Brake a few metres too early and the time is gone for good. Brake a few metres too late and the car runs wide, or off. Braking point gives you the real approach to five of those stops a day, with the car at its real speed, and asks you to find the last moment you can still make the corner.",
    ],
    learn: ["braking-points", "trail-braking", "racing-in-the-wet"],
  },
  "make-the-corner": {
    about: [
      "A corner is three moments. The car brakes hard in a straight line, rolls into the corner as the brakes come off and the steering goes on, and then the driver squeezes the throttle back on as the car unwinds towards the exit. Each moment comes at a single point on the road, and getting one wrong spoils the other two.",
      "Make the corner puts you in the car for one famous corner at a time, in 3D, with the car at its real speed. You choose when to brake, when to let go and when to get on the power, and the result shows how close each was to the perfect lap, metre by metre.",
    ],
    learn: ["braking-points", "trail-braking", "corner-exit-traction"],
  },
  "corner-order": {
    about: [
      "Drivers learn a new circuit as a sequence: which corner comes after which, where the straights are and which corner leads onto them. Before they drive it, they study it on video and in the simulator until they can call out every corner in order with their eyes closed.",
      "Order the corners tests that sequence. The six corners are drawn to scale from the real track, with an arrow for the direction the car goes, and the shapes of the straights and bends around them are left out. You need to know how the lap flows to put them back in order.",
    ],
    learn: ["learning-a-circuit", "corner-types"],
  },
  "speed-trap": {
    about: [
      "Speeds on a racing lap span a huge range. At the end of a long straight a car can top 340 km/h; in a tight hairpin it slows to well under 80 km/h. Fast sweeps sit in between, often taken at more than 250 km/h, with the driver close to flat out.",
      "Speed trap asks you to read those speeds from the circuit itself: how long the straight before the spot is, how tight the corner is and what comes after it. The answers come from Lapdle's own physics on the perfect lap, the same model that drives every lap in the Daily Quali.",
    ],
    learn: ["low-downforce", "why-monaco-is-slow", "corner-types"],
  },
  "line-up": {
    about: [
      "Motor racing has more than seventy years of names behind it: drivers, teams, cars and circuits, many of them linked in ways only fans would spot. Some drivers share a nationality, some teams share an engine supplier, some circuits share a country or a type of track.",
      "Line-up hides four of those links among sixteen tiles. The yellow group is usually plain; the purple one is meant to catch you out, with a tile or two that fit more than one group. Four mistakes are allowed, so it pays to be sure before you lock a group in.",
    ],
    learn: ["learning-a-circuit"],
  },
  aerial: {
    about: [
      "Most racing circuits are built into the land around them: a lake beside the paddock, a forest on the far side of the lap, a town or a motorway right up to the fence. From above, those surroundings are often enough to recognise the circuit long before you see the track itself.",
      "Aerial view draws the area round a real circuit from open map data and leaves the track out. The view starts close and pulls further out with every miss, so it pays to read the landscape: water, woods, farmland and towns all narrow it down.",
    ],
    learn: ["learning-a-circuit"],
  },
  reaction: {
    about: [
      "A Grand Prix starts from a standstill on five red lights. They come on one by one, a second apart, then go out together after an unpredictable pause, and the race is on. A good start can gain several places before the first corner; a jump start, moving before the lights go out, brings a penalty.",
      "Racing drivers react in about two tenths of a second, after years of practice. Most people take a little longer. Lights out lets you try the same start as often as you like and keeps your best time and the average of your last five.",
    ],
    learn: [],
  },
};

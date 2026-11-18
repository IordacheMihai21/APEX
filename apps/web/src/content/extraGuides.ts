/** Guides for games outside the original daily-game registry. */
export const EXTRA_GUIDES = [
  {
    id: "season",
    name: "Perfect Season",
    route: "/season",
    cadence: "endless" as const,
    howTo: {
      steps: [
        "Choose your era, difficulty and draft settings, then spin for a real constructor and season.",
        "Take one driver or car part from each draw until your seven team slots are filled. Rerolls are limited by difficulty.",
        "Simulate twelve races, follow the constructors' standings and chase a perfect 12-0 record.",
      ],
      tip: "Your draft settings change the available teams and how much information you see.",
    },
    guide: {
      intro: "Perfect Season is an F1 team draft. Build a seven-part team from historic constructor-seasons, then see how it performs across twelve races.",
      scoring: "Your record is wins out of twelve races. The simulation also places your team against nine rival constructors in the standings. A 12-0 season is the target; your team rating and finishing position help explain the result. Historic ratings are Lapdle's interpretation of results, not official F1 ratings.",
      tips: [
        "Decide whether to draft the constructor first or choose the slot first before starting.",
        "Balance your two drivers with the five car parts; one strong rating cannot cover every weakness.",
        "Try the one-constructor challenge when you want every draw to come from different seasons of one team.",
        "Enable the midseason upgrade to adjust one part after six races.",
      ],
    },
  },
  {
    id: "setup-season",
    name: "Setup Sprint",
    route: "/setup-season",
    cadence: "endless" as const,
    howTo: {
      steps: [
        "Race a twelve-circuit season. At each circuit, read the track and weather before choosing a car setup.",
        "Choose low drag, balanced or high grip. You can use each setup only four times across the season.",
        "See the simulated lap and result, then move to the next race and aim for 12-0.",
      ],
      tip: "Save scarce setups for the circuits that reward them most.",
    },
    guide: {
      intro: "Setup Sprint is a short twelve-race strategy challenge. Make one setup call for each circuit and try to win every round.",
      scoring: "Each setup is available four times. The same deterministic lap physics used by Daily Quali evaluates your choice against the circuit and conditions. Every race adds a win or loss to your season record; the goal is twelve wins and no losses. Your personal best is saved locally.",
      tips: [
        "Low drag suits long straights, while high grip helps where corners dominate.",
        "Check the wet or dry condition before committing a setup.",
        "Balanced is useful when the circuit does not strongly favour either extreme.",
        "Plan all twelve uses: spending every high-grip setup early leaves none for later tracks.",
      ],
    },
  },
  {
    id: "fast-detective",
    name: "The Fast Detective",
    route: "/fast-detective",
    cadence: "daily" as const,
    howTo: {
      steps: [
        "Reveal five clues about one car approaching a real corner. The diagram adds weather, speed, braking and power points as you go.",
        "Decide whether the car makes the corner or runs off the road.",
        "For bonus points, predict the lowest speed it reaches. Lock in your verdict to watch the replay.",
      ],
      tip: "One case per day. Your verdict is final once submitted.",
    },
    guide: {
      intro: "The Fast Detective gives everyone the same corner case each day. Read five clues, judge whether the car holds the road and estimate its lowest speed.",
      scoring: "A correct make-or-miss verdict earns 700 points. Your speed estimate adds up to 300 more: each km/h away from the actual lowest speed costs 12 points, down to zero bonus. The maximum score is 1,000. The replay shows the simulated outcome after you answer.",
      tips: [
        "Use the corner shape and the wet or dry condition before judging the approach speed.",
        "Compare the braking point with the apex: a later brake leaves less room to slow down.",
        "The carry-speed and power clues describe the driver's plan, not a guaranteed successful turn.",
        "Estimate the lowest speed separately from the entry speed to earn the bonus.",
      ],
    },
  },
  {
    id: "racing-context",
    name: "Racing Context",
    route: "/racing-context",
    cadence: "daily" as const,
    howTo: {
      steps: [
        "Type a racing driver's name and choose it from the suggestions.",
        "Read its similarity rank. Number 1 is the secret driver; green is close, then yellow, orange and red.",
        "Use the sorted guesses and optional career clues to narrow the answer. Keep guessing until you find the driver.",
      ],
      tip: "Unlimited guesses. A new secret driver appears each day.",
    },
    guide: {
      intro: "Racing Context is a daily driver-finding game. Every guess gets a similarity rank that tells you how close it is to the secret racing driver.",
      scoring: "Number 1 is the answer. Other ranks compare drivers by nationality, teams, years raced and career records; lower numbers mean closer matches. Guesses are sorted by rank and coloured by proximity. There is no guess limit, so the result is how many guesses it took to find the driver.",
      tips: [
        "Start with a driver you know well, then use the rank to choose a nearer era or team.",
        "A shared team or nationality can explain a close rank, but several career traits contribute.",
        "Optional career diagrams unlock as your guesses build up; reveal them if you need another clue.",
        "Watch the newly animated rank bar, then compare the best-ranked names at the top of your list.",
      ],
    },
  },
] as const;

export type ExtraGuideId = (typeof EXTRA_GUIDES)[number]["id"];
export const extraGuide = (id: string) => EXTRA_GUIDES.find((g) => g.id === id);

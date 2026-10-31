/**
 * Learn: articles on driving a racing line, the craft behind every Lapdle game. Original writing, checked against the
 * game's own physics where it quotes numbers (modes/makeCorner.ts, the corner data in game/corners). Each article is
 * an intro and sections of paragraphs; the page (content/Learn.tsx) adds the headings, the links and a game to try.
 */
export interface Article {
  slug: string;
  title: string;
  /** for search results and link previews, about 150 characters */
  description: string;
  /** a word or two above the title */
  kicker: string;
  intro: string[];
  sections: { h: string; p: string[] }[];
  /** the game that puts the article into practice */
  play: { text: string; href: string };
}

export const ARTICLES: Article[] = [
  {
    slug: "what-is-a-racing-line",
    kicker: "The basics",
    title: "What is a racing line? The fastest way through a corner, explained",
    description: "What a racing line is, why it is the fastest way round a circuit, and the three ideas behind it: use the whole track, make the corner wider and get on the power early.",
    intro: [
      "Watch a car on a fast lap and it never seems to take the obvious route. It swings out to one edge of the track before a corner, cuts in to brush the inside kerb, then lets itself drift all the way out again on the exit. That path is the racing line: the route through a corner, and round a whole lap, that takes the least time.",
      "It is not the shortest route. The shortest way round a corner hugs the inside, and it is slow, because it forces the car through the tightest possible curve. The racing line trades a few extra metres of distance for a much gentler curve, and a gentler curve can be taken at a much higher speed. Almost everything about driving fast follows from that trade.",
    ],
    sections: [
      {
        h: "Why a wider curve is faster",
        p: [
          "A car can only turn as hard as its tyres can grip. The force needed to hold a car on a curve grows with the square of its speed and shrinks as the curve gets wider: double the speed and you need four times the grip; double the radius of the curve and you need half as much. Since the grip is fixed, the only way to carry more speed through a corner is to make the curve wider.",
          "That is why the racing line uses all of the track. By starting on the far edge, touching the inside at the middle of the corner and finishing on the far edge again, the car draws the largest arc that fits between the two sides of the road. On a typical 90 degree corner, the radius of that arc can be two or three times the radius of the corner's inside edge, and the speed the car can carry rises with it.",
        ],
      },
      {
        h: "Outside, inside, outside",
        p: [
          "The classic shape has three points. The turn-in is where the car leaves the outside of the track and starts to turn. The apex is the point closest to the inside of the corner, usually where the car touches or nearly touches the inside kerb. The exit, or track-out, is where the car reaches the outside of the track again as the corner opens onto the next straight.",
          "Get those three points right and the corner flows: the steering goes in once, smoothly, and comes out once. Get them wrong and the car needs a second bite of steering mid-corner, or runs out of road on the exit, and both cost time. A driver learning a new circuit spends much of the first laps finding these points and the landmarks that mark them: a brake marker board, a change in the kerb paint, a patch of different tarmac.",
        ],
      },
      {
        h: "The exit matters more than the entry",
        p: [
          "Not all of a corner is equally important. Time lost at the entry is lost once. Speed lost at the exit is carried all the way down the following straight, and on a long straight that adds up: a car that leaves a corner 5 km/h slower is still slower hundreds of metres later, at the end of the straight, where the next braking zone begins.",
          "So the fastest line is rarely symmetrical. Before a long straight, drivers turn in a little later and put the apex further round the corner. The car is slower at the entry, but its path straightens out sooner, the driver can get back on the throttle earlier and harder, and the exit speed is higher. This is the late apex, and it is the reason the racing line through most slow corners looks lopsided.",
        ],
      },
      {
        h: "Braking, turning and accelerating",
        p: [
          "A lap is a cycle of three jobs: braking for a corner, turning through it and accelerating out of it. The tyres can share their grip between braking and turning, but not do both at full strength at once. On a good line, the car does most of its braking in a straight line, eases off the brakes as it turns in, and only starts to accelerate hard once the steering begins to unwind.",
          "This is why the line and the braking point belong together. A line that turns in early needs the car to be slow early. A late apex lets the car brake a little later and deeper into the corner. Change one and the other has to move with it.",
        ],
      },
      {
        h: "One line, many corners",
        p: [
          "Real circuits rarely give you a corner on its own. Corners come in sequences, and the line through one sets you up for the next. In a chicane, a quick left followed by a quick right, there is no room to use the full width for both: the driver gives up the ideal line through the first part to be in the right place for the second, because the second leads onto the straight.",
          "The same thinking runs through a whole lap. The question is never only 'what is the fastest way through this corner?' but 'what is the fastest way from here to the next straight?' A racing line is a compromise, made over and over, in favour of the parts of the lap that matter most.",
        ],
      },
      {
        h: "No single perfect line",
        p: [
          "The ideal line also changes with conditions. In the rain, the rubber laid down on the dry line becomes slippery and drivers move off it. With less downforce, a fast corner that was flat out becomes a braking zone. A car with more traction can get on the power earlier and use a tighter exit. Even the same car on the same day finds a slightly different line on worn tyres than on new ones.",
          "That is what makes the racing line interesting. There is a best way round every corner for a given car and a given day, and finding it is a puzzle with a measurable answer: the stopwatch.",
        ],
      },
      {
        h: "Try it",
        p: [
          "Lapdle's Daily Quali gives you one real circuit a day and lets you set the line through every corner: early apex, classic or late, or each point by hand. A physics model drives your line and shows, corner by corner, how much time it lost against the perfect lap. It is the quickest way to feel why a wider, later line beats the obvious one.",
        ],
      },
    ],
    play: { text: "Play today's Daily Quali", href: "/" },
  },
  {
    slug: "early-vs-late-apex",
    kicker: "Line choice",
    title: "Early, classic or late apex: which is fastest, and when",
    description: "The difference between an early apex, a geometric (classic) apex and a late apex, what each one does to your speed, and how to choose the right one for each corner.",
    intro: [
      "The apex is the point of a corner where the car comes closest to the inside edge. Where you put it decides almost everything else about the corner: where you turn in, how fast you can go through the middle and, most important, how early you can get back on the power. Drivers talk about three kinds of apex: early, classic and late.",
      "None of them is always right. Each one wins in some corners and loses in others, and the skill is knowing which corner needs which.",
    ],
    sections: [
      {
        h: "The classic (geometric) apex",
        p: [
          "The classic apex sits in the middle of the corner. Draw the biggest arc that fits from the outside edge on the way in to the outside edge on the way out and it touches the inside exactly halfway round. This is the geometric line: the widest possible curve, so it allows the highest speed through the middle of the corner.",
          "It is the right choice when the corner's middle speed is what matters: in fast, open corners taken near flat out, where there is little braking before and little acceleration after. In a sweeping bend at 250 km/h, any tightening of the curve costs speed directly, and the classic line keeps the curve as gentle as it can be.",
        ],
      },
      {
        h: "The late apex",
        p: [
          "A late apex sits further round the corner than the geometric one. The car stays on the outside longer, turns in later and more sharply, and touches the inside past the halfway point. The first half of the corner is tighter, so the car must be slower there, but the second half is straighter: the car can begin to accelerate earlier and with the steering already unwinding, which lets it put more of its power down.",
          "Because the exit speed is carried down the next straight, a late apex usually wins whenever a corner leads onto a long straight, and especially in slow corners such as hairpins, where the car's acceleration out of the corner is worth far more than a few km/h at its slowest point. It is also the safer choice: turning in late leaves room to correct, while turning in early commits the car to an exit it may not be able to make.",
        ],
      },
      {
        h: "The early apex",
        p: [
          "An early apex comes before the halfway point. The car turns in early, sweeps across to the inside quickly and carries good speed into the corner. The cost comes later: the second half of the curve is tighter than the first, so the car runs out of road on the exit. The driver has to wait before accelerating, or lift and add steering to stay on the track.",
          "In most corners, an early apex is a mistake, and the classic one drivers make when they are trying too hard. It can still be the right call in a few places: when the corner is followed immediately by another turn in the opposite direction, so the car has to be on the 'wrong' side early anyway; or when racing wheel to wheel, to take the inside line and defend a position.",
        ],
      },
      {
        h: "What the stopwatch says",
        p: [
          "In Lapdle's physics, the pattern is clear. Through slow corners the late apex is almost always fastest, because the car's acceleration out of the corner is limited by grip, and a straighter exit lets it use more of its power sooner. Through fast sweeps, the classic line keeps the speed up, and a late apex loses time by tightening the entry for no gain on the exit. An early apex tends to lose time in both, usually by running wide or by forcing a lift on the exit.",
          "What surprises people is where the time goes. In a slow corner before a long straight, the late apex often looks slower through the corner itself and still wins, because its advantage keeps growing all the way down the straight. In a fast sweep, the wrong choice hurts in the corner itself, because every km/h lost through the middle is carried for its whole length.",
        ],
      },
      {
        h: "How to choose",
        p: [
          "A simple order of questions gets you most of the way. First: what comes after the corner? If it is a long straight, favour a late apex; if it is another corner, think about where you need to be for that one. Second: how fast is the corner? The slower it is, the more a late apex helps; the faster it is, the closer you want to be to the classic line. Third: is it part of a sequence? In a chicane or a run of esses, give up the first part and get the last one right.",
          "When in doubt, a little late beats a little early. A late apex costs a fraction of a second at the entry. An early one can cost the whole exit.",
        ],
      },
      {
        h: "Feeling the difference",
        p: [
          "The difference is easy to read once you know what to look for. A late apex feels slow and patient at the entry, then the car straightens and pulls hard out of the corner. An early apex feels quick and committed at the entry, then the car seems to drift towards the outside edge while you wait to accelerate. If you find yourself waiting at the exit, the apex was too early.",
          "Lapdle's Daily Quali lets you switch any corner between early, classic and late apex with one tap and race the lap again. Try a slow hairpin all three ways and watch the corner's colour change: it is the fastest way to learn which corners want which line.",
        ],
      },
    ],
    play: { text: "Try all three lines in the Daily Quali", href: "/" },
  },
  {
    slug: "braking-points",
    kicker: "Braking",
    title: "How to find the braking point for a corner",
    description: "Why braking points move with speed, how racing drivers find them with marker boards, and how to brake later without arriving too fast, with real numbers from the physics.",
    intro: [
      "The braking point is where the driver goes from full throttle to full brakes before a corner. It is one of the most important numbers on a lap: brake a few metres too early and the time is gone for good; brake a few metres too late and the car arrives too fast, misses the apex, runs wide and loses far more than it gained.",
      "Finding it is a mix of physics and landmarks. The physics tells you why the braking point is where it is. The landmarks tell you where it is on a given lap.",
    ],
    sections: [
      {
        h: "Why speed decides the distance",
        p: [
          "The distance a car needs to slow down grows with the square of its speed. To go from a speed v down to a corner speed u at a steady deceleration a, it needs (v² − u²) / 2a metres. Double the speed on the straight and the braking distance roughly quadruples.",
          "Take a single-seater arriving at 330 km/h (92 m/s) for a corner it takes at 80 km/h (22 m/s). Braking at an average of around 4 g, 39 m/s², it needs about (8,400 − 490) / 78, roughly 100 metres. At 300 km/h, the same corner needs about 82 metres. That is why the braking point for the same corner moves with the length of the straight before it, with the wind and with the car's top speed, and why a faster car does not simply brake 'at the 100 m board' everywhere.",
        ],
      },
      {
        h: "Why braking is not one number",
        p: [
          "A racing car does not brake equally hard all the way. With aerodynamic downforce pushing the tyres into the track, it can brake hardest at the highest speed. As it slows, the downforce fades, the grip falls with it and the deceleration drops. A modern single-seater may brake at close to 5 g at the start of a big stop and at much less than that by the end.",
          "So the braking is front-loaded: the first metres do most of the work. A driver hits the pedal hard at once, then releases it progressively as the car slows and turns in. Brake too gently at the start and the car needs more distance; brake too hard at the end and the front tyres lock or the car will not turn.",
        ],
      },
      {
        h: "Marker boards and landmarks",
        p: [
          "Most circuits put marker boards before the big braking zones, usually at 300, 200, 100 and 50 metres before the turn-in. Drivers use them to pick their braking point in the first laps and then refine it with their own landmarks: a seam in the tarmac, a change in the kerb, a shadow, a sign on the barrier.",
          "The boards are a reference, not a rule. A driver might brake 'just after the 100' in qualifying and 'at the 150' at the start of the race on cold tyres and a full fuel tank. What matters is that the reference is something they can see clearly at speed, every lap.",
        ],
      },
      {
        h: "Late is not always faster",
        p: [
          "There is a limit to braking later. Every corner has a maximum speed the car can carry through it. If the braking starts too late, the car reaches the turn-in faster than that, and the driver has three bad choices: keep braking into the corner and lose the line, turn in and run wide, or miss the corner altogether.",
          "The cost is lopsided. Braking 5 metres too early costs a little time, maybe a few hundredths of a second. Braking 5 metres too late can cost the exit of the corner, which is carried down the whole of the next straight. That is why good drivers creep up on a braking point over several laps, a couple of metres at a time, rather than diving in.",
        ],
      },
      {
        h: "Downhill, uphill, wet",
        p: [
          "Gradient moves braking points too. Braking uphill, gravity helps slow the car, so the braking point can come later: the run up to Turn 1 at Austin climbs steeply and helps the car stop. Braking downhill, gravity pushes the car on, and the point comes earlier.",
          "Rain changes everything. With less grip, the deceleration drops and the corner's maximum speed falls. In Lapdle's physics, the braking point for Austin's Turn 1 moves about 38 metres earlier in the wet, from about 105 to 145 metres before the apex, and the speed the car can carry through the corner drops from 46 to 38 km/h. A driver who keeps braking at their dry marker in the rain will simply not stop in time.",
        ],
      },
      {
        h: "Brake, release, turn",
        p: [
          "The braking point is only half of the stop. The other half is the release: when the driver comes off the brakes as the car reaches the corner's speed. Release too early and the car is still too fast; release too late and it slows more than it needs to and loses time in the middle of the corner.",
          "Lapdle's Make the corner game is built on exactly these calls: when to brake, when to let go, and when to get back on the throttle, in one famous corner a day in 3D. Braking point is the purer version: five of the biggest stops in racing, one pedal, and a score for how close you came to the perfect point.",
        ],
      },
    ],
    play: { text: "Find the braking point in Make the corner", href: "/make-the-corner" },
  },
  {
    slug: "racing-in-the-wet",
    kicker: "Conditions",
    title: "Racing lines in the wet: why the dry line stops working",
    description: "What rain does to grip, braking and corner speed, why drivers leave the normal racing line in the wet, and how to adjust your line and braking points when the track is wet.",
    intro: [
      "A wet track changes more than the speed. On a dry day the racing line is the same lap after lap; in the rain, drivers move off it, brake much earlier, turn in more gently and look for grip in places they would ignore in the dry. Some of the most memorable drives in racing came in the rain, precisely because the usual rules stop working.",
    ],
    sections: [
      {
        h: "Less grip, everywhere",
        p: [
          "Water sits between the tyre and the track, and the tyre can no longer bite into the surface as well. Dedicated wet tyres pump water away through their grooves, but even so, the grip on a wet track is far below the grip on a dry one. Every limit of the car drops with it: how hard it can brake, how fast it can turn and how much power it can put down without spinning its wheels.",
          "A lower limit means lower corner speeds and earlier braking. In Lapdle's physics, a typical slow corner is taken around 15 to 20 per cent slower in the wet, and the braking zone before it grows by about a third. The lap time can grow by several seconds on a long circuit.",
        ],
      },
      {
        h: "Why the dry line is slippery",
        p: [
          "Over a dry weekend, the cars lay down a layer of rubber on the racing line. In the dry, that rubber helps grip. In the wet, it turns into one of the most slippery parts of the track: rubber and oil residue sit on top of the surface, and water lies over them. The tarmac either side, untouched by the rubber, often gives more grip.",
          "That is why drivers in the rain often take a different line, moving a car's width off the usual path, turning in from further inside or finding the 'wet line' around the outside of a corner where the surface is rougher. The best wet line varies from circuit to circuit and even from corner to corner, and finding it is part of the skill.",
        ],
      },
      {
        h: "Paint, kerbs and standing water",
        p: [
          "Painted surfaces are treacherous in the rain. White lines, the painted parts of kerbs and the advertising painted on run-off areas offer very little grip when wet. A line that clips the kerb in the dry may need to stay off it in the wet, and a tyre on the white line at the track's edge under braking can lock without warning.",
          "Water also collects where the track is low or flat. Through these puddles, a car can aquaplane: the tyre rides on a film of water and loses contact with the track for a moment. Drivers learn where the standing water is and either steer round it or keep the car straight and off the brakes while crossing it.",
        ],
      },
      {
        h: "Brake earlier, and smoother",
        p: [
          "With less grip, the braking point moves earlier, and not by a little. In Lapdle's physics, the braking point for Austin's Turn 1 moves about 38 metres earlier in the wet: from about 105 metres before the apex in the dry to about 145. The car also has to arrive slower, about 38 km/h at the slowest point instead of 46.",
          "The technique changes too. In the dry, a driver can hit the brakes as hard as possible at once. In the wet, a sudden stab on the pedal can lock the front tyres, so the braking is squeezed on more progressively and released more gently as the car turns in.",
        ],
      },
      {
        h: "Gentle inputs, earlier throttle",
        p: [
          "Every input in the wet is softer. Steering is turned in more slowly, so the front tyres are not overwhelmed. The throttle is fed in gradually on the exit, because full power with a wheel still turned can spin the car. Drivers often use a higher gear than in the dry out of slow corners, so the engine delivers its power more gently.",
          "Because the car is slower through the corners, its exit speed is lower too, and acceleration matters even more than in the dry. The late apex becomes even more valuable: a straighter exit lets the driver use more of the limited traction sooner.",
        ],
      },
      {
        h: "When the track dries",
        p: [
          "A drying track is the hardest of all. A dry line appears where the cars run most, the rest of the track stays damp, and the best line changes lap by lap. Drivers who read it quickly, staying on the dry strip in the braking zones and moving off it where the damp offers better grip, can gain seconds a lap on those who wait.",
        ],
      },
      {
        h: "Try it",
        p: [
          "Some days in Lapdle are wet. On those days, the Daily Quali's perfect line and medal times change with the conditions, and the braking points in Make the corner come earlier. Driving the same corner dry and wet is the clearest way to feel how much rain takes away.",
        ],
      },
    ],
    play: { text: "Drive a corner in the wet in Free Practice", href: "/?play=practice&track=spa&cond=wet" },
  },
  {
    slug: "corner-types",
    kicker: "Corners",
    title: "Hairpins, chicanes and sweepers: how each type of corner is driven",
    description: "The main types of corner on a racing circuit, hairpins, chicanes, sweepers, esses and kinks, and how the fastest line and braking change for each one.",
    intro: [
      "Every corner is different, but most fall into a handful of types, and each type has its own logic. Knowing which kind of corner you are looking at tells you most of what you need: where to brake, where to put the apex and what matters most, the entry, the middle or the exit.",
    ],
    sections: [
      {
        h: "Hairpins",
        p: [
          "A hairpin turns the car through about 180 degrees, usually at the end of a straight, and is the slowest kind of corner on most circuits. La Source at Spa-Francorchamps and the Grand Hotel hairpin at Monaco are famous examples. A modern single-seater can arrive at more than 300 km/h and take the slowest point at well under 100.",
          "Hairpins are all about the braking and the exit. The braking zone is long and is the best place on the lap to gain time on the brakes. The apex is late, often well past the middle of the turn, so the car can straighten early and accelerate hard. In Lapdle's physics, the slowest point of La Source in the dry is about 44 km/h: much slower than most people guess.",
        ],
      },
      {
        h: "Chicanes",
        p: [
          "A chicane is a quick left-right or right-left, often added to slow cars down before a fast section. The first part of a chicane usually comes after a long straight, so it is also a big braking zone, as at the first chicane at Monza.",
          "The key is that the two parts cannot both be driven on their ideal line. There is no room. Drivers sacrifice the first part, often braking into it and turning in late, to be in the best place for the second part, which leads to the next straight. Kerbs matter more in chicanes than anywhere else: riding the inside kerbs lets the car take a straighter path through.",
        ],
      },
      {
        h: "Sweepers",
        p: [
          "A sweeper is a long, fast corner, taken at high speed with little or no braking. Copse at Silverstone and the long right of Turn 8 at Istanbul are classic examples. In a modern car, many are taken nearly flat out.",
          "In a sweeper the middle speed is everything. The classic, geometric line works best, because it keeps the curve as wide and gentle as possible. Smooth steering matters: any correction in the middle of a fast corner scrubs speed off the tyres. With aerodynamic downforce, a car's grip grows with its speed, which is why a sweeper that would frighten a road car is routine for a racing car.",
        ],
      },
      {
        h: "Esses",
        p: [
          "Esses are a sequence of alternating bends, left-right-left, taken in a rhythm. Maggotts and Becketts at Silverstone and the first sector at Suzuka are the best-known. Esses reward a driver who thinks several corners ahead: the exit of each bend is the entry of the next.",
          "The fastest line through esses is rarely the fastest line through any one bend. Drivers straighten the sequence as much as they can, using the kerbs on both sides, and give up a little speed in the early bends to be perfectly placed for the last one, which leads onto a straight. A mistake in the first bend usually costs something in every bend after it.",
        ],
      },
      {
        h: "Kinks",
        p: [
          "A kink is a slight bend in a straight, usually taken flat out. It does not slow the car much, but it matters: the line through it sets up the next braking zone, and a car that takes it badly loses the speed it carries to the end of the straight. In the wet or with low downforce, a kink that is flat in the dry may need a lift.",
        ],
      },
      {
        h: "Decreasing and increasing radius",
        p: [
          "Some corners tighten as you go round them: their radius decreases towards the exit. These are tricky, because the line that looks right at the entry runs wide at the exit. The trick is a late apex, much later than it looks, and patience on the throttle. Corners that open up towards the exit are the reverse: they invite an earlier apex and early acceleration.",
        ],
      },
      {
        h: "Reading a corner",
        p: [
          "When you meet a new corner, ask three things. How slow is it? The slower it is, the more the braking and the exit matter. What comes after it? A long straight means a late apex and a strong exit. Does it belong to a sequence? Then drive the sequence, not the corner.",
          "Lapdle's Order the corners puzzle and the circuit guides are a good place to see how corners connect into a lap, and the Daily Quali lets you try each type: a hairpin with a late apex, a sweeper on the classic line, a chicane where the first part is given up for the second.",
        ],
      },
    ],
    play: { text: "Read the corners of today's circuit in the Daily Quali", href: "/" },
  },
];

export const article = (slug: string) => ARTICLES.find((a) => a.slug === slug);

/** Words in an article (the intro and every paragraph), for "x min read". */
export const words = (a: Article) => [...a.intro, ...a.sections.flatMap((s) => s.p)].join(" ").split(/\s+/).length;

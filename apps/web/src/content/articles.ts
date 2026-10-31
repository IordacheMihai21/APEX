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
  {
    slug: "trail-braking",
    kicker: "Braking",
    title: "Trail braking: how drivers carry the brakes into a corner",
    description: "What trail braking is, why the fastest drivers ease off the brakes as they turn in instead of letting go at once, and how it helps the car rotate.",
    intro: [
      "Ask someone how to drive a corner and they will usually describe three separate steps: brake in a straight line, let go of the brake, then turn. It is a good way to learn, and it is safe. It is also not quite what fast drivers do. Watch the pedal traces from a qualifying lap and the brake pressure does not drop to zero before the steering goes in. It fades away gradually, all the way to the middle of the corner.",
      "That overlap between braking and turning is called trail braking: the brake pressure 'trails off' as the steering goes in. It is one of the techniques that separate a tidy lap from a fast one, and it follows directly from how a tyre shares its grip.",
    ],
    sections: [
      {
        h: "The friction circle",
        p: [
          "A tyre has a fixed amount of grip, and it can spend that grip in any direction: slowing the car, turning it, or a mix of the two. Engineers draw this as a circle. Straight-line braking uses the whole circle in one direction. A steady corner uses the whole circle sideways. Anything in between, some braking and some turning, sits on the edge of the circle at an angle.",
          "The three-step method wastes part of that circle. In the moment between letting go of the brake and turning in, the tyres are doing neither job fully. Trail braking fills that gap: as the steering asks for more sideways grip, the brake gives some back, so the tyres stay close to their limit the whole way from the braking zone to the apex.",
        ],
      },
      {
        h: "Braking later, and deeper",
        p: [
          "Because the car is still slowing as it turns in, it does not need to reach its corner speed before the turn-in point. Some of the speed is shed in the first part of the corner itself. That lets the driver brake a few metres later on the straight, which is time gained where the car is fastest.",
          "The gain is not only in the braking zone. A driver who arrives at the corner with the brakes already off has to guess the entry speed exactly: too fast and there is no way left to scrub speed without running wide. A driver still lightly on the brakes can adjust the speed right up to the apex. Trail braking makes the entry more precise, not just later.",
        ],
      },
      {
        h: "Helping the car turn",
        p: [
          "There is a second reason, and it has to do with weight. When a car brakes, its weight shifts forward onto the front tyres, and a tyre with more weight on it has more grip. Keeping a little brake on as the car turns in keeps the front tyres loaded at exactly the moment they need to grip, so the nose bites and the car turns more willingly.",
          "Drivers call this rotation. A car that rotates well points towards the apex early, and the sooner it points down the road, the sooner the driver can open the steering and get back on the throttle. A car that will not rotate, that keeps pushing its nose wide, is said to understeer, and trail braking is one of the main tools for curing it from the cockpit.",
        ],
      },
      {
        h: "The risk: too much, too long",
        p: [
          "The same weight shift has a downside. With the weight on the front, the rear tyres are lighter and have less grip. Brake too hard while turning, or keep the brake on too long, and the rear can step out. The car turns more than the driver asked for, and on a fast corner that can end in a spin.",
          "So trail braking is about a smooth release, not about braking in the corner. The pressure should fall in a steady line as the steering angle rises, reaching zero around the slowest point of the corner. A sudden release upsets the car just as much as holding on too long: the weight springs back to the rear and the front loses the grip it was counting on.",
        ],
      },
      {
        h: "Where it matters most",
        p: [
          "Trail braking earns the most in slow corners at the end of fast straights: hairpins and tight right-angle corners, where the braking zone is long and the entry speed is low. The car does a lot of slowing down, and moving even a small part of that into the corner frees up metres on the straight.",
          "In fast sweeping corners there is very little braking to trail. The car might only lift off the throttle or touch the brakes briefly, and the line and the steering matter more. In a chicane the brake often stays on lightly through the first part to settle the car for the second.",
        ],
      },
      {
        h: "Trail braking in the wet",
        p: [
          "In the rain, the circle shrinks. Every input has less grip to spend, and the car reacts more sharply when the driver asks for too much. Drivers still trail brake in the wet, but more gently: lower pressure, released earlier, with more of the slowing done in a straight line. The rear stepping out is a bigger risk on a slippery surface, and a mistake costs more.",
        ],
      },
      {
        h: "How Lapdle models it",
        p: [
          "Lapdle's physics uses the friction circle directly. In Make the corner, the car can brake and turn at the same time, but every bit of braking takes away grip it could use for turning, and the other way round. A braking point that looks too late on a straight line can still work if the line gives the car room to finish slowing as it turns, and a braking point that works on one line can put the car off the road on another.",
          "That is why the best runs in Make the corner rarely come from the earliest braking point. They come from braking late, turning in on a line that lets the car keep shedding speed, and reaching the apex at the right speed with nothing to spare.",
        ],
      },
      {
        h: "Learning it",
        p: [
          "Drivers learn trail braking by doing less, not more. First they brake in a straight line and release fully before turning. Then they let the release overlap the turn-in by a fraction, a little more each lap, feeling for the moment the nose starts to bite. The goal is a single smooth movement: brake pressure going down as the steering goes in, the two inputs crossing over like a pair of dials.",
        ],
      },
    ],
    play: { text: "Brake late and turn in Make the corner", href: "/make-the-corner" },
  },
  {
    slug: "low-downforce",
    kicker: "Car setup",
    title: "Low downforce: why Monza and Mexico City are driven differently",
    description: "Why teams take the wings off for Monza, why Mexico City's thin air does it for them, and how less downforce changes braking points and the racing line.",
    intro: [
      "A racing car is pushed into the ground by its wings and its floor. That push, called downforce, gives the tyres more grip than the car's weight alone could, and it grows with speed. At the speeds of a fast corner, a modern single-seater can have more downforce than it weighs.",
      "Downforce has a price, though. The same wings that push the car down also hold it back, with drag. On most circuits the trade is worth it, because there are enough corners to win back the time lost on the straights. On a few circuits it is not, and the teams take most of the wing off. Driving one of those cars is a different job.",
    ],
    sections: [
      {
        h: "Grip against top speed",
        p: [
          "Every setup decision on a racing car comes back to this trade. More wing means more grip in the corners and more speed through them, but a lower top speed and a slower run down every straight. Less wing means the car is a missile on the straights and a handful in the corners.",
          "Engineers decide by simulating the lap both ways. A circuit made of long straights and a few slow corners, where the car spends most of the lap at full throttle, rewards a slippery car. A circuit made of medium and fast corners, where the car is turning most of the time, rewards a car that grips.",
        ],
      },
      {
        h: "Monza: the temple of speed",
        p: [
          "Monza, in northern Italy, is the classic low-downforce circuit. Its lap is a sequence of long straights broken by chicanes and a handful of fast corners, and the cars spend about three quarters of it at full throttle. Teams bring special thin wings for this one weekend, and the cars reach their highest speeds of the year.",
          "Lapdle's physics shows the same trade. Its low-downforce car carries less wing and much less drag, and on Monza's perfect lap it reaches about 390 km/h at the end of the straights, against 346 km/h for the normal car. It is roughly half a second faster round Monza than the normal car, and three to four seconds slower on twisty circuits, where the missing grip costs more in the corners than the straights give back.",
        ],
      },
      {
        h: "Mexico City: thin air",
        p: [
          "Mexico City's circuit takes the wings off a different way. It sits about 2,200 metres above sea level, and the air there is roughly a fifth thinner than at the coast. Downforce and drag both depend on how dense the air is, so every wing on the car works less hard. Teams bolt on their biggest wings, the ones they would use at Monaco, and still end up with about as much downforce as a Monza car.",
          "Thin air also means less drag, so Mexico produces some of the highest top speeds of the season on its long run to the first corner. The engines have to work harder for cooling, the brakes run hot, and the cars slide around in the slow stadium section, but on the straights they fly.",
        ],
      },
      {
        h: "What changes in the braking zones",
        p: [
          "Less downforce changes braking first. A racing car brakes hardest at high speed, when the wings press the tyres into the ground. Take away downforce and the car arrives at each braking zone faster, but with less grip to slow down with, so the braking zones get longer. A driver who brakes at the usual marker will miss the corner.",
          "The car also becomes harder to slow down evenly. Downforce falls away as the car slows, so a low-downforce car loses grip faster through the braking zone. Drivers brake earlier and more progressively, and they are careful about turning in while still braking, because there is less grip to share between the two.",
        ],
      },
      {
        h: "What changes in the corners",
        p: [
          "In slow corners, where downforce never contributed much, a low-downforce car is almost as quick as a normal one. The difference shows in the medium and fast corners. A corner that was flat out with full wings may need a lift of the throttle, or even a touch of the brakes. A fast corner taken at 270 km/h may drop to 240.",
          "The line changes with it. With less grip in fast corners, the car needs every centimetre of track width, and drivers lean harder on the exits, where it can be tempting to run wide over the kerbs. In slow corners, the gain from a strong exit is bigger than ever, because the car accelerates harder and longer down a straight with less drag holding it back.",
        ],
      },
      {
        h: "Why it makes the racing closer",
        p: [
          "Low-downforce circuits tend to produce good racing. The long straights and the slippery cars give a following driver a strong tow, and the late braking zones at the end of those straights are natural places to overtake. Cars that are slower over a lap can still defend, and cars that are faster can still attack.",
        ],
      },
      {
        h: "Try it in Lapdle",
        p: [
          "Some days, Lapdle's Daily Quali and Make the corner run with the low-downforce car. The circuit is the same, but the braking points move, a corner that was flat out may need a lift, and the line that was best yesterday is no longer quite right. Comparing your low-downforce lap with a dry one on the same circuit is the clearest way to see how much the wings were doing.",
        ],
      },
    ],
    play: { text: "Play today's Daily Quali", href: "/" },
  },
  {
    slug: "why-monaco-is-slow",
    kicker: "Circuits",
    title: "Why Monaco is the slowest lap of the year",
    description: "Monaco is the shortest and slowest circuit on the calendar, and still the one drivers most want to win. Why the lap is so slow, and why it is so hard to drive.",
    intro: [
      "Monaco is the odd one out on the calendar. Most circuits are built for racing, with wide tracks, long run-off areas and corners shaped to give fast cars something to do. Monaco is a town. For one weekend a year, its streets, harbour front and a tunnel under a hotel become a circuit, lined with barriers on both sides.",
      "The result is the slowest lap of the season. A pole lap at Monaco averages around 170 km/h, against more than 260 km/h at Monza. And yet drivers rank it among the hardest and most rewarding laps in the world. Both facts have the same cause.",
    ],
    sections: [
      {
        h: "Short, tight and twisty",
        p: [
          "The circuit is about 3.3 km long, the shortest on the calendar, and it fits nineteen corners into that distance. There is no straight long enough for the car to reach the top speeds it manages elsewhere; the longest flat-out stretch runs through the tunnel and curves the whole way.",
          "Lapdle's physics shows the shape of the lap. On Monaco's perfect lap the car never goes faster than about 315 km/h, against 346 km/h at Monza, and it drops below 50 km/h twice. Much of the lap is spent between 100 and 200 km/h, braking and accelerating out of one tight corner after another.",
        ],
      },
      {
        h: "The slowest corner in racing",
        p: [
          "The Fairmont hairpin, below the hotel of the same name, is usually called the slowest corner in Formula 1. The cars take it at around 50 km/h, with full steering lock, and the teams fit special steering parts so the cars can turn sharply enough to get round. The line is fixed by the barriers: there is room for one car, and the drivers brush the inside wall with their wheels.",
          "The hairpin sums up the circuit. A corner like this rewards precision, not bravery: braking to exactly the right speed, turning in at exactly the right moment and getting the power down cleanly on the exit, without touching the barrier on the outside.",
        ],
      },
      {
        h: "Barriers instead of run-off",
        p: [
          "On a modern circuit, a small mistake costs time. At Monaco it usually costs the car. The barriers sit right at the edge of the track, so there is no room to run wide on an exit and recover. The racing line at Monaco is drawn not by the white lines but by the walls, and the fastest drivers take it within centimetres of them.",
          "That changes how the circuit is driven. On a normal circuit a driver can use all of the road on the exit of a corner and run over the kerb. At Monaco the outside of the exit is a barrier, so drivers often take a slightly tighter exit, giving up a little speed to keep a margin. The fastest laps come from shrinking that margin, lap by lap, through the weekend.",
        ],
      },
      {
        h: "Maximum downforce",
        p: [
          "With no long straights and many slow corners, Monaco is the opposite of Monza. Teams bring their highest-downforce wings, because grip in the corners matters far more than top speed. Drag barely matters when the car is never flat out for long.",
          "Mechanical grip matters just as much. The streets are bumpy and change surface from one corner to the next: there are painted road markings, drain covers and a dip where the track crosses from one road to another. The cars run softer suspension than usual so the tyres stay in contact with the road.",
        ],
      },
      {
        h: "Why qualifying is everything",
        p: [
          "The tight streets that make the lap slow also make overtaking almost impossible. There is nowhere to get alongside another car, and a driver who is faster by a second a lap can spend the whole race stuck behind a slower car. So the Saturday matters more than the Sunday. The order on the grid is usually close to the order at the finish, and the qualifying lap is the most important lap of the weekend.",
          "That makes Monaco qualifying one of the most watched sessions of the year: one driver, one lap, inches from the barriers, with the whole race riding on it.",
        ],
      },
      {
        h: "A circuit that rewards confidence",
        p: [
          "Monaco is a circuit where lap times keep falling through the whole weekend. The track gets grippier as the cars lay rubber on public roads that are normally driven by buses and scooters, and the drivers find more speed as they trust themselves closer to the walls. The fastest drivers are not the ones who take the most risk, but the ones who build up to the limit most cleanly.",
        ],
      },
      {
        h: "Drive it",
        p: [
          "Monaco is one of the circuits in Lapdle's rotation. Its guide walks through the corners in order, and when it comes up in the Daily Quali, the slow corners reward a patient, late-apex line more than anywhere else on the calendar.",
        ],
      },
    ],
    play: { text: "Read the Monaco circuit guide", href: "/circuits/monaco" },
  },
  {
    slug: "kerbs",
    kicker: "Technique",
    title: "How to use the kerbs: when to ride them and when to stay off",
    description: "Kerbs are part of the racing line. Which ones drivers use to make a corner wider, which ones they avoid, and why riding a kerb can be faster or slower.",
    intro: [
      "The red and white stripes at the edge of a corner are not decoration. Kerbs mark the edge of the track, protect the grass and the gravel from cars cutting the corner, and give drivers a little extra width to play with. On a fast lap, the car touches a kerb at almost every corner.",
      "But not every kerb is there to be used, and not every kerb can be used the same way. Knowing which ones to attack, which ones to brush and which ones to avoid is part of learning any circuit.",
    ],
    sections: [
      {
        h: "Why kerbs make a corner faster",
        p: [
          "The racing line is about making a corner as wide as possible, and a kerb adds width. A car that can put two wheels on the inside kerb at the apex can cut the corner by up to a metre. A car that can run out onto the exit kerb can open the curve of its exit by the same amount. A wider curve means a higher speed, and on a corner that leads onto a straight, a higher exit speed carries all the way down it.",
          "So on most corners, the best line uses the kerb on the inside at the apex and the kerb on the outside at the exit. The question is how much of it.",
        ],
      },
      {
        h: "Flat kerbs and sausage kerbs",
        p: [
          "Kerbs come in different shapes. The most common are low and flat, often with shallow ridges, and a car can drive over them without much fuss. These are the ones drivers use freely at the apex and on the exit.",
          "Behind them, many circuits add taller kerbs, sometimes called sausage kerbs, rounded bumps designed to stop drivers cutting further. Hitting one of these can launch the car, break the suspension or tear off part of the floor. They are not part of the line; they mark where the line ends.",
        ],
      },
      {
        h: "The cost of riding a kerb",
        p: [
          "Even a flat kerb has a cost. It is bumpier than the track, so the tyres spend part of the time bouncing instead of gripping, and a car that hits a kerb hard while braking or turning can lose grip for a moment. Painted kerbs are also slippery when wet, and many drivers stay off them completely in the rain.",
          "So drivers judge every kerb on its own. A smooth kerb at the apex of a slow corner, where the car is barely loaded, is free time. The same kerb in the middle of a fast corner, where the car is at the limit of its grip, can unsettle it and cost more than it gives back.",
        ],
      },
      {
        h: "Apex kerbs",
        p: [
          "On the inside of a corner, the kerb lets the car cut a little tighter at the apex. On slow corners, drivers often put the inside wheels well onto it. On fast corners they tend to brush it lightly, enough to use the width but not so much that the car bounces. In chicanes, where the car must change direction quickly, drivers often ride the kerbs hard because cutting across them straightens the path between the two parts.",
        ],
      },
      {
        h: "Exit kerbs",
        p: [
          "On the outside of the exit, the kerb is a safety margin as much as extra width. A driver who reaches it with the steering already unwinding and the throttle wide open has used every centimetre of the track. A driver who arrives there still turning hard is running out of road, and the next step is the grass.",
          "This is why exit kerbs are where track limits are judged. At most circuits the line at the edge of the track, not the outer edge of the kerb, is the limit. A car with all four wheels beyond it has left the track, and lap times set that way are deleted.",
        ],
      },
      {
        h: "Kerbs and the car",
        p: [
          "How much a driver can use the kerbs also depends on the car. A car with soft suspension rides over kerbs and keeps its grip, while a stiff car skips across them. Teams sometimes soften the setup at circuits where the kerbs are important, giving up a little performance elsewhere so the drivers can attack them.",
        ],
      },
      {
        h: "Kerbs in Lapdle",
        p: [
          "In Make the corner, the kerbs are part of the road and the car can use them, but the grass and the gravel beyond are much slower, and the barrier ends the run. The camera shakes as the car crosses a kerb, so you can feel when your line has used the full width of the track and when it has gone further than it should.",
          "The best runs usually touch the inside kerb at the apex and drift out to the outside kerb on the exit, just as a real driver would. Going wider than that costs time, and going narrower leaves speed unused.",
        ],
      },
      {
        h: "Learning the kerbs",
        p: [
          "When a driver arrives at a new circuit, the kerbs are among the first things they study, on foot and on video. Which ones can be ridden, how high they are, what lies behind them. Then, lap by lap, they use a little more of each, until they find the point where the next centimetre costs more than it gives.",
        ],
      },
    ],
    play: { text: "Use the full track in Make the corner", href: "/make-the-corner" },
  },
  {
    slug: "learning-a-circuit",
    kicker: "Practice",
    title: "How racing drivers learn a new circuit",
    description: "Track walks, onboard videos, simulators and reference points: how a driver goes from a new circuit to a qualifying lap in a single weekend.",
    intro: [
      "A racing driver arriving at a circuit for a race weekend has very little time. Practice sessions are short, the tyres are limited, and by qualifying the driver must be within a few tenths of the car's limit on every corner. Even at a circuit they know, the car, the tyres and the weather are different from last year.",
      "So drivers learn circuits in layers, before they ever drive a lap, and then they build speed in a careful order once they are on track.",
    ],
    sections: [
      {
        h: "Before the weekend: video and simulators",
        p: [
          "The first lap of a new circuit is usually driven on a screen. Drivers watch onboard videos of previous laps, from their own team and from others, to learn the order of the corners, the gear for each one and where the car is flat out. Many teams run detailed simulators that model the circuit to the centimetre, and a driver may complete hundreds of laps there before the car is even unloaded.",
          "The simulator cannot teach everything. The real grip, the bumps and the way the track changes as rubber goes down all have to be learned on the day. But it means the driver arrives knowing where the circuit goes, and can spend the real laps on details.",
        ],
      },
      {
        h: "The track walk",
        p: [
          "On the day before running starts, drivers and engineers walk or cycle around the circuit. It looks relaxed, but it is work. On foot, a driver can see things that are invisible at 300 km/h: the camber of the road, how high the kerbs are, where the surface changes, what lies beyond the edge of the track, and the landmarks that will mark each braking point and turn-in.",
        ],
      },
      {
        h: "Reference points",
        p: [
          "A driver does not judge a braking point by distance. They judge it by what they see. Circuits have marker boards counting down to each corner, usually at 150, 100 and 50 metres, but drivers also use anything that will not move: a change in the tarmac, a crack in the barrier, a sign on a bridge, a shadow in the afternoon.",
          "Every corner gets a set of these reference points: one for the braking point, one for the turn-in, one for the apex and one for where the car should track out. A lap becomes a chain of them, and a driver who has the chain memorised can drive the lap almost without thinking, leaving attention for the details that change from lap to lap.",
        ],
      },
      {
        h: "Building up speed",
        p: [
          "On track, drivers build up gradually. The first laps are about checking that the circuit matches what they learned, and that the car does what it should. Then they start moving the braking points later, one marker at a time, and carrying more speed into the corners, until they find where the limit is.",
          "Good drivers do this in a deliberate order. They do not attack every corner at once. They might push the braking in one corner while keeping the rest steady, so that if something goes wrong, they know which change caused it. A lap time is built from separate small gains, each one tested before the next.",
        ],
      },
      {
        h: "The data",
        p: [
          "After every run, drivers sit with their engineers and the data. The car records the speed, the throttle, the brake pressure and the steering angle at every metre of the lap, and the team overlays one driver's lap on another's. A driver can see exactly where a teammate braked later, carried more speed or got on the throttle sooner, and take that back onto the track.",
          "This is how drivers find the last few tenths. Most of a lap time is found by feel, but the final gains often come from a graph showing that the car was two metres off the ideal line through one corner, or waiting too long to accelerate on the exit of another.",
        ],
      },
      {
        h: "Learning the conditions",
        p: [
          "A circuit is not the same all weekend. It gets faster as rubber goes down, slower when it rains or when the sun heats the track, and the wind can change which way the car slides in a fast corner. Drivers keep learning right up to qualifying, adjusting their reference points as the grip changes.",
        ],
      },
      {
        h: "Learning a circuit in Lapdle",
        p: [
          "Lapdle's daily games follow the same steps in a smaller way. The circuit guides walk through each lap corner by corner, the Daily Quali shows which corner cost the most time after every attempt, and Make the corner puts you in one corner with one braking point to find. Coming back to the same circuit on a different day, with different conditions, shows how much of what you learned still holds.",
          "The best way to learn a circuit is the same as for a real driver: find the order of the corners, pick your reference points, and then change one thing at a time.",
        ],
      },
    ],
    play: { text: "Learn the circuits, corner by corner", href: "/circuits" },
  },
  {
    slug: "corner-exit-traction",
    kicker: "Acceleration",
    title: "Traction: why the exit of a slow corner decides the straight",
    description: "Why the first moments of acceleration out of a slow corner matter more than the corner itself, and how the line, the throttle and the tyres decide the exit.",
    intro: [
      "Most of a lap time is made on the straights. That sounds odd, because the straights are where every car is simply flat out, but it is true: the car spends far more time on them than in the corners, and what decides how fast it goes down a straight is what happened at the end of the corner before it.",
      "That end of the corner, the exit, is where traction matters: how much of the engine's power the rear tyres can put on the road without spinning.",
    ],
    sections: [
      {
        h: "Speed carried down the straight",
        p: [
          "Imagine two cars leaving the same slow corner, one at 100 km/h and one at 105 km/h. The faster car starts the straight ahead and stays ahead all the way down it, because both are accelerating as hard as they can and the faster one had a head start. At the end of a long straight, the gap can be several car lengths, all from five km/h at the exit.",
          "Now imagine the same five km/h gained at the entry to the corner. It is gone by the apex, because both cars slow to the same corner speed. That is why drivers and engineers obsess over exits and talk about entries much less: speed at the exit is carried, speed at the entry is spent.",
        ],
      },
      {
        h: "Why slow corners are traction-limited",
        p: [
          "At low speed, a racing car has far more power than its tyres can use. Downforce is small at 80 km/h, so the rear tyres have little extra grip, and the engine can spin them easily. Out of a hairpin, the driver cannot simply floor the throttle; they must feed it in, adding power as fast as the tyres will take it.",
          "As the car speeds up, downforce grows and the tyres can take more, until at some point the driver can go flat out. The quicker the car reaches that point, the faster it goes down the straight. Everything about the exit of a slow corner is about reaching full throttle as early as possible.",
        ],
      },
      {
        h: "The line sets up the exit",
        p: [
          "The tyres share their grip between turning and accelerating, so a car that is still turning hard cannot accelerate hard. The way to get on the power early is to finish most of the turning early, which is exactly what a late apex does. By turning in later and pointing the car down the straight sooner, the driver straightens the exit and frees the tyres to put power down.",
          "This is why a slow corner before a long straight is almost always driven with a late apex, and why the late apex looks slow from the outside: the car takes a tighter, slower path in the first half of the corner to earn a straighter, faster second half.",
        ],
      },
      {
        h: "Throttle like a dimmer, not a switch",
        p: [
          "Good drivers apply the throttle progressively, not in a stab. A sudden burst of power on a car that is still turning will break the rear tyres loose, and the car either slides, losing speed, or spins. A smooth, rising throttle lets the tyres keep gripping all the way out of the corner.",
          "Engineers look for this on the data: a steady ramp from the apex to full throttle, with the steering unwinding at the same rate. Any wiggle in the throttle trace, a lift after the driver started accelerating, is time lost.",
        ],
      },
      {
        h: "Tyres and conditions",
        p: [
          "Traction is the first thing to go when the tyres wear, overheat or get cold. Worn rear tyres spin more easily, and drivers on old tyres have to be gentler on the exits. In the rain, traction falls dramatically: drivers short-shift, changing to a higher gear earlier, so the engine delivers less torque at the wheels and the tyres have a better chance of gripping.",
        ],
      },
      {
        h: "Not every exit is equal",
        p: [
          "Exits matter most before long straights. The exit of a corner that leads straight into another corner barely matters, because the car will slow down again almost immediately. Drivers sacrifice those exits to set up the corners that do lead somewhere, and a good lap is built by knowing which is which.",
        ],
      },
      {
        h: "Seeing it in Lapdle",
        p: [
          "In the Daily Quali, the speed trace after every lap shows how quickly the car reaches full speed after each corner. A late apex on a corner before a long straight will usually show a slightly lower minimum speed and a much steeper climb afterwards, and the lap time will be better for it. The Speed trap game asks you to guess the speed at points on the perfect lap, from the slowest point of a hairpin to the end of the longest straight.",
        ],
      },
    ],
    play: { text: "Try a late apex in the Daily Quali", href: "/" },
  },
];

export const article = (slug: string) => ARTICLES.find((a) => a.slug === slug);

/** Words in an article (the intro and every paragraph), for "x min read". */
export const words = (a: Article) => [...a.intro, ...a.sections.flatMap((s) => s.p)].join(" ").split(/\s+/).length;

/**
 * The written part of each famous corner's guide (content/Corners.tsx), keyed like game/cornerStats.json
 * (`<trackId>-<complex>`, the Corner of the week list in modes/cornerList.ts): the address, where the corner sits
 * and what it is, how to drive it, what the rain changes, and the usual mistakes. Venue facts only: no teams, drivers or results.
 */
import { type WeeklyCorner, WEEKLY_CORNERS } from "../modes/cornerList";

export const keyOf = (w: WeeklyCorner) => `${w.trackId}-${w.complex}`;
export const cornerSlug = (w: WeeklyCorner) => CORNER_TEXT[keyOf(w)].slug;
export const cornerBySlug = (slug: string) => WEEKLY_CORNERS.find((w) => cornerSlug(w) === slug);

export const CORNER_TEXT: Record<string, { slug: string; where: string[]; drive: string[]; wet: string; mistakes: string[] }> = {
  "spa-0": {
    slug: "la-source",
    where: [
      "La Source is the first corner of the lap at Spa-Francorchamps, a tight right-hand hairpin a few hundred metres after the start line. Its name is French for “the spring”. It is the slowest corner on a lap of more than seven kilometres, and it sits at the top of the long downhill run that leads to Eau Rouge and Raidillon.",
      "Because it comes so soon after the start, La Source is where the field bunches up on the first lap, and the wide entry lets drivers try different lines into it. The run-off on the outside is paved, so a car that runs wide can rejoin, but it loses the drive down the hill and the speed it carries all the way to the end of the Kemmel straight.",
    ],
    drive: [
      "Brake hard and in a straight line on the left of the road, then turn in late. A hairpin this tight is a late-apex corner: the aim is not to carry speed through the middle, which is low whatever you do, but to get the car pointed down the hill as early as possible so that you can open the throttle and keep it open.",
      "The exit matters more than the entry. Every km/h you have when the road straightens is carried down past the old pits, through Eau Rouge and up the hill, so a corner that feels slow and tidy is usually quicker than one that feels brave. Let the car run out to the left kerb on the way out, and use all of it.",
    ],
    wet: "Spa is famous for weather that changes from one end of the lap to the other, and La Source is often where a wet lap starts to go wrong. The braking zone is long and straight, but the painted lines and the kerbs at the apex hold water. In the rain, brake earlier, keep the car off the paint and turn in on a slightly wider arc, so that the tyres are asked to do one thing at a time: stop first, then turn, then accelerate.",
    mistakes: [
      "Turning in early, then having to wait for the car to rotate before you can accelerate.",
      "Braking too late and running wide at the apex, which costs the exit and the whole run to Eau Rouge.",
      "Getting on the power before the car is straight: the rear steps out and the exit is gone.",
    ],
  },
  "monza-0": {
    slug: "prima-variante",
    where: [
      "The Prima Variante, the first chicane, is where the lap at Monza first slows down. It comes at the end of the long main straight, after the start, and is a tight right-left. It is also called the Variante del Rettifilo, the chicane of the straight. Monza added chicanes in the early 1970s to cut the speed of its long straights, and this one has been reshaped since into the tight right-left it is today.",
      "Its braking zone is one of the biggest of the year: cars arrive at the end of the straight at the highest speeds of the season and have to come down to a walking pace by racing standards. On the first lap the whole field arrives here together, and there is an escape road straight ahead for anyone who gets it wrong.",
    ],
    drive: [
      "Everything happens under braking. Brake in a straight line, as late as you dare, and keep the braking going as you turn into the right. The aim is to arrive at the first apex slowly enough to cross to the left-hander in one movement, straight over the kerbs, with the car settled.",
      "The left-hander is the one that counts, because it opens onto the long run to the Curva Grande. Sacrifice the first part to get the second one right: a car that is straight and on the power early through the exit gains time all the way to the next braking zone. The kerbs can be used, but a big hit unsettles the car just when you want it calm.",
    ],
    wet: "In the rain the Prima Variante becomes a lottery for anyone who brakes at the dry marker. The car arrives at almost the same speed but with far less grip, so the stop starts much earlier and has to be gentler at the end. With the low-downforce set-up that Monza calls for, the car is even faster on the straight and slower to stop, which makes the braking point the single biggest decision of the lap.",
    mistakes: [
      "Braking too late and locking up, then missing the first apex and having to cut the chicane.",
      "Taking too much speed into the right-hander, which leaves the car wrongly placed for the left.",
      "Hitting the inside kerb of the left too hard, which bounces the car and delays the throttle.",
    ],
  },
  "suzuka-9": {
    slug: "suzuka-final-chicane",
    where: [
      "The final chicane at Suzuka is the last real braking zone of the lap. It comes after the long, fast run from 130R, one of the quickest corners in racing, and drops the car into a tight right-left before the final bend and the main straight. On a circuit known for its flowing first sector, this is one of the few places where cars are close enough to pass.",
      "It is also the corner that decides the speed down the main straight, past the pits and towards the first corner, so it matters twice: once for the lap and once for the start of the next one. A slow exit here is felt all the way to the line.",
    ],
    drive: [
      "Brake in a straight line from the top speed of the lap and turn into the right while still on the brakes. The car has to be slowed enough to change direction for the left almost at once, so the entry speed is lower than it looks. Use the kerb on the inside of the first part, but do not lean on it.",
      "From the second part, the focus is on getting the car straight and on the power. The final bend is taken almost flat, so the speed you carry out of the chicane is the speed you take all the way to the line. A tidy, slightly slow entry beats an ambitious one that leaves the car out of shape.",
    ],
    wet: "Suzuka's weather can turn quickly, and in the wet the final chicane needs a lot more respect. The approach is fast and long, so standing water and spray hide the braking point, and the change of direction asks the tyres for grip they no longer have. Brake earlier, keep the steering inputs smaller and accept a slower first part: the exit, and the run to the line, is still where the time is.",
    mistakes: [
      "Braking late from very high speed and arriving too fast to make the change of direction.",
      "Using too much of the kerb, which throws the car wide for the left-hander.",
      "Rushing the throttle on the exit and losing the rear before the final bend.",
    ],
  },
  "interlagos-0": {
    slug: "interlagos-first-corner-s",
    where: [
      "The S at the start of the lap at Interlagos is a plunging left, then a right, then a long left onto the back straight. The circuit runs anti-clockwise around a natural bowl in the south of São Paulo, and the lap begins by dropping sharply off the start line into this sequence. The view from the grandstands, looking down into it, is one of the best on the calendar.",
      "Because the lap starts with a descent, the cars arrive at the first left at very high speed with the road falling away beneath them. It is one of the main overtaking places on the circuit, and the sequence that follows it leads straight onto the back straight, so a good exit is worth a lot.",
    ],
    drive: [
      "Brake while the car is still on the straight, before the road falls away, and turn into the left with the brakes coming off. The first corner is the slowest of the three. Its job is to set the car up for the right that follows, so a late apex in the left, with the car on the right side of the road, gives the best line through the rest.",
      "The right-hander flows straight into the long left, and that last corner leads onto the back straight. Carry the speed through the right, keep the car settled and get on the power as early as the grip allows. The time is found on the exit of the final part, not on the entry to the first.",
    ],
    wet: "São Paulo is known for sudden heavy showers, and the S at the start of the lap is where they bite first. Braking downhill on a wet road is the hardest stop of all, because the car is light and the tyres lock easily. In the rain, start braking earlier and more gently, avoid the painted kerbs and take a wider, rounder line through the left so that the car stays settled for the right.",
    mistakes: [
      "Braking downhill, where the car is lighter and the tyres lock more easily.",
      "Apexing the left too early, which leaves the car on the wrong side for the right-hander.",
      "Fighting the car in the right and losing the speed onto the back straight.",
    ],
  },
  "zandvoort-0": {
    slug: "tarzan",
    where: [
      "Tarzan is the first corner at Zandvoort, a right-hander at the end of the main straight, among the dunes of the Dutch coast. The road is cambered towards the inside, which helps the car turn and lets it carry more speed than the tight shape suggests. It is the main overtaking place on a narrow, fast circuit where passing is hard.",
      "The corner has been part of the circuit since it opened in 1948, and its name has stayed through every change since. When the circuit was rebuilt for its return to the world championship, the corners around the lap were given more banking, but Tarzan kept its character: a heavy stop from top speed into a long, turning right.",
    ],
    drive: [
      "Brake in a straight line from top speed, on the left of the road, and turn in with the brakes still on. The camber helps you here: the car will take more speed in the middle of the corner than a flat corner of the same shape would allow, so do not over-slow on entry.",
      "The exit leads into the quick run through the following corners, so the aim is a smooth arc that keeps the car on the outside of the road on the way out. Several lines work into Tarzan, the inside for defence and the outside around the camber, but the quickest is the one that gets the car back on the power without having to correct it.",
    ],
    wet: "Rain at the seaside is common, and wind can blow sand from the dunes onto the track, which leaves less grip than the surface suggests. At Tarzan the camber still helps in the wet, but the stop from top speed is much longer. Brake earlier, let the car settle before turning in and lean on the camber rather than on the brakes to get it round.",
    mistakes: [
      "Braking for a flat corner and arriving far too slowly, wasting the help of the camber.",
      "Turning in too early and running out of road on the exit.",
      "Getting on the throttle before the car has finished turning, which pushes it wide.",
    ],
  },
  "austin-0": {
    slug: "austin-turn-1",
    where: [
      "Turn 1 at the Circuit of the Americas, near Austin, Texas, is a tight left-hand hairpin at the top of a steep climb. The road rises about forty metres from the start line, and the braking zone comes as the cars are still climbing, so the apex is out of sight when the drivers have to brake. It is the signature of the circuit and its grandstand on the hill is one of the best places to watch anywhere.",
      "The road is very wide at the top of the hill, so drivers can take different lines into it: some go deep on the inside, others swing wide and cut back. On the first lap that width turns the corner into a scramble, and over a race it is one of the main places to pass.",
    ],
    drive: [
      "Brake while still climbing: the slope helps the car slow, so the stopping distance is shorter than on a flat road. Turn in late, as for any hairpin, and aim for an apex that lets the car point down the hill towards the fast esses that follow.",
      "The exit falls away to the right and leads into a short run towards the esses, so the time comes from getting the car straight early. A wide entry and a late apex are almost always quicker than diving for the inside. Take the whole width of the road on the way out.",
    ],
    wet: "In the rain, Turn 1 at Austin turns tricky because the braking zone climbs and the apex is hidden. Water runs down the slope towards the braking area, and the paint at the apex is slippery. Brake earlier, turn in a little wider and be gentle with the throttle on the way down the hill, where the car is light and easily upset.",
    mistakes: [
      "Braking at the point you would on a flat road and arriving too slowly.",
      "Turning in too early because the road is wide, then running out of room on the exit.",
      "Accelerating hard while the car is still turning downhill, where it is light and easily upset.",
    ],
  },
  "imola-0": {
    slug: "tamburello",
    where: [
      "Tamburello is the first chicane of the lap at Imola, the Autodromo Enzo e Dino Ferrari, which runs anti-clockwise beside the Santerno river. It comes after the long, curving run from the start line. Until the mid-1990s it was a flat-out left-hand curve with a wall close behind it, one of the most dangerous corners in racing; the chicane replaced it, and today it is a left-right-left taken at high speed.",
      "It is the first of the corners that give Imola its rhythm: fast chicanes and short straights, with gravel and grass close to the track. The chicane is quick by modern standards, and a car that gets it right arrives at the next braking zone with a real advantage.",
    ],
    drive: [
      "Brake in a straight line, but less than for a slow chicane: this is a fast change of direction, and the car carries a lot of speed through it. The first apex sets up everything else, so be on the inside of the left with the car settled, and let it flow across to the right.",
      "The kerbs are there to be used, but they are high, and a car that climbs them too far is thrown off line for the next part. Use enough of them to straighten the path and no more. The exit leads up towards Villeneuve and Tosa, so a clean run out of the last part is worth more than a brave entry.",
    ],
    wet: "Imola in the wet is notoriously slippery, with grass and gravel close to the track. At Tamburello the high kerbs become the biggest danger: a wet kerb offers almost no grip, and a car that rides it is thrown wide for the next part. Brake earlier, stay off the kerbs and take a rounder line through the chicane: in the rain a smooth car is a fast car.",
    mistakes: [
      "Braking as if for a slow chicane, which loses the speed this corner is about.",
      "Riding the kerbs too hard, which unsettles the car for the next change of direction.",
      "Getting the first part wrong and fighting the car for the rest of the sequence.",
    ],
  },
  "monaco-0": {
    slug: "sainte-devote",
    where: [
      "Sainte Dévote is the first corner at Monaco, a tight right-hander at the end of the short start straight. It takes its name from the small chapel of Sainte Dévote, Monaco's patron saint, which stands beside the corner. From here the road climbs steeply up Beau Rivage towards Massenet and the Casino square.",
      "The corner is lined with barriers on both sides and has only a short escape road straight ahead. On the first lap, with the whole field arriving together, it is one of the most crowded corners of the year; over the rest of the race it is one of the few places on the circuit where a car can try to pass.",
    ],
    drive: [
      "Brake in a straight line, as late as you dare but no later: there is no run-off to make up for a mistake. Turn in later than you think and use the whole width of the road, keeping the car away from the barrier on the inside, so that the exit points up the hill.",
      "The climb that follows rewards a good exit, and it is one of the few places at Monaco where the car can reach a real speed. Get the car straight early and accelerate hard up the hill. The corner is slow whatever you do; what matters is how early you can be back on the power.",
    ],
    wet: "Monaco's streets are slippery in the rain: road paint, manhole covers and the polished surface of a town all lose grip when wet. At Sainte Dévote there is no room for error, so the braking point moves back and the turn-in has to be gentle. Take a wider line, avoid the painted lines and be patient with the throttle on the climb.",
    mistakes: [
      "Braking too late and running into the escape road, or worse.",
      "Clipping the inside barrier by turning in too early.",
      "Getting on the throttle before the car is straight, which sends it towards the outside barrier.",
    ],
  },
  "monza-5": {
    slug: "parabolica",
    where: [
      "The Parabolica is the last corner at Monza, a long right-hander that opens out onto the main straight. Its radius tightens at the entry and then widens all the way to the exit, which is what gives it its name. It is the corner that decides the speed down the longest straight on the lap, past the pits and to the first chicane.",
      "It has been part of the circuit since the 1950s, and it remains one of the most famous corners in racing. The run-off on the outside, once gravel, is now largely paved, but the corner still asks for patience: a car that runs wide loses the speed onto the straight, and that loss is felt all the way to the Prima Variante.",
    ],
    drive: [
      "Brake once, firmly and in a straight line, and turn in on the left of the road. The car slows to its lowest speed early in the corner, at the tight entry, and from there the radius opens out. Pick the apex late enough that the car can then run wide on the exit with the throttle open.",
      "This is a corner for patience. The speed through it is high, so small mistakes cost a lot of time. Get the car turned early, apex late, and let the exit come to you: you should be flat out well before the road straightens, using the full width on the way out.",
    ],
    wet: "In the wet the Parabolica asks for even more patience. The corner is long and fast, so the car spends a long time leaning on its tyres, and in the rain that grip is much lower. Brake earlier, take a rounder line and wait until the car is pointed down the straight before using the throttle hard; a slide here costs speed all the way to the first chicane.",
    mistakes: [
      "Carrying too much speed into the tight entry and missing the apex.",
      "Getting on the throttle too early and running out of road on the exit.",
      "Braking too gently, then having to lift in the middle of the corner.",
    ],
  },
  "spa-10": {
    slug: "bus-stop",
    where: [
      "The Bus Stop is the last chicane at Spa-Francorchamps, a tight right-left before the final straight to the line. It takes its name from a bus stop that once stood beside the public road the circuit used to run on. It has been reshaped more than once, and today it is a slow chicane at the end of the long, fast run from Blanchimont.",
      "It is one of the best places to overtake on the circuit, because cars arrive at it at top speed and the braking zone is long. It is also the last chance to gain time before the line, so on a qualifying lap a good Bus Stop can make up for a mistake earlier in the lap.",
    ],
    drive: [
      "Brake hard and in a straight line from top speed, and turn into the right as the brakes come off. The first part is the slower one: get the car slowed and turned in time, because the left follows straight away and leads onto the short straight to the line.",
      "Use the kerbs to straighten the line through the left, and get the car pointed at the line as early as possible. The run to the finish is short, so the time is in the braking and the change of direction rather than in a long exit. Keep it tidy: a mistake here is the last thing a lap can afford.",
    ],
    wet: "In the rain the Bus Stop comes at the end of the fastest part of the lap, where spray from other cars hides the braking point. The stop is long and the change of direction is sharp, so brake earlier, keep the car straight while slowing and stay off the wet kerbs. It is also a place where the weather can differ from the rest of the circuit, so the grip may not be what the last corner suggested.",
    mistakes: [
      "Braking too late from top speed and missing the first apex.",
      "Getting the change of direction wrong and losing the run to the line.",
      "Running over too much kerb and unsettling the car on the way out.",
    ],
  },
  "hungaroring-0": {
    slug: "hungaroring-turn-1",
    where: [
      "Turn 1 at the Hungaroring, near Budapest, is a long right-hand hairpin at the end of the main straight, reached downhill. The circuit, opened in 1986 in a natural valley, is twisty and tight, with one corner flowing into the next and few long straights. That makes Turn 1 its main overtaking place.",
      "The corner drops away under braking, and its long, curving shape means that drivers can take very different lines through it. Because there are so few other places to pass, the battle into Turn 1 decides much of what happens over a race.",
    ],
    drive: [
      "Brake hard and in a straight line on the downhill approach, where the car is lighter and the tyres lock more easily. Turn in late, with the brakes coming off, and be patient: this is a long corner, and the apex comes late.",
      "The exit leads into a short run downhill to Turn 2, so the aim is to get the car straight and on the power with the full width of the road. A late apex, a wide exit and a smooth throttle are worth more here than a deep, late lunge on the brakes.",
    ],
    wet: "Rain is not common at the Hungaroring in summer, but when it comes the downhill braking zone into Turn 1 is the hardest place on the lap. The car is light under braking, the tyres lock easily and the long corner asks them to turn for a long time. Brake earlier and more gently, and keep the car off the painted kerbs at the apex.",
    mistakes: [
      "Braking downhill at the same point as on a flat road, and locking a front wheel.",
      "Turning in early and having to wait for the apex with the car stuck mid-corner.",
      "Getting impatient on the throttle and running wide on the exit.",
    ],
  },
  "monaco-8": {
    slug: "rascasse",
    where: [
      "Rascasse is the tight right-hander near the end of the lap at Monaco, round the harbourside restaurant of the same name, a rascasse being a fish of the Mediterranean. It comes after the swimming pool section and is followed by the final corner, which leads onto the start straight. The pit lane entry is here, on the inside.",
      "The corner was reshaped when the pit lane was enlarged in the 2000s, but it remains one of the slowest and most awkward corners in racing, with barriers close on both sides. Because it is near the end of the lap, a good Rascasse is felt at the line.",
    ],
    drive: [
      "Brake in a straight line after the swimming pool and turn in late, taking the car as close to the inside barrier as you dare. The corner is so slow that the gain comes from the exit rather than the speed through it, so get the car rotated early and point it towards the final corner.",
      "The final corner follows almost at once, and from there the start straight is short, so the time is in the two corners together. Use all the road between them, get the car straight, and accelerate hard towards the line.",
    ],
    wet: "In the wet the harbour section of Monaco is one of the trickiest places in racing. Painted lines, the barriers close on both sides and very little grip leave no margin at Rascasse. Brake earlier after the swimming pool, turn in gently and wait for the car to be straight before accelerating towards the final corner.",
    mistakes: [
      "Braking too late after the swimming pool and running into the barrier.",
      "Turning in too early and having no room for the final corner.",
      "Rushing the throttle and catching the rear on the way out.",
    ],
  },
};

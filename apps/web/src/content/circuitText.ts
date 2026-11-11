/**
 * The written part of each circuit guide: the circuit's character, and how to
 * drive it in Lapdle. The numbers on the guide come from the data (facts in
 * modes/circuits.ts, lap and medal times in game/outlines.ts); this is the
 * prose around them. Venue facts only: no teams, drivers or results.
 */
export const CIRCUIT_TEXT: Record<string, { character: string; drive: string }> = {
  monza: {
    character:
      "Monza sits in the royal park north of Milan and is the fastest circuit in Lapdle: long straights broken up by chicanes, then the sweeping Parabolica onto the main straight. It has held a Grand Prix almost every year since 1950.",
    drive:
      "The lap is won under braking. The chicanes come at the end of long straights, so brake in a straight line and use the kerbs to straighten the exit. Parabolica rewards patience: one braking point, then let the car run wide onto the straight.",
  },
  spa: {
    character:
      "Spa-Francorchamps runs through the Ardennes forest in Belgium and, at just over 7 km, is the longest lap in Lapdle. It drops and climbs through Eau Rouge and Raidillon, then races along the Kemmel straight; the weather can change from one end of the lap to the other.",
    drive:
      "Get La Source right to carry speed down the hill and up through Eau Rouge: the long straights afterwards reward a good exit. The Bus Stop chicane at the end is the last chance to gain time before the line.",
  },
  silverstone: {
    character:
      "Silverstone, a former airfield in England, held the very first round of the world championship in 1950. Its fast, sweeping corners, above all the Maggotts and Becketts sequence, make it a test of commitment and rhythm.",
    drive:
      "Through the fast sequences, line each corner up for the next one rather than chasing every apex. A tidy entry into the first corner of a sequence sets up all the rest.",
  },
  suzuka: {
    character:
      "Suzuka in Japan is the only figure-of-eight layout in Lapdle: the track crosses over itself on a bridge. The flowing esses of the first sector are among the hardest corners anywhere to string together, and 130R is one of the fastest.",
    drive:
      "In the esses, one early mistake costs you every corner after it, so give a little on the first to keep the rest in rhythm. The final chicane decides your speed down to the line.",
  },
  monaco: {
    character:
      "Monaco is a street circuit around the principality's harbour and hillside: the shortest lap in Lapdle, lined with barriers, with a tunnel and one of the slowest hairpins in racing. There is almost no run-off, so precision counts for more than bravery.",
    drive:
      "Every corner is slow and tight. Use the full width of the road and take late apexes to get the car straight for the next short burst of speed. The swimming pool chicane and Rascasse are where the time is.",
  },
  interlagos: {
    character:
      "Interlagos in São Paulo runs anti-clockwise around a natural bowl. The lap opens with a plunging left-right S, and a long uphill run back to the line makes the final corners count twice.",
    drive:
      "Set up the first-corner S to carry speed through its second half. Because the drag to the finish climbs all the way, the exit of the last corner is worth more than its entry.",
  },
  hungaroring: {
    character:
      "The Hungaroring near Budapest is twisty and tight, with one corner flowing straight into the next and few long straights. It is a famously hard place to overtake, so the lap is all about rhythm.",
    drive:
      "Think two corners ahead: a line that compromises one corner usually sets up the next. Turn 1, at the end of the main straight, is the big braking zone of the lap.",
  },
  "red-bull-ring": {
    character:
      "The circuit at Spielberg sits in the Styrian hills of Austria: a short lap of just ten corners, with steep climbs, heavy braking into slow uphill hairpins, and quick sweepers through the second half.",
    drive:
      "The uphill hairpins reward braking deep and getting the car turned early, so you can power out up the hill. The fast final corners reward a smooth, committed line.",
  },
  zandvoort: {
    character:
      "Zandvoort sits among the dunes on the Dutch North Sea coast. Its tight, rolling lap has banked corners, including the last turn onto the main straight, where the banking holds the car at more speed than a flat corner would.",
    drive:
      "Use the banking: on the banked corners you can carry more speed and turn in earlier than it looks. Tarzan, at the end of the main straight, is the main braking zone.",
  },
  austin: {
    character:
      "The circuit in Austin, Texas, opened in 2012 and is the newest venue in Lapdle. The lap starts with a steep climb into a blind hairpin and runs straight into a fast series of esses through the first sector.",
    drive:
      "Brake for Turn 1 before you can see the apex: the climb helps you stop. Through the esses keep the car flowing, rather than attacking every kerb.",
  },
  barcelona: {
    character:
      "The Circuit de Barcelona-Catalunya, north of Barcelona, mixes a long main straight with medium and fast corners and a slower final section. It has long been a testing venue, which makes it a benchmark of all-round performance.",
    drive:
      "The long right-hander of Turn 3 rewards a smooth, constant line. The slower final corners decide your speed all the way down the main straight.",
  },
  imola: {
    character:
      "Imola, in northern Italy, runs anti-clockwise beside the Santerno river, with fast chicanes, kerb-heavy corners and real changes of elevation through Acque Minerali and Rivazza.",
    drive:
      "Several chicanes punish too much kerb: take enough to straighten the car, but not so much that it unsettles the exit. Tamburello sets the pace for the run along the river.",
  },
  "las-vegas": {
    character:
      "Las Vegas is a night street circuit laid out on the roads around the Strip, with a permanent pit building on the east side of the city. It is long, fast and flat, and its defining feature is a run of nearly two kilometres flat out along Las Vegas Boulevard, past the resorts and casinos.",
    drive:
      "Most of the lap is straights, so the exits decide it: the slow corners before the long runs are worth more than any fast corner. Brake in a straight line, turn the car early and get on the throttle as soon as it points down the road. The walls are close, so a line that clips the apex by a little too much costs more than it gains.",
  },
};

/**
 * The longer part of each guide: a lap of the circuit corner by corner, and
 * its history as a venue. Same rule as above: no teams, drivers or results.
 */
export const CIRCUIT_MORE: Record<string, { lap: string[]; history: string }> =
  {
    monza: {
      lap: [
        "The lap starts on a long, wide main straight, the fastest part of the circuit, and ends at the first chicane, the Variante del Rettifilo: a tight right-left taken at the end of the heaviest braking zone of the lap. Cars arrive near their top speed and leave in second or third gear, so this is where a lap is most easily lost, either by braking too late and missing the apex or by too much kerb on the way out.",
        "From there the track runs through the long, flat-out right of Curva Grande to the second chicane, the Variante della Roggia, a left-right. Then come the two Lesmo corners, a pair of quicker rights where the car is loaded up in the middle of the corner and the exit of the second sets the speed down the Serraglio straight, which passes under the old banked oval.",
        "The last part of the lap is the fastest. The Variante Ascari is a quick left-right-left taken at speed, with the car changing direction twice, and it opens onto the back straight. At its end comes the Parabolica, a long right-hander that tightens and then opens: one braking point, a patient middle and a long, wide exit onto the main straight, where every km/h is carried for more than a kilometre.",
        "Where is the time at Monza? Mostly in the braking zones and the exits of the chicanes. The car spends so long at full throttle that a small gain in exit speed is multiplied down every straight, and the chicanes are where drivers decide how much kerb to take. Too little and the path through the chicane is too tight; too much and the car bounces and loses the exit. The Parabolica decides the most valuable straight of all.",
      ],
      history:
        "Monza was built in 1922 in the park of the Royal Villa of Monza, making it one of the oldest purpose-built circuits in the world. The original layout combined a road course with a high-speed oval with steep banking, and some versions of the race used both. The banking was last used by Grand Prix cars in the early 1960s and still stands in the park, unused. Chicanes were added from the 1970s to slow the cars down, but Monza is still the fastest lap of the year and the home of the Italian Grand Prix, held there almost every year since the world championship began.",
    },
    spa: {
      lap: [
        "The lap begins with La Source, a tight right-hand hairpin just after the start line and the slowest corner on the circuit. It matters far more than its speed suggests, because it opens onto a long downhill run towards Eau Rouge. The car crosses the stream at the bottom, flicks left, then climbs steeply right and left through Raidillon, flat out in the dry, before cresting onto the Kemmel straight.",
        "At the end of Kemmel, the longest flat-out stretch of the lap, comes Les Combes, a right-left chicane at the top of the hill and the main overtaking place. The track then falls away through Malmedy and the tight right of Bruxelles, down to Pouhon, a fast, double-apex left-hander taken downhill, where the car is loaded for a long time and a clean entry is everything.",
        "The final sector runs through the Fagnes chicane and Campus, then Stavelot and Paul Frère, before the long climb back towards the start. Blanchimont, a very fast left, is flat out in the dry, and the lap ends at the Bus Stop chicane, a heavy braking zone into a right-left, followed by a short burst to the line.",
        "Where is the time at Spa? A long lap gives a lot of places to lose it, but the biggest gains are in the exits that lead onto long straights: La Source onto the run to Eau Rouge, Les Combes onto the descent, and the Bus Stop onto the line. In the middle sector, Pouhon and the fast corners reward a car that grips and a driver who commits. In the rain, Spa changes more than most circuits, because of its length and its fast corners.",
      ],
      history:
        "The first race at Spa was held in the early 1920s on a triangle of public roads between the villages of Francorchamps, Malmedy and Stavelot, nearly 15 km long and among the fastest and most dangerous circuits in Europe. Racing on the old layout ended in the 1970s, and in 1979 a shorter, permanent circuit of about 7 km was built, keeping the first part of the original course, with La Source, Eau Rouge and the Kemmel straight, and adding a new section through the forest. It is still the longest circuit on the calendar, and its size means it can rain on one part of the lap and be dry on another.",
    },
    silverstone: {
      lap: [
        "The start line sits on the straight between Club and Abbey. The lap begins with Abbey, a fast right taken almost flat, and the Farm curve, before the slow Village corner and the tight left of the Loop, the slowest point of the lap. Aintree takes the car onto the Wellington straight, which ends at Brooklands and the long right of Luffield, where patience on the throttle pays off down the following straight.",
        "Copse, a fast right at the end of that straight, leads into the sequence that defines Silverstone: Maggotts, Becketts and Chapel, a left-right-left-right-left taken in a rhythm of quick changes of direction at high speed. The car never stops turning, and each corner sets up the next; a small mistake at the first corner costs time through all of them and down the Hangar straight that follows.",
        "At the end of the Hangar straight, Stowe is a fast right where the car arrives at top speed and brakes only lightly. Then come Vale, a slow left, and Club, a right-hander that brings the car back to the start line. It is one of the few places on the lap where a strong exit matters more than the corner itself.",
        "Where is the time at Silverstone? In the fast corners more than at most circuits. Copse, Maggotts, Becketts and Stowe are all taken at high speed, and the difference between a committed line and a cautious one is large. The slow corners, Village, the Loop and Vale, matter mainly for their exits. The circuit is also exposed and windy, so the balance of the car can change from one lap to the next, and a gust can turn a fast corner into a hard one.",
      ],
      history:
        "Silverstone was built on a Second World War bomber airfield in Northamptonshire, and its first races used the runways and the perimeter road. In 1950 it held the very first race of the new world championship. The layout has changed many times since, keeping the airfield's fast character, and in 2011 a new pit and paddock complex, called the Wing, moved the start line to its current place between Club and Abbey. It is one of the fastest circuits on the calendar, with a lap made largely of high-speed corners. Its corners take their names from the airfield and the area around it: Copse, Becketts, Stowe and Club among them. The circuit has hosted the British Grand Prix every year since 1987.",
    },
    suzuka: {
      lap: [
        "The lap starts downhill into Turn 1, a fast right that tightens into Turn 2. Then come the S curves, the esses: a series of linked left and right corners climbing the hill, where the line through one decides the line through the next. They end with the Dunlop curve, a long left, before the two Degner corners, the second of which runs the car under the bridge that carries the back of the circuit.",
        "After the bridge comes the hairpin, the slowest corner on the circuit, and a long right-hand curve onto the approach to Spoon, a double-apex left that opens onto the back straight. Spoon decides the speed along the straight, so the second apex matters more than the first.",
        "The back straight crosses over the start of the lap on the bridge and runs to 130R, a very fast left named after its radius, taken almost flat out. The lap ends with the Casio Triangle, a slow right-left chicane, and a final right-hander onto the main straight. A clean exit of the chicane is worth time all the way to the line.",
        "Where is the time at Suzuka? In the first sector, above all. The esses are a long chain of corners where a small mistake costs time all the way to Degner, and a smooth, early rhythm is worth more than attacking any single corner. In the second half, the exits of Spoon and the final chicane decide the two longest flat-out stretches of the lap.",
      ],
      history:
        "Suzuka was built in the early 1960s as a test track for a Japanese car maker, on land beside its factory, and was designed by the Dutch engineer John Hugenholtz. It is the only figure-of-eight circuit on the calendar: the back straight crosses over the first part of the lap on a bridge. It first held the Japanese Grand Prix in 1987. The circuit sits inside an amusement park, with a large Ferris wheel visible from much of the lap, and its fast, flowing first sector is one of the hardest anywhere for drivers to get exactly right.",
    },
    monaco: {
      lap: [
        "The lap starts on the short straight by the harbour and turns right at Sainte Dévote, the first corner, then climbs up Beau Rivage to the left of Massenet and Casino Square at the top of the hill. The track drops back down through Mirabeau and into the Grand Hotel hairpin, the slowest corner of the season, where the cars need full steering lock to get round.",
        "Mirabeau Bas and Portier, two slow right-handers, lead into the tunnel, the fastest part of the lap. The car comes out of the darkness into daylight on a downhill braking zone into the Nouvelle Chicane on the harbour front, then follows the water through Tabac, a fast left beside the barrier.",
        "The swimming pool section is a quick left-right, followed by a slower right-left. These are among the fastest changes of direction on the lap and need precision between the barriers. The lap finishes with La Rascasse, a tight right around a restaurant, and Anthony Noghès, the last corner onto the start straight.",
        "Where is the time at Monaco? In the slow corners and their exits. With so many of them, a small gain in each adds up, and the short bursts of acceleration between corners reward getting on the power early. The tunnel and the swimming pool reward commitment, but the barriers mean that a little margin is never wasted.",
      ],
      history:
        "The first Monaco Grand Prix was held in 1929, organised by the Automobile Club de Monaco through the streets of the principality. It was part of the first world championship season in 1950 and has been a regular round since the 1950s. The circuit has changed only in detail over the decades, because it is bounded by the town itself: a new swimming pool section in the 1970s, a reshaped Rascasse and a larger pit lane in the 2000s. It remains the slowest, shortest and tightest lap of the season, and one of the most famous races in the world.",
    },
    interlagos: {
      lap: [
        "The lap begins with a downhill left-right, the S do Senna, taken from the end of the main straight under heavy braking. It flows into the long left of Curva do Sol and onto the back straight, the Reta Oposta, a natural overtaking place that ends at the Descida do Lago, a left-hander at the bottom of the hill.",
        "The middle of the lap is the twisty infield. The Ferradura, or horseshoe, is a long double right; Pinheirinho is a slow left; and Bico de Pato is a tight right-hand hairpin, the slowest point on the lap. The circuit then drops through the long left of Mergulho, where the car is loaded at speed.",
        "The final corner, Junção, is a left-hander that opens onto the longest flat-out stretch of the lap: a steep uphill run past the pits and the grandstands, all the way to the start line and beyond, to the first corner. Because the car is accelerating uphill for so long, the exit of Junção is one of the most valuable corners anywhere.",
        "Where is the time at Interlagos? In the exits that lead uphill. The run from Junção to the first corner is long and steep, and a slow exit there is felt all the way to the braking zone. The S do Senna matters for the same reason: it leads onto the long left of Curva do Sol and the back straight. In the twisty middle section, a smooth rhythm counts more than any single corner. The weather can change quickly in São Paulo, and the circuit is often damp at one end and dry at the other.",
      ],
      history:
        "Interlagos, officially the Autódromo José Carlos Pace, opened in 1940 in the south of São Paulo, between two lakes, which gives it its name. It first held the Brazilian Grand Prix in 1973. The original circuit was nearly 8 km long, with a long outer loop and fast banked corners; in 1990 it was shortened to its current length of about 4.3 km, keeping the natural bowl and its changes of elevation. It is one of the few circuits that run anti-clockwise, and its short lap and long uphill straight make it one of the busiest for overtaking.",
    },
    hungaroring: {
      lap: [
        "The lap starts on the main straight, one of the few long straights on the circuit, and runs downhill into Turn 1, a long right-hand hairpin that is the biggest braking zone of the lap and the best place to overtake. Turn 2, a tight left, and Turn 3, a right, lead onto a short straight.",
        "Turn 4 is a fast left over a crest, taken with the car light and loaded at the same time, followed by the long right of Turn 5. The middle sector is a series of slow and medium corners that link into one another: a chicane, quick changes of direction and few places for the car to straighten. Here the line through one corner is set by the next.",
        "The lap ends with a series of slower corners, Turns 12 to 14, through the final part of the circuit, and the last corner, a long right-hander, opens onto the main straight. The exit of that corner sets the speed all the way down the straight and into Turn 1.",
        "Where is the time at the Hungaroring? In the rhythm of the middle sector. With almost no straights, the car is turning or braking for most of the lap, and the line through each corner is a compromise with the next. Turn 1 and the last corner matter most, because they bracket the only long straight. The track is often dusty off the racing line, so drivers stay on the cleaner rubbered line where they can.",
      ],
      history:
        "The Hungaroring was built in 1986 near the town of Mogyoród, about 20 km from Budapest, and that summer it held the first world championship race behind the Iron Curtain. The circuit sits in a natural valley, so spectators can see much of the lap from the hillsides. It is twisty, often hot and dusty, and one of the hardest places to overtake on the calendar, which makes qualifying especially important. The layout has had only small changes since it opened, most notably the removal of an early chicane in the late 1980s. Its first corner was moved and tightened in the 2000s to help overtaking, and the circuit has been resurfaced several times since.",
    },
    "red-bull-ring": {
      lap: [
        "The lap begins with a steep climb into Turn 1, a right-hander taken under braking on the uphill, followed by a long, rising straight to Turn 3, a tight right-hand hairpin at the top of the hill. The climb helps the car slow down, so the braking point is later than it looks.",
        "From the top, the track drops down a straight to Turn 4, another tight right under heavy braking, this time downhill. These three corners and the straights between them make up most of the overtaking on the lap, and the exit of each hairpin matters more than the corner itself.",
        "The second half of the lap is very different: a series of fast, flowing corners through the infield, where the car is loaded for long periods and commitment matters. The lap ends with two fast right-handers dropping down the hill onto the start straight.",
        "Where is the time at Spielberg? In the first half, at the exits of the three uphill and downhill hairpins: each opens onto a long straight, so a strong exit is worth a lot. In the second half, the fast corners reward commitment and a car that grips. The lap is so short that a tenth of a second is a big gap, and the field is often very close. The kerbs and the track limits are tight, especially in the last two corners, so drivers have to use all of the road without going beyond it.",
      ],
      history:
        "The circuit at Spielberg, in the Styrian hills, first opened in 1969 as the Österreichring, a very fast circuit of nearly 6 km through the hills. It held the Austrian Grand Prix from 1970 until the 1980s. In the 1990s it was rebuilt as a shorter circuit, the A1-Ring, with slower hairpins and the current layout, and after a gap it was rebuilt again and reopened as the Red Bull Ring in 2011. With only ten corners and one of the shortest lap times of the year, it is a short and intense lap. The hills around the circuit form a natural amphitheatre, so spectators on the grass banks can see a large part of the lap, and the mountains of Styria rise behind the track.",
    },
    zandvoort: {
      lap: [
        "The lap starts on a straight near the sea and ends at Tarzan, a right-hand hairpin with a slight banking that is the main overtaking place. From there the track winds through Gerlach and into Hugenholtz, a steeply banked corner that lets the car carry much more speed than a flat corner would.",
        "The middle of the lap climbs and falls through the dunes: Hunserug over a crest, the fast Scheivlak downhill, and the slower corners through the back of the circuit. With the dunes and changes of elevation, many corners are blind on the approach, and the track is narrow, so the line has little room for error.",
        "The lap ends with a chicane, then the Arie Luyendyk corner, a long right with steep banking that lets the car accelerate early and carry speed onto the main straight. The banking makes the last corner one of the most unusual on the calendar.",
        "Where is the time at Zandvoort? In the banked corners and the run onto the main straight. The banking lets the car carry speed that a flat corner would not allow, so a driver who trusts it is faster. The narrow track and the blind crests in the dunes make the middle of the lap hard to read, and the sand blown onto the track by the wind can make the grip change from lap to lap. With few straights and a narrow track, qualifying matters a great deal.",
      ],
      history:
        "Zandvoort opened in 1948, built among the dunes on the Dutch coast, partly on roads laid during the war. It held the Dutch Grand Prix from 1952 to 1985, then was used for national and smaller international racing. For its return to the world championship in 2021, two corners were rebuilt with steep banking, among the steepest on a modern road circuit. The circuit is short, narrow and fast, and the wind from the sea often blows sand onto the track. The grandstands sit close to the track among the dunes, and on race weekends the circuit is one of the loudest and most crowded on the calendar. The town of Zandvoort, a seaside resort, lies just beside it.",
    },
    austin: {
      lap: [
        "The lap starts on the main straight and climbs a steep hill to Turn 1, a tight left-hand hairpin at the top, one of the most spectacular first corners anywhere. The braking point comes before the driver can see the apex, and the corner is wide, so drivers take very different lines through it.",
        "From Turn 1 the track drops into a series of fast esses, a rhythm of left and right corners taken at speed. A tidy entry into the first sets up the rest. Then come Turn 11, a slow hairpin, and the back straight, the longest of the lap, more than a kilometre long.",
        "At the end of the back straight is Turn 12, a heavy braking zone and a common place to overtake, followed by a slower stadium section of short straights and tight corners. The lap finishes with a long, multi-apex right through Turns 16 to 18, then two slower corners onto the start straight.",
        "Where is the time at Austin? In the first sector and the long back straight. The esses reward a smooth, early rhythm, and the hairpin of Turn 11 decides the speed down the back straight, the longest flat-out stretch of the lap. The surface is bumpy in places, and the changes of elevation affect braking: uphill into Turn 1 the car stops more easily, while downhill corners need earlier braking. The stadium section and the long right of Turns 16 to 18 then reward patience.",
      ],
      history:
        "The Circuit of the Americas, south-east of Austin, Texas, opened in 2012 and was the first circuit in the United States built specifically for Formula 1. Its design borrowed ideas from famous corners elsewhere: the fast esses recall Silverstone, the stadium section recalls Hockenheim, and the long multi-apex right recalls Istanbul. It runs anti-clockwise, and the climb to Turn 1, about 40 metres high, is the signature of the circuit. It also holds motorcycle and sports car races. The observation tower beside the circuit, more than 70 metres tall, gives a view of almost the whole lap, and the grandstand on the hill at Turn 1 is one of the best places to watch anywhere.",
    },
    barcelona: {
      lap: [
        "The lap starts on a long main straight, and the first corner is a tight right-left, the main overtaking place. Turn 3 is a long, fast right where the car is loaded for a long time and a smooth line matters more than the apex. Turn 4 is a slower right, and Turn 5 a downhill left.",
        "The middle of the lap has a series of medium-speed corners, then Turn 9, a very fast right over a crest, approached blind. The back straight leads to Turn 10, a tight left-hand hairpin under heavy braking.",
        "The final sector runs through slower corners in the infield, before the last corners, which open onto the main straight. The exit of the last corner decides the speed down the longest straight of the lap.",
        "Where is the time at Barcelona? Everywhere a little, which is why it is such a good test. Turn 3 and Turn 9 reward a car that grips in fast corners and a driver who commits; Turn 1 and Turn 10 are heavy braking zones; the final sector and its exit decide the speed down the long main straight. The track surface is abrasive and often hot, so the tyres wear quickly, and the wind can change the balance of the car from one corner to the next. A car that is quick here is usually quick almost anywhere, because no single kind of corner dominates the lap.",
      ],
      history:
        "The Circuit de Barcelona-Catalunya, at Montmeló, opened in 1991, and has held the Spanish Grand Prix every year since. It has long been a winter testing venue, because the mix of fast, medium and slow corners tests every part of the car, so teams know it extremely well. The layout has changed in the final sector several times: a slow chicane was added in 2007 and removed in 2023, returning the last corners to a faster, flowing shape. Its long main straight, one of the longest on the calendar, and its slow final sector make it a good place to compare cars over a lap, and its grandstands at the first corner and the final sector see most of the action.",
    },
    imola: {
      lap: [
        "The lap starts on a straight beside the pits and runs into Tamburello, once a flat-out left, now a fast chicane. Then come Villeneuve, another chicane, and Tosa, a slow left-hand hairpin. Each needs heavy braking from high speed.",
        "After Tosa the track climbs to Piratella, a blind left over a crest, then drops down to Acque Minerali, a fast right-hand sequence at the bottom of the valley and back up the hill. These changes of elevation make the corners harder to read.",
        "The track then runs through the Variante Alta, a chicane where too much kerb unsettles the car, and down to Rivazza, a double left at the bottom of the hill. The lap ends with a run back to the start line.",
        "Where is the time at Imola? In the chicanes and the corners with elevation. The chicanes reward a balance between using the kerbs and keeping the car settled, and the narrow track leaves little room to recover a mistake. Piratella and Acque Minerali are hard to read because of the crests and the dips, and Rivazza rewards a patient exit onto the run to the line. The narrow track also makes overtaking hard, so the starting position matters. In the rain, Imola's kerbs and changes of elevation make it one of the hardest circuits to drive.",
      ],
      history:
        "Imola, officially the Autodromo Internazionale Enzo e Dino Ferrari, opened in the 1950s near the town of Imola in northern Italy. It was built on public land beside the Santerno river, and its first races were for motorcycles. It held its first world championship Grand Prix in 1980 and was the home of the San Marino Grand Prix for many years. Several fast corners were turned into chicanes in the 1990s for safety. It is one of the few circuits that run anti-clockwise, and is known for its changes of elevation, kerbs and narrow track. The circuit runs through a public park beside the town, and parts of it are open to walkers and cyclists outside race weekends. Its narrow, old-fashioned layout makes it a favourite of drivers, who see it as a real test of precision.",
    },
    "las-vegas": {
      lap: [
        "The lap starts on the straight beside the pit building and ends in the first corner, a slow left-hander reached under heavy braking. The first few corners are tight and close together, a short street section where the car changes direction at low speed before the track opens up.",
        "From there the lap heads north on long, wide roads, with quick bends that are taken flat or nearly flat with low downforce. The track passes the Sphere and swings around the resorts at the north end of the lap through a series of slower, tighter corners. These are the corners that set up the most important part of the circuit.",
        "Then comes the Strip itself: the track turns onto Las Vegas Boulevard and runs south for nearly two kilometres at full throttle, past the hotels and fountains, with the car at its top speed for longer than almost anywhere else in racing. At the end of the boulevard a slow, tight section brings the speed right down before the track turns back towards the pit straight.",
        "Where is the time at Las Vegas? In the exits of the slow corners. With so much of the lap spent at full throttle, a small gain in speed out of the corner before the boulevard is carried all the way down it, and the same is true of the corners onto the back straight and the pit straight. The low grip of a street surface on a cold desert night makes the braking zones harder than they look: the tyres take time to come up to temperature, and a lock-up into a slow corner costs time on the straight that follows.",
      ],
      history:
        "Grand Prix racing first came to Las Vegas in 1981 and 1982, on a temporary track laid out in the car park of Caesars Palace. The racing on the Strip itself began in 2023, when the current circuit was built on the roads around it, with a permanent pit and paddock building on land east of the boulevard. The race is held at night, on a Saturday in November, and most of the track uses public roads that are open to traffic for the rest of the year. The cold of a desert night in November gives it some of the lowest track temperatures of the season, and its long straights make it one of the fastest street circuits ever raced. Its first weekend was interrupted in practice when a loose drain cover on the boulevard damaged a car, and the covers along the track were checked before running resumed.",
    },
  };

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
};

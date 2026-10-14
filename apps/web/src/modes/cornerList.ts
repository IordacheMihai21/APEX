/**
 * The famous corners, named the way fans know them (never after drivers or
 * sponsors), with only corners whose place in the lap is certain. Shared by
 * Corner of the week, Make the corner and the tool that builds its data
 * (tools/track-builder/src/build-corners.ts), so it imports nothing.
 */
export interface WeeklyCorner {
  trackId: string;
  /** index into the track's corner groups (controls.complexes) */
  complex: number;
  name: string;
  /** one line on what makes it hard */
  note: string;
}

export const WEEKLY_CORNERS: WeeklyCorner[] = [
  { trackId: "spa", complex: 0, name: "La Source", note: "The tightest hairpin of the lap, straight after the line. Brake late, get the car turned, and the long run to Eau Rouge starts here." },
  { trackId: "monza", complex: 0, name: "Prima Variante", note: "From top speed into a right-left chicane. Braking is everything; clip the kerbs and get on the power early." },
  { trackId: "suzuka", complex: 9, name: "Suzuka's final chicane", note: "The last corners of the lap: hard braking into a tight chicane onto the main straight. Exit speed is the lap time." },
  { trackId: "interlagos", complex: 0, name: "Interlagos' first-corner S", note: "Downhill into a left, straight into a right. Set up the first to carry speed through the second." },
  { trackId: "zandvoort", complex: 0, name: "Tarzan", note: "A banked right-hander at the end of the main straight. The banking lets you carry more speed than it looks." },
  { trackId: "austin", complex: 0, name: "Austin's Turn 1", note: "Uphill and blind into a tight left hairpin. The braking point comes before you can see the apex." },
  { trackId: "imola", complex: 0, name: "Tamburello", note: "A fast chicane on the run along the river. Too much kerb and you lose the exit." },
  { trackId: "monaco", complex: 0, name: "Sainte Dévote", note: "The first corner, between the barriers: a tight right that sends you up the hill. No run-off for a mistake." },
  { trackId: "monza", complex: 5, name: "Parabolica", note: "A long right that opens onto the main straight. Brake once, then let the car run out wide on the exit." },
  { trackId: "spa", complex: 10, name: "Bus Stop", note: "The last chicane before the line: hard on the brakes, right-left, then flat out to the finish." },
  { trackId: "hungaroring", complex: 0, name: "Hungaroring's Turn 1", note: "Downhill into a long right hairpin. Late on the brakes, and patient on the throttle." },
  { trackId: "monaco", complex: 8, name: "Rascasse", note: "The slow corners that end the lap, round the harbour and up to the line. Every metre of kerb counts." },
];

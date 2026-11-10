import { cleanNickname } from "./nickname";

/**
 * The pitlane name: the one nickname a device races under everywhere (the Daily Quali board, the Championship).
 * It's offered after the first daily game is finished, never on arrival, with a made-up racing name filled in; a
 * player who waves it away is asked once more on a later day, then never again unasked (the menu always has it).
 */
const FIRST = ["Late", "Apex", "Kerb", "Slip", "Pit", "Chicane", "Tyre", "Grid", "Turbo", "Brake", "Pole", "Draft", "Lap", "Sector", "Wet"];
const SECOND = ["Braker", "Hunter", "Crusher", "Stream", "Wall", "Chaser", "Whisper", "Rocket", "Racer", "Master", "Sitter", "King", "Ace", "Flyer", "Wizard"];

/** A made-up racing name, e.g. "LateBraker217" (always a valid nickname). */
export function suggestName(rand: () => number = Math.random): string {
  for (;;) {
    const name = `${FIRST[Math.floor(rand() * FIRST.length)]}${SECOND[Math.floor(rand() * SECOND.length)]}${Math.floor(rand() * 900) + 100}`;
    if (cleanNickname(name)) return name;
  }
}

const KEY = "apex.pitlane";
interface Asked {
  times: number;
  day: string;
}
function asked(): Asked {
  try {
    const a = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Asked>;
    return { times: Number(a.times) || 0, day: typeof a.day === "string" ? a.day : "" };
  } catch {
    return { times: 0, day: "" };
  }
}

/** Whether to offer the name now: no name yet, asked fewer than twice, and not already today. */
export function shouldOfferName(hasName: boolean, today: string): boolean {
  if (hasName) return false;
  const a = asked();
  return a.times < 2 && a.day !== today;
}

/** Remember that the name was offered today (whatever the answer). */
export function markOffered(today: string) {
  try {
    const a = asked();
    localStorage.setItem(KEY, JSON.stringify({ times: a.times + 1, day: today }));
  } catch {
    /* it may be offered again */
  }
}

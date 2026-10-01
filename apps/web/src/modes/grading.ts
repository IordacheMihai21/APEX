/** Lap feedback language: one colour per corner group, sector-timing convention. */
export type Grade = "purple" | "green" | "yellow" | "red";

/** Seconds lost to the target line in one corner group → colour. Purple = the impossible bar. */
export const GRADE_LIMITS_MS = { purple: 50, green: 150, yellow: 400 } as const;

export function gradeFor(deltaMs: number): Grade {
  if (deltaMs <= GRADE_LIMITS_MS.purple) return "purple";
  if (deltaMs <= GRADE_LIMITS_MS.green) return "green";
  if (deltaMs <= GRADE_LIMITS_MS.yellow) return "yellow";
  return "red";
}

export const GRADE_EMOJI: Record<Grade, string> = { purple: "🟪", green: "🟩", yellow: "🟨", red: "🟥" };

export const GRADE_LABEL: Record<Grade, string> = {
  purple: "on the perfect line",
  green: "close",
  yellow: "slow",
  red: "far off",
};

export interface GroupGrade {
  name: string;
  deltaMs: number;
  grade: Grade;
  /** Race time (ms) at which the car leaves this group: when its tile reveals. */
  revealAtMs: number;
}

const GRADE_RANK: Record<Grade, number> = { purple: 0, green: 1, yellow: 2, red: 3 };

/**
 * Personal best per corner group across laps, F1 style: the best colour
 * reached in each group on any lap (null before the first lap).
 */
export function bestPerGroup(laps: Grade[][]): Grade[] | null {
  if (!laps.length) return null;
  return laps[0].map((_, i) => laps.reduce<Grade>((b, l) => (l[i] && GRADE_RANK[l[i]] < GRADE_RANK[b] ? l[i] : b), laps[0][i]));
}

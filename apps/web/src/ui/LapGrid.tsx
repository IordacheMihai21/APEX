import type { Grade } from "../modes/grading";

const TILE: Record<Grade, string> = {
  purple: "bg-purple border-purple",
  green: "bg-green border-green",
  yellow: "bg-yellow border-yellow",
  red: "bg-kerb border-kerb",
};

/**
 * The lap grid: one row per lap, one tile per corner group (the Wordle board of
 * APEX). Empty rows show the laps still available; a live row reveals tile by
 * tile with a flip as the car passes each group.
 */
export function LapGrid({
  rows,
  total,
  cols,
  live,
  size = "md",
  labels,
}: {
  rows: Grade[][];
  total: number;
  cols: number;
  /** tiles of the lap in progress, and how many are revealed */
  live?: { grades: Grade[]; revealed: number };
  size?: "sm" | "md";
  labels?: string[];
}) {
  const tile = size === "sm" ? "h-2.5 min-w-2.5 rounded-[2px]" : "h-[clamp(14px,3.2vh,24px)] min-w-4 rounded-[3px]";
  const allRows: { grades: (Grade | null)[]; live: boolean }[] = rows.map((r) => ({ grades: r, live: false }));
  if (live) allRows.push({ grades: live.grades.map((g, i) => (i < live.revealed ? g : null)), live: true });
  while (allRows.length < total) allRows.push({ grades: new Array(cols).fill(null), live: false });
  return (
    <div className={`flex flex-col ${size === "sm" ? "gap-1" : "gap-1.5"}`}>
      {allRows.slice(0, total).map((row, r) => (
        <div key={r} className={`grid ${size === "sm" ? "gap-1" : "gap-1.5"}`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {row.grades.map((g, c) => (
            <span
              key={c}
              title={labels?.[c]}
              className={`${tile} border ${g ? `${TILE[g]} ${row.live ? "tile-flip" : ""}` : row.live ? "border-white/35 bg-white/5" : "border-white/12 bg-transparent"}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

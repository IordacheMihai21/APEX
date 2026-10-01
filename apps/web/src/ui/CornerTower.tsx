import type { Grade } from "../modes/grading";

const BAR: Record<Grade, string> = { purple: "bg-purple", green: "bg-green", yellow: "bg-yellow", red: "bg-kerb" };
const TEXT: Record<Grade, string> = { purple: "text-purple", green: "text-green", yellow: "text-yellow", red: "text-kerb" };

export interface TowerRow {
  name: string;
  grade: Grade | null;
  deltaMs: number | null;
}

/**
 * The corner tower: a timing tower on the left edge, one row per corner group,
 * the same strip through setup, race and result. In setup a row jumps to that
 * corner; in the race rows light up as the car clears them; in the result it
 * is the lap summary. The coloured edge bar is the only colour on it.
 */
export function CornerTower({
  rows,
  active,
  header,
  onSelect,
  live = false,
}: {
  rows: TowerRow[];
  /** highlighted row: the selected corner (setup) or where the car is (race) */
  active: number;
  header: string;
  onSelect?: (i: number) => void;
  live?: boolean;
}) {
  return (
    <nav aria-label="Corners" className="pointer-events-auto w-[84px] min-[720px]:w-[172px]">
      <div className="label border-b border-line bg-night/90 px-2 py-1.5 text-paint">{header}</div>
      <ol className="bg-night/82 backdrop-blur-[2px]">
        {rows.map((r, i) => {
          const on = i === active;
          const Tag = onSelect ? "button" : "div";
          return (
            <li key={r.name} className="border-b border-line/70 last:border-b-0">
              <Tag
                {...(onSelect ? { onClick: () => onSelect(i), "aria-current": on ? "true" : undefined, type: "button" as const } : {})}
                className={`relative flex h-[27px] w-full items-center gap-1.5 pr-2 text-left ${on ? "bg-paint text-night" : "text-paint"} ${
                  live && r.grade ? "row-flash" : ""
                } ${onSelect && !on ? "hover:bg-graphite" : ""}`}
              >
                <span className={`cut-l num grid h-full w-[22px] shrink-0 place-items-center text-[11px] font-bold ${on ? "bg-night text-paint" : "bg-graphite text-steel"}`}>
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12px] font-bold [font-stretch:80%]">{r.name}</span>
                {r.deltaMs !== null && r.grade && (
                  <span className={`num hidden text-[11px] font-semibold min-[720px]:inline ${on ? "text-night" : TEXT[r.grade]}`}>
                    {r.deltaMs >= 0 ? "+" : "−"}
                    {(Math.abs(r.deltaMs) / 1000).toFixed(2)}
                  </span>
                )}
                <span aria-hidden="true" className={`absolute top-0 right-0 bottom-0 w-[4px] ${r.grade ? BAR[r.grade] : "bg-transparent"}`} />
                {r.grade && <span className="sr-only">{r.grade}</span>}
              </Tag>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

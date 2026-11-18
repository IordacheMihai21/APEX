import { t } from "../i18n";
import type { DetectiveCase } from "../modes/fastDetective";

type Point = [number, number];
const path = (points: Point[], close = false) => points.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ") + (close ? " Z" : "");

function Marker({ at, color, label, side = "right", labelY = -10 }: { at: Point; color: string; label: string; side?: "left" | "right"; labelY?: number }) {
  return <g className="detective-clue-in" transform={`translate(${at[0]} ${at[1]})`}>
    <circle r="10" fill="none" stroke={color} strokeWidth="2" opacity="0.45" />
    <circle r="4" fill={color} />
    <text x={side === "right" ? 13 : -13} y={labelY} textAnchor={side === "right" ? "start" : "end"} fill={color} fontSize="10" fontWeight="800" letterSpacing="0.6">{label}</text>
  </g>;
}

/** One corner, with each clue changing the same scene before the result replay. */
export function DetectiveVisual({ case_: c, clues, answered }: { case_: DetectiveCase; clues: number; answered: boolean }) {
  const v = c.visual;
  const road = path([...v.left, ...[...v.right].reverse()], true);
  const center = path(v.line);
  const replay = path(v.replay.length > 1 ? v.replay : [v.start, v.outcome]);
  const reduceMotion = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  return <figure className="mt-7 overflow-hidden border border-line bg-board" aria-label={t("Visual corner clues")}>
    <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3"><figcaption className="text-[12px] font-bold uppercase tracking-[0.1em] text-paint">{c.circuit} · {c.corner}</figcaption><span className="num text-[12px] text-steel">{answered ? t("REPLAY") : `${String(clues).padStart(2, "0")} / 05`}</span></div>
    <div className="relative bg-[#101519]">
      <svg className="block aspect-[320/210] w-full" viewBox="0 0 320 210" role="img" aria-label={t("A diagram of the corner and the driver's braking, apex and throttle points as clues appear")}>
        <path d={road} fill="#293137" stroke="#8a9295" strokeWidth="1.6" />
        <path d={center} fill="none" stroke="#bdc5c6" strokeWidth="1.1" strokeDasharray="5 6" opacity="0.7" />
        <Marker at={v.start} color="#ebf4f3" label={t("ENTRY")} side={v.start[0] > 160 ? "left" : "right"} />
        {clues >= 2 && c.condition === "wet" && <g className="detective-clue-in" stroke="#69baff" strokeWidth="2" opacity="0.75" aria-hidden="true">{Array.from({ length: 17 }, (_, i) => <path key={i} d={`M${18 + (i * 53) % 290} ${13 + (i * 37) % 175}l-4 11`} />)}</g>}
        {clues >= 4 && <Marker at={v.brake} color="#ff665c" label={t("BRAKE")} side={v.brake[0] > 160 ? "left" : "right"} labelY={v.brake[1] > 175 ? -18 : 25} />}
        {clues >= 5 && <><Marker at={v.apex} color="#ffd35b" label={t("APEX")} side={v.apex[0] > 160 ? "left" : "right"} labelY={v.apex[1] < 20 ? 22 : -10} /><Marker at={v.throttle} color="#47d4ad" label={t("POWER")} side={v.throttle[0] > 160 ? "left" : "right"} labelY={v.throttle[1] < 40 ? 28 : -27} /></>}
        {!answered && <g transform={`translate(${v.start[0]} ${v.start[1]})`}><path d="M0 -8L6 7L0 4L-6 7Z" fill="#fff" stroke="#101519" strokeWidth="1.5" /></g>}
        {answered && (reduceMotion ? <g transform={`translate(${v.outcome[0]} ${v.outcome[1]})`}><circle r="10" fill={c.tookCorner ? "#36dbaa" : "#ff665c"} opacity="0.35" /><path d="M0 -8L6 7L0 4L-6 7Z" fill="#fff" stroke="#101519" strokeWidth="1.5" /></g> : <g><path d="M0 -8L6 7L0 4L-6 7Z" fill="#fff" stroke="#101519" strokeWidth="1.5" /><animateMotion dur="2.6s" path={replay} rotate="auto" fill="freeze" /></g>)}
        {answered && <Marker at={v.outcome} color={c.tookCorner ? "#36dbaa" : "#ff665c"} label={c.tookCorner ? t("MADE IT") : t("LOST GRIP")} side={v.outcome[0] > 160 ? "left" : "right"} />}
      </svg>
      {clues >= 2 && <span className={`detective-clue-in absolute top-3 right-3 border px-2 py-1 text-[11px] font-bold tracking-wide ${c.condition === "wet" ? "border-sky-300/70 bg-sky-950/80 text-sky-200" : "border-yellow/70 bg-night/90 text-yellow"}`}>{c.condition === "wet" ? t("WET TRACK") : t("DRY TRACK")}</span>}
    </div>
    <div className="grid grid-cols-3 divide-x divide-line border-t border-line text-center text-[11px] text-steel"><div className="px-2 py-3"><span className="block font-bold uppercase tracking-wide">{t("Approach")}</span><strong className="num mt-1 block text-[16px] text-paint">{clues >= 3 ? `${c.entryKmh} km/h` : "—"}</strong></div><div className="px-2 py-3"><span className="block font-bold uppercase tracking-wide">{t("Brake")}</span><strong className="num mt-1 block text-[16px] text-paint">{clues >= 4 ? `${c.brakeBeforeM} m` : "—"}</strong></div><div className="px-2 py-3"><span className="block font-bold uppercase tracking-wide">{t("Carry")}</span><strong className="num mt-1 block text-[16px] text-paint">{clues >= 5 ? `${c.carryKmh} km/h` : "—"}</strong></div></div>
  </figure>;
}

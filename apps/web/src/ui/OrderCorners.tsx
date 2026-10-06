import { useEffect, useMemo, useRef, useState } from "react";
import { HowToPlay, modalOpen } from "./HowToPlay";
import { AdBelow } from "./Ads";
import { FinishCard } from "./FinishCard";
import { NextToday } from "./NextToday";
import { gameFinished, gameStarted } from "../games/events";
import { type OutlineDetail, OUTLINES, loadOutlineDetail } from "../game/outlines";
import { circuit } from "../modes/circuits";
import { dailyNumber } from "../modes/daily";
import { type Corner, CORNERS_PER_DAY, ORDER_TRIES, marks, orderCircuit, orderOver, orderShare, orderSolved, orderStats, orderTries, pickCorners, recordTry, trayOrder } from "../modes/order";
import { primaryBtn, secondaryBtn } from "./styles";

/** A corner's shape, as it sits on the map (north up), with a dot where the car comes in. */
function Tile({ c, tone = "plain" }: { c: Corner; tone?: "plain" | "right" | "wrong" }) {
  const xs = c.path.map((p) => p[0]);
  const ys = c.path.map((p) => p[1]);
  // at least 170 units across, so a small corner isn't blown up to look like a big one
  const side = Math.max(170, Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) + 50;
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  const d = `M${c.path.map((p) => p.join(" ")).join("L")}`;
  const stroke = tone === "right" ? "var(--color-green)" : tone === "wrong" ? "var(--color-kerb)" : "#f2f2ee";
  return (
    <svg viewBox={`${cx - side / 2} ${cy - side / 2} ${side} ${side}`} className="aspect-square w-full" aria-hidden="true">
      <path d={d} fill="none" stroke="#2b2f37" strokeWidth={side * 0.12} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={stroke} strokeWidth={side * 0.05} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={c.path[0][0]} cy={c.path[0][1]} r={side * 0.045} fill="#ff6a13" stroke="#0a0b0d" strokeWidth={side * 0.015} />
    </svg>
  );
}

/** The circuit, the start line and the way round, with the corners placed so far numbered. */
function MapView({ id, corners, shown }: { id: string; corners: Corner[]; shown: boolean[] }) {
  const o = OUTLINES[id];
  const [x, y, angle] = o.start;
  return (
    <svg viewBox="0 0 1000 1000" className="aspect-square w-full" role="img" aria-label={`${circuit(id).name} from above, with the start line and the direction of travel`}>
      <path d={o.outline} fill="none" stroke="#2b2f37" strokeWidth={44} strokeLinejoin="round" />
      <path d={o.outline} fill="none" stroke="#9aa1ab" strokeWidth={14} strokeLinejoin="round" />
      <g transform={`translate(${x} ${y}) rotate(${angle})`}>
        <rect x={-6} y={-34} width={12} height={68} fill="#f2f2ee" />
        {/* the way round */}
        <path d="M30 0 L 92 0 M70 -20 L 94 0 L 70 20" fill="none" stroke="#ff6a13" strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" />
      </g>
      {corners.map((c, i) =>
        shown[i] ? (
          <g key={c.group} className="rise">
            <circle cx={c.apex[0]} cy={c.apex[1]} r={40} fill="var(--color-green)" stroke="#0a0b0d" strokeWidth={10} />
            <text x={c.apex[0]} y={c.apex[1] + 15} textAnchor="middle" className="wide" fontSize={44} fill="#0a0b0d">
              {i + 1}
            </text>
          </g>
        ) : null,
      )}
    </svg>
  );
}

/**
 * Order the corners: tap the tiles into the order the car meets them, from
 * the start line round the lap; Check marks the right slots, which stay. Four
 * checks; the same circuit and tiles for everyone each day.
 */
export function OrderCorners() {
  const id = useMemo(() => orderCircuit(), []);
  const [detail, setDetail] = useState<OutlineDetail | null>(null);
  useEffect(() => {
    let live = true;
    loadOutlineDetail(id).then((d) => live && setDetail(d));
    return () => {
      live = false;
    };
  }, [id]);
  const corners = useMemo(() => (detail ? pickCorners(detail.corners) : []), [detail]);
  const tray0 = useMemo(() => trayOrder(corners.length || CORNERS_PER_DAY), [corners.length]);

  const [tries, setTries] = useState<number[][]>(() => orderTries());
  const over = orderOver(tries);
  const won = orderSolved(tries);
  // a slot is locked once a check found the right corner in it
  const locked = useMemo(() => Array.from({ length: corners.length }, (_, i) => tries.some((t) => t[i] === i)), [tries, corners.length]);
  const fresh = () => locked.map((l, i) => (l ? i : null));
  const [slots, setSlots] = useState<(number | null)[]>([]);
  const [flash, setFlash] = useState<boolean[] | null>(null);
  const [finish, setFinish] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    // a finished day shows the right order
    if (corners.length) setSlots(over ? corners.map((_, i) => i) : fresh());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [corners.length]);

  const tray = tray0.filter((p) => !slots.includes(p));
  const full = slots.length > 0 && slots.every((s) => s !== null);

  const place = (p: number) => {
    if (over || flash) return;
    const at = slots.indexOf(null);
    if (at < 0) return;
    gameStarted("corner-order", "daily");
    setSlots(slots.map((s, i) => (i === at ? p : s)));
  };
  const unplace = (i: number) => {
    if (over || flash || locked[i] || slots[i] === null) return;
    setSlots(slots.map((s, k) => (k === i ? null : s)));
  };
  const check = () => {
    if (!full || over || flash || modalOpen()) return;
    const guess = slots as number[];
    // the same order twice would only waste a check
    if (tries.some((t) => t.join() === guess.join())) {
      setNotice("You've checked that order already. Swap a corner or two.");
      timer.current = window.setTimeout(() => setNotice(null), 2200);
      return;
    }
    setNotice(null);
    const next = recordTry(guess);
    setTries(next);
    const m = marks(guess);
    setFlash(m);
    timer.current = window.setTimeout(() => {
      setFlash(null);
      if (orderOver(next)) {
        // out of checks: show the answer in place
        setSlots(corners.map((_, i) => i));
        gameFinished("corner-order", "daily", { solved: orderSolved(next), checks: next.length });
        timer.current = window.setTimeout(() => setFinish(true), 900);
      } else setSlots(m.map((ok, i) => (ok || next.some((t) => t[i] === i) ? i : null)));
    }, 1100);
  };

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (finish || modalOpen()) return;
      if (e.key === "Enter") check();
      else if (e.key === "Backspace") {
        const last = [...slots.keys()].reverse().find((i) => slots[i] !== null && !locked[i]);
        if (last !== undefined) unplace(last);
      } else if (/^[1-6]$/.test(e.key) && tray[Number(e.key) - 1] !== undefined) place(tray[Number(e.key) - 1]);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  const c = circuit(id);
  const st = orderStats();
  const shownOnMap = Array.from({ length: corners.length }, (_, i) => over || locked[i]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1080px] px-4 pt-4 pb-12 md:px-8 md:pt-6 lg:pt-10">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="wide text-[clamp(24px,6vw,52px)] leading-none text-paint">Order the corners</h1>
              <HowToPlay game="corner-order" />
            </div>
            <p className="mt-1.5 text-[14px] text-steel md:mt-2 md:max-w-[52ch] md:text-[15px]">
              Put the corners of {c.name} in lap order<span className="hidden md:inline">, from the start line round the lap. The dot on each tile is where the car comes in</span>.
            </p>
          </div>
          <p className="shrink-0 text-center">
            <span className="wide num block text-[22px] leading-none text-paint md:text-[26px]">
              {Math.min(tries.length + (over ? 0 : 1), ORDER_TRIES)}
              <span className="text-steel">/{ORDER_TRIES}</span>
            </span>
            <span className="caption mt-1 block">Check</span>
          </p>
        </div>

        <div className="mt-3 grid items-start gap-4 md:mt-5 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-8">
          <figure className="mx-auto w-full max-w-[230px] border border-line bg-board/70 p-2 md:max-w-none md:p-3">
            <MapView id={id} corners={corners} shown={shownOnMap} />
            <figcaption className="mt-1 flex items-center justify-between gap-2 text-[13px] text-steel">
              <span className="wide truncate text-paint">{c.name}</span>
              <span className="shrink-0">
                {c.flag}
                <span className="hidden md:inline"> {c.country}</span>
              </span>
            </figcaption>
          </figure>

          <div>
            <p className="caption">Lap order</p>
            <ol className="mt-2 grid grid-cols-6 gap-1.5 md:gap-2">
              {Array.from({ length: CORNERS_PER_DAY }, (_, i) => {
                const p = slots[i] ?? null;
                const tone = flash ? (flash[i] ? "right" : "wrong") : locked[i] || (over && won) ? "right" : "plain";
                return (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => unplace(i)}
                      disabled={p === null || locked[i] || over}
                      aria-label={p === null ? `Slot ${i + 1}, empty` : `Slot ${i + 1}${locked[i] ? ", right" : ", tap to take back"}`}
                      className={`relative block w-full border p-1 ${
                        tone === "right" ? "border-green bg-green/10" : tone === "wrong" ? "border-kerb bg-kerb/10" : p === null ? "border-dashed border-line" : "border-line bg-board/70"
                      }`}
                    >
                      <span className={`num absolute top-0.5 left-1 text-[11px] font-bold md:top-1 md:left-1.5 md:text-[12px] ${tone === "right" ? "text-green" : "text-steel"}`}>{i + 1}</span>
                      {p !== null && corners[p] ? <Tile c={corners[p]} tone={tone} /> : <span className="block aspect-square w-full" />}
                    </button>
                  </li>
                );
              })}
            </ol>

            {!over && (
              <>
                <p className="caption mt-4 md:mt-5">Corners</p>
                <ul className="mt-2 grid min-h-[52px] grid-cols-6 gap-1.5 md:gap-2">
                  {tray.map((p, k) => (
                    <li key={p}>
                      <button
                        type="button"
                        onClick={() => place(p)}
                        aria-label={`Corner ${k + 1}: place it next`}
                        className="block w-full border border-line bg-board/70 p-1 transition-colors hover:border-paint/40"
                      >
                        {corners[p] && <Tile c={corners[p]} />}
                      </button>
                    </li>
                  ))}
                </ul>
                {notice && (
                  <p className="rise mt-3 text-[14px] text-yellow" role="status">
                    {notice}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2 md:mt-4">
                  <button className={primaryBtn} disabled={!full || !!flash} onClick={check}>
                    Check
                  </button>
                  <button className={secondaryBtn} disabled={!!flash || slots.every((s, i) => s === null || locked[i])} onClick={() => setSlots(fresh())}>
                    Clear
                  </button>
                </div>
              </>
            )}

            {tries.length > 0 && (
              <ol className="mt-5 space-y-1" aria-label="Your checks">
                {tries.map((t, k) => (
                  <li key={k} className="flex gap-1" aria-label={`Check ${k + 1}: ${marks(t).filter(Boolean).length} of ${CORNERS_PER_DAY} right`}>
                    {marks(t).map((m, i) => (
                      <span key={i} className={`h-2.5 w-8 ${m ? "bg-green" : "bg-graphite"}`} />
                    ))}
                  </li>
                ))}
              </ol>
            )}

            {over && !flash && (
              <div className="rise mt-6">
                <p className="wide text-[clamp(24px,5vw,36px)] leading-none text-paint">{won ? `Solved in ${tries.length}` : "Out of checks"}</p>
                <p className="mt-2 text-[15px] text-paint/85">{won ? "Every corner in its place." : "The right order is shown above, numbered on the map."} A new circuit tomorrow.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button className={primaryBtn} onClick={() => setFinish(true)}>
                    See result
                  </button>
                  <NextToday />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <AdBelow />

      {finish && over && (
        <FinishCard
          game="corner-order"
          eyebrow={`Order the corners #${dailyNumber()}`}
          title={won ? (tries.length === 1 ? "First time!" : "Sorted") : "Out of checks"}
          tone={won ? "win" : "loss"}
          value={`${won ? tries.length : "X"}/${ORDER_TRIES}`}
          valueLabel="checks"
          message={`${c.name}, ${CORNERS_PER_DAY} corners.`}
          stats={[
            ["Played", String(st.played)],
            ["Solved", String(st.solved)],
            ["Average", st.average !== null ? st.average.toFixed(1) : "-"],
          ]}
          shareText={orderShare(tries, `${location.origin}/corner-order`)}
          daily="circuit"
          onClose={() => setFinish(false)}
        />
      )}
    </div>
  );
}

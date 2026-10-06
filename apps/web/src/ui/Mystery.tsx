import { useEffect, useRef, useState } from "react";
import { HowToPlay, modalOpen } from "./HowToPlay";
import { AdBelow } from "./Ads";
import { FinishCard } from "./FinishCard";
import { track } from "../analytics";
import { OUTLINES } from "../game/outlines";
import { CIRCUITS, circuit } from "../modes/circuits";
import { dailyNumber, msToNextDay } from "../modes/daily";
import {
  type Dir,
  type Feedback,
  type Mark,
  MYSTERY_TRIES,
  REVEAL,
  isOver,
  isSolved,
  judge,
  loadMystery,
  mysteryAnswer,
  mysteryShare,
  mysteryStats,
  recordGuess,
  revealOffset,
} from "../modes/mystery";
import { Down, Share, Up } from "./icons";
import { primaryBtn, secondaryBtn } from "./styles";

const CELL: Record<Mark, string> = {
  hit: "bg-green text-night",
  near: "bg-yellow text-night",
  miss: "bg-graphite text-paint",
};

function Cell({ mark, dir, children, delay }: { mark: Mark; dir?: Dir; children: React.ReactNode; delay: number }) {
  return (
    <td className="p-0.5">
      <span className={`flip flex h-11 items-center justify-center gap-1 px-1 text-center text-[13px] font-semibold ${CELL[mark]}`} style={{ animationDelay: `${delay}ms` }}>
        <span className="num">{children}</span>
        {dir === "up" && <Up className="h-3.5 w-3.5" />}
        {dir === "down" && <Down className="h-3.5 w-3.5" />}
      </span>
    </td>
  );
}

function Row({ f }: { f: Feedback }) {
  const c = circuit(f.id);
  return (
    <tr>
      <th scope="row" className="py-0.5 pr-2 text-left text-[14px] font-semibold text-paint">
        {c.name}
      </th>
      <Cell mark={f.country} delay={0}>
        {c.country === "Great Britain" ? "GB" : c.country === "United States" ? "USA" : c.country}
      </Cell>
      <Cell mark={f.length.mark} dir={f.length.dir} delay={90}>
        {c.lengthKm.toFixed(2)}
      </Cell>
      <Cell mark={f.turns.mark} dir={f.turns.dir} delay={180}>
        {c.turns}
      </Cell>
      <Cell mark={f.firstGp.mark} dir={f.firstGp.dir} delay={270}>
        {c.firstGp}
      </Cell>
    </tr>
  );
}

const hms = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, "0")).join(":");
};

/**
 * Mystery circuit: the outline draws in a little more with each wrong guess.
 * Pick from the twelve circuits; each guess is marked on country, length,
 * corners and first Grand Prix, with arrows pointing at the answer.
 */
export function Mystery({ onPlayDaily }: { onPlayDaily: () => void }) {
  const [day, setDay] = useState(loadMystery);
  const [copied, setCopied] = useState(false);
  const [left, setLeft] = useState(msToNextDay);
  useEffect(() => {
    const t = setInterval(() => setLeft(msToNextDay()), 1000);
    return () => clearInterval(t);
  }, []);

  const answer = mysteryAnswer(day.key);
  const o = OUTLINES[answer];
  const over = isOver(day);
  const solved = isSolved(day);
  const shown = over ? 1 : REVEAL[Math.min(day.guesses.length, REVEAL.length - 1)];
  const offset = revealOffset(day.key);
  const a = circuit(answer);

  // the finish card opens when the round ends here (not on a revisit), once the outline has drawn
  const wasOver = useRef(over);
  const [finish, setFinish] = useState(false);
  useEffect(() => {
    let t = 0;
    if (over && !wasOver.current) t = window.setTimeout(() => setFinish(true), 900);
    wasOver.current = over;
    return () => clearTimeout(t);
  }, [over]);

  const share = async () => {
    const text = mysteryShare(day, `${location.origin}/mystery`);
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      /* share sheet dismissed */
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto grid max-w-[1080px] gap-8 px-4 pt-8 pb-12 md:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:pt-12">
        <div>
          <p className="caption">Mystery circuit #{dailyNumber(day.key)}</p>
          <div className="mt-2 flex items-start justify-between gap-3">
            <h1 className="wide text-[clamp(30px,6vw,52px)] leading-none text-paint">Name the circuit</h1>
            <HowToPlay game="mystery" />
          </div>
          <p className="mt-3 max-w-[42ch] text-[15px] text-steel">
            {MYSTERY_TRIES} guesses. Every miss draws more of the lap, and the clues say how close you were.
          </p>

          <figure className="relative mt-6 border border-line bg-board/70 p-6">
            <svg viewBox="0 0 1000 1000" className="mx-auto aspect-square w-full max-w-[420px]" role="img" aria-label={over ? `${a.name} circuit outline` : `${Math.round(shown * 100)} percent of the mystery circuit`}>
              <path d={o.outline} fill="none" stroke="var(--color-asphalt)" strokeWidth={over ? 46 : 0} strokeLinejoin="round" />
              <path
                d={o.outline}
                pathLength={1}
                fill="none"
                stroke={over ? (solved ? "var(--color-green)" : "var(--color-paint)") : "var(--color-ink)"}
                strokeWidth={26}
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray={`${shown} ${1 - shown + 0.0001}`}
                strokeDashoffset={-offset}
                className="mystery-line"
              />
              {over && <circle cx={o.start[0]} cy={o.start[1]} r={40} fill="var(--color-ink)" stroke="var(--color-night)" strokeWidth={16} />}
            </svg>
            <figcaption className="mt-4 flex items-baseline justify-between text-[13px] text-steel">
              {over ? (
                <>
                  <span className="wide text-[20px] text-paint">{a.name}</span>
                  <span>
                    {a.country}, {a.lengthKm.toFixed(3)} km
                  </span>
                </>
              ) : (
                <>
                  <span>{Math.round(shown * 100)}% of the lap shown</span>
                  <span>
                    Guess {day.guesses.length + 1} of {MYSTERY_TRIES}
                  </span>
                </>
              )}
            </figcaption>
          </figure>
        </div>

        <div className="lg:pt-[92px]">
          <table className="w-full table-fixed border-separate border-spacing-0">
            <colgroup>
              <col className="w-[30%]" />
              <col />
              <col />
              <col />
              <col />
            </colgroup>
            <thead>
              <tr className="caption text-center">
                <th className="pb-2 text-left font-normal">Circuit</th>
                <th className="pb-2 font-normal">Country</th>
                <th className="pb-2 font-normal">Km</th>
                <th className="pb-2 font-normal">Corners</th>
                <th className="pb-2 font-normal">First GP</th>
              </tr>
            </thead>
            <tbody>
              {day.guesses.map((g) => (
                <Row key={g} f={judge(g, answer)} />
              ))}
              {Array.from({ length: MYSTERY_TRIES - day.guesses.length }, (_, i) => (
                <tr key={`e${i}`} aria-hidden="true">
                  <td className="py-0.5 pr-2">
                    <span className="block h-11 border-b border-line/60" />
                  </td>
                  {[0, 1, 2, 3].map((j) => (
                    <td key={j} className="p-0.5">
                      <span className="block h-11 border border-line/60" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="caption mt-3 flex flex-wrap gap-x-4 gap-y-1">
            <span><span className="mr-1.5 inline-block h-2.5 w-2.5 bg-green align-middle" />Exact</span>
            <span><span className="mr-1.5 inline-block h-2.5 w-2.5 bg-yellow align-middle" />Close: same continent, within 0.5 km, 2 corners or 10 years</span>
          </p>

          {over ? (
            <div className="rise mt-8 border-t border-line pt-6">
              <p className="wide text-[24px] leading-tight text-paint">
                {solved ? `Got it in ${day.guesses.length}.` : `It was ${a.name}.`}
              </p>
              <p className="mt-2 text-[15px] text-steel">
                Next mystery in <span className="num text-paint">{hms(left)}</span>
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <button className={secondaryBtn} onClick={share}>
                  <Share className="h-4 w-4" /> {copied ? "Copied" : "Share"}
                </button>
                <button className={secondaryBtn} onClick={() => setFinish(true)}>
                  See result
                </button>
                <button className={primaryBtn} onClick={onPlayDaily}>
                  Play the Daily Quali
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-8">
              <h2 className="text-[15px] font-semibold text-paint">Your guess</h2>
              <ul className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {CIRCUITS.map((c) => {
                  const used = day.guesses.includes(c.id);
                  return (
                    <li key={c.id}>
                      <button
                        disabled={used}
                        onClick={() =>
                          setDay((d) => {
                            const next = recordGuess(d, c.id);
                            if (isOver(next) && !isOver(d)) track("Minigame finished", { game: "mystery", solved: isSolved(next), guesses: next.guesses.length });
                            return next;
                          })
                        }
                        className="guess-chip w-full border border-line bg-board/70 px-3 py-2.5 text-left text-[14px] font-semibold text-paint disabled:text-steel/50 disabled:line-through"
                      >
                        {c.name}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
      {finish && over && (() => {
        const st = mysteryStats();
        return (
          <FinishCard
            game="mystery"
            eyebrow={`Mystery circuit #${dailyNumber(day.key)}`}
            title={solved ? "Got it!" : "Out of guesses"}
            tone={solved ? "win" : "loss"}
            value={`${solved ? day.guesses.length : "X"}/${MYSTERY_TRIES}`}
            valueLabel="guesses"
            message={solved ? `It's ${a.name}.` : `It was ${a.name}.`}
            stats={[
              ["Played", String(st.played)],
              ["Solved", st.played ? `${Math.round((100 * st.solved) / st.played)}%` : "-"],
              ["Streak", String(st.streak)],
            ]}
            shareText={mysteryShare(day, `${location.origin}/mystery`)}
            daily="mystery circuit"
            onClose={() => setFinish(false)}
          />
        );
      })()}
      <AdBelow />
    </div>
  );
}

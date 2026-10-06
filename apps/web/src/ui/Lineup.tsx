import { useEffect, useMemo, useRef, useState } from "react";
import { HowToPlay, modalOpen } from "./HowToPlay";
import { AdBelow } from "./Ads";
import { FinishCard } from "./FinishCard";
import { NextToday } from "./NextToday";
import { gameFinished, gameStarted } from "../games/events";
import { dailyNumber } from "../modes/daily";
import { GROUP_SIZE, MISTAKES, dailyLineup, item, judge, lineupGuesses, lineupShare, lineupState, lineupStats, recordLineupGuess } from "../modes/lineup";
import { primaryBtn, secondaryBtn } from "./styles";

/** Group colours, easiest first (the share squares match: yellow, green, blue, purple). */
const COLOURS = ["var(--color-yellow)", "var(--color-green)", "#5aa9ff", "var(--color-purple)"];

/**
 * Line-up: sixteen tiles, four groups of four. Pick four and submit; a right
 * group locks in as a coloured bar, three of four says "one away", and four
 * mistakes end the day. The same board for everyone each day.
 */
export function Lineup() {
  const puzzle = useMemo(() => dailyLineup(), []);
  const [guesses, setGuesses] = useState<string[][]>(() => lineupGuesses());
  const state = lineupState(puzzle, guesses);
  const [order, setOrder] = useState<string[]>(puzzle.board);
  const [picked, setPicked] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [finish, setFinish] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  const foundItems = new Set(state.found.flatMap((g) => puzzle.groups[g].items));
  // once the day is over, every group shows: the found ones first, then the rest
  const shownGroups = state.over ? [...state.found, ...puzzle.groups.map((_, i) => i).filter((i) => !state.found.includes(i))] : state.found;
  const left = order.filter((id) => !foundItems.has(id));

  const say = (text: string) => {
    setToast(text);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 1800);
  };
  const toggle = (id: string) => {
    if (state.over) return;
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < GROUP_SIZE ? [...p, id] : p));
  };
  const submit = () => {
    if (picked.length !== GROUP_SIZE || state.over || modalOpen()) return;
    const key = [...picked].sort().join();
    if (guesses.some((g) => g.join() === key)) return say("Already tried those four");
    gameStarted("line-up", "daily");
    const next = recordLineupGuess(puzzle, picked);
    setGuesses(next);
    const r = judge(puzzle, picked);
    if (r.group !== null) setPicked([]);
    else {
      setShake(true);
      window.setTimeout(() => setShake(false), 450);
      if (r.best === GROUP_SIZE - 1) say("One away…");
    }
    const s = lineupState(puzzle, next);
    if (s.over) {
      setPicked([]);
      gameFinished("line-up", "daily", { won: s.won, mistakes: s.mistakes });
      window.setTimeout(() => setFinish(true), 1200);
    }
  };
  const shuffle = () => {
    const a = [...order];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    setOrder(a);
  };

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (finish || modalOpen()) return;
      if (e.key === "Enter") submit();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  const st = lineupStats();
  const left_ = MISTAKES - state.mistakes;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[720px] px-4 pt-4 pb-12 md:px-8 md:pt-6 lg:pt-10">
        <div className="flex items-center gap-3">
          <h1 className="wide text-[clamp(26px,6vw,52px)] leading-none text-paint">Line-up</h1>
          <HowToPlay game="line-up" />
        </div>
        <p className="mt-1.5 text-[14px] text-steel md:mt-2 md:text-[15px]">Find four groups of four: circuits that share a fact, or corners of the same circuit.</p>

        <div className="mt-4 space-y-2">
          {shownGroups.map((g) => {
            const group = puzzle.groups[g];
            return (
              <div key={group.category.id} className="rise px-3 py-2.5 text-center text-night" style={{ background: COLOURS[g] }}>
                <p className="wide text-[14px] leading-tight uppercase md:text-[15px]">{group.category.title}</p>
                <p className="mt-0.5 text-[13px] leading-snug md:text-[14px]">{group.items.map((id) => item(id).label).join(", ")}</p>
              </div>
            );
          })}
        </div>

        {!state.over && (
          <ul className={`mt-2 grid grid-cols-4 gap-1.5 md:gap-2 ${shake ? "lineup-shake" : ""}`}>
            {left.map((id) => {
              const on = picked.includes(id);
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => toggle(id)}
                    aria-pressed={on}
                    className={`grid h-16 w-full place-items-center px-1 text-center text-[12px] leading-tight font-semibold break-words transition-colors md:h-20 md:text-[14px] ${
                      on ? "bg-paint text-night" : "bg-graphite text-paint hover:bg-asphalt"
                    }`}
                  >
                    {item(id).label}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {!state.over ? (
          <>
            <div className="mt-4 flex items-center justify-center gap-2 text-[14px] text-steel" aria-label={`${left_} mistakes left`}>
              Mistakes left
              {Array.from({ length: MISTAKES }, (_, i) => (
                <span key={i} className={`h-3 w-3 rounded-full ${i < left_ ? "bg-paint/80" : "bg-asphalt"}`} />
              ))}
            </div>
            <p className="mt-2 h-5 text-center text-[14px] font-semibold text-yellow" role="status">
              {toast}
            </p>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              <button className={secondaryBtn} onClick={shuffle}>
                Shuffle
              </button>
              <button className={secondaryBtn} disabled={picked.length === 0} onClick={() => setPicked([])}>
                Deselect
              </button>
              <button className={primaryBtn} disabled={picked.length !== GROUP_SIZE} onClick={submit}>
                Submit
              </button>
            </div>
          </>
        ) : (
          <div className="rise mt-6 text-center">
            <p className="wide text-[clamp(24px,5vw,36px)] leading-none text-paint">{state.won ? (state.mistakes === 0 ? "Perfect line-up" : "Line-up complete") : "Out of mistakes"}</p>
            <p className="mt-2 text-[15px] text-paint/85">{state.won ? `${state.mistakes} mistake${state.mistakes === 1 ? "" : "s"}. ` : "The groups are above. "}A new line-up tomorrow.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button className={primaryBtn} onClick={() => setFinish(true)}>
                See result
              </button>
              <NextToday />
            </div>
          </div>
        )}
      </div>

      <AdBelow />

      {finish && state.over && (
        <FinishCard
          game="line-up"
          eyebrow={`Line-up #${dailyNumber()}`}
          title={state.won ? (state.mistakes === 0 ? "Perfect line-up" : "Line-up complete") : "Out of mistakes"}
          tone={state.won ? "win" : "loss"}
          value={`${state.found.length}/4`}
          valueLabel="groups found"
          message={state.won ? `${state.mistakes} mistake${state.mistakes === 1 ? "" : "s"}.` : "Four mistakes."}
          stats={[
            ["Played", String(st.played)],
            ["Won", String(st.won)],
            ["Perfect", String(st.perfect)],
          ]}
          shareText={lineupShare(puzzle, guesses, `${location.origin}/line-up`)}
          daily="line-up"
          onClose={() => setFinish(false)}
        />
      )}
    </div>
  );
}

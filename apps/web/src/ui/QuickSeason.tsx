import { useState } from "react";
import { CATALOG } from "../game/catalog";
import { gameFinished, gameStarted, shared } from "../games/events";
import { t } from "../i18n";
import { evaluateQuick, readQuick, recordQuick, roundWet, SETUPS, setupLeft, startQuick, type QuickResult, type Setup } from "../modes/quickSeason";
import { primaryBtn, secondaryBtn } from "./styles";
import { SUPPORT_URL, supportClicked } from "../support";

const NAMES: Record<Setup, string> = { "low-drag": "Low drag", balanced: "Balanced", "high-grip": "High grip" };
const NOTES: Record<Setup, string> = { "low-drag": "Straight-line speed", balanced: "All-round pace", "high-grip": "Cornering grip" };
const TRAITS: Record<string, string> = {
  monza: "Long straights, sharp braking", spa: "Fast, flowing corners", silverstone: "High-speed direction changes",
  suzuka: "Linked high-speed corners", monaco: "Slow corners, narrow road", interlagos: "Short straights and climbing turns",
  hungaroring: "One corner follows another", "red-bull-ring": "Long climbs and heavy braking", zandvoort: "Banked, flowing corners",
  austin: "Long straight and technical turns", barcelona: "Fast sweeps and slow exits", imola: "Quick direction changes",
};

const time = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms % 60000 / 1000)).padStart(2, "0")}.${String(ms % 1000).padStart(3, "0")}`;

/** A two-minute championship built on the same deterministic lap simulator as Daily Quali. */
export function QuickSeason({ onClassic }: { onClassic: () => void }) {
  const [store, setStore] = useState(readQuick);
  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState<QuickResult | null>(null);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);
  const run = store.run;
  const round = run?.results.length ?? 0;
  const done = round === 12;
  const current = run?.order[round];
  const circuit = CATALOG.find((x) => x.id === current);
  const wet = run ? roundWet(run.seed, round) : false;
  const wins = run?.results.filter((r) => r.won).length ?? 0;

  const begin = () => { setStore(startQuick()); setReveal(null); setError(false); setCopied(false); };
  const choose = async (setup: Setup) => {
    if (!run || !current || busy || reveal || setupLeft(run, setup) <= 0) return;
    setBusy(true);
    setError(false);
    try {
      if (round === 0) gameStarted("quick-season", "endless");
      const result = await evaluateQuick(current, wet, setup, round);
      const next = recordQuick(result);
      setStore(next);
      setReveal(result);
      if (next.run?.results.length === 12) gameFinished("quick-season", "endless", { wins: next.run.results.filter((r) => r.won).length });
    } catch { setError(true); }
    finally { setBusy(false); }
  };
  const share = async () => {
    const text = `Lapdle Setup Sprint ${wins}-${12 - wins}\n${run?.results.map((r) => r.won ? "🟩" : "🟥").join("")}\nCan you go 12-0? https://lapdle.com/setup-season`;
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); setCopied(true); }
      shared("quick-season");
    } catch { /* cancelled or clipboard unavailable */ }
  };

  return <div className="h-full overflow-y-auto bg-night text-paint">
    <div className="mx-auto max-w-[880px] px-4 pt-7 pb-16 md:px-8 md:pt-12">
      <h1 className="wide text-[clamp(34px,8vw,72px)] leading-none">SETUP SPRINT</h1>
      <p className="mt-4 max-w-[55ch] text-[16px] leading-relaxed text-steel">{t("Twelve circuits. One setup call at each. Win every round to go 12-0. You have four of each setup for the whole season.")}</p>

      <div className="mt-5 grid grid-cols-[1fr_auto] items-end gap-4 border-y border-line py-3">
        <div>
          <div className="wide text-[clamp(50px,12vw,88px)] leading-none tabular-nums">{wins}-{round - wins}</div>
          <p className="mt-1 text-[13px] text-steel">{run ? done ? t("Season complete") : t("After {n} of 12 rounds", { n: round }) : t("The target is 12-0")}</p>
        </div>
        <div className="text-right text-[13px] text-steel">{t("Personal best")}<div className="wide mt-1 text-[25px] text-paint">{store.bestWins}-{store.played ? 12 - store.bestWins : 0}</div></div>
      </div>

      {run && <ol className="mt-5 grid grid-cols-12 gap-1" aria-label={t("Season results")}>{run.order.map((id, i) => <li key={`${id}-${i}`} className={`grid h-7 place-items-center text-[11px] font-bold ${run.results[i] ? run.results[i].won ? "bg-green text-night" : "bg-kerb text-night" : i === round ? "bg-paint text-night" : "bg-graphite text-steel"}`} title={CATALOG.find((x) => x.id === id)?.name}>{i + 1}</li>)}</ol>}

      {!run ? <div className="mt-7 border-t border-line pt-5"><p className="max-w-[55ch] text-[15px] leading-relaxed text-paint/85">{t("Pick between straight-line speed, an all-round setup and extra grip. The same lap physics decides every result. Each setup can be used four times.")}</p><button className={`${primaryBtn} mt-5`} onClick={begin}>{t("Start season")}</button></div>
      : reveal ? <div className="mt-9 border-t border-line pt-6" aria-live="polite">
          <p className={`wide text-[clamp(40px,9vw,68px)] leading-none ${reveal.won ? "text-green" : "text-kerb"}`}>{reveal.won ? t("ROUND WON") : t("ROUND LOST")}</p>
          <p className="mt-3 text-[17px] text-paint">{CATALOG.find((x) => x.id === reveal.track)?.name}: {time(reveal.timeMs)} <span className="text-steel">vs {time(reveal.rivalMs)}</span></p>
          <p className="mt-2 text-[14px] leading-relaxed text-steel">{reveal.bestSetup === reveal.setup ? t("You picked the quickest setup for this circuit.") : t("The {setup} setup was quicker here.", { setup: t(NAMES[reveal.bestSetup]).toLowerCase() })}</p>
          <div className="mt-6 flex flex-wrap gap-2">{done ? <><button className={primaryBtn} onClick={share}>{copied ? t("Copied") : t("Share result")}</button><button className={secondaryBtn} onClick={begin}>{t("New season")}</button></> : <button className={primaryBtn} onClick={() => setReveal(null)}>{t("Next circuit")}</button>}</div>
          {done && SUPPORT_URL && <p className="mt-5 text-[13px] text-steel">{t("Enjoying Lapdle?")} <a className="text-paint underline underline-offset-2" href={SUPPORT_URL} target="_blank" rel="noopener noreferrer" onClick={() => supportClicked("season")}>{t("Support the game")}</a></p>}
        </div>
      : done ? <div className="mt-9 flex flex-wrap gap-2"><button className={primaryBtn} onClick={share}>{copied ? t("Copied") : t("Share result")}</button><button className={secondaryBtn} onClick={begin}>{t("New season")}</button></div>
      : <div className="mt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="wide text-[clamp(30px,7vw,48px)] leading-none">{circuit?.flag} {circuit?.name}</h2><span className="num text-[14px] text-steel">ROUND {round + 1} / 12</span></div>
          <p className="mt-2 text-[15px] text-steel">{TRAITS[current!]}. {wet ? t("Wet track: grip is lower.") : t("Dry track.")}</p>
          <h3 className="mt-4 text-[13px] font-bold uppercase tracking-wide text-steel">{t("Choose your setup")}</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">{SETUPS.map((id) => { const left = setupLeft(run, id); return <button key={id} disabled={busy || left <= 0} onClick={() => void choose(id)} className="min-h-24 border border-line bg-board px-4 py-3 text-left transition-colors hover:border-paint/50 hover:bg-graphite focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paint disabled:cursor-not-allowed disabled:opacity-40"><span className="wide block text-[24px] leading-none text-paint">{t(NAMES[id])}</span><span className="mt-2 block text-[13px] text-steel">{t(NOTES[id])}</span><span className="num mt-3 block text-[12px] text-paint/80">{left} {t("uses left")}</span></button>; })}</div>
          {busy && <p className="mt-4 text-[14px] text-steel" role="status">{t("Simulating the lap…")}</p>}
          {error && <p className="mt-4 text-[14px] text-kerb" role="alert">{t("The circuit could not load. Try your setup again.")}</p>}
        </div>}

      <div className="mt-12 border-t border-line pt-5"><button className="text-[14px] text-steel underline underline-offset-4 hover:text-paint" onClick={onClassic}>{t("Drive every lap in Classic Season")}</button></div>
    </div>
  </div>;
}

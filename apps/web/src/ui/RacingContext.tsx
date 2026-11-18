import { useMemo, useState } from "react";
import { t } from "../i18n";
import { gameFinished, gameStarted, shared } from "../games/events";
import { CONTEXT_SOURCE, DRIVERS, contextGuesses, ranksFor, recordContextGuess, secretDriver, type Driver } from "../modes/racingContext";
import { primaryBtn } from "./styles";
import { SUPPORT_URL, supportClicked } from "../support";

export function RacingContext() {
  const secret = useMemo(secretDriver, []);
  const ranks = useMemo(() => ranksFor(secret), [secret]);
  const [guesses, setGuesses] = useState(contextGuesses);
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const solved = guesses.includes(secret.id);
  const selected = new Set(guesses);
  const matches = query.trim().length >= 2 ? DRIVERS.filter((d) => !selected.has(d.id) && d.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).slice(0, 8) : [];
  const history = [...guesses].reverse().map((id) => DRIVERS.find((d) => d.id === id)!).filter(Boolean);
  const guess = (d: Driver) => {
    if (solved) return;
    if (guesses.length === 0) gameStarted("racing-context", "daily");
    const next = recordContextGuess(d.id);
    setGuesses(next);
    setQuery("");
    if (d.id === secret.id) gameFinished("racing-context", "daily", { guesses: next.length });
  };
  const share = async () => {
    const text = `Lapdle Racing Context #${guesses.length}\n${solved ? `Solved in ${guesses.length} guesses` : `Closest: #${Math.min(...guesses.map((id) => ranks.get(id) ?? 999))}`}\nhttps://lapdle.com/racing-context`;
    try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); setCopied(true); } shared("racing-context"); } catch { /* cancelled */ }
  };
  return <div className="h-full overflow-y-auto bg-night text-paint">
    <div className="mx-auto max-w-[760px] px-4 pt-7 pb-16 md:px-8 md:pt-12">
      <h1 className="wide text-[clamp(34px,8vw,64px)] leading-none">RACING CONTEXT</h1>
      <p className="mt-4 max-w-[58ch] text-[16px] leading-relaxed text-steel">{t("Find today's secret racing driver. Every guess gets a similarity rank: #1 is the answer. You have unlimited guesses.")}</p>
      <div className="mt-7 border-y border-line py-4 text-[14px] text-steel">{t("Closeness uses nationality, teams, years raced and career records. A lower rank is closer.")}</div>
      {!solved && <div className="relative mt-8">
        <label className="block text-[14px] font-semibold text-paint" htmlFor="driver-guess">{t("Guess a driver")}</label>
        <input id="driver-guess" type="search" autoComplete="off" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("Type at least two letters")} className="mt-2 w-full border border-line bg-board px-4 py-3 text-[17px] text-paint placeholder:text-steel/75 focus-visible:outline-2 focus-visible:outline-paint" />
        {matches.length > 0 && <ul className="mt-1 border border-line bg-board" aria-label={t("Matching drivers")}>{matches.map((d) => <li key={d.id}><button className="w-full border-b border-line px-4 py-3 text-left text-[15px] text-paint hover:bg-graphite focus-visible:outline-2 focus-visible:outline-paint" onClick={() => guess(d)}>{d.name}</button></li>)}</ul>}
        {query.trim().length >= 2 && matches.length === 0 && <p className="mt-2 text-[13px] text-steel">{t("No matching driver in the game.")}</p>}
      </div>}
      {solved && <div className="mt-8 border-y border-line py-6" aria-live="polite"><h2 className="wide text-[clamp(34px,8vw,56px)] leading-none text-green">{t("DRIVER FOUND")}</h2><p className="mt-2 text-[17px] text-paint">{secret.name} · {guesses.length} {t("guesses")}</p><button className={`${primaryBtn} mt-5`} onClick={() => void share()}>{copied ? t("Copied") : t("Share result")}</button>{SUPPORT_URL && <p className="mt-5 text-[13px] text-steel">{t("Enjoying Lapdle?")} <a className="text-paint underline underline-offset-2" href={SUPPORT_URL} target="_blank" rel="noopener noreferrer" onClick={() => supportClicked("context")}>{t("Support the game")}</a></p>}</div>}
      {history.length > 0 && <section className="mt-8"><h2 className="text-[13px] font-bold uppercase tracking-wide text-steel">{t("Your guesses")}</h2><ol className="mt-3 space-y-2">{history.map((d) => { const rank = ranks.get(d.id)!; const sameTeam = d.teams.some((x) => secret.teams.includes(x)); const era = d.last < secret.first ? t("Earlier era") : d.first > secret.last ? t("Later era") : t("Same era"); return <li key={d.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border border-line bg-board px-4 py-3"><div className="min-w-0"><p className="truncate text-[17px] font-bold text-paint">{d.name}</p><p className="mt-1 text-[12px] leading-snug text-steel">{d.nation === secret.nation ? t("Same nationality") : d.nation} · {sameTeam ? t("Shared team") : era} · {d.first}–{d.last}</p></div><div className={`wide self-center text-[26px] ${rank === 1 ? "text-green" : rank <= 20 ? "text-yellow" : "text-paint"}`}>#{rank}</div></li>; })}</ol></section>}
      <p className="mt-10 text-[12px] text-steel">{t("Driver facts")}: <a className="underline underline-offset-4 hover:text-paint" href={CONTEXT_SOURCE.url} target="_blank" rel="noreferrer">{CONTEXT_SOURCE.name} {CONTEXT_SOURCE.release}</a> · {CONTEXT_SOURCE.license}</p>
    </div>
  </div>;
}

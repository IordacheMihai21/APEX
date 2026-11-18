import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { t } from "../i18n";
import { gameFinished, gameStarted, shared } from "../games/events";
import { CONTEXT_SOURCE, DRIVERS, contextClues, contextGuesses, ranksFor, recordContextGuess, revealContextClue, secretDriver, type Driver } from "../modes/racingContext";
import { primaryBtn } from "./styles";
import { SUPPORT_URL, supportClicked } from "../support";
import { HowToPlay } from "./HowToPlay";

export function RacingContext() {
  const secret = useMemo(secretDriver, []);
  const ranks = useMemo(() => ranksFor(secret), [secret]);
  const [guesses, setGuesses] = useState(contextGuesses);
  const [clues, setClues] = useState(contextClues);
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const rows = useRef(new Map<string, HTMLLIElement>());
  const before = useRef(new Map<string, DOMRect>());
  const latestCard = useRef<HTMLDivElement>(null);
  const animated = useRef(guesses.at(-1) ?? null);
  const solved = guesses.includes(secret.id);
  const selected = new Set(guesses);
  const matches = query.trim().length >= 2 ? DRIVERS.filter((d) => !selected.has(d.id) && d.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).slice(0, 8) : [];
  const history = guesses.map((id) => DRIVERS.find((d) => d.id === id)!).filter(Boolean).sort((a, b) => ranks.get(a.id)! - ranks.get(b.id)!);
  const latest = guesses.length ? DRIVERS.find((d) => d.id === guesses[guesses.length - 1]) : null;
  const heat = (rank: number) => rank === 1 ? { name: "Found", color: "bg-green" } : rank <= 10 ? { name: "Very close", color: "bg-green" } : rank <= 50 ? { name: "Close", color: "bg-yellow" } : rank <= 120 ? { name: "Warm", color: "bg-orange-400" } : { name: "Far", color: "bg-kerb" };
  const rankWidth = (rank: number) => Math.max(7, Math.round((1 - Math.log(rank) / Math.log(DRIVERS.length)) * 100));
  useLayoutEffect(() => {
    const newest = guesses.at(-1);
    if (!newest || animated.current === newest) return;
    animated.current = newest;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { before.current.clear(); return; }
    const timing = { duration: 470, easing: "cubic-bezier(0.16, 1, 0.3, 1)" };
    for (const [id, row] of rows.current) {
      const prior = before.current.get(id);
      const delta = prior ? prior.top - row.getBoundingClientRect().top : 0;
      if (!prior && id === newest) row.animate([{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "translateY(0)" }], timing);
      else if (Math.abs(delta) > 1) row.animate([{ transform: `translateY(${delta}px)` }, { transform: "translateY(0)" }], timing);
      if (id === newest) row.querySelector<HTMLElement>("[data-rank-fill]")?.animate([{ transform: "scaleX(0)" }, { transform: `scaleX(${rankWidth(ranks.get(id)!) / 100})` }], { duration: 680, easing: timing.easing });
    }
    latestCard.current?.animate([{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "translateY(0)" }], timing);
    latestCard.current?.querySelector<HTMLElement>("[data-rank-fill]")?.animate([{ transform: "scaleX(0)" }, { transform: `scaleX(${rankWidth(ranks.get(newest)!) / 100})` }], { duration: 680, easing: timing.easing });
    before.current.clear();
  }, [guesses, ranks]);
  const guess = (d: Driver) => {
    if (solved) return;
    before.current = new Map([...rows.current].flatMap(([id, row]) => {
      const rect = row.getBoundingClientRect();
      return rect.bottom > -100 && rect.top < window.innerHeight + 100 ? [[id, rect] as const] : [];
    }));
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
      <div className="flex items-start justify-between gap-3"><h1 className="wide text-[clamp(34px,8vw,64px)] leading-none">RACING CONTEXT</h1><HowToPlay game="racing-context" /></div>
      <p className="mt-4 max-w-[58ch] text-[16px] leading-relaxed text-steel">{t("Find today's secret racing driver. Every guess gets a similarity rank: #1 is the answer. You have unlimited guesses.")}</p>
      <div className="mt-7 border-y border-line py-4 text-[14px] text-steel">{t("Closeness uses nationality, teams, years raced and career records. A lower rank is closer.")} <span className="block mt-2 text-paint">{t("Green is very close; yellow is close; orange is warm; red is far.")}</span></div>
      {!solved && <div className="relative mt-8">
        <label className="block text-[14px] font-semibold text-paint" htmlFor="driver-guess">{t("Guess a driver")}</label>
        <input id="driver-guess" type="search" autoComplete="off" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("Type at least two letters")} className="mt-2 w-full border border-line bg-board px-4 py-3 text-[17px] text-paint placeholder:text-steel/75 focus-visible:outline-2 focus-visible:outline-paint" />
        {matches.length > 0 && <ul className="mt-1 border border-line bg-board" aria-label={t("Matching drivers")}>{matches.map((d) => <li key={d.id}><button className="w-full border-b border-line px-4 py-3 text-left text-[15px] text-paint hover:bg-graphite focus-visible:outline-2 focus-visible:outline-paint" onClick={() => guess(d)}>{d.name}</button></li>)}</ul>}
        {query.trim().length >= 2 && matches.length === 0 && <p className="mt-2 text-[13px] text-steel">{t("No matching driver in the game.")}</p>}
      </div>}
      {latest && <div ref={latestCard} className="relative mt-4 overflow-hidden border border-line bg-board px-4 py-3" aria-label={t("Latest guess: {name}, rank {rank}", { name: latest.name, rank: ranks.get(latest.id)! })}><span data-rank-fill className={`absolute inset-0 origin-left opacity-80 ${heat(ranks.get(latest.id)!).color}`} style={{ transform: `scaleX(${rankWidth(ranks.get(latest.id)!) / 100})` }} aria-hidden="true" /><div className="relative flex items-center justify-between gap-3"><strong className="truncate text-[17px] text-paint">{latest.name}</strong><span className="wide text-[27px] text-paint">#{ranks.get(latest.id)}</span></div></div>}
      {solved && <div className="mt-8 border-y border-line py-6" aria-live="polite"><h2 className="wide text-[clamp(34px,8vw,56px)] leading-none text-green">{t("DRIVER FOUND")}</h2><p className="mt-2 text-[17px] text-paint">{secret.name} · {guesses.length} {t("guesses")}</p><button className={`${primaryBtn} mt-5`} onClick={() => void share()}>{copied ? t("Copied") : t("Share result")}</button>{SUPPORT_URL && <p className="mt-5 text-[13px] text-steel">{t("Enjoying Lapdle?")} <a className="text-paint underline underline-offset-2" href={SUPPORT_URL} target="_blank" rel="noopener noreferrer" onClick={() => supportClicked("context")}>{t("Support the game")}</a></p>}</div>}
      {guesses.length >= 4 && <section className="mt-7 border-y border-line py-5" aria-label={t("Visual clues")}><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-[13px] font-bold uppercase tracking-wide text-steel">{t("Career fingerprint")}</h2><p className="mt-1 text-[12px] text-steel">{t("Optional visual clues unlock as you guess.")}</p></div>{!solved && clues < 3 && guesses.length >= (clues + 1) * 4 && <button className={primaryBtn} onClick={() => setClues(revealContextClue())}>{t("Reveal clue {n}", { n: clues + 1 })}</button>}</div>
        {clues > 0 && <figure className="mt-5 border border-line bg-board px-4 py-4"><figcaption className="text-[12px] font-bold uppercase tracking-wide text-steel">{t("Years on the grid")}</figcaption><svg className="mt-3 h-16 w-full" viewBox="0 0 320 64" role="img" aria-label={t("The driver raced from {from} to {to}", { from: secret.first, to: secret.last })}><path d="M8 24H312" stroke="currentColor" className="text-steel" strokeWidth="4" /><path d={`M${8 + (secret.first - 1950) / 76 * 304} 24H${8 + (secret.last - 1950) / 76 * 304}`} stroke="currentColor" className="text-ink" strokeWidth="12" strokeLinecap="round" /><text x="8" y="55" fill="currentColor" className="text-steel" fontSize="11">1950</text><text x="146" y="55" fill="currentColor" className="text-steel" fontSize="11">1988</text><text x="284" y="55" fill="currentColor" className="text-steel" fontSize="11">2026</text></svg><p className="mt-2 text-[13px] text-paint">{secret.first}–{secret.last}</p>{clues > 1 && <p className="mt-3 border-t border-line pt-3 text-[13px] text-paint">{t("Teams raced for")}: <strong>{secret.teams.length}</strong> <span className="ml-2 text-steel">{Array.from({ length: Math.min(12, secret.teams.length) }, (_, i) => <span key={i} className="mr-1 inline-block h-2 w-3 bg-ink" />)}</span></p>}{clues > 2 && <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center"><div><strong className="wide block text-[23px] text-paint">{secret.starts}</strong><span className="text-[11px] text-steel">{t("Starts")}</span></div><div><strong className="wide block text-[23px] text-paint">{secret.wins}</strong><span className="text-[11px] text-steel">{t("Wins")}</span></div><div><strong className="wide block text-[23px] text-paint">{secret.titles}</strong><span className="text-[11px] text-steel">{t("Titles")}</span></div></div>}</figure>}
      </section>}
      {history.length > 0 && <section className="mt-8"><div className="flex items-baseline justify-between gap-3"><h2 className="text-[13px] font-bold uppercase tracking-wide text-steel">{t("Your guesses")}</h2><span className="num text-[13px] text-steel">{guesses.length} {t("guesses")}</span></div><ol className="mt-3 space-y-2">{history.map((d) => { const rank = ranks.get(d.id)!; const sameTeam = d.teams.some((x) => secret.teams.includes(x)); const era = d.last < secret.first ? t("Earlier era") : d.first > secret.last ? t("Later era") : t("Same era"); const tone = heat(rank); return <li key={d.id} ref={(node) => { if (node) rows.current.set(d.id, node); else rows.current.delete(d.id); }} aria-label={`${d.name}: rank ${rank} of ${DRIVERS.length}, ${tone.name}`} className="relative overflow-hidden border border-line bg-board px-4 py-3"><span data-rank-fill className={`absolute inset-0 origin-left opacity-80 ${tone.color}`} style={{ transform: `scaleX(${rankWidth(rank) / 100})` }} aria-hidden="true" /><div className="relative grid grid-cols-[minmax(0,1fr)_auto] gap-3"><div className="min-w-0"><p className="truncate text-[17px] font-bold text-paint">{d.name} {latest?.id === d.id && <span className="ml-1 text-[11px] uppercase tracking-wide text-paint/75">{t("Latest")}</span>}</p><p className="mt-1 text-[12px] leading-snug text-paint/85">{d.nation === secret.nation ? t("Same nationality") : d.nation} · {sameTeam ? t("Shared team") : era} · {d.first}–{d.last}</p></div><div className="wide self-center text-[26px] text-paint">#{rank}</div></div></li>; })}</ol></section>}
      <p className="mt-10 text-[12px] text-steel">{t("Driver facts")}: <a className="underline underline-offset-4 hover:text-paint" href={CONTEXT_SOURCE.url} target="_blank" rel="noreferrer">{CONTEXT_SOURCE.name} {CONTEXT_SOURCE.release}</a> · {CONTEXT_SOURCE.license}</p>
    </div>
  </div>;
}

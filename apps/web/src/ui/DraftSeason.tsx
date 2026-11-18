import { useRef, useState } from "react";
import { CATALOG } from "../game/catalog";
import { gameFinished, gameStarted, shared } from "../games/events";
import { t } from "../i18n";
import { clearDraft, currentSquad, DEFAULT_CONFIG, DRAFT_SOURCE, draftComplete, eligibleSquads, finishDraft, optionsFor, pickDraft, readDraft, REROLLS, saveRun, seasonStandings, simulateDraft, SLOT_NAME, SLOTS, spinDraft, startDraft, teamRating, wins, type Candidate, type DraftConfig, type DraftRun, type Slot } from "../modes/draftSeason";
import { SUPPORT_URL, supportClicked } from "../support";
import { primaryBtn, secondaryBtn } from "./styles";
import { HowToPlay } from "./HowToPlay";

const PHILOSOPHY = [
  { id: "balanced", name: "Balanced", note: "A little pace everywhere" },
  { id: "low-drag", name: "Low drag", note: "Strong on power circuits" },
  { id: "high-grip", name: "High grip", note: "Strong on technical circuits" },
] as const;
const DIFFICULTY = [
  { id: "easy", name: "Easy", note: "3 rerolls" },
  { id: "normal", name: "Normal", note: "1 reroll" },
  { id: "hard", name: "Hard", note: "No rerolls; ratings hidden" },
] as const;
const ERAS = [
  { id: "all", name: "All-time", note: "1992–2025" },
  { id: "2000s", name: "2000s+", note: "2000–2025" },
  { id: "2010s", name: "2010s+", note: "2010–2025" },
  { id: "modern", name: "Modern", note: "2016–2025" },
] as const;
const label = "mt-7 block text-[12px] font-bold uppercase tracking-[0.12em] text-steel";
const seconds = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms % 60000 / 1000)).padStart(2, "0")}.${String(ms % 1000).padStart(3, "0")}`;

function Choice<T extends string>({ title, options, value, onChange }: { title: string; options: readonly { id: T; name: string; note: string }[]; value: T; onChange: (id: T) => void }) {
  return <fieldset className="mt-6"><legend className="text-[12px] font-bold uppercase tracking-[0.12em] text-steel">{t(title)}</legend><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">{options.map((o) => <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)} className={`border px-3 py-3 text-left transition-colors ${value === o.id ? "border-ink bg-ink/10" : "border-line bg-board hover:border-steel"}`}><span className="block text-[15px] font-bold text-paint">{t(o.name)}</span><span className="mt-1 block text-[12px] text-steel">{t(o.note)}</span></button>)}</div></fieldset>;
}

export function DraftSeason({ onSetup, onClassic }: { onSetup: () => void; onClassic: () => void }) {
  const scroll = useRef<HTMLDivElement>(null);
  const draftSection = useRef<HTMLElement>(null);
  const [store, setStore] = useState(readDraft);
  const [config, setConfig] = useState<DraftConfig>({ ...DEFAULT_CONFIG, ...store.run?.config });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sort, setSort] = useState<"rating" | "name" | "role">("rating");
  const run = store.run;
  const squad = run ? currentSquad(run) : null;
  const complete = run ? draftComplete(run) : false;
  const done = run?.results.length === 12;
  const standings = run?.results.length ? seasonStandings(run) : [];
  const championshipPlace = standings.findIndex((row) => row.player) + 1;
  const showRatings = run?.config.difficulty !== "hard" && run?.config.showRatings;
  const update = (next: DraftRun) => setStore(saveRun(next));
  const setConfigField = <K extends keyof DraftConfig>(field: K, value: DraftConfig[K]) => setConfig((old) => ({ ...old, [field]: value }));
  const top = () => requestAnimationFrame(() => scroll.current?.scrollTo({ top: 0, behavior: "instant" }));
  const begin = () => { setStore(startDraft(config)); setError(false); setCopied(false); gameStarted("draft-season", "endless"); top(); };
  const select = (candidate: Candidate, slot: Slot) => { if (run) { update(pickDraft(run, candidate, slot)); top(); } };
  const spin = (reroll = false) => {
    if (!run) return;
    update(spinDraft(run, reroll));
    requestAnimationFrame(() => draftSection.current?.scrollIntoView({ block: "start", behavior: "instant" }));
  };
  const simulate = async (r: DraftRun) => {
    if (busy) return;
    setBusy(true); setError(false); setProgress(r.results.length);
    try {
      const next = await simulateDraft(r, setProgress);
      setStore(next.results.length === 12 ? finishDraft(next) : saveRun(next));
      if (next.results.length === 12) gameFinished("draft-season", "endless", { wins: wins(next), rating: Math.round(teamRating(next)) });
    } catch { setError(true); }
    finally { setBusy(false); }
  };
  const share = async () => {
    if (!run || !done) return;
    const text = `Lapdle Perfect Season ${wins(run)}-${12 - wins(run)} · P${championshipPlace}/10\n${run.results.map((r) => r.won ? "🟩" : "🟥").join("")}\n${run.picks.driver1?.name} + ${run.picks.driver2?.name} · ${Math.round(teamRating(run))} team rating\nBuild your team: https://lapdle.com/season`;
    try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); setCopied(true); } shared("draft-season"); }
    catch { /* share cancelled */ }
  };
  const choices = squad && run ? optionsFor(run, squad).sort((a, b) => sort === "rating" ? b.rating - a.rating : sort === "name" ? a.name.localeCompare(b.name) : a.slot.localeCompare(b.slot)) : [];
  const selectedPool = eligibleSquads({ ...config, constructorOnly: null });
  const constructorCounts = new Map<string, number>();
  for (const item of selectedPool) constructorCounts.set(item.constructor, (constructorCounts.get(item.constructor) ?? 0) + 1);
  const constructors = [...constructorCounts].filter(([, count]) => count >= SLOTS.length).map(([name]) => name).sort();
  const validPool = eligibleSquads(config).length >= SLOTS.length;

  return <div ref={scroll} className="h-full overflow-y-auto bg-night text-paint"><div className="mx-auto max-w-[880px] px-4 pt-7 pb-16 md:px-8 md:pt-12">
    <div className="flex items-start justify-between gap-3"><h1 className="wide text-[clamp(34px,8vw,70px)] leading-none">PERFECT SEASON</h1><HowToPlay game="season" /></div>
    <p className="mt-4 max-w-[60ch] text-[16px] leading-relaxed text-steel">{t("Spin a constructor and season. Draft one piece of that team. Build seven slots, then simulate twelve races. Can you go 12-0?")}</p>

    {!run && <section className="mt-8 border-t border-line pt-5" aria-label={t("Set up your draft")}>
      <Choice title="Car philosophy" options={PHILOSOPHY} value={config.philosophy} onChange={(x) => setConfigField("philosophy", x)} />
      <Choice title="Difficulty" options={DIFFICULTY} value={config.difficulty} onChange={(x) => setConfigField("difficulty", x)} />
      <Choice title="Era" options={ERAS} value={config.era} onChange={(x) => setConfig((old) => ({ ...old, era: x, fromYear: x === "modern" ? 2016 : x === "2010s" ? 2010 : x === "2000s" ? 2000 : 1992, toYear: 2025, constructorOnly: null }))} />
      <fieldset className="mt-6"><legend className="text-[12px] font-bold uppercase tracking-[0.12em] text-steel">{t("Season range")}</legend><div className="mt-3 grid gap-4 sm:grid-cols-2"><label className="block text-[13px] text-steel">{t("From")} <strong className="ml-1 text-paint">{config.fromYear}</strong><input className="mt-2 block w-full accent-green" type="range" min="1992" max={config.toYear} value={config.fromYear} onChange={(e) => setConfig((old) => ({ ...old, fromYear: Number(e.target.value), constructorOnly: null }))} /></label><label className="block text-[13px] text-steel">{t("To")} <strong className="ml-1 text-paint">{config.toYear}</strong><input className="mt-2 block w-full accent-green" type="range" min={config.fromYear} max="2025" value={config.toYear} onChange={(e) => setConfig((old) => ({ ...old, toYear: Number(e.target.value), constructorOnly: null }))} /></label></div><p className="mt-2 text-[12px] text-steel">{selectedPool.length} {t("constructor-seasons in this range")}</p></fieldset>
      <label className="mt-6 block text-[12px] font-bold uppercase tracking-[0.12em] text-steel" htmlFor="one-constructor">{t("One-constructor challenge")}</label><select id="one-constructor" className="mt-2 w-full border border-line bg-board px-3 py-3 text-[14px] text-paint" value={config.constructorOnly ?? ""} onChange={(e) => setConfigField("constructorOnly", e.target.value || null)}><option value="">{t("Any constructor")}</option>{constructors.map((name) => <option key={name} value={name}>{name}</option>)}</select><p className="mt-2 text-[12px] text-steel">{t("Every spin comes from the same constructor, across different seasons.")}</p>
      <Choice title="Draft order" options={[{ id: "squad-first", name: "Constructor first", note: "Spin, then pick a role" }, { id: "slot-first", name: "Slot first", note: "Pick a role, then spin" }]} value={config.mode} onChange={(x) => setConfigField("mode", x)} />
      <Choice title="Driver ratings" options={[{ id: "season", name: "That season", note: "Their form in that year" }, { id: "prime", name: "Career prime", note: "Their best rated year" }]} value={config.driverRatings} onChange={(x) => setConfigField("driverRatings", x)} />
      {config.difficulty !== "hard" && <Choice title="Show ratings" options={[{ id: "on", name: "On", note: "See every number" }, { id: "off", name: "Off", note: "Trust your knowledge" }]} value={config.showRatings ? "on" : "off"} onChange={(x) => setConfigField("showRatings", x === "on")} />}
      <label className="mt-7 flex cursor-pointer items-start gap-3 border border-line bg-board px-4 py-4"><input type="checkbox" checked={config.midseason} onChange={(e) => setConfigField("midseason", e.target.checked)} className="mt-1 accent-green" /><span><strong className="block text-[15px] text-paint">{t("Midseason upgrade")}</strong><span className="mt-1 block text-[13px] text-steel">{t("Pause after six races and choose one upgrade for the second half.")}</span></span></label>
      <button className={`${primaryBtn} mt-7 w-full sm:w-auto`} disabled={!validPool} onClick={begin}>{t("Start draft")}</button>
      {!validPool && <p className="mt-2 text-[13px] text-kerb">{t("Choose a wider year range for seven different constructor-seasons.")}</p>}
      <p className="mt-4 text-[12px] text-steel">{t("Ratings are Lapdle's interpretation of historic results, not official ratings.")}</p>
    </section>}

    {run && <>
      {!complete && !squad && run.config.mode === "squad-first" && <button className={`${primaryBtn} mt-6`} onClick={() => spin()}>{t("Spin the wheel")}</button>}
      <div className="mt-7 flex flex-wrap items-end justify-between gap-3 border-y border-line py-4"><div><p className="text-[12px] uppercase tracking-wide text-steel">{t("Your team")}</p><p className="wide text-[36px] leading-none text-paint">{done ? `${wins(run)}-${12 - wins(run)}` : `${Object.keys(run.picks).length} / 7`}</p></div><p className="text-right text-[13px] text-steel">{t("Team rating")}<span className="wide block text-[25px] text-paint">{Object.keys(run.picks).length ? Math.round(teamRating(run)) : "—"}</span></p></div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label={t("Your garage")}>{SLOTS.map((slot) => <button key={slot} disabled={run.config.mode !== "slot-first" || !!run.picks[slot] || !!squad || complete} onClick={() => update({ ...run, selectedSlot: slot })} className={`min-h-20 border px-3 py-2 text-left ${run.selectedSlot === slot ? "border-ink bg-ink/10" : run.picks[slot] ? "border-line bg-board" : "border-dashed border-line bg-night"} disabled:cursor-default`}><span className="block text-[11px] font-bold uppercase tracking-wide text-steel">{t(SLOT_NAME[slot])}</span><span className="mt-1 block text-[14px] font-bold leading-snug text-paint">{run.picks[slot]?.name ?? (run.selectedSlot === slot ? t("Selected") : t("Open slot"))}</span>{run.picks[slot] && <span className="mt-1 block text-[11px] text-steel">{run.picks[slot]!.year} · {run.picks[slot]!.constructor}{showRatings ? ` · ${run.picks[slot]!.rating}` : ""}</span>}</button>)}</div>

      {!complete && <section ref={draftSection} className="mt-7 border-t border-line pt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="wide text-[27px] leading-none">{squad ? t("CONSTRUCTOR DRAWN") : t("SPIN FOR A CONSTRUCTOR")}</h2><span className="num text-[13px] text-steel">{7 - Object.keys(run.picks).length} {t("slots left")}</span></div>
        {squad ? <>
          <div className="mt-4 border border-ink bg-board px-4 py-4"><p className="text-[12px] uppercase tracking-wide text-steel">{t("Constructor · season")}</p><p className="wide mt-1 text-[25px] leading-none text-paint">{squad.constructor} <span className="text-ink">{squad.year}</span></p><p className="mt-2 text-[13px] text-steel">{t("Choose one piece of this team for an open garage slot.")}</p></div>
          {run.rerollsUsed < REROLLS[run.config.difficulty] && <button className={`${secondaryBtn} mt-3`} onClick={() => spin(true)}>{t("Reroll constructor")} ({REROLLS[run.config.difficulty] - run.rerollsUsed} {t("left")})</button>}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2"><h3 className="text-[12px] font-bold uppercase tracking-wide text-steel">{t("Available picks")}</h3><div className="flex gap-1">{(["rating", "role", "name"] as const).map((x) => <button key={x} aria-pressed={sort === x} className={`border px-2 py-1 text-[12px] ${sort === x ? "border-ink text-paint" : "border-line text-steel"}`} onClick={() => setSort(x)}>{t(x === "rating" ? "Rating" : x === "role" ? "Role" : "Name")}</button>)}</div></div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">{choices.map((c) => { const driver = c.slot === "driver"; const slot = driver ? !run.picks.driver1 ? "driver1" : "driver2" : c.slot as Slot; return <div key={c.id} className="border border-line bg-board px-4 py-3"><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-wide text-steel">{driver ? t("Driver") : t(SLOT_NAME[slot])}</p><p className="mt-1 text-[16px] font-bold leading-snug text-paint">{c.name}</p></div>{showRatings && <span className="wide text-[23px] text-ink">{c.rating}</span>}</div><div className="mt-3 flex gap-2">{driver && !run.picks.driver1 && !run.picks.driver2 && run.config.mode === "squad-first" ? <><button className={secondaryBtn} onClick={() => select(c, "driver1")}>{t("Lead")}</button><button className={secondaryBtn} onClick={() => select(c, "driver2")}>{t("Second")}</button></> : <button className={secondaryBtn} onClick={() => select(c, slot)}>{t("Draft to {slot}", { slot: t(SLOT_NAME[slot]).toLowerCase() })}</button>}</div></div>; })}</div>
        </> : <><p className="mt-3 text-[14px] text-steel">{run.config.mode === "slot-first" ? run.selectedSlot ? t("Now spin for {slot}.", { slot: t(SLOT_NAME[run.selectedSlot]).toLowerCase() }) : t("Choose an open garage slot, then spin.") : t("Spin for a constructor and season, then draft one pick.")}</p>{run.config.mode === "slot-first" && <button className={`${primaryBtn} mt-5`} disabled={!run.selectedSlot} onClick={() => spin()}>{t("Spin the wheel")}</button>}</>}
      </section>}

      {complete && !done && <section className="mt-8 border-t border-line pt-6"><h2 className="wide text-[30px] leading-none">{run.results.length === 6 ? t("HALFWAY") : t("TEAM READY")}</h2><p className="mt-3 text-[15px] text-steel">{run.results.length === 6 ? t("Six races down. Pick one upgrade for the final six.") : t("Your seven picks are locked. Run the twelve-race season to see if this team can go 12-0.")}</p>
        {run.results.length === 6 ? <div className="mt-5 grid gap-2 sm:grid-cols-3">{(["engine", "aero", "reliability"] as const).map((x) => <button key={x} className="border border-line bg-board px-4 py-4 text-left hover:border-ink" onClick={() => void simulate({ ...run, upgrade: x })}><strong className="block text-[16px] text-paint">{t(x === "engine" ? "Power unit" : x === "aero" ? "Aero package" : "Reliability")}</strong><span className="mt-1 block text-[12px] text-steel">{t(x === "engine" ? "More pace on power circuits" : x === "aero" ? "More pace in technical corners" : "A small gain at every circuit")}</span></button>)}</div>
        : <button className={`${primaryBtn} mt-6`} onClick={() => void simulate(run)}>{t("Simulate season")}</button>}
      </section>}
      {busy && <p role="status" className="mt-5 text-[14px] text-steel">{t("Simulating race {n} of 12…", { n: Math.min(12, progress + 1) })}</p>}
      {error && <p role="alert" className="mt-5 text-[14px] text-kerb">{t("A circuit could not load. Try the simulation again.")}</p>}
      {run.results.length > 0 && <section className="mt-8 border-t border-line pt-5"><h2 className="text-[12px] font-bold uppercase tracking-wide text-steel">{t("Season results")}</h2><ol className="mt-3 grid gap-1.5 sm:grid-cols-2">{run.results.map((r, i) => <li key={r.circuit} className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 border border-line bg-board px-3 py-2"><span className="num text-[12px] text-steel">{String(i + 1).padStart(2, "0")}</span><span className="truncate text-[14px] text-paint">{CATALOG.find((c) => c.id === r.circuit)?.name}</span><span className={`wide text-[17px] ${r.won ? "text-green" : "text-kerb"}`}>P{r.position}</span><span className="col-start-2 text-[11px] text-steel">{seconds(r.playerMs)} vs {seconds(r.rivalMs)}</span><span className="text-right text-[11px] text-steel">{r.points} pts</span></li>)}</ol></section>}
      {standings.length > 0 && <section className="mt-8 border-t border-line pt-5"><h2 className="text-[12px] font-bold uppercase tracking-wide text-steel">{t("Constructors' standings")}</h2><ol className="mt-3 divide-y divide-line border-y border-line">{standings.map((team, i) => <li key={team.name} className={`grid grid-cols-[32px_minmax(0,1fr)_auto_auto] items-center gap-3 px-3 py-2 text-[14px] ${team.player ? "bg-ink/10 font-bold text-paint" : "text-steel"}`}><span className="num">{i + 1}</span><span>{t(team.name)}</span><span className="num text-[12px]">{team.wins} W</span><span className="num text-paint">{team.points}</span></li>)}</ol></section>}
      {done && <section className="mt-8 border-t border-line pt-6" aria-live="polite"><h2 className="wide text-[clamp(36px,8vw,60px)] leading-none text-paint">{wins(run)}–{12 - wins(run)} <span className="text-ink">P{championshipPlace}</span></h2><p className="mt-2 text-[15px] text-steel">{wins(run) === 12 ? t("Perfect season. Every race won.") : championshipPlace === 1 ? t("Championship won. Can you go unbeaten next time?") : t("Draft again and see if a stronger team can go 12-0.")} {t("Personal best: {wins}-{losses}.", { wins: store.bestWins, losses: 12 - store.bestWins })}</p><div className="mt-6 flex flex-wrap gap-2"><button className={primaryBtn} onClick={() => void share()}>{copied ? t("Copied") : t("Share result")}</button><button className={secondaryBtn} onClick={() => { setStore(startDraft(config)); top(); }}>{t("New draft")}</button></div>{SUPPORT_URL && <p className="mt-5 text-[13px] text-steel">{t("Enjoying Lapdle?")} <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer" onClick={() => supportClicked("draft-season")} className="text-paint underline underline-offset-2">{t("Support the game")}</a></p>}</section>}
      {!done && <button className="mt-10 text-[13px] text-steel underline underline-offset-2 hover:text-paint" onClick={() => { setStore(clearDraft()); top(); }}>{t("Change draft settings")}</button>}
    </>}
    <div className="mt-12 border-t border-line pt-5 text-[13px] text-steel"><p>{t("Want a shorter setup game or to drive every lap yourself?")}</p><div className="mt-2 flex flex-wrap gap-4"><button className="underline underline-offset-2 hover:text-paint" onClick={onSetup}>{t("Play Setup Sprint")}</button><button className="underline underline-offset-2 hover:text-paint" onClick={onClassic}>{t("Drive Classic Season")}</button></div><p className="mt-5 text-[11px]">{t("Historic roster data")}: <a className="underline" href={DRAFT_SOURCE.url} target="_blank" rel="noreferrer">{DRAFT_SOURCE.name} {DRAFT_SOURCE.release}</a> · {DRAFT_SOURCE.license}</p></div>
  </div></div>;
}

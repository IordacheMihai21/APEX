import { useEffect, useRef, useState } from "react";
import { t } from "../i18n";
import { gameFinished, gameStarted, shared } from "../games/events";
import { buildDetectiveCase, detectiveAnswer, gradeDetective, saveDetective, type DetectiveCase, type DetectiveAnswer } from "../modes/fastDetective";
import { primaryBtn, secondaryBtn } from "./styles";
import { SUPPORT_URL, supportClicked } from "../support";
import { DetectiveVisual } from "./DetectiveVisual";
import { HowToPlay } from "./HowToPlay";

export function FastDetective() {
  const [case_, setCase] = useState<DetectiveCase | null>(null);
  const [error, setError] = useState(false);
  const [clues, setClues] = useState(() => detectiveAnswer() ? 5 : 1);
  const [answer, setAnswer] = useState<DetectiveAnswer | null>(detectiveAnswer);
  const [verdict, setVerdict] = useState<boolean | null>(null);
  const [speed, setSpeed] = useState(120);
  const [copied, setCopied] = useState(false);
  const [replayKey, setReplayKey] = useState(0);
  const visualRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let live = true;
    void buildDetectiveCase().then((c) => { if (live) { setCase(c); setSpeed(c.carryKmh); } }, () => { if (live) setError(true); });
    return () => { live = false; };
  }, []);
  const clueLines = case_ ? [
    `${case_.circuit} · ${case_.corner}`,
    case_.condition === "wet" ? t("Wet track. Less grip under braking and through the turn.") : t("Dry track. Full grip available."),
    t("Approach speed: {n} km/h.", { n: case_.entryKmh }),
    t("Braking begins {n} m before the apex.", { n: case_.brakeBeforeM }),
    t("The driver aims to carry {n} km/h and goes back on power {m} m {where} the apex.", { n: case_.carryKmh, m: Math.abs(case_.throttleAfterM), where: case_.throttleAfterM < 0 ? t("before") : t("after") }),
  ] : [];
  const revealNext = () => {
    if (clues === 1) gameStarted("fast-detective", "daily");
    setClues((x) => Math.min(5, x + 1));
  };
  const submit = () => {
    if (!case_ || verdict === null || answer || !Number.isFinite(speed)) return;
    const a = gradeDetective(case_, verdict, speed);
    saveDetective(a);
    setAnswer(a);
    gameFinished("fast-detective", "daily", { correct: a.correct, score: a.score });
  };
  const share = async () => {
    if (!answer) return;
    const text = `Lapdle Fast Detective ${answer.score}/1000\n${answer.correct ? "🟩" : "🟥"} ${Math.abs(answer.guessKmh - answer.actualKmh)} km/h off\nCan you solve the corner? https://lapdle.com/fast-detective`;
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); setCopied(true); }
      shared("fast-detective");
    } catch { /* cancelled */ }
  };

  return <div className="h-full overflow-y-auto bg-night text-paint">
    <div className="mx-auto max-w-[760px] px-4 pt-7 pb-16 md:px-8 md:pt-12">
      <div className="flex items-start justify-between gap-3"><h1 className="wide text-[clamp(34px,8vw,64px)] leading-none">THE FAST DETECTIVE</h1><HowToPlay game="fast-detective" /></div>
      <p className="mt-4 max-w-[55ch] text-[16px] leading-relaxed text-steel">{t("Five clues. One car approaching a corner. Decide if it makes the turn, then guess the speed it actually carries.")}</p>
      {error && <p className="mt-7 text-kerb" role="alert">{t("The case could not load. Reload to try again.")}</p>}
      {!case_ && !error && <p className="mt-7 text-steel" role="status">{t("Loading today's case…")}</p>}
      {case_ && <>
        <div ref={visualRef}><DetectiveVisual key={`${case_.day}-${replayKey}`} case_={case_} clues={clues} answered={!!answer} /></div>
        <ol className="mt-8 border-t border-line" aria-label={t("Clues")}>{clueLines.slice(0, clues).map((line, i) => <li key={i} className="grid grid-cols-[40px_1fr] gap-3 border-b border-line py-4"><span className="num text-[14px] font-bold text-ink">{String(i + 1).padStart(2, "0")}</span><span className="text-[16px] leading-snug text-paint">{line}</span></li>)}</ol>
        {!answer && clues < 5 && <button className={`${primaryBtn} mt-6`} onClick={revealNext}>{t("Reveal clue {n} of 5", { n: clues + 1 })}</button>}
        {!answer && clues === 5 && <section className="mt-8" aria-label={t("Your verdict")}>
          <h2 className="wide text-[30px] leading-none">{t("Does it make the corner?")}</h2>
          <div className="mt-4 grid grid-cols-2 gap-2"><button className={`${verdict === true ? primaryBtn : secondaryBtn} min-h-14`} aria-pressed={verdict === true} onClick={() => setVerdict(true)}>{t("Yes, it makes it")}</button><button className={`${verdict === false ? primaryBtn : secondaryBtn} min-h-14`} aria-pressed={verdict === false} onClick={() => setVerdict(false)}>{t("No, it goes off")}</button></div>
          <label className="mt-7 block text-[15px] font-semibold text-paint" htmlFor="detective-speed">{t("Bonus: predict the lowest speed reached")}</label>
          <div className="mt-2 flex items-center gap-3"><input id="detective-speed" className="w-28 border border-line bg-board px-3 py-3 text-[22px] text-paint focus-visible:outline-2 focus-visible:outline-paint" type="number" inputMode="numeric" min="15" max="350" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} /><span className="num text-[15px] text-steel">km/h</span></div>
          <button className={`${primaryBtn} mt-7`} disabled={verdict === null || speed < 15 || speed > 350} onClick={submit}>{t("Lock in verdict")}</button>
        </section>}
        {answer && <section className="mt-8 border-t border-line pt-6" aria-live="polite">
          <h2 className={`wide text-[clamp(36px,8vw,58px)] leading-none ${answer.correct ? "text-green" : "text-kerb"}`}>{answer.correct ? t("CASE SOLVED") : t("CASE MISSED")}</h2>
          <p className="mt-3 text-[17px] leading-relaxed text-paint">{case_.tookCorner ? t("The car made the corner.") : t("The car went off the road.")} {t("Lowest speed: {n} km/h.", { n: case_.actualKmh })}</p>
          <p className="mt-2 text-[15px] text-steel">{t("Your estimate: {n} km/h. Score: {score}/1000.", { n: answer.guessKmh, score: answer.score })}</p>
          <p className="mt-2 text-[14px] text-steel">{case_.tookCorner ? t("The tyres had enough grip to hold the line at that speed.") : case_.offAtM !== null && case_.offAtM < 0 ? t("The car ran out of grip before the apex.") : t("The car ran wide as it tried to exit the turn.")}</p>
          <div className="mt-6 flex flex-wrap gap-3"><button className={secondaryBtn} onClick={() => { setReplayKey((x) => x + 1); visualRef.current?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" }); }}>{t("Watch replay")}</button><button className={primaryBtn} onClick={() => void share()}>{copied ? t("Copied") : t("Share result")}</button></div>
          {SUPPORT_URL && <p className="mt-5 text-[13px] text-steel">{t("Enjoying Lapdle?")} <a className="text-paint underline underline-offset-2" href={SUPPORT_URL} target="_blank" rel="noopener noreferrer" onClick={() => supportClicked("detective")}>{t("Support the game")}</a></p>}
        </section>}
      </>}
    </div>
  </div>;
}

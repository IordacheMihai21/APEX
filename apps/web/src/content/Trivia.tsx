import { useEffect, useMemo, useState } from "react";
import { OUTLINES } from "../game/outlines";
import { CIRCUITS, circuit, circuitSlug } from "../modes/circuits";
import { AdSlot } from "../ui/Ads";
import { Share } from "../ui/icons";
import { primaryBtn, secondaryBtn } from "../ui/styles";
import { Page, Section, link } from "./Guides";
import { gameFinished, gameStarted } from "../games/events";
import { quiz, recordQuiz, triviaBest, verdict } from "./quiz";

/**
 * Circuit trivia: an index and one quiz per circuit. The questions render to
 * static HTML at build time (src/ssg), so the page reads as a list of
 * questions without JavaScript; in the app each one can be answered, with the
 * answer and a line of explanation, and the best score is kept on the device.
 */

export function TriviaIndex() {
  // best scores live on the device: read after the first render, so the build's HTML stays the same for everyone
  const [best, setBest] = useState<Record<string, number | null>>({});
  useEffect(() => setBest(Object.fromEntries(CIRCUITS.map((c) => [c.id, triviaBest(c.id)]))), []);
  return (
    <Page>
      <header>
        <p className="caption">Lapdle</p>
        <h1 className="wide mt-2 text-[clamp(32px,6vw,52px)] leading-none text-paint">Circuit trivia</h1>
        <p className="mt-4 text-[16px] leading-relaxed text-paint/85">
          A quick quiz on each of the twelve real circuits in Lapdle: where it is, how long a lap is, how many corners, its first Grand Prix, its famous corners and its pole lap. Eight questions or so, a minute each.
        </p>
      </header>
      <ul className="divide-y divide-line border-y border-line">
        {CIRCUITS.map((c) => {
          const n = quiz(c.id).length;
          const b = best[c.id];
          return (
            <li key={c.id}>
              <a href={`/trivia/${circuitSlug(c.id)}`} className="group flex items-center gap-4 py-3.5">
                <svg viewBox="0 0 1000 1000" className="h-11 w-11 shrink-0" aria-hidden="true">
                  <path d={OUTLINES[c.id].outline} fill="none" stroke="#f2f2ee" strokeWidth={50} strokeLinejoin="round" />
                </svg>
                <span className="min-w-0 flex-1">
                  <span className="wide block text-[18px] leading-tight text-paint">{c.name} quiz</span>
                  <span className="text-[14px] text-steel">
                    {n} questions{b !== null && b !== undefined ? `, your best ${b}/${n}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-[14px] font-semibold text-ink transition-transform group-hover:translate-x-0.5">Play ›</span>
              </a>
            </li>
          );
        })}
      </ul>
    </Page>
  );
}

export function TriviaQuiz({ id }: { id: string }) {
  const c = circuit(id);
  const qs = useMemo(() => quiz(id), [id]);
  const [picked, setPicked] = useState<(number | null)[]>(() => qs.map(() => null));
  const [copied, setCopied] = useState(false);
  useEffect(() => setPicked(qs.map(() => null)), [qs]);

  const answered = picked.filter((p) => p !== null).length;
  const score = picked.filter((p, i) => p === qs[i].answer).length;
  const done = answered === qs.length;
  useEffect(() => {
    if (!done) return;
    recordQuiz(id, score);
    gameFinished("trivia", "endless", { circuit: id, score: `${score}/${qs.length}` });
  }, [done, id, score, qs.length]);

  const at = CIRCUITS.findIndex((x) => x.id === id);
  const next = CIRCUITS[(at + 1) % CIRCUITS.length];
  const shareText = `Lapdle ${c.name} quiz: ${score}/${qs.length}\n${picked.map((p, i) => (p === qs[i].answer ? "🟩" : "🟥")).join("")}\n${typeof location !== "undefined" ? location.origin : "https://lapdle.com"}/trivia/${circuitSlug(id)}`;
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ text: shareText });
      else {
        await navigator.clipboard.writeText(shareText);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      /* share sheet dismissed */
    }
  };

  return (
    <Page>
      <header>
        <p className="caption">
          <a className={link} href="/trivia">
            Circuit trivia
          </a>
        </p>
        <h1 className="wide mt-2 text-[clamp(32px,6vw,52px)] leading-none text-paint">{c.name} quiz</h1>
        <p className="mt-4 text-[16px] leading-relaxed text-paint/85">
          {qs.length} questions on {c.name}, {c.country}. Pick an answer to see if you're right. The{" "}
          <a className={link} href={`/circuits/${circuitSlug(id)}`}>
            circuit guide
          </a>{" "}
          has every answer.
        </p>
      </header>

      <ol className="space-y-6">
        {qs.map((q, i) => {
          const p = picked[i];
          return (
            <li key={`${id}-${i}`} className="border-t border-line pt-5">
              {i === 4 && <AdSlot kind="inline" className="mb-6" />}
              <p className="flex gap-3 text-[17px] leading-snug text-paint">
                <span className="wide num shrink-0 text-steel">{i + 1}.</span>
                <span>{q.prompt}</span>
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {q.options.map((o, j) => {
                  const state = p === null ? "open" : j === q.answer ? "right" : j === p ? "wrong" : "dim";
                  return (
                    <button
                      key={o}
                      type="button"
                      disabled={p !== null}
                      onClick={() => {
                        if (answered === 0) gameStarted("trivia", "endless");
                        setPicked((xs) => xs.map((x, k) => (k === i ? j : x)));
                      }}
                      className={`border px-3.5 py-3 text-left text-[15px] transition-colors ${
                        state === "open"
                          ? "border-line bg-board/70 text-paint hover:border-paint/40"
                          : state === "right"
                            ? "border-green bg-green/15 text-paint"
                            : state === "wrong"
                              ? "border-kerb bg-kerb/15 text-paint"
                              : "border-line text-steel/70"
                      }`}
                      aria-pressed={p === j}
                    >
                      {o}
                    </button>
                  );
                })}
              </div>
              {p !== null && (
                <p className="rise mt-2.5 text-[15px] text-paint/85" aria-live="polite">
                  <span className={p === q.answer ? "font-semibold text-green" : "font-semibold text-kerb"}>{p === q.answer ? "Right." : "Not quite."}</span> {q.explain}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      <Section title={done ? `${score}/${qs.length}: ${verdict(score, qs.length)}` : `${answered} of ${qs.length} answered`}>
        {done ? (
          <>
            <p>{score === qs.length ? `Every answer right on ${c.name}.` : `${qs.length - score} to brush up on: the circuit guide has them all.`}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button className={secondaryBtn} onClick={share}>
                <Share className="h-4 w-4" /> {copied ? "Copied" : "Share"}
              </button>
              <a className={primaryBtn} href={`/trivia/${circuitSlug(next.id)}`}>
                {next.name} quiz
              </a>
            </div>
          </>
        ) : (
          <p className="text-steel">Answer them all for your score.</p>
        )}
        <p>
          Then drive it:{" "}
          <a className={link} href={`/?play=practice&track=${id}`}>
            free practice at {c.name}
          </a>
          , or read the{" "}
          <a className={link} href={`/circuits/${circuitSlug(id)}`}>
            {c.name} circuit guide
          </a>
          .
        </p>
      </Section>

      <Section title="More quizzes">
        <ul className="flex flex-wrap gap-x-5 gap-y-2">
          {CIRCUITS.filter((x) => x.id !== id).map((x) => (
            <li key={x.id}>
              <a className={link} href={`/trivia/${circuitSlug(x.id)}`}>
                {x.name}
              </a>
            </li>
          ))}
        </ul>
      </Section>
    </Page>
  );
}

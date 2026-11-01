import STATS from "../game/circuitStats.json";
import { OUTLINES } from "../game/outlines";
import { CIRCUITS, circuit, circuitSlug } from "../modes/circuits";
import { WEEKLY_CORNERS } from "../modes/corner";
import { cornerSlug } from "./cornerText";
import { AdSlot } from "../ui/Ads";
import { lapTime } from "../ui/format";
import { CIRCUIT_MORE, CIRCUIT_TEXT } from "./circuitText";
import { Page, Section, link } from "./Guides";

/**
 * Circuit guides: an index of the twelve real circuits and one page per
 * circuit. The facts come from modes/circuits.ts, the outline, perfect laps and
 * medal times from game/outlines.ts, the famous corners from the Corner of the
 * week list, the prose from content/circuits.ts. Rendered to static HTML at
 * build time like the How to play pages (src/ssg).
 */

/** A practice link; the app opens it in place, a fresh visit lands straight on the circuit. */
const practiceHref = (id: string, cond?: "wet" | "lowdf") => `/?play=practice&track=${id}${cond ? `&cond=${cond}` : ""}`;

function Outline({ id, className = "", start = false }: { id: string; className?: string; start?: boolean }) {
  const o = OUTLINES[id];
  const [x, y, angle] = o.start;
  return (
    <svg viewBox="0 0 1000 1000" className={className} aria-hidden="true">
      <path d={o.outline} fill="none" stroke="#2b2f37" strokeWidth={46} strokeLinejoin="round" />
      <path d={o.outline} fill="none" stroke="#f2f2ee" strokeWidth={start ? 16 : 22} strokeLinejoin="round" />
      {start && (
        <g transform={`translate(${x} ${y}) rotate(${angle})`}>
          <rect x={-5} y={-30} width={10} height={60} className="fill-ink" />
        </g>
      )}
    </svg>
  );
}

export function CircuitsIndex() {
  return (
    <Page>
      <header>
        <p className="caption">Lapdle</p>
        <h1 className="wide mt-2 text-[clamp(32px,6vw,52px)] leading-none text-paint">Circuit guides</h1>
        <p className="mt-4 text-[16px] leading-relaxed text-paint/85">
          Twelve real circuits, traced from map data and raced in Lapdle every day. Each guide covers the circuit's facts and famous corners, how to drive it, and the perfect lap to chase in the dry, the wet and with
          low downforce.
        </p>
      </header>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {CIRCUITS.map((c) => (
          <li key={c.id}>
            <a href={`/circuits/${circuitSlug(c.id)}`} className="track-tile flex h-full flex-col border border-line bg-board/70 p-3">
              <Outline id={c.id} className="aspect-square w-full" />
              <span className="wide mt-3 text-[15px] leading-tight text-paint">{c.name}</span>
              <span className="mt-0.5 text-[13px] text-steel">
                {c.country}, {c.lengthKm.toFixed(3)} km
              </span>
            </a>
          </li>
        ))}
      </ul>
    </Page>
  );
}

type LapStats = { maxKmh: number; minKmh: number; accelPct: number; brakePct: number };
const LAP_STATS = STATS as Record<string, Record<"dry" | "wet" | "lowdf", LapStats>>;
const secs = (ms: number) => (Math.abs(ms) / 1000).toFixed(1);

/** The perfect lap in numbers, in words: speeds and shares from game/circuitStats.json, times from the outlines. */
function lapInNumbers(id: string): string[] {
  const c = circuit(id);
  const o = OUTLINES[id];
  const { dry, wet, lowdf } = LAP_STATS[id];
  const braking = CIRCUITS.map((x) => LAP_STATS[x.id].dry.brakePct);
  const rank = dry.brakePct >= Math.max(...braking) ? ", more than on any other circuit in Lapdle" : dry.brakePct <= Math.min(...braking) ? ", less than on any other circuit in Lapdle" : "";
  const out = [
    `On Lapdle's perfect dry lap the car reaches ${dry.maxKmh} km/h at its fastest and slows to ${dry.minKmh} km/h at the slowest point of the lap. It spends about ${dry.accelPct}% of the lap accelerating and ${dry.brakePct}% braking${rank}.`,
  ];
  if (c.poleMs) {
    const d = o.lapMs - c.poleMs;
    out.push(`The perfect lap, ${lapTime(o.lapMs)}, is ${secs(d)} s ${d < 0 ? "faster" : "slower"} than the real pole lap of 2025. The model drives one simplified car on every circuit, so the two are close but not the same.`);
  }
  const { gold, silver, bronze } = o.medals;
  out.push(
    `The medals in the dry are set just above the perfect lap: gold at ${lapTime(gold)}, within ${secs(gold - o.lapMs)} s of it; silver at ${lapTime(silver)}; and bronze at ${lapTime(bronze)}, ${Math.round((100 * (bronze - o.lapMs)) / o.lapMs)}% off the perfect lap. Most of the gap between a bronze and a gold is found in two or three corners, usually the ones before the longest straights.`,
  );
  const w = o.conditions.wet;
  if (w) {
    out.push(`In the wet the perfect lap is ${secs(w.lapMs - o.lapMs)} s slower, ${Math.round((100 * (w.lapMs - o.lapMs)) / o.lapMs)}% more. Every corner gets slower, the slowest point drops to ${wet.minKmh} km/h, and braking grows to ${wet.brakePct}% of the lap.`);
  }
  const l = o.conditions.lowdf;
  if (l) {
    const d = l.lapMs - o.lapMs;
    out.push(
      `With low downforce the car reaches ${lowdf.maxKmh} km/h, ${lowdf.maxKmh - dry.maxKmh} km/h more than in the dry, ${d < 0 ? `and the lap is ${secs(d)} s quicker: here the straights give back more than the corners take.` : `but the lap is ${secs(d)} s slower, because the corners cost more than the straights give back.`}`,
    );
  }
  return out;
}

const CONDITIONS = [
  { key: "dry", name: "Dry" },
  { key: "wet", name: "Wet" },
  { key: "lowdf", name: "Low downforce" },
] as const;

export function CircuitGuide({ id }: { id: string }) {
  const c = circuit(id);
  const o = OUTLINES[id];
  const text = CIRCUIT_TEXT[id];
  const more = CIRCUIT_MORE[id];
  const corners = WEEKLY_CORNERS.filter((w) => w.trackId === id);
  const others = CIRCUITS.filter((x) => x.id !== id);
  const facts: [string, string][] = [
    ["Country", `${c.flag} ${c.country}`],
    ["Lap length", `${c.lengthKm.toFixed(3)} km`],
    ["Corners", String(c.turns)],
    ["First Grand Prix", String(c.firstGp)],
    ["Race distance", `${c.laps} laps, ${(c.laps * c.lengthKm).toFixed(1)} km`],
  ];
  if (c.poleMs) facts.push(["Pole lap, 2025", lapTime(c.poleMs)]);

  return (
    <Page>
      <header>
        <p className="caption">
          <a className={link} href="/circuits">
            Circuit guides
          </a>
        </p>
        <h1 className="wide mt-2 text-[clamp(32px,6vw,52px)] leading-none text-paint">{c.name}</h1>
        <p className="mt-2 text-[15px] text-steel">
          {c.country}, {c.lengthKm.toFixed(3)} km, {c.turns} corners
        </p>
      </header>

      <div className="grid items-start gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <figure className="border border-line bg-board/70 p-4">
          <Outline id={id} start className="aspect-square w-full" />
          <figcaption className="mt-2 text-[12px] text-steel">The layout from above. The bar marks the start line.</figcaption>
        </figure>
        <p className="text-[17px] leading-relaxed text-paint/90">{text.character}</p>
      </div>

      <Section title="Circuit facts">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 divide-y divide-line border-t border-line">
          {facts.map(([k, v]) => (
            <div key={k} className="col-span-2 grid grid-cols-subgrid py-2.5">
              <dt className="text-steel">{k}</dt>
              <dd className="num text-paint">{v}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {corners.length > 0 && (
        <Section title="Famous corners">
          <ul className="space-y-4">
            {corners.map((w) => (
              <li key={w.name}>
                <h3 className="wide text-[17px] leading-tight text-paint">{w.name}</h3>
                <p className="mt-1">
                  {w.note}{" "}
                  <a className={link} href={`/corners/${cornerSlug(w)}`}>
                    How to drive {w.name}
                  </a>
                </p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title={`A lap of ${c.name}`}>
        {more.lap.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </Section>

      <Section title="How to drive it">
        <p>{text.drive}</p>
      </Section>

      <Section title="The lap in numbers">
        {lapInNumbers(id).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </Section>

      <Section title="History">
        <p>{more.history}</p>
      </Section>

      <AdSlot kind="inline" />

      <Section title="The perfect lap">
        <p>
          In Lapdle you choose how to take each corner, and the car drives your line with real physics. The perfect lap is the fastest line the model can find; the medals are set just above it.
        </p>
        <ul className="divide-y divide-line border-y border-line">
          {CONDITIONS.map(({ key, name }) => {
            const t = key === "dry" ? { lapMs: o.lapMs, medals: o.medals } : o.conditions[key];
            if (!t) return null;
            return (
              <li key={key} className="py-3">
                <div className="flex items-baseline justify-between gap-4">
                  <a className={`${link} font-semibold`} href={practiceHref(id, key === "dry" ? undefined : key)}>
                    {name}
                  </a>
                  <span className="num text-paint">
                    <span className="mr-2 text-[12px] tracking-[0.04em] text-steel uppercase">Perfect</span>
                    {lapTime(t.lapMs)}
                  </span>
                </div>
                <p className="num mt-1 flex flex-wrap gap-x-4 text-[14px] text-steel">
                  <span>Gold {lapTime(t.medals.gold)}</span>
                  <span>Silver {lapTime(t.medals.silver)}</span>
                  <span>Bronze {lapTime(t.medals.bronze)}</span>
                </p>
              </li>
            );
          })}
        </ul>
      </Section>

      <div>
        <a href={practiceHref(id)} className="btn-go cut wide inline-flex items-center justify-center gap-2 bg-ink py-3 pr-10 pl-6 text-[15px] whitespace-nowrap text-night uppercase">
          Drive this circuit
        </a>
        <p className="mt-3 text-[14px] text-steel">Free practice at {c.name}: unlimited laps, and the perfect line on demand. Pick a condition above to drive it in the wet or with low downforce.</p>
      </div>

      <Section title={`${c.name} quiz`}>
        <p>
          Know it by heart?{" "}
          <a className={link} href={`/trivia/${circuitSlug(id)}`}>
            Take the {c.name} quiz
          </a>
          : a few quick questions on the circuit.
        </p>
      </Section>

      <Section title="More circuits">
        <ul className="flex flex-wrap gap-x-5 gap-y-2">
          {others.map((x) => (
            <li key={x.id}>
              <a className={link} href={`/circuits/${circuitSlug(x.id)}`}>
                {x.name}
              </a>
            </li>
          ))}
        </ul>
      </Section>
    </Page>
  );
}

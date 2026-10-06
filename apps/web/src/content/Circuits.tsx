import { OUTLINES } from "../game/outlines";
import { CIRCUITS, circuit, circuitSlug } from "../modes/circuits";
import { WEEKLY_CORNERS } from "../modes/corner";
import { AdSlot } from "../ui/Ads";
import { lapTime } from "../ui/format";
import { CIRCUIT_TEXT } from "./circuitText";
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

const CONDITIONS = [
  { key: "dry", name: "Dry" },
  { key: "wet", name: "Wet" },
  { key: "lowdf", name: "Low downforce" },
] as const;

export function CircuitGuide({ id }: { id: string }) {
  const c = circuit(id);
  const o = OUTLINES[id];
  const text = CIRCUIT_TEXT[id];
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
                <p className="mt-1">{w.note}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="How to drive it">
        <p>{text.drive}</p>
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

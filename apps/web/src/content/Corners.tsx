import { OUTLINES } from "../game/outlines";
import STATS from "../game/cornerStats.json";
import { type WeeklyCorner, WEEKLY_CORNERS } from "../modes/cornerList";
import { circuit, circuitSlug } from "../modes/circuits";
import { CORNER_MEDAL_MS } from "../modes/corner";
import { AdSlot } from "../ui/Ads";
import { article } from "./articles";
import { CORNER_TEXT, cornerBySlug, cornerSlug, keyOf } from "./cornerText";
import { Page, Section, link } from "./Guides";

/**
 * Famous corners: an index and one guide per corner of the Corner of the week list (modes/cornerList.ts). The prose
 * comes from content/cornerText.ts; the numbers from game/cornerStats.json, the perfect lap through the corner as the
 * physics drives it (npm run build:corner-stats). Rendered to static HTML at build time like the other content pages.
 */

const secs = (ms: number) => (ms / 1000).toFixed(2);

type Stats = { entryKmh: number; brakeM: number; brakeS: number; minKmh: number; lowKmh: number; exitKmh: number; timeS: number };
type CornerStats = { turns: string[]; direction: string; conditions: Record<"dry" | "wet" | "lowdf", Stats> };
const stats = (key: string) => (STATS as Record<string, CornerStats>)[key];


const ORDINAL = ["", "", "second ", "third ", "fourth ", "fifth ", "sixth "];
/** "the slowest", "the third slowest", or null past the sixth */
function rank(key: string, value: (s: CornerStats) => number, word: string): string | null {
  const sorted = WEEKLY_CORNERS.map((w) => value(stats(keyOf(w)))).sort((a, b) => b - a);
  const place = sorted.indexOf(value(stats(key))) + 1;
  return place < ORDINAL.length ? `the ${ORDINAL[place]}${word}` : null;
}

/** The corner in numbers, written from the physics. */
function inNumbers(w: WeeklyCorner): string[] {
  const key = keyOf(w);
  const s = stats(key);
  const { dry, wet, lowdf } = s.conditions;
  const group = s.turns.length > 1;
  const out: string[] = [];
  let p = `On Lapdle's perfect lap in the dry, the car arrives at ${dry.entryKmh} km/h and the brakes go on ${dry.brakeM} m before the slowest point${group ? " of the first corner" : ""}, which it reaches ${dry.brakeS} s later at ${dry.minKmh} km/h.`;
  p += ` From the braking point to 150 m past the ${group ? "last corner" : "corner"} takes ${dry.timeS} s, and by then the car is back up to ${dry.exitKmh} km/h.`;
  out.push(p);
  const slowest = rank(key, (x) => -x.conditions.dry.minKmh, "slowest");
  const withs = [rank(key, (x) => x.conditions.dry.brakeM, "longest stop"), rank(key, (x) => x.conditions.dry.entryKmh, "fastest approach")].filter(Boolean);
  const list = (xs: (string | null)[]) => (xs.length < 2 ? xs[0] : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
  if (slowest || withs.length) out.push(`Of the twelve famous corners in Lapdle, it ${slowest ? `is ${slowest}${withs.length ? `, with ${list(withs)}` : ""}` : `has ${list(withs)}`}.`);
  const lapS = OUTLINES[w.trackId].lapMs / 1000;
  out.push(
    `Those ${dry.timeS} s are ${Math.round((100 * dry.timeS) / lapS)}% of a perfect lap of ${lapS.toFixed(1)} s at ${circuit(w.trackId).name}. In Corner of the week, a run is measured on the time it loses to the perfect line through the corner: within ${secs(CORNER_MEDAL_MS.pole)} s is pole, within ${secs(CORNER_MEDAL_MS.gold)} s gold, ${secs(CORNER_MEDAL_MS.silver)} s silver and ${secs(CORNER_MEDAL_MS.bronze)} s bronze. On a corner that lasts ${dry.timeS} s, a gold is a margin of about ${((100 * CORNER_MEDAL_MS.gold) / (dry.timeS * 1000)).toFixed(1)}%.`,
  );
  out.push(
    `${
      wet.brakeM > dry.brakeM
        ? `In the wet the brakes go on ${wet.brakeM - dry.brakeM} m earlier, ${wet.brakeM} m before the slowest point`
        : `In the wet the car arrives slower, at ${wet.entryKmh} km/h, so the stop is shorter: ${wet.brakeM} m to the slowest point`
    }, which drops to ${wet.minKmh} km/h, and the stretch takes ${(wet.timeS - dry.timeS).toFixed(1)} s longer. Every part of the corner is slower: the braking, the speed through the middle and the drive out.`,
  );
  out.push(
    lowdf.entryKmh > dry.entryKmh
      ? `With low downforce the car is ${lowdf.entryKmh - dry.entryKmh} km/h faster on the approach, at ${lowdf.entryKmh} km/h, but has less grip to stop with: it needs ${lowdf.brakeM} m to reach the slowest point, ${lowdf.brakeM - dry.brakeM} m more than in the dry, and gets down to ${lowdf.minKmh} km/h.`
      : `With low downforce the car has less grip everywhere: it arrives at ${lowdf.entryKmh} km/h and gets down to ${lowdf.minKmh} km/h, ${dry.minKmh - lowdf.minKmh} km/h less than in the dry at the slowest point.`,
  );
  return out;
}

/** Further reading for a corner: hairpins and chicanes, Monaco, the wet. */
function reading(w: WeeklyCorner): string[] {
  const s = stats(keyOf(w));
  const slugs = s.turns.length > 1 ? ["corner-types", "kerbs"] : ["braking-points", "corner-exit-traction"];
  if (w.trackId === "monaco") slugs.push("why-monaco-is-slow");
  if (w.trackId === "monza") slugs.push("low-downforce");
  return [...slugs, "racing-in-the-wet"];
}

function Outline({ trackId, className }: { trackId: string; className: string }) {
  return (
    <svg viewBox="0 0 1000 1000" className={className} aria-hidden="true">
      <path d={OUTLINES[trackId].outline} fill="none" stroke="#f2f2ee" strokeWidth={40} strokeLinejoin="round" />
    </svg>
  );
}

export function CornersIndex() {
  return (
    <Page>
      <header>
        <p className="caption">Lapdle</p>
        <h1 className="wide mt-2 text-[clamp(32px,6vw,52px)] leading-none text-paint">Famous corners</h1>
        <p className="mt-4 text-[16px] leading-relaxed text-paint/85">
          Twelve of the best-known corners in racing, from La Source and Tarzan to the Parabolica and Rascasse. Each guide covers where the corner is and why it is famous, how to drive it, the mistakes to avoid, and
          the corner in numbers from Lapdle's own physics: the braking point, the slowest speed and what the wet and low downforce change.
        </p>
      </header>
      <ul className="divide-y divide-line border-y border-line">
        {WEEKLY_CORNERS.map((w) => (
          <li key={keyOf(w)}>
            <a href={`/corners/${cornerSlug(w)}`} className="group flex items-start gap-4 py-4">
              <Outline trackId={w.trackId} className="mt-1 h-11 w-11 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="caption">{circuit(w.trackId).name}</span>
                <span className="wide mt-1 block text-[20px] leading-tight text-paint group-hover:text-ink">{w.name}</span>
                <span className="mt-1 block text-[15px] leading-snug text-steel">{w.note}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </Page>
  );
}

export function CornerGuide({ slug }: { slug: string }) {
  const w = cornerBySlug(slug)!;
  const key = keyOf(w);
  const text = CORNER_TEXT[key];
  const c = circuit(w.trackId);
  const dry = stats(key).conditions.dry;
  const others = WEEKLY_CORNERS.filter((x) => x !== w);
  const facts: [string, string][] = [
    ["Circuit", `${c.name}, ${c.country}`],
    ["Approach", `${dry.entryKmh} km/h`],
    ["Braking", `${dry.brakeM} m, ${dry.brakeS} s`],
    ["Slowest point", `${dry.minKmh} km/h`],
  ];
  const ld = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `${w.name}: how to drive it`,
    description: w.note,
    url: `https://lapdle.com/corners/${slug}`,
    publisher: { "@type": "Organization", name: "Lapdle", url: "https://lapdle.com" },
  };
  return (
    <Page>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <header>
        <p className="caption">
          <a className={link} href="/corners">
            Famous corners
          </a>{" "}
          ·{" "}
          <a className={link} href={`/circuits/${circuitSlug(w.trackId)}`}>
            {c.name}
          </a>
        </p>
        <h1 className="wide mt-2 text-[clamp(32px,6vw,52px)] leading-none text-paint">{w.name}</h1>
        <p className="mt-4 text-[17px] leading-relaxed text-paint/90">{w.note}</p>
      </header>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-y border-line py-4 sm:grid-cols-4">
        {facts.map(([k, v]) => (
          <div key={k}>
            <dt className="caption">{k}</dt>
            <dd className="num text-paint">{v}</dd>
          </div>
        ))}
      </dl>

      <Section title="Where it is">
        {text.where.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </Section>

      <Section title="How to drive it">
        {text.drive.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </Section>

      <AdSlot kind="inline" />

      <Section title="In the rain">
        <p>{text.wet}</p>
      </Section>

      <Section title="Mistakes to avoid">
        <ul className="list-disc space-y-2 pl-5 marker:text-ink">
          {text.mistakes.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </Section>

      <Section title="The corner in numbers">
        {inNumbers(w).map((p) => (
          <p key={p}>{p}</p>
        ))}
      </Section>

      <Section title="Drive it in Lapdle">
        <p>
          {w.name} comes round as the{" "}
          <a className={link} href="/corner">
            Corner of the week
          </a>
          , where you set your line through it as often as you like and chase the perfect time. You can also drive the whole lap in{" "}
          <a className={link} href={`/?play=practice&track=${w.trackId}`}>
            free practice at {c.name}
          </a>
          , or read the{" "}
          <a className={link} href={`/circuits/${circuitSlug(w.trackId)}`}>
            {c.name} circuit guide
          </a>
          .
        </p>
      </Section>

      <Section title="Read more">
        <ul className="space-y-2">
          {reading(w).map((s) => (
            <li key={s}>
              <a className={link} href={`/learn/${s}`}>
                {article(s)!.title}
              </a>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="More famous corners">
        <ul className="flex flex-wrap gap-x-5 gap-y-2">
          {others.map((x) => (
            <li key={keyOf(x)}>
              <a className={link} href={`/corners/${cornerSlug(x)}`}>
                {x.name}
              </a>
            </li>
          ))}
        </ul>
      </Section>
    </Page>
  );
}

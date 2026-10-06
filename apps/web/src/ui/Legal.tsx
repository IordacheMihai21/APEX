import { OPERATOR, OPERATOR_SET } from "../legal";

const link = "text-paint underline decoration-line underline-offset-4 hover:decoration-paint";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line pt-5">
      <h2 className="wide text-[20px] leading-tight text-paint">{title}</h2>
      <div className="mt-2.5 space-y-3 text-[15px] leading-relaxed text-paint/85">{children}</div>
    </section>
  );
}

/** Software and data Lapdle ships, with their licences (checked against the installed packages). */
const SOFTWARE: [string, string, string][] = [
  ["React and React DOM", "MIT", "https://github.com/facebook/react/blob/main/LICENSE"],
  ["Phosphor Icons", "MIT", "https://github.com/phosphor-icons/react/blob/master/LICENSE"],
  ["Archivo typeface (Omnibus-Type), via Fontsource", "SIL Open Font License 1.1", "https://github.com/Omnibus-Type/Archivo/blob/master/OFL.txt"],
];

/**
 * Legal notice and terms: who runs the site (Romanian Law 365/2002 art. 5),
 * the terms of use, the trademark notice, and the data and software licences.
 */
export function Legal() {
  return (
    <div className="h-full overflow-y-auto">
      <article className="mx-auto max-w-[68ch] space-y-7 px-4 pt-8 pb-16 md:px-8 lg:pt-12">
        <header>
          <h1 className="wide text-[clamp(32px,6vw,52px)] leading-none text-paint">Legal</h1>
          <p className="mt-3 text-[14px] text-steel">Last updated 4 October 2026.</p>
        </header>

        <Section title="Who runs Lapdle">
          {OPERATOR_SET ? (
            <p>
              {OPERATOR.name}
              {OPERATOR.address && (
                <>
                  <br />
                  {OPERATOR.address}
                </>
              )}
              {OPERATOR.registration && (
                <>
                  <br />
                  {OPERATOR.registration}
                </>
              )}
              <br />
              <a className={link} href={`mailto:${OPERATOR.email}`}>
                {OPERATOR.email}
              </a>
            </p>
          ) : (
            <p className="text-steel">Operator details are added before launch.</p>
          )}
        </Section>

        <Section title="Terms of use">
          <p>Lapdle is free to play in your browser. By playing you agree to these terms.</p>
          <p>
            Play fairly. Don't automate play or leaderboard submissions, flood the servers, or try to get around the game's limits or security. We may remove results, limit access or reset the leaderboard to keep it fair and
            working.
          </p>
          <p>
            The game, its look, its code and its circuit drawings are ours (map data excepted, see below). You may share screenshots, clips and the share cards the game makes. We may change, pause or end any part of the game,
            and these terms; the date above shows the latest version.
          </p>
          <p>
            Lapdle is provided as it is, without guarantees that it will always be available or free of errors. Lap times and facts are for fun. Nothing in these terms limits rights you have as a consumer under the law that
            applies to you. These terms are governed by Romanian law.
          </p>
        </Section>

        <Section title="Trademarks">
          <p>
            Lapdle is unofficial and not associated in any way with the Formula 1 companies. F1, FORMULA ONE, FORMULA 1, FIA FORMULA ONE WORLD CHAMPIONSHIP, GRAND PRIX and related marks are trade marks of Formula One Licensing
            B.V.
          </p>
          <p>Circuit names are used only to identify the real venues and remain the marks of their owners. The game uses no team, driver or sponsor names, logos or liveries.</p>
          <p>
            If you own a name, mark or data used here and want it changed or removed, write to us
            {OPERATOR.email ? (
              <>
                {" "}at{" "}
                <a className={link} href={`mailto:${OPERATOR.email}`}>
                  {OPERATOR.email}
                </a>
              </>
            ) : null}{" "}
            with what it is and where it appears. We reply within a few working days and act on valid requests promptly.
          </p>
        </Section>

        <Section title="Map data">
          <p>
            Circuit surroundings are drawn from{" "}
            <a className={link} href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
              OpenStreetMap
            </a>{" "}
            data, © OpenStreetMap contributors, available under the Open Database License (ODbL). The extracted surroundings data used by the game is itself available under the ODbL; ask us for a copy.
          </p>
          <p>Circuit facts (lengths, corners, first Grand Prix, race laps, 2025 pole times) are public facts, checked against official race pages and public references.</p>
        </Section>

        <Section title="Software">
          <ul className="space-y-1.5">
            {SOFTWARE.map(([name, licence, url]) => (
              <li key={name}>
                {name}:{" "}
                <a className={link} href={url} target="_blank" rel="noreferrer">
                  {licence}
                </a>
              </li>
            ))}
          </ul>
        </Section>
      </article>
    </div>
  );
}

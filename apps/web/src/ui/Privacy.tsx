import { ANALYTICS_ON } from "../analytics";
import { useState } from "react";
import { OPERATOR, OPERATOR_SET } from "../legal";
import { ONLINE, existingDeviceId, forgetThisDevice } from "../online";
import { secondaryBtn } from "./styles";

const ADS = !!import.meta.env.VITE_ADSENSE_CLIENT;

declare global {
  interface Window {
    googlefc?: { callbackQueue?: unknown[]; showRevocationMessage?: () => void };
  }
}

/** The device's anonymous id and a button that erases its leaderboard results. */
function ForgetMe() {
  const [id, setId] = useState(existingDeviceId);
  const [state, setState] = useState<"idle" | "busy" | "done" | "failed">("idle");
  const [removed, setRemoved] = useState(0);
  return (
    <div className="space-y-3">
      <p>
        Your anonymous device number: <span className="num break-all text-paint">{id ?? "none yet (you haven't finished a daily lap online)"}</span>
      </p>
      {id && (
        <button
          className={secondaryBtn}
          disabled={state === "busy"}
          onClick={async () => {
            setState("busy");
            const n = await forgetThisDevice();
            if (n === null) setState("failed");
            else {
              setRemoved(n);
              setId(null);
              setState("done");
            }
          }}
        >
          {state === "busy" ? "Deleting…" : "Delete my leaderboard results"}
        </button>
      )}
      {state === "done" && <p className="text-paint">Done: {removed} {removed === 1 ? "result" : "results"} deleted, and this device has a new number from now on.</p>}
      {state === "failed" && <p className="text-kerb">That didn't reach the server. Check your connection and try again, or write to us with your device number.</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line pt-5">
      <h2 className="wide text-[20px] leading-tight text-paint">{title}</h2>
      <div className="mt-2.5 space-y-3 text-[15px] leading-relaxed text-paint/85">{children}</div>
    </section>
  );
}

/**
 * The privacy page, written from what the app actually does, and adapting to
 * what this build has switched on (ads, analytics, a contact address).
 */
export function Privacy() {
  const updated = "4 October 2026";
  return (
    <div className="h-full overflow-y-auto">
      <article className="mx-auto max-w-[68ch] space-y-7 px-4 pt-8 pb-16 md:px-8 lg:pt-12">
        <header>
          <h1 className="wide text-[clamp(32px,6vw,52px)] leading-none text-paint">Privacy</h1>
          <p className="mt-3 text-[14px] text-steel">Last updated {updated}.</p>
        </header>

        <Section title="No account, no sign-in">
          <p>APEX has no accounts. You never give us a name, an email address or a password to play.</p>
        </Section>

        <Section title="Loading the site">
          <p>
            Like any website, APEX is delivered by a hosting provider. To send you the pages, its servers necessarily receive your IP address and basic browser details, and keep short-lived access logs to keep the
            service running and secure (legitimate interest, Art. 6(1)(f) GDPR). We don't use these logs to identify or follow players.
          </p>
        </Section>

        <Section title="What stays on your device">
          <p>
            Your progress is saved in your browser's local storage on this device: daily results and streaks, personal bests and lines on each circuit, minigame records, and your settings (colour-blind colours).{" "}
            {ONLINE ? "Apart from the daily leaderboard entry described below, it never leaves the device." : "It never leaves the device."} Clearing this site's data in your browser deletes it.
          </p>
          <p>The app also keeps a short local log of game events (for example "lap finished") to help us improve the game during development. It stays on your device too.</p>
        </Section>

        {ONLINE && (
          <Section title="Daily leaderboard">
            <p>
              When you finish a Daily Quali lap, the app sends today's date, the circuit, the conditions, your best line of the day (the points of your racing line) and a random device number made on this device, so the
              game can tell you how you compare. The server times the line itself; no name, account or email is involved.
            </p>
            <p>
              It's stored in a database run by Supabase in the EU (Frankfurt). Other players only ever see totals (how many played, how many were faster, the median), never your device number or your line. We don't store
              your IP address with your result (to stop abuse, the server counts requests per IP as a salted one-way hash, kept for up to two days); Supabase keeps short-lived server logs for running the service.
              Results are kept for up to 30 days. The legal basis is our legitimate interest in running the leaderboard you see in the game (Art. 6(1)(f) GDPR).
            </p>
            <ForgetMe />
          </Section>
        )}

        {ANALYTICS_ON && (
          <Section title="Visit statistics">
            <p>
              We count visits with Plausible Analytics, which uses no cookies and collects no personal data: no IP addresses are stored and visitors can't be tracked across sites or days. We see totals such as how many people
              opened the Daily Quali and how many laps were driven, by page, country and device type.
            </p>
          </Section>
        )}

        {ADS && (
          <Section title="Advertising">
            <p>
              The game is free and paid for by ads served by Google AdSense. Google and its partners may use cookies or similar technologies to show ads and measure them, and, where you agree, to personalise them. In the
              European Economic Area, the UK and Switzerland you're asked for consent first, through Google's certified consent message, and you can change your choice at any time. Personalised ads are shown only with
              that consent (Art. 6(1)(a) GDPR).
            </p>
            <p>
              Google may process this data in the United States. Google is certified under the EU-U.S. Data Privacy Framework, which the European Commission recognises as giving adequate protection (Art. 45 GDPR).
            </p>
            <p>
              How Google uses information from sites that use its services:{" "}
              <a className="text-paint underline decoration-line underline-offset-4 hover:decoration-paint" href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noreferrer">
                policies.google.com/technologies/partner-sites
              </a>
              .
            </p>
            <button
              className={secondaryBtn}
              onClick={() => {
                window.googlefc ??= {};
                (window.googlefc.callbackQueue ??= []).push(() => window.googlefc?.showRevocationMessage?.());
              }}
            >
              Change cookie choices
            </button>
          </Section>
        )}

        <Section title="Map data and facts">
          <p>
            Circuit surroundings come from OpenStreetMap (© OpenStreetMap contributors, ODbL). Circuit facts come from public sources. APEX is an independent game, not affiliated with Formula 1 or any team; circuit names refer to
            the venues only.
          </p>
        </Section>

        <Section title="Children">
          <p>
            APEX is a general-audience game, not directed at children. It has no accounts and asks for no personal details. Where ads are shown, players under the age of digital consent (16 in Romania) shouldn't agree to
            personalised advertising; choose "Do not consent" in the cookie message, or ask a parent.
          </p>
        </Section>

        <Section title="Security">
          <p>
            The site only runs over HTTPS and sends strict security headers.{" "}
            {ONLINE && "The leaderboard database can't be read or written from the browser; results go through a server function that checks every submission and re-times the lap itself. "}
            No method is perfectly secure, but we keep what we hold to the minimum above.
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            Under the GDPR you can ask to access, correct or delete personal data about you, object to its use, or restrict it. Leaderboard results can be deleted at once with the button above; for anything else, write to us
            {OPERATOR.email ? (
              <>
                {" "}at{" "}
                <a className="text-paint underline decoration-line underline-offset-4 hover:decoration-paint" href={`mailto:${OPERATOR.email}`}>
                  {OPERATOR.email}
                </a>
              </>
            ) : null}
            . We answer within one month. You can also complain to the Romanian data protection authority, ANSPDCP (
            <a className="text-paint underline decoration-line underline-offset-4 hover:decoration-paint" href="https://www.dataprotection.ro" target="_blank" rel="noreferrer">
              dataprotection.ro
            </a>
            ), or the authority where you live.
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p>If what APEX collects changes, we update this page first and change the date at the top. Links to other sites (OpenStreetMap, Google) follow those sites' own policies.</p>
        </Section>

        <Section title="Who runs APEX">
          {OPERATOR_SET ? (
            <p>
              {OPERATOR.name}
              {OPERATOR.address ? `, ${OPERATOR.address}` : ""}
              {OPERATOR.registration ? ` (${OPERATOR.registration})` : ""}. Contact:{" "}
              <a className="text-paint underline decoration-line underline-offset-4 hover:decoration-paint" href={`mailto:${OPERATOR.email}`}>
                {OPERATOR.email}
              </a>
              . We are the data controller for the leaderboard.
            </p>
          ) : (
            <p className="text-steel">Operator details are added before launch.</p>
          )}
        </Section>
      </article>
    </div>
  );
}

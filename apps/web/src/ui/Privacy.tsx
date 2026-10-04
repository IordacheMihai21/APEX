import { ANALYTICS_ON } from "../analytics";
import { ONLINE } from "../online";
import { secondaryBtn } from "./styles";

const ADS = !!import.meta.env.VITE_ADSENSE_CLIENT;
const CONTACT = import.meta.env.VITE_CONTACT_EMAIL as string | undefined;

declare global {
  interface Window {
    googlefc?: { callbackQueue?: unknown[]; showRevocationMessage?: () => void };
  }
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
  const updated = "3 October 2026";
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

        <Section title="What stays on your device">
          <p>
            Your progress is saved in your browser's local storage on this device: daily results and streaks, personal bests and lines on each circuit, minigame records, and your settings (sound, colour-blind colours).{" "}
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
              your IP address with your result; Supabase keeps short-lived server logs for running the service. Clearing this site's data gives you a new device number.
            </p>
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
              European Economic Area, the UK and Switzerland you're asked for consent first, and you can change your choice at any time.
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

        {CONTACT && (
          <Section title="Contact">
            <p>
              Questions about privacy:{" "}
              <a className="text-paint underline decoration-line underline-offset-4 hover:decoration-paint" href={`mailto:${CONTACT}`}>
                {CONTACT}
              </a>
              .
            </p>
          </Section>
        )}
      </article>
    </div>
  );
}

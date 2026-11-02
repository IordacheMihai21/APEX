import { UPDATES } from "./updateList";
import { Page, link } from "./Guides";

/**
 * What's new: the updates players can see (content/updateList.ts), newest first, on one page. Rendered to static HTML at
 * build time like the other content pages (src/ssg).
 */

const day = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export function Updates() {
  return (
    <Page>
      <header>
        <p className="caption">Lapdle</p>
        <h1 className="wide mt-2 text-[clamp(32px,6vw,52px)] leading-none text-paint">What's new</h1>
        <p className="mt-4 text-[16px] leading-relaxed text-paint/85">
          Lapdle changes every week: new games, new guides, fixes to the circuits and the physics. Here is what changed for players since the first day, newest first. The Daily Quali, Make the corner and the other daily
          games themselves change every day.
        </p>
      </header>
      <ol className="space-y-9">
        {UPDATES.map((u) => (
          <li key={`${u.date}-${u.title}`} className="border-t border-line pt-5">
            <p className="caption">
              <time dateTime={u.date}>{day(u.date)}</time>
            </p>
            <h2 className="wide mt-1.5 text-[22px] leading-tight text-paint">{u.title}</h2>
            <div className="mt-2.5 space-y-3 text-[15px] leading-relaxed text-paint/85">
              {u.body.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            {u.links && (
              <p className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[15px]">
                {u.links.map(([label, href]) => (
                  <a key={href} className={link} href={href}>
                    {label}
                  </a>
                ))}
              </p>
            )}
          </li>
        ))}
      </ol>
    </Page>
  );
}

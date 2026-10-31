import { ARTICLES, type Article, article, words } from "./articles";
import { Page, Section, link } from "./Guides";

/**
 * Learn: the articles on driving a racing line (content/articles.ts), an index and one page each. Rendered to static
 * HTML at build time like the other content pages (src/ssg), with Article structured data for search engines.
 */

const minutes = (a: Article) => Math.max(2, Math.round(words(a) / 220));

export function LearnIndex() {
  return (
    <Page>
      <header>
        <p className="caption">Lapdle</p>
        <h1 className="wide mt-2 text-[clamp(32px,6vw,52px)] leading-none text-paint">Learn the racing line</h1>
        <p className="mt-4 text-[16px] leading-relaxed text-paint/85">
          Short guides to the craft behind every Lapdle game: what a racing line is, where to put the apex, how to find a braking point and what changes in the rain. Written for anyone who loves a good lap, with numbers
          from the game's own physics.
        </p>
      </header>
      <ul className="divide-y divide-line border-y border-line">
        {ARTICLES.map((a) => (
          <li key={a.slug}>
            <a href={`/learn/${a.slug}`} className="group block py-5">
              <span className="caption">
                {a.kicker} · {minutes(a)} min read
              </span>
              <span className="wide mt-1.5 block text-[22px] leading-tight text-paint group-hover:text-ink">{a.title}</span>
              <span className="mt-1.5 block text-[15px] leading-snug text-steel">{a.description}</span>
            </a>
          </li>
        ))}
      </ul>
    </Page>
  );
}

export function LearnArticle({ slug }: { slug: string }) {
  const a = article(slug)!;
  const others = ARTICLES.filter((x) => x.slug !== slug);
  const ld = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.title,
    description: a.description,
    url: `https://lapdle.com/learn/${a.slug}`,
    publisher: { "@type": "Organization", name: "Lapdle", url: "https://lapdle.com" },
  };
  return (
    <Page>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <header>
        <p className="caption">
          <a className={link} href="/learn">
            Learn
          </a>{" "}
          · {a.kicker} · {minutes(a)} min read
        </p>
        <h1 className="wide mt-2 text-[clamp(30px,5.4vw,46px)] leading-[1.02] text-paint">{a.title}</h1>
        <div className="mt-5 space-y-4 text-[17px] leading-relaxed text-paint/90">
          {a.intro.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </header>

      {a.sections.map((s) => (
        <Section key={s.h} title={s.h}>
          {s.p.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </Section>
      ))}

      <div>
        <a href={a.play.href} className="btn-go cut wide inline-flex items-center justify-center gap-2 bg-ink py-3 pr-10 pl-6 text-[15px] whitespace-nowrap text-night uppercase">
          {a.play.text}
        </a>
      </div>

      <Section title="More to learn">
        <ul className="space-y-2">
          {others.map((o) => (
            <li key={o.slug}>
              <a className={link} href={`/learn/${o.slug}`}>
                {o.title}
              </a>
            </li>
          ))}
        </ul>
      </Section>
    </Page>
  );
}

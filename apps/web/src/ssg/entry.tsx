/**
 * Build-time rendering of the content pages (How to play, About) to static
 * HTML, so search engines and link previews get the full text without running
 * JavaScript. Built with `vite build --ssr` and used by scripts/prerender.mjs;
 * in the browser the app takes over and renders the same page.
 */
import { renderToString } from "react-dom/server";
import { About, HowToPlayGuide, HowToPlayIndex } from "../content/Guides";
import { contentMeta, parseContent } from "../content/meta";
import { ChevronLeft } from "../ui/icons";
import { CONTENT_ROUTES } from "../games/registry";

/** The app's frame around a page (the header as the app draws it, with a link back to the grid). */
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid h-dvh grid-cols-[minmax(0,1fr)] grid-rows-[auto_1fr_auto] overflow-hidden">
      <header className="flex h-[52px] items-stretch justify-between border-b border-line bg-night pt-[env(safe-area-inset-top)]">
        <div className="flex min-w-0 items-stretch">
          <a href="/" className="back grid w-12 shrink-0 place-items-center border-r border-line text-paint" aria-label="Back to the grid">
            <ChevronLeft />
          </a>
          <div className="flex min-w-0 items-center gap-3 px-3">
            <a href="/" className="wide text-[17px] leading-none tracking-[0.02em] text-paint sm:text-[20px]">
              LAPDLE
            </a>
          </div>
        </div>
      </header>
      <main className="relative min-h-0">{children}</main>
    </div>
  );
}

export const routes = CONTENT_ROUTES;

export function render(path: string): { html: string; title: string; description: string } {
  const c = parseContent(path);
  if (!c) throw new Error(`not a content page: ${path}`);
  const page = c.page === "about" ? <About /> : c.game ? <HowToPlayGuide id={c.game} /> : <HowToPlayIndex />;
  return { html: renderToString(<Frame>{page}</Frame>), ...contentMeta(c) };
}

import { GAMES, type GameId, game } from "../games/registry";

/** A content page's address, parsed: About, the How to play index, or one game's guide. */
export type ContentPage = { page: "about" } | { page: "howto"; game?: GameId };

export function parseContent(path: string): ContentPage | null {
  const p = path.replace(/^\/+|\/+$/g, "");
  if (p === "about") return { page: "about" };
  if (p === "how-to-play") return { page: "howto" };
  const m = /^how-to-play\/([a-z-]+)$/.exec(p);
  if (m && GAMES.some((g) => g.id === m[1])) return { page: "howto", game: m[1] as GameId };
  return null;
}

export const contentPath = (c: ContentPage) => (c.page === "about" ? "/about" : c.game ? `/how-to-play/${c.game}` : "/how-to-play");

/** A description of at most ~160 characters, cut at a word. */
const clip = (s: string, n = 158) => (s.length <= n ? s : `${s.slice(0, s.lastIndexOf(" ", n - 1))}…`);

/** Title and description of a content page, for <head> (the build) and document.title (the app). */
export function contentMeta(c: ContentPage): { title: string; description: string } {
  if (c.page === "about")
    return {
      title: "About Lapdle: the daily racing line challenge",
      description: "Lapdle is a set of short, free racing games on real circuits, new every day. What the games are, how the circuits are made, and how to get in touch.",
    };
  if (!c.game)
    return {
      title: "How to play Lapdle: rules, scoring and tips | Lapdle",
      description: clip(`Rules, scoring and tips for every Lapdle game: ${GAMES.map((g) => g.name).join(", ")}.`),
    };
  const g = game(c.game);
  return { title: `How to play ${g.name}: rules, scoring and tips | Lapdle`, description: clip(`${g.guide.intro} ${g.guide.scoring}`) };
}

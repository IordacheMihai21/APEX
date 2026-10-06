import { GAMES, type GameId, game } from "../games/registry";
import { CIRCUITS, circuit, circuitBySlug, circuitSlug } from "../modes/circuits";
import { CIRCUIT_TEXT } from "./circuitText";

/** A content page's address, parsed: About, How to play (the index or one game's guide), or Circuits (the index or one circuit's guide). */
export type ContentPage = { page: "about" } | { page: "howto"; game?: GameId } | { page: "circuits"; id?: string };

export function parseContent(path: string): ContentPage | null {
  const p = path.replace(/^\/+|\/+$/g, "");
  if (p === "about") return { page: "about" };
  if (p === "how-to-play") return { page: "howto" };
  const m = /^how-to-play\/([a-z-]+)$/.exec(p);
  if (m && GAMES.some((g) => g.id === m[1])) return { page: "howto", game: m[1] as GameId };
  if (p === "circuits") return { page: "circuits" };
  const c = /^circuits\/([a-z-]+)$/.exec(p);
  const found = c && circuitBySlug(c[1]);
  if (found) return { page: "circuits", id: found.id };
  return null;
}

export function contentPath(c: ContentPage): string {
  if (c.page === "about") return "/about";
  if (c.page === "circuits") return c.id ? `/circuits/${circuitSlug(c.id)}` : "/circuits";
  return c.game ? `/how-to-play/${c.game}` : "/how-to-play";
}

/** A description of at most ~160 characters, cut at a word. */
const clip = (s: string, n = 158) => (s.length <= n ? s : `${s.slice(0, s.lastIndexOf(" ", n - 1))}…`);

/** Title and description of a content page, for <head> (the build) and document.title (the app). */
export function contentMeta(c: ContentPage): { title: string; description: string } {
  if (c.page === "about")
    return {
      title: "About Lapdle: the daily racing line challenge",
      description: "Lapdle is a set of short, free racing games on real circuits, new every day. What the games are, how the circuits are made, and how to get in touch.",
    };
  if (c.page === "circuits") {
    if (!c.id)
      return {
        title: "Circuit guides: twelve real circuits to master | Lapdle",
        description: clip(`Guides to the twelve real circuits in Lapdle: ${CIRCUITS.map((x) => x.name).join(", ")}. Facts, famous corners, the perfect lap and how to drive each one.`),
      };
    const x = circuit(c.id);
    return { title: `${x.name} circuit guide: facts, corners and the perfect lap | Lapdle`, description: clip(CIRCUIT_TEXT[x.id].character) };
  }
  if (!c.game)
    return {
      title: "How to play Lapdle: rules, scoring and tips | Lapdle",
      description: clip(`Rules, scoring and tips for every Lapdle game: ${GAMES.map((g) => g.name).join(", ")}.`),
    };
  const g = game(c.game);
  return { title: `How to play ${g.name}: rules, scoring and tips | Lapdle`, description: clip(`${g.guide.intro} ${g.guide.scoring}`) };
}

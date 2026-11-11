import { GAMES, type GameId, game } from "../games/registry";
import { t } from "../i18n";
import { GUIDE_CIRCUITS, circuit, circuitBySlug, circuitSlug, factsOf, guideBySlug } from "../modes/circuits";
import { CIRCUIT_TEXT } from "./circuitText";
import { quiz } from "./quiz";
import { article } from "./articles";
import { cornerBySlug } from "./cornerText";

/** A content page's address, parsed: About, How to play (the index or one game's guide), or Circuits (the index or one circuit's guide). */
export type ContentPage = { page: "about" } | { page: "howto"; game?: GameId } | { page: "circuits"; id?: string } | { page: "trivia"; id?: string } | { page: "learn"; slug?: string } | { page: "corners"; slug?: string } | { page: "updates" };

export function parseContent(path: string): ContentPage | null {
  const p = path.replace(/^\/+|\/+$/g, "");
  if (p === "about") return { page: "about" };
  if (p === "updates") return { page: "updates" };
  if (p === "how-to-play") return { page: "howto" };
  const m = /^how-to-play\/([a-z-]+)$/.exec(p);
  if (m && GAMES.some((g) => g.id === m[1])) return { page: "howto", game: m[1] as GameId };
  if (p === "circuits") return { page: "circuits" };
  const c = /^circuits\/([a-z-]+)$/.exec(p);
  const found = c && guideBySlug(c[1]);
  if (found) return { page: "circuits", id: found.id };
  if (p === "learn") return { page: "learn" };
  const l = /^learn\/([a-z-]+)$/.exec(p);
  if (l && article(l[1])) return { page: "learn", slug: l[1] };
  if (p === "corners") return { page: "corners" };
  const k = /^corners\/([a-z0-9-]+)$/.exec(p);
  if (k && cornerBySlug(k[1])) return { page: "corners", slug: k[1] };
  if (p === "trivia") return { page: "trivia" };
  const t = /^trivia\/([a-z-]+)$/.exec(p);
  const quizOf = t && circuitBySlug(t[1]);
  if (quizOf) return { page: "trivia", id: quizOf.id };
  return null;
}

export function contentPath(c: ContentPage): string {
  if (c.page === "about") return "/about";
  if (c.page === "updates") return "/updates";
  if (c.page === "circuits") return c.id ? `/circuits/${circuitSlug(c.id)}` : "/circuits";
  if (c.page === "trivia") return c.id ? `/trivia/${circuitSlug(c.id)}` : "/trivia";
  if (c.page === "learn") return c.slug ? `/learn/${c.slug}` : "/learn";
  if (c.page === "corners") return c.slug ? `/corners/${c.slug}` : "/corners";
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
  if (c.page === "updates")
    return {
      title: "What's new in Lapdle: every update to the game | Lapdle",
      description: "Every change players can see in Lapdle, newest first: new games and guides, fixes to the circuits and the physics, and what changed in each daily game.",
    };
  if (c.page === "learn") {
    const a = c.slug ? article(c.slug) : undefined;
    if (!a)
      return {
        title: "Learn the racing line: guides to driving fast | Lapdle",
        description: "Short guides to the racing line: what it is, early vs late apex, how to find a braking point, driving in the wet and how each type of corner is driven.",
      };
    return { title: `${a.title} | Lapdle`, description: clip(a.description) };
  }
  if (c.page === "corners") {
    const w = c.slug ? cornerBySlug(c.slug) : undefined;
    if (!w)
      return {
        title: "Famous corners: how to drive twelve of racing's best | Lapdle",
        description: "Guides to twelve famous corners, from La Source and Tarzan to the Parabolica and Rascasse: where they are, how to drive them and the numbers from the physics.",
      };
    return { title: `${w.name} at ${circuit(w.trackId).name}: how to drive it | Lapdle`, description: clip(w.note) };
  }
  if (c.page === "trivia") {
    if (!c.id)
      return {
        title: "Circuit trivia: a quiz on every circuit | Lapdle",
        description: "Quick quizzes on twelve real racing circuits: country, lap length, corners, first Grand Prix, famous corners and pole laps. Free, no sign-up.",
      };
    const x = circuit(c.id);
    const n = quiz(c.id).length;
    return {
      title: `${x.name} quiz: ${n} questions on the circuit | Lapdle`,
      description: clip(`How well do you know ${x.name}? ${n} quick questions on the circuit in ${x.country}: lap length, corners, its first Grand Prix, famous corners and the pole lap.`),
    };
  }
  if (c.page === "circuits") {
    if (!c.id)
      return {
        title: "Circuit guides: thirteen real circuits to master | Lapdle",
        description: clip(`Guides to the real circuits in Lapdle: ${GUIDE_CIRCUITS.map((x) => x.name).join(", ")}. Facts, the perfect lap and how to drive each one.`),
      };
    const x = factsOf(c.id)!;
    return { title: `${x.name} circuit guide: facts, corners and the perfect lap | Lapdle`, description: clip(CIRCUIT_TEXT[x.id].character) };
  }
  if (!c.game)
    return {
      title: t("How to play Lapdle: rules, scoring and tips | Lapdle"),
      description: clip(t("Rules, scoring and tips for every Lapdle game: {games}.", { games: GAMES.map((g) => g.name).join(", ") })),
    };
  const g = game(c.game);
  return { title: t("How to play {game}: rules, scoring and tips | Lapdle", { game: g.name }), description: clip(`${g.guide.intro} ${g.guide.scoring}`) };
}

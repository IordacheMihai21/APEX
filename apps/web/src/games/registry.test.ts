import { beforeEach, describe, expect, it } from "vitest";
import redirects from "../../public/_redirects?raw";
import sitemap from "../../public/sitemap.xml?raw";
import { DAILY_SET, GAMES, GAME_PAGES, PUBLIC_ROUTES, game, todayProgress } from "./registry";

const store: Record<string, string> = {};
beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  globalThis.localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => void (store[k] = v),
    removeItem: (k: string) => void delete store[k],
  } as Storage;
});

describe("game registry", () => {
  it("has one entry per game, each with its own id and address", () => {
    const ids = GAMES.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    const routes = GAMES.flatMap((g) => (g.route ? [g.route] : []));
    expect(new Set(routes).size).toBe(routes.length);
    expect(GAME_PAGES).toEqual(routes.map((r) => r.slice(1)));
    expect(game("mystery").name).toBe("Mystery circuit");
  });

  it("serves and lists every public address", () => {
    // a game added to the registry also needs its rewrite and its sitemap entry
    for (const route of PUBLIC_ROUTES) {
      if (route !== "/") expect(redirects, `${route} in public/_redirects`).toMatch(new RegExp(`^${route}\\s+/\\s+200$`, "m"));
      expect(sitemap, `${route} in public/sitemap.xml`).toContain(`<loc>https://lapdle.com${route}</loc>`);
    }
  });

  it("explains every game that has its own page", () => {
    for (const g of GAMES.filter((x) => x.route)) {
      expect(g.howTo?.steps.length, g.id).toBeGreaterThanOrEqual(2);
      expect(g.title, g.id).toMatch(/\| Lapdle$/);
    }
  });

  it("reports today's status, and the daily set's progress, from a fresh device", () => {
    for (const g of GAMES) expect(g.today().state, g.id).toBe("new");
    const p = todayProgress();
    expect(p.total).toBe(DAILY_SET.length);
    expect(p.done).toBe(0);
    expect(p.items.map((i) => i.game.id)).toEqual(DAILY_SET.map((g) => g.id));
  });
});

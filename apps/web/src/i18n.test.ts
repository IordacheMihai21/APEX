import { describe, expect, it } from "vitest";
import sitemap from "../public/sitemap.xml?raw";
import { hasSpanish, stripLang, t, tn, withLang } from "./i18n";
import { ES } from "./i18n/es";
import { CONTENT_ROUTES, PUBLIC_ROUTES } from "./games/registry";

const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("i18n", () => {
  it("falls back to the English and fills in variables", () => {
    expect(t("Not a key in any dictionary")).toBe("Not a key in any dictionary");
    expect(t("Round {n} of {total}", { n: 2, total: 12 })).toBe("Round 2 of 12");
    expect(tn(1, "{n} lap left", "{n} laps left")).toBe("1 lap left");
    expect(tn(3, "{n} lap left", "{n} laps left")).toBe("3 laps left");
  });

  it("keeps every Spanish text's variables the same as its English key's", () => {
    for (const [en, es] of Object.entries(ES)) {
      expect(es.trim(), en).not.toBe("");
      expect(vars(es), en).toEqual(vars(en));
    }
  });

  it("adds and strips the /es prefix, and leaves the English-only pages alone", () => {
    expect(withLang("/", "es")).toBe("/es");
    expect(withLang("/mystery", "es")).toBe("/es/mystery");
    expect(withLang("/how-to-play/quali", "es")).toBe("/es/how-to-play/quali");
    expect(withLang("/circuits/monza", "es")).toBe("/circuits/monza");
    expect(withLang("/mystery", "en")).toBe("/mystery");
    expect(stripLang("/es")).toBe("/");
    expect(stripLang("/es/mystery")).toBe("/mystery");
    expect(stripLang("/espana")).toBe("/espana");
  });

  it("lists every Spanish page in the sitemap", () => {
    for (const route of [...PUBLIC_ROUTES, ...CONTENT_ROUTES].filter(hasSpanish)) {
      const es = route === "/" ? "/es" : `/es${route}`;
      expect(sitemap, `${es} in public/sitemap.xml`).toContain(`<loc>https://lapdle.com${es}</loc>`);
    }
  });
});

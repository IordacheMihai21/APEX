import { describe, expect, it } from "vitest";
import { ARTICLES, words } from "./articles";
import { contentMeta, contentPath, parseContent } from "./meta";

describe("Learn articles", () => {
  it("each has its own address, a full-length text and a description that fits a search result", () => {
    expect(new Set(ARTICLES.map((a) => a.slug)).size).toBe(ARTICLES.length);
    for (const a of ARTICLES) {
      expect(words(a), a.slug).toBeGreaterThan(700);
      expect(a.description.length, a.slug).toBeLessThanOrEqual(200);
      expect(a.sections.length, a.slug).toBeGreaterThanOrEqual(4);
    }
  });

  it("routes to and from /learn/<slug>", () => {
    for (const a of ARTICLES) {
      const c = parseContent(`/learn/${a.slug}`);
      expect(c).toEqual({ page: "learn", slug: a.slug });
      expect(contentPath(c!)).toBe(`/learn/${a.slug}`);
      expect(contentMeta(c!).title).toContain(a.title);
    }
    expect(parseContent("/learn/not-an-article")).toBeNull();
  });
});

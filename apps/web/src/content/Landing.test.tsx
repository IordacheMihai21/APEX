import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LANDING_ROUTES, landing } from "./Landing";

describe("static pages of the app", () => {
  it("gives every page its own title, description and heading", () => {
    const titles = new Set<string>();
    for (const route of LANDING_ROUTES) {
      const { node, title, description } = landing(route);
      expect(titles.has(title), `${route} title is unique`).toBe(false);
      titles.add(title);
      expect(description.length, route).toBeGreaterThan(50);
      expect(description.length, route).toBeLessThanOrEqual(170);
      const html = renderToString(<>{node}</>);
      expect(html.match(/<h1/g)?.length, `${route} has one h1`).toBe(1);
      expect(html, `${route} links home or to the games`).toContain('href="/');
    }
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { dayShareReady, dayShareText } from "./dayShare";
import { DAILY_SET } from "./registry";

const store: Record<string, string> = {};
beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  globalThis.localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => void (store[k] = v),
    removeItem: (k: string) => void delete store[k],
  } as Storage;
});

describe("share your day", () => {
  it("lists every game of the daily set, then the link", () => {
    const text = dayShareText("https://lapdle.com/?ref=share-day", "2026-10-29");
    const lines = text.split("\n");
    expect(lines[0]).toMatch(/^Lapdle #\d+: 0\/\d+ dailies$/);
    expect(lines).toHaveLength(DAILY_SET.length + 2);
    for (const g of DAILY_SET) expect(text).toContain(`⬜ ${g.name}`);
    expect(lines.at(-1)).toBe("https://lapdle.com/?ref=share-day");
  });

  it("waits for two games before offering itself", () => {
    expect(dayShareReady("2026-10-29")).toBe(false);
  });
});

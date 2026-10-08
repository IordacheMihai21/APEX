import { beforeAll, describe, expect, it, vi } from "vitest";

const sent: [string, Record<string, unknown>][] = [];
vi.mock("../analytics", () => ({ track: (event: string, props: Record<string, unknown> = {}) => void sent.push([event, props]) }));
vi.mock("../install", () => ({ standalone: () => false }));

beforeAll(() => {
  globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} } as unknown as Storage;
});

describe("challenge events", () => {
  it("reports the funnel once per page load: opened, first lap, first win", async () => {
    const { challengeLap, challengeOpened } = await import("./events");
    challengeOpened("monza");
    challengeOpened("monza");
    challengeLap("monza", false);
    challengeLap("monza", false);
    challengeLap("monza", true);
    challengeLap("monza", true);
    expect(sent.map(([e]) => e)).toEqual(["Challenge opened", "Challenge raced", "Challenge beaten"]);
    expect(sent[1][1]).toMatchObject({ circuit: "monza", beat: false, player: "new" });
  });
});

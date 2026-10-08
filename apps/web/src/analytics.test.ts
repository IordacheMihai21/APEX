import { describe, expect, it } from "vitest";
import { sourceQuery } from "./analytics";

describe("visit source", () => {
  it("keeps the parameters Plausible reads a source from", () => {
    expect(sourceQuery("?ref=tiktok")).toBe("?ref=tiktok");
    expect(sourceQuery("?utm_source=reddit&utm_medium=social&utm_campaign=wk2")).toBe("?utm_source=reddit&utm_medium=social&utm_campaign=wk2");
  });

  it("drops the app's own parameters", () => {
    expect(sourceQuery("?vs=spa~AAEC&ref=challenge")).toBe("?ref=challenge");
    expect(sourceQuery("?play=practice&track=monza")).toBe("");
    expect(sourceQuery("")).toBe("");
  });
});

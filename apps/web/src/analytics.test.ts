import { describe, expect, it } from "vitest";
import { sourceQuery, utmQuery } from "./analytics";

describe("visit source", () => {
  it("keeps the parameters that say where a visit came from", () => {
    expect(sourceQuery("?ref=tiktok")).toBe("?ref=tiktok");
    expect(sourceQuery("?utm_source=reddit&utm_medium=social&utm_campaign=wk2")).toBe("?utm_source=reddit&utm_medium=social&utm_campaign=wk2");
  });

  it("drops the app's own parameters", () => {
    expect(sourceQuery("?vs=spa~AAEC&ref=challenge")).toBe("?ref=challenge");
    expect(sourceQuery("?play=practice&track=monza")).toBe("");
    expect(sourceQuery("")).toBe("");
  });

  it("hands Umami a link's ref as utm_source", () => {
    expect(utmQuery("?ref=tiktok")).toBe("?utm_source=tiktok");
    expect(utmQuery("?utm_source=reddit&utm_medium=social")).toBe("?utm_source=reddit&utm_medium=social");
    expect(utmQuery("?ref=challenge&utm_source=reddit")).toBe("?utm_source=reddit");
    expect(utmQuery("")).toBe("");
  });
});

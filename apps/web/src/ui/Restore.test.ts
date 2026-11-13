import { describe, expect, it } from "vitest";
import { inAppBrowser } from "./Restore";
import { restoreCodeIn } from "../online";

describe("in-app browsers and restore links", () => {
  it("knows the apps' own browsers", () => {
    expect(inAppBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22B83 Instagram 354.0.0.30.94")).toBe("Instagram");
    expect(inAppBrowser("Mozilla/5.0 (Linux; Android 14) [FBAN/EMA;FBLC/en_US;FBAV/400.0]")).toBe("Facebook");
    expect(inAppBrowser("Mozilla/5.0 (Linux; Android 14) musical_ly_2023 BytedanceWebview")).toBe("TikTok");
    expect(inAppBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 Version/18.1 Mobile/15E148 Safari/604.1")).toBeNull();
  });
  it("finds the code in a pasted link or on its own", () => {
    const id = "3f2b8c1e-9a4d-4e7f-8b2a-1c5d6e7f8a9b";
    expect(restoreCodeIn(`https://lapdle.com/?restore=${id}`)).toBe(id);
    expect(restoreCodeIn(` ${id.toUpperCase()} `)).toBe(id);
    expect(restoreCodeIn("lapdle.com/?restore=nope")).toBeNull();
  });
});

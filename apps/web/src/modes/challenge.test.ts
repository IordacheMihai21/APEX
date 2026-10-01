import { describe, expect, it } from "vitest";
import { decodeChallenge, encodeChallenge } from "./challenge";

describe("challenge links", () => {
  it("round-trips a line to the centimetre", () => {
    const knots = [0, 1.234, -5.678, 6.5, -0.004];
    const back = decodeChallenge(encodeChallenge({ trackId: "monza", knots }))!;
    expect(back.trackId).toBe("monza");
    back.knots.forEach((k, i) => expect(Math.abs(k - knots[i])).toBeLessThanOrEqual(0.005));
  });

  it("rejects unknown tracks and broken data", () => {
    expect(decodeChallenge("nowhere~AAAA")).toBeNull();
    expect(decodeChallenge("monza~")).toBeNull();
    expect(decodeChallenge("monza~%%%")).toBeNull();
    expect(decodeChallenge(null)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { challengeMessage, parseScoreChallenge } from "./scoreChallenge";

describe("score challenge links", () => {
  it("reads the game and the friend's result", () => {
    expect(parseScoreChallenge("?ref=challenge-higher-lower&score=3%2F10")).toEqual({ game: "higher-lower", value: "3/10" });
    expect(parseScoreChallenge("?ref=challenge-pit-stop&score=2.314%20s")).toEqual({ game: "pit-stop", value: "2.314 s" });
  });

  it("ignores anything else", () => {
    expect(parseScoreChallenge("?ref=tiktok&score=3%2F10")).toBeNull();
    expect(parseScoreChallenge("?ref=challenge-mystery")).toBeNull();
    expect(parseScoreChallenge("?ref=challenge-mystery&score=%3Cb%3Ex%3C%2Fb%3E")).toBeNull();
    expect(parseScoreChallenge(`?ref=challenge-mystery&score=${"9".repeat(30)}`)).toBeNull();
  });

  it("writes a link that reads back", () => {
    const msg = challengeMessage("higher-lower", "/higher-lower", "Higher or lower #36", "3/10", "https://lapdle.com");
    expect(msg).toBe("I got 3/10 on Higher or lower #36. Can you beat it?\nhttps://lapdle.com/higher-lower?ref=challenge-higher-lower&score=3%2F10");
    expect(parseScoreChallenge(new URL(msg.split("\n")[1]).search)).toEqual({ game: "higher-lower", value: "3/10" });
  });
});

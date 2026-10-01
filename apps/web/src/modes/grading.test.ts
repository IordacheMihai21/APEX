import { describe, expect, it } from "vitest";
import { bestPerGroup } from "./grading";

describe("bestPerGroup", () => {
  it("keeps the best colour reached in each group on any lap", () => {
    expect(
      bestPerGroup([
        ["red", "purple", "yellow"],
        ["green", "yellow", "red"],
        ["yellow", "red", "green"],
      ]),
    ).toEqual(["green", "purple", "green"]);
  });
  it("is null before the first lap", () => {
    expect(bestPerGroup([])).toBeNull();
  });
});

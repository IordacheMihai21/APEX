import { describe, expect, it } from "vitest";
import { CIRCUITS } from "../modes/circuits";
import { NAMED_CORNERS, quiz } from "./quiz";

describe("circuit trivia", () => {
  it("asks every circuit at least six sound questions, the same each time", () => {
    for (const c of CIRCUITS) {
      const qs = quiz(c.id);
      expect(qs.length, c.id).toBeGreaterThanOrEqual(6);
      expect(quiz(c.id)).toEqual(qs);
      for (const q of qs) {
        expect(q.options).toHaveLength(4);
        expect(new Set(q.options).size, q.prompt).toBe(4);
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(q.explain).toContain(q.options[q.answer].replace(/ km$/, ""));
      }
    }
  });

  it("keeps each corner name to one circuit", () => {
    const all = Object.values(NAMED_CORNERS).flat();
    expect(new Set(all).size).toBe(all.length);
  });
});

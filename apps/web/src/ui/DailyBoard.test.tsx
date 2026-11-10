import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DailyBoard } from "./DailyBoard";
import { RoadBand } from "./RoadBand";

describe("named board and road band", () => {
  it("offers a nickname box under today's board", () => {
    const html = renderToString(<DailyBoard board={{ day: "2026-11-10", trackId: "spa", condition: "wet" }} />);
    expect(html).toContain("Today&#x27;s board");
    expect(html).toContain('id="board-nick"');
  });
  it("shows the goal and the invite rewards", () => {
    const html = renderToString(<RoadBand />);
    expect(html).toContain("Road to 1,000");
    expect(html).toContain("Magenta line colour");
    expect(html).toContain("Gold star on the board");
  });
});

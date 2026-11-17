import { describe, expect, it } from "vitest";
import { wheelDriveState } from "./drive";

describe("3D steering wheel drive state", () => {
  it("fills and resets rev lights in the upper gears using the wheel's rev fraction", () => {
    expect(wheelDriveState(5, 0.54).leds).toBe(0);
    expect(wheelDriveState(5, 0.75).leds).toBeGreaterThan(0);
    expect(wheelDriveState(5, 0.96).leds).toBe(15);
    expect(wheelDriveState(6, 0.72).leds).toBeLessThan(wheelDriveState(5, 0.96).leds);
    expect(wheelDriveState(8, 0.98).shift).toBe(true);
  });
});

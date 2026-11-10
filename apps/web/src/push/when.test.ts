import { describe, expect, it } from "vitest";
import { localDayHour, pushEndpointOk, reminderDue, reminderMessage, validTimeZone } from "./when";

describe("daily reminder clock", () => {
  const now = new Date("2026-11-10T07:30:00Z"); // 09:30 in Bucharest, 02:30 in New York

  it("reads the player's own day and hour", () => {
    expect(localDayHour("Europe/Bucharest", now)).toEqual({ day: "2026-11-10", hour: 9 });
    expect(localDayHour("America/New_York", now)).toEqual({ day: "2026-11-10", hour: 2 });
    expect(localDayHour("Pacific/Auckland", now)).toEqual({ day: "2026-11-10", hour: 20 });
  });

  it("is due once, at the chosen hour, unless today was already played", () => {
    const row = { tz: "Europe/Bucharest", hour: 9, last_sent: null, last_played: null };
    expect(reminderDue(row, now)).toBe("2026-11-10");
    expect(reminderDue({ ...row, hour: 10 }, now)).toBeNull();
    expect(reminderDue({ ...row, last_sent: "2026-11-10" }, now)).toBeNull();
    expect(reminderDue({ ...row, last_played: "2026-11-10" }, now)).toBeNull();
    expect(reminderDue({ ...row, last_sent: "2026-11-09", last_played: "2026-11-09" }, now)).toBe("2026-11-10");
  });

  it("knows real time zones only", () => {
    expect(validTimeZone("Europe/Vienna")).toBe(true);
    expect(validTimeZone("Mars/Olympus")).toBe(false);
    expect(validTimeZone("")).toBe(false);
  });
});

describe("daily reminder message", () => {
  it("names the day's Daily Quali and opens the app", () => {
    const m = reminderMessage("en", "2026-11-10");
    expect(m.title).toBe("Today's Lapdle is ready");
    expect(m.body).toMatch(/^Daily Quali #36: /);
    expect(m.url).toBe("/?ref=push");
    expect(reminderMessage("es", "2026-11-10").url).toBe("/es?ref=push");
  });
});

describe("push endpoints", () => {
  it("only takes the browsers' push services", () => {
    expect(pushEndpointOk("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(pushEndpointOk("https://updates.push.services.mozilla.com/wpush/v2/x")).toBe(true);
    expect(pushEndpointOk("https://web.push.apple.com/QK")).toBe(true);
    expect(pushEndpointOk("https://wns2-db5p.notify.windows.com/w/?token=x")).toBe(true);
    expect(pushEndpointOk("https://evil.example.com/fcm.googleapis.com")).toBe(false);
    expect(pushEndpointOk("http://fcm.googleapis.com/x")).toBe(false);
  });
});

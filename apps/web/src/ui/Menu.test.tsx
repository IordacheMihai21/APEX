import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";
import { Menu } from "./Menu";

beforeEach(() => {
  const store: Record<string, string> = {};
  globalThis.localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => void (store[k] = v),
    removeItem: (k: string) => void delete store[k],
  } as Storage;
});

describe("menu", () => {
  // the games ignore taps and keys while any aria-modal is on the page (HowToPlay's modalOpen)
  it("is a modal dialog only while open", () => {
    const closed = renderToString(<Menu open={false} onClose={() => {}} onAction={() => {}} />);
    expect(closed).not.toContain("aria-modal");
    expect(closed).not.toContain('role="dialog"');
    const open = renderToString(<Menu open onClose={() => {}} onAction={() => {}} />);
    expect(open).toContain('aria-modal="true"');
  });
});

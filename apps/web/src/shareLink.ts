import { inviteParam } from "./community";

/**
 * The link in a shared result: one of the game's pages, tagged with where the
 * visit came from (?ref=share-mystery), so the analytics can tell visits from
 * shares apart from everything else (see analytics.ts, sourceQuery), and with
 * this device's invite code (?inv=), so a friend who comes in and plays counts for it.
 */
export function shareLink(path: string, ref: string): string {
  const origin = typeof location !== "undefined" ? location.origin : "https://lapdle.com";
  return `${origin}${path}?ref=${ref}&${inviteParam()}`;
}

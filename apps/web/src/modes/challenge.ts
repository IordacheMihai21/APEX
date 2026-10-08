import { CATALOG } from "../game/catalog";

/**
 * "Beat my lap" links. The engine is deterministic, so a lap is just its line:
 * the link carries the track and the knot offsets (centimetres, int16,
 * base64url) and the receiver re-simulates it, so the time can't be faked.
 * The challenger's lap is raced as a pace marker on the receiver's own line,
 * never drawn, so a link never gives a line away.
 */
export interface Challenge {
  trackId: string;
  knots: number[];
}

const toB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function fromB64(s: string): Uint8Array | null {
  try {
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

export function encodeChallenge({ trackId, knots }: Challenge): string {
  const view = new DataView(new ArrayBuffer(knots.length * 2));
  knots.forEach((k, i) => view.setInt16(i * 2, Math.max(-32768, Math.min(32767, Math.round(k * 100)))));
  return `${trackId}~${toB64(new Uint8Array(view.buffer))}`;
}

export function decodeChallenge(code: string | null): Challenge | null {
  if (!code) return null;
  const [trackId, data] = code.split("~");
  if (!CATALOG.some((t) => t.id === trackId) || !data) return null;
  const bytes = fromB64(data);
  if (!bytes || bytes.length % 2 !== 0 || bytes.length === 0) return null;
  const view = new DataView(bytes.buffer);
  const knots = Array.from({ length: bytes.length / 2 }, (_, i) => view.getInt16(i * 2) / 100);
  return { trackId, knots };
}

export function challengeUrl(c: Challenge): string {
  return `${location.origin}${location.pathname}?vs=${encodeChallenge(c)}&ref=challenge`;
}

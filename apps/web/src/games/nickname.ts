/**
 * Board nicknames: 3 to 16 letters, digits, spaces, dots, dashes or underscores, checked the same way on the device
 * and on the server (supabase/functions/submit-lap). A short list keeps out names that pose as the site or are
 * plainly abusive; anything else is the player's own.
 */
const SHAPE = /^[A-Za-z0-9 _.-]{3,16}$/;
const BLOCKED = ["lapdle", "admin", "moderator", "official", "fuck", "shit", "cunt", "nigg", "fag", "rape", "hitler", "nazi", "whore", "slut", "porn", "dick", "pussy"];

/** The nickname tidied (outer spaces gone, inner runs of spaces made one), or null when it can't be used. */
export function cleanNickname(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, " ");
  if (!SHAPE.test(name)) return null;
  const flat = name.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/0/g, "o").replace(/1/g, "i").replace(/3/g, "e").replace(/4/g, "a").replace(/5/g, "s");
  if (BLOCKED.some((w) => flat.includes(w))) return null;
  return name;
}

import { track } from "./analytics";

const raw = import.meta.env.VITE_SUPPORT_URL as string | undefined;

/** A hosted checkout set by the site owner; no payment data passes through Lapdle. */
export const SUPPORT_URL = raw && /^https:\/\//i.test(raw) ? raw : null;

export function supportClicked(from: string) {
  track("Support clicked", { from });
}

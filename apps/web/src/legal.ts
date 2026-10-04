/**
 * Who runs APEX, from env vars (see .env.example). Romanian Law 365/2002
 * (art. 5) and the EU e-Commerce Directive require an ad-funded site to show
 * its operator's name, address and a direct contact; the GDPR (art. 13)
 * requires the same on the privacy page.
 */
export const OPERATOR = {
  name: (import.meta.env.VITE_OPERATOR_NAME as string | undefined) || "",
  address: (import.meta.env.VITE_OPERATOR_ADDRESS as string | undefined) || "",
  /** registration number, for a company or a sole trader (PFA) */
  registration: (import.meta.env.VITE_OPERATOR_REGISTRATION as string | undefined) || "",
  email: (import.meta.env.VITE_CONTACT_EMAIL as string | undefined) || "",
};

export const OPERATOR_SET = !!(OPERATOR.name && OPERATOR.email);

/** Ads (and so Google's consent message) are on when an AdSense client is set. */
export const ADS_CONSENT = !!import.meta.env.VITE_ADSENSE_CLIENT;

declare global {
  interface Window {
    googlefc?: { callbackQueue?: unknown[]; showRevocationMessage?: () => void };
  }
}

/** Reopen Google's consent message so the player can change their cookie choices. */
export function openConsent() {
  window.googlefc ??= {};
  (window.googlefc.callbackQueue ??= []).push(() => window.googlefc?.showRevocationMessage?.());
}

/** The game's social accounts, from env vars; an account shows in the footer only once its link is set. */
export const SOCIAL = (
  [
    ["x", "X", import.meta.env.VITE_SOCIAL_X],
    ["instagram", "Instagram", import.meta.env.VITE_SOCIAL_INSTAGRAM],
    ["tiktok", "TikTok", import.meta.env.VITE_SOCIAL_TIKTOK],
    ["youtube", "YouTube", import.meta.env.VITE_SOCIAL_YOUTUBE],
    ["discord", "Discord", import.meta.env.VITE_SOCIAL_DISCORD],
  ] as const
)
  .filter(([, , url]) => typeof url === "string" && /^https:\/\//.test(url))
  .map(([id, name, url]) => ({ id, name, url: url as string }));

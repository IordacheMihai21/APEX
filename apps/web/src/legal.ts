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

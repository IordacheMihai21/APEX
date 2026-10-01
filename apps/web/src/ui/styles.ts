/**
 * Shared control styles, so every screen uses one primary and one secondary button.
 * The motion lives in index.css (.btn-go, .btn-line, .btn-icon).
 */
export const primaryBtn =
  "btn-go cut wide inline-flex items-center justify-center gap-2 bg-ink pr-10 pl-6 py-3 whitespace-nowrap text-[15px] uppercase text-night disabled:bg-graphite disabled:text-steel";
export const secondaryBtn =
  "btn-line inline-flex items-center justify-center gap-2 border border-paint/20 px-4 py-2.5 text-[14px] font-semibold whitespace-nowrap text-paint/90 disabled:opacity-35";
export const iconBtn = "btn-icon grid h-10 w-10 shrink-0 place-items-center border border-line bg-board/85 text-paint";

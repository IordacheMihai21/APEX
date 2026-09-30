/** 88214 → "1:28.214" */
export function fmt(ms: number): string {
  const m = Math.floor(ms / 60000);
  const s = (ms - m * 60000) / 1000;
  return `${m}:${s.toFixed(3).padStart(6, "0")}`;
}

export function signed(ms: number): string {
  return `${ms >= 0 ? "+" : "−"}${(Math.abs(ms) / 1000).toFixed(3)}`;
}

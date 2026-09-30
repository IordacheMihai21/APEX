/** 78902 → "1:18.902" */
export function lapTime(ms: number): string {
  const m = Math.floor(ms / 60000);
  const s = (ms - m * 60000) / 1000;
  return `${m}:${s.toFixed(3).padStart(6, "0")}`;
}

/** 412 → "+0.412", -203 → "−0.203" */
export function delta(ms: number): string {
  return `${ms > 0 ? "+" : ms < 0 ? "−" : "±"}${(Math.abs(ms) / 1000).toFixed(3)}`;
}

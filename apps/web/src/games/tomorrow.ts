/**
 * Tomorrow's Daily Quali, for the places that used to say only "a new circuit
 * at midnight": a named circuit is a reason to come back. The schedule is fixed
 * (modes/schedule.ts), so tomorrow's circuit and conditions are known today.
 */
import { CATALOG } from "../game/catalog";
import { t } from "../i18n";
import { CONDITION_NAME, dailyCondition, dailyTrack, dateKey } from "../modes/daily";

export const nextDay = (key: string) => {
  const d = new Date(`${key}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return dateKey(d);
};

/** "🇭🇺 Hungaroring, low downforce" (conditions only when they aren't dry). */
export function tomorrowQuali(today = dateKey()): string {
  const key = nextDay(today);
  const c = CATALOG.find((x) => x.id === dailyTrack(key));
  const cond = dailyCondition(key);
  const name = c ? `${c.flag} ${c.name}` : dailyTrack(key);
  return cond === "dry" ? name : `${name}, ${t(CONDITION_NAME[cond]).toLowerCase()}`;
}

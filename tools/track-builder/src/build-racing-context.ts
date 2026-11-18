/** Small, attributed F1DB subset for Racing Context. Source: F1DB v2026.17.0, CC BY 4.0. */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../..");
const db = JSON.parse(readFileSync(resolve(root, "data/raw/f1db/f1db-v2026.17.0.json"), "utf8"));
type Row = Record<string, any>;
const nation = new Map<string, string>(db.countries.map((c: Row) => [c.id, c.name]));
const records = new Map<string, { years: number[]; teams: Set<string> }>();
for (const season of db.seasons as Row[]) {
  for (const entrant of season.entrants ?? []) for (const constructor of entrant.constructors ?? []) for (const d of constructor.drivers ?? []) {
    if (d.testDriver) continue;
    const rec = records.get(d.driverId) ?? { years: [], teams: new Set<string>() };
    rec.years.push(season.year);
    rec.teams.add(constructor.constructorId);
    records.set(d.driverId, rec);
  }
}
const drivers = (db.drivers as Row[]).filter((d) => d.totalRaceStarts >= 10).map((d) => {
  const rec = records.get(d.id);
  return {
    id: d.id, name: d.name, nation: nation.get(d.nationalityCountryId) ?? "Unknown",
    first: Math.min(...(rec?.years ?? [1950])), last: Math.max(...(rec?.years ?? [1950])),
    teams: [...(rec?.teams ?? [])].sort(), starts: d.totalRaceStarts, wins: d.totalRaceWins,
    titles: d.totalChampionshipWins,
  };
}).sort((a, b) => a.name.localeCompare(b.name));
writeFileSync(resolve(root, "apps/web/src/game/racing-context.json"), JSON.stringify({ source: { name: "F1DB", release: "v2026.17.0", license: "CC BY 4.0", url: "https://github.com/f1db/f1db" }, drivers }) + "\n");
console.log(`Wrote ${drivers.length} drivers`);

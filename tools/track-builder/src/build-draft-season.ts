/** Historic constructor-season draft pool. F1DB v2026.17.0, CC BY 4.0. */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../..");
type Row = Record<string, any>;
const db = JSON.parse(readFileSync(resolve(root, "data/raw/f1db/f1db-v2026.17.0.json"), "utf8")) as Row;
const names = (rows: Row[]) => new Map<string, string>(rows.map((r) => [r.id, r.name]));
const drivers = names(db.drivers);
const constructors = names(db.constructors);
const chassis = names(db.chassis);
const engines = names(db.engineManufacturers);
const clamp = (n: number) => Math.max(45, Math.min(99, Math.round(n)));
const place = (position: number | null | undefined, field: number) => position ? (field - position) / Math.max(1, field - 1) : 0;
const rate = (n: number, denominator: number) => n / Math.max(1, denominator);

type Driver = { id: string; name: string; season: number; prime: number };
type Squad = { id: string; year: number; constructor: string; chassis: string; engine: string; drivers: Driver[]; ratings: { chassis: number; engine: number; qualifying: number; race: number; reliability: number } };
const squads: Squad[] = [];
const prime = new Map<string, number>();

for (const season of db.seasons as Row[]) {
  if (season.year < 1992 || season.year > 2025) continue;
  const cs = new Map<string, Row>(season.constructors.map((r: Row) => [r.constructorId, r]));
  const es = new Map<string, Row>(season.engineManufacturers.map((r: Row) => [r.engineManufacturerId, r]));
  const ds = new Map<string, Row>(season.drivers.map((r: Row) => [r.driverId, r]));
  const maxLaps = Math.max(...season.constructors.map((r: Row) => r.totalRaceLaps ?? 0));
  for (const entrant of season.entrants as Row[]) for (const team of entrant.constructors as Row[]) {
    const c = cs.get(team.constructorId);
    const e = es.get(team.engineManufacturerId);
    if (!c || !e || !team.chassis?.length) continue;
    const field = season.constructorStandings.length || season.constructors.length;
    const base = 52 + 35 * place(c.positionNumber, field);
    const starts = c.totalRaceStarts || c.totalRaceEntries || 1;
    const driverRows: Driver[] = (team.drivers as Row[])
      .filter((d) => !d.testDriver && (d.rounds?.length ?? 0) >= 3)
      .map((d) => {
        const stat = ds.get(d.driverId);
        if (!stat) return null;
        const rating = clamp(49 + 36 * place(stat.positionNumber, season.driverStandings.length || season.drivers.length) + 10 * rate(stat.totalRaceWins, stat.totalRaceStarts) + 3 * rate(stat.totalPolePositions, stat.totalRaceStarts));
        prime.set(d.driverId, Math.max(prime.get(d.driverId) ?? 0, rating));
        return { id: d.driverId, name: drivers.get(d.driverId) ?? d.driverId, season: rating, prime: rating };
      }).filter(Boolean) as Driver[];
    if (!driverRows.length) continue;
    const engineField = season.engineManufacturers.length;
    const ratings = {
      chassis: clamp(base + 8 * rate(c.totalRaceWins, starts)),
      engine: clamp(52 + 35 * place(e.positionNumber, engineField) + 8 * rate(e.totalRaceWins, e.totalRaceStarts)),
      qualifying: clamp(base + 10 * rate(c.totalPolePositions, starts)),
      race: clamp(base + 10 * rate(c.totalPodiumRaces, starts)),
      reliability: clamp(52 + 40 * rate(c.totalRaceLaps, maxLaps)),
    };
    squads.push({
      id: `${season.year}-${team.constructorId}-${team.engineManufacturerId}`,
      year: season.year, constructor: constructors.get(team.constructorId) ?? team.constructorId,
      chassis: chassis.get(team.chassis[0].chassisId) ?? team.constructorId,
      engine: engines.get(team.engineManufacturerId) ?? team.engineManufacturerId,
      drivers: driverRows, ratings,
    });
  }
}
for (const squad of squads) for (const driver of squad.drivers) driver.prime = prime.get(driver.id) ?? driver.season;
squads.sort((a, b) => a.year - b.year || a.constructor.localeCompare(b.constructor));
writeFileSync(resolve(root, "apps/web/src/game/draft-season.json"), JSON.stringify({ source: { name: "F1DB", release: "v2026.17.0", license: "CC BY 4.0", url: "https://github.com/f1db/f1db" }, squads }) + "\n");
console.log(`Wrote ${squads.length} constructor-seasons`);

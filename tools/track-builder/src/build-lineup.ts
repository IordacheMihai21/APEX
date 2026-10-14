/**
 * Line-up facts from F1DB (https://github.com/f1db/f1db, CC BY 4.0): drivers,
 * teams, championship cars and circuits, and the groups they form, written to
 * apps/web/src/game/lineup.json for the daily Line-up. Every group lists all
 * of its known members, so the game can check that a day's sixteen tiles fit
 * exactly one of its four groups.
 *
 * The F1DB release is pinned below and downloaded once into data/raw/f1db/
 * (git-ignored: ~85 MB). Rerun after bumping RELEASE to pick up new results.
 * Usage: npm run build:lineup
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const RELEASE = "v2026.17.0";
const root = resolve(import.meta.dirname, "../../..");
const raw = resolve(root, "data/raw/f1db");
const json = resolve(raw, `f1db-${RELEASE}.json`);
const out = resolve(root, "apps/web/src/game/lineup.json");

if (!existsSync(json)) {
  mkdirSync(raw, { recursive: true });
  const zip = resolve(raw, "f1db-json-single.zip");
  console.log(`downloading F1DB ${RELEASE}…`);
  execFileSync("curl", ["-sSL", "-o", zip, `https://github.com/f1db/f1db/releases/download/${RELEASE}/f1db-json-single.zip`]);
  execFileSync("unzip", ["-o", "-q", zip, "f1db.json", "-d", raw]);
  execFileSync("mv", [resolve(raw, "f1db.json"), json]);
}

type Row = Record<string, any>;
const db = JSON.parse(readFileSync(json, "utf8")) as Record<string, Row[]>;
const drivers = new Map(db.drivers.map((d) => [d.id as string, d]));
const constructors = new Map(db.constructors.map((c) => [c.id as string, c]));
const chassis = new Map(db.chassis.map((c) => [c.id as string, c]));
const countries = new Map(db.countries.map((c) => [c.id as string, c]));
const seasons = [...db.seasons].sort((a, b) => a.year - b.year);
const LATEST = seasons[seasons.length - 1].year as number;

// ---------------------------------------------------------------- who drove for whom, and who won what

/** driver → the teams they started races for */
const teamsOf = new Map<string, Set<string>>();
/** year → constructor → chassis used that season */
const chassisOf = new Map<number, Map<string, string[]>>();
/** year → driver → constructors that season */
const seasonTeams = new Map<number, Map<string, string[]>>();
for (const s of seasons) {
  const cm = new Map<string, string[]>();
  const dm = new Map<string, string[]>();
  for (const e of s.entrants ?? [])
    for (const c of e.constructors ?? []) {
      cm.set(c.constructorId, [...(cm.get(c.constructorId) ?? []), ...(c.chassis ?? []).map((x: Row) => x.chassisId)]);
      for (const d of c.drivers ?? []) {
        if (d.testDriver) continue;
        dm.set(d.driverId, [...(dm.get(d.driverId) ?? []), c.constructorId]);
        if (!teamsOf.has(d.driverId)) teamsOf.set(d.driverId, new Set());
        teamsOf.get(d.driverId)!.add(c.constructorId);
      }
    }
  chassisOf.set(s.year, cm);
  seasonTeams.set(s.year, dm);
}

/** drivers' titles: year, driver, the team (when they drove for just one that season) and its car (when it ran just one) */
const titles: { year: number; driver: string; team: string | null; car: string | null }[] = [];
for (const s of seasons) {
  const champ = (s.driverStandings ?? []).find((x: Row) => x.championshipWon);
  if (!champ) continue;
  const teams = [...new Set(seasonTeams.get(s.year)?.get(champ.driverId) ?? [])];
  const team = teams.length === 1 ? teams[0] : null;
  const cars = team ? [...new Set(chassisOf.get(s.year)?.get(team) ?? [])] : [];
  titles.push({ year: s.year, driver: champ.driverId, team, car: cars.length === 1 ? cars[0] : null });
}
const grid = new Set([...(seasonTeams.get(LATEST)?.keys() ?? [])]);
const gridTeams = new Set([...(seasonTeams.get(LATEST)?.values() ?? [])].flat());

// ---------------------------------------------------------------- the known tiles

const n = (x: unknown) => (typeof x === "number" ? x : 0);
const groupBy = <T,>(xs: T[], key: (x: T) => string) => {
  const m = new Map<string, T[]>();
  for (const x of xs) m.set(key(x), [...(m.get(key(x)) ?? []), x]);
  return [...m];
};
/** the last season a driver raced, and whether they ever raced outside the Indianapolis 500 (a world championship round in the 1950s) */
const lastSeason = new Map<string, number>();
for (const [year, dm] of seasonTeams) for (const id of dm.keys()) lastSeason.set(id, Math.max(lastSeason.get(id) ?? 0, year));
const beyondIndy = new Set(db.races.filter((r) => r.circuitId !== "indianapolis").flatMap((r) => (r.raceResults ?? []).map((x: Row) => x.driverId as string)));
// known: every champion, today's grid, winners who raced in 1970 or later, and the long careers
const knownDriver = (d: Row) =>
  beyondIndy.has(d.id) && (n(d.totalChampionshipWins) > 0 || grid.has(d.id) || (n(d.totalRaceWins) > 0 && (lastSeason.get(d.id) ?? 0) >= 1970) || n(d.totalRaceStarts) >= 150);
const KNOWN_DRIVERS = db.drivers.filter(knownDriver);
/** teams founded by a driver who raced in F1 (checked by hand: Frank Williams, for one, never started a Grand Prix) */
const FOUNDERS: Record<string, string> = {
  brabham: "jack-brabham",
  mclaren: "bruce-mclaren",
  surtees: "john-surtees",
  fittipaldi: "emerson-fittipaldi",
  prost: "alain-prost",
  stewart: "jackie-stewart",
  ligier: "guy-ligier",
  hill: "graham-hill",
};
const knownTeam = (c: Row) => n(c.totalRaceWins) > 0 || gridTeams.has(c.id) || (c.id in FOUNDERS && n(c.totalRaceStarts) >= 30);
const KNOWN_TEAMS = db.constructors.filter(knownTeam);
const CHAMPION_CARS = [...new Set(titles.filter((t) => t.car && t.year >= 1970).map((t) => t.car!))];
const KNOWN_CIRCUITS = db.circuits.filter((c) => n(c.totalRacesHeld) >= 10);

export interface Item {
  id: string;
  label: string;
  kind: "driver" | "team" | "car" | "circuit";
}
const items = new Map<string, Item>();
const add = (it: Item) => items.set(it.id, it);
KNOWN_TEAMS.forEach((c) => add({ id: `t:${c.id}`, label: c.name, kind: "team" }));
/** circuits by the names fans use (and never a sponsor's) */
const CIRCUIT_LABEL: Record<string, string> = {
  austin: "Austin",
  imola: "Imola",
  interlagos: "Interlagos",
  montreal: "Montreal",
  "mexico-city": "Mexico City",
  jacarepagua: "Jacarepaguá",
  "buenos-aires": "Buenos Aires",
  "marina-bay": "Singapore",
  "yas-marina": "Abu Dhabi",
  melbourne: "Melbourne",
  spielberg: "Spielberg",
  "red-bull-ring": "Spielberg",
  "spa-francorchamps": "Spa",
  reims: "Reims",
};
KNOWN_CIRCUITS.forEach((c) => add({ id: `r:${c.id}`, label: CIRCUIT_LABEL[c.id] ?? c.name, kind: "circuit" }));
CHAMPION_CARS.forEach((id) => add({ id: `v:${id}`, label: chassis.get(id)!.name, kind: "car" }));
// drivers go by surname, with an initial when the surname is shared (Hill, Rosberg) or is also a team (Brabham)
const taken = new Set([...items.values()].map((i) => i.label.toLowerCase()));
const surnameCount = new Map<string, number>();
KNOWN_DRIVERS.forEach((d) => surnameCount.set(d.lastName, (surnameCount.get(d.lastName) ?? 0) + 1));
for (const d of KNOWN_DRIVERS) {
  let label = d.lastName as string;
  if (surnameCount.get(label)! > 1 || taken.has(label.toLowerCase())) label = `${(d.firstName as string)[0]}. ${d.lastName}`;
  if ([...items.values()].some((i) => i.label === label)) label = d.name;
  add({ id: `d:${d.id}`, label, kind: "driver" });
}

// ---------------------------------------------------------------- the groups

export interface Group {
  id: string;
  title: string;
  /** 1 (easiest, yellow) to 4 (hardest, purple) */
  level: 1 | 2 | 3 | 4;
  /** groups of one kind ("drove for X and Y") share a family, so a day draws a family first and no kind crowds the others out */
  family: string;
  members: string[];
}
const groups: Group[] = [];
const group = (id: string, title: string, level: Group["level"], members: string[], family = id) => {
  const m = [...new Set(members)].filter((x) => items.has(x)).sort();
  if (m.length >= 4) groups.push({ id, title, level, family, members: m });
};
const teamName = (id: string) => constructors.get(id)!.name as string;
const D = (id: string) => `d:${id}`;
const BIG = ["ferrari", "mclaren", "williams", "red-bull", "mercedes", "lotus", "brabham", "renault", "benetton", "tyrrell"];

// 1 · yellow: what any fan knows
group("champions", "World champions", 1, titles.map((t) => D(t.driver)));
for (const team of BIG) group(`champ-with-${team}`, `World champions with ${teamName(team)}`, 1, titles.filter((t) => t.team === team).map((t) => D(t.driver)), "champ-with");
group("grid", `On the ${LATEST} grid`, 1, [...grid].map(D));
for (const [country, list] of groupBy(titles, (t) => drivers.get(t.driver)!.nationalityCountryId as string))
  group(`champs-${country}`, `World champions from ${countries.get(country)!.name}`, 1, list.map((t) => D(t.driver)), "champs-country");
group("grid-teams", `Teams on the ${LATEST} grid`, 1, [...gridTeams].map((id) => `t:${id}`));
group("constructors-champions", "Constructors' champions", 1, KNOWN_TEAMS.filter((c) => n(c.totalChampionshipWins) > 0).map((c) => `t:${c.id}`));

// 2 · green: careers
for (let i = 0; i < BIG.length; i++)
  for (let j = i + 1; j < BIG.length; j++)
    group(`both-${BIG[i]}-${BIG[j]}`, `Drove for ${teamName(BIG[i])} and ${teamName(BIG[j])}`, 2, KNOWN_DRIVERS.filter((d) => teamsOf.get(d.id)?.has(BIG[i]) && teamsOf.get(d.id)?.has(BIG[j])).map((d) => D(d.id)), "drove-for-both");
group("multi-champions", "Two or more world titles", 2, KNOWN_DRIVERS.filter((d) => n(d.totalChampionshipWins) >= 2).map((d) => D(d.id)));
for (const decade of [1970, 1980, 1990, 2000, 2010])
  group(`champs-${decade}s`, `World champions in the ${decade}s`, 2, titles.filter((t) => t.year >= decade && t.year < decade + 10).map((t) => D(t.driver)), "champs-decade");
for (const [country, list] of groupBy(KNOWN_DRIVERS.filter((d) => n(d.totalRaceWins) > 0), (d) => d.nationalityCountryId as string))
  group(`winners-${country}`, `Grand Prix winners from ${countries.get(country)!.name}`, 2, list.map((d) => D(d.id)), "winners-country");
for (const country of ["italy", "united-states-of-america", "spain", "germany", "united-kingdom", "france", "brazil"])
  group(`circuits-${country}`, `Circuits in ${countries.get(country)!.name}`, 2, KNOWN_CIRCUITS.filter((c) => c.countryId === country).map((c) => `r:${c.id}`), "circuits-country");
group("street", "Street circuits", 2, KNOWN_CIRCUITS.filter((c) => c.type === "STREET").map((c) => `r:${c.id}`));

// 3 · blue: the numbers behind the names
group("pole-no-win", "Pole position, never a win", 3, KNOWN_DRIVERS.filter((d) => n(d.totalPolePositions) > 0 && n(d.totalRaceWins) === 0).map((d) => D(d.id)));
group("one-win", "Won exactly one Grand Prix", 3, KNOWN_DRIVERS.filter((d) => n(d.totalRaceWins) === 1).map((d) => D(d.id)));
group("podium-no-win", "Podiums but never a win", 3, KNOWN_DRIVERS.filter((d) => n(d.totalPodiums) >= 3 && n(d.totalRaceWins) === 0).map((d) => D(d.id)));
group("one-title", "Exactly one world title", 3, KNOWN_DRIVERS.filter((d) => n(d.totalChampionshipWins) === 1).map((d) => D(d.id)));
group("anticlockwise", "Raced anticlockwise", 3, KNOWN_CIRCUITS.filter((c) => c.direction === "ANTI_CLOCKWISE").map((c) => `r:${c.id}`));
group("fifties-circuits", "Held a Grand Prix in the 1950s", 3, KNOWN_CIRCUITS.filter((c) => db.races.some((r) => r.circuitId === c.id && r.year < 1960)).map((c) => `r:${c.id}`));
for (const team of ["ferrari", "mclaren", "williams", "red-bull", "mercedes"])
  group(`cars-${team}`, `Title-winning ${teamName(team)} cars`, 3, titles.filter((t) => t.team === team && t.car).map((t) => `v:${t.car}`), "team-cars");

// 4 · purple: the hidden links
group("sons", "Sons of F1 drivers", 4, KNOWN_DRIVERS.filter((d) => (d.familyRelationships ?? []).some((r: Row) => r.type === "PARENT" && n(drivers.get(r.driverId)?.totalRaceStarts) > 0)).map((d) => D(d.id)));
group("champion-cars", "Cars that won the drivers' title", 4, CHAMPION_CARS.map((id) => `v:${id}`));
group("driver-teams", "Teams founded by an F1 driver", 4, Object.keys(FOUNDERS).map((id) => `t:${id}`));
group("own-team", "Ran their own team", 4, Object.values(FOUNDERS).map(D));
group("brothers", "Had a brother in F1", 4, KNOWN_DRIVERS.filter((d) => (d.familyRelationships ?? []).some((r: Row) => r.type === "SIBLING" && n(drivers.get(r.driverId)?.totalRaceStarts) > 0)).map((d) => D(d.id)));
group(
  "circuits-named",
  "Circuits named after a driver",
  4,
  KNOWN_CIRCUITS.filter((c) => db.drivers.some((d) => n(d.totalRaceStarts) > 0 && (c.fullName as string).includes(d.lastName) && ((c.fullName as string).includes(d.firstName) || /Hermanos/.test(c.fullName)))).map((c) => `r:${c.id}`),
);
group("champ-final-team", "Won the title in their last season", 4, titles.filter((t) => !seasons.some((s) => s.year > t.year && seasonTeams.get(s.year)?.has(t.driver))).map((t) => D(t.driver)));

// only the tiles some group uses
const used = new Set(groups.flatMap((g) => g.members));
const payload = {
  source: { name: "F1DB", url: "https://github.com/f1db/f1db", release: RELEASE, license: "CC BY 4.0" },
  items: [...items.values()].filter((i) => used.has(i.id)).sort((a, b) => a.id.localeCompare(b.id)),
  groups,
};
writeFileSync(out, `${JSON.stringify(payload)}\n`);
const byLevel = [1, 2, 3, 4].map((l) => groups.filter((g) => g.level === l).length);
console.log(`${payload.items.length} tiles, ${groups.length} groups (by level ${byLevel.join(" / ")}) → ${out}`);

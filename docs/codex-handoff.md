# Handoff: Lapdle (lapdle.com), where we are and what's next

Paste this whole file into Codex as the first message. Updated 17 Nov 2026.

## The project

Lapdle is an anonymous daily F1 browser game site (lapdle.com). Monorepo at `/Users/mi/APEX`:
- `apps/web`: Vite + React + TypeScript + Tailwind, three.js for 3D (`src/game3d/*`), the 2D map game (`src/game/*`),
  pages (`src/content/*`), i18n Spanish strings in `src/i18n/es.ts`.
- `packages/engine`: the deterministic lap simulation (`simulateLap`, `prepareTrack`).
- `supabase/`: migrations and edge functions (`functions/submit-lap/src.ts` bundles the app's schedule and engine).
- `marketing/trailer-src/`: recording and profiling scripts (Playwright), gitignored marketing material.
- Supabase project id `acglshyvgeikyrvjfjue`.

## House rules (must follow)

- Commits are authored by the owner only: NO "Co-Authored-By" line, ever.
- Run `npm run build -w @apex/web` (and `cd apps/web && npx vitest run`) before every commit; tests must not import `node:fs`.
- Every player-visible change gets an entry at the top of `apps/web/src/content/updateList.ts` (/updates).
- Never push, never deploy edge functions, never run production migrations, never post on social media: the owner does
  those. Prepare them and say exactly what to run.
- Any change to `apps/web/src/modes/schedule.ts` (e.g. `PINNED_DAYS`) needs `npm run deploy:functions`, or the server
  refuses that day's laps ("not that day's daily").
- Lapdle stays anonymous (no personal names or emails anywhere public).
- 3D realism bar: it should look like a real F1 game; no low-poly stand-ins.
- Replies to the owner in Romanian, short.

## Waiting on the owner (tell them first)

1. `cd ~/APEX && npm run deploy:functions`: submit-lap was built with the old schedule and refused every Spa lap on
   17 Nov. The client now resends a best line the board never took (Hub and Play), so laps come back as players return.
2. Push all local commits (several today: Spa pin, resend, phone UI, 3D perf, safety net, site-name JSON-LD, AdSense
   paragraphs).
3. AdSense: after 1 and 2, press "Request review" (Sites, lapdle.com). Audit done: 106 pages OK, median ~500 words,
   trust pages, ads.txt fine (AdSense still shows the stale 31 Oct "Not found").
4. Search Console: URL inspection, `https://lapdle.com/`, Request indexing (new WebSite/Organization data for the
   "Lapdle" site name).

## Main task in progress: make the 3D lap load smoothly on any phone/browser

A player's phone froze ~40 s with 3D on. The owner wants 3D kept ON by default and made fast, not switched off.

Measure with `marketing/trailer-src/profile-build.mjs` (Playwright, iPhone-sized page, CPU throttled 6x, CDP profiler,
prints long tasks and top self-time functions). Profile an unminified production build:
`cd apps/web && npx vite build --minify false`, then serve with the `apex-web-build` preview (port 4173), then
`cd marketing/trailer-src && node profile-build.mjs spa`. Rebuild minified afterwards.

Done so far (commits f7e7da6, 5cc559b): long-task total 25 s to 16 s, worst 12 s to 6.5 s at 6x CPU.
- `circuitWorld.ts` `nearestIndex`: dense numeric grid plus a ring search with early exit (was string keys).
- Distance field from every 4th centre-line point.
- Forest planting by scanline spans instead of point-in-polygon per tree.
- `textures.ts` `loadPicture`: ImageBitmapLoader (off-main-thread decode) with fallback.
- `MeshoptDecoder.useWorkers(2)` in `carF1.ts`.
- Safety net: `Lap3D` `onTooSlow` (a long task over 6 s, or under ~15 fps for 2 s) hands the lap to the 2D map for
  this visit only, with a note (`Play.tsx`).

New reports from the owner's Samsung S24 (after the above), fix these FIRST:
- Dragging the map before Lights out lags (delays). Likely the 3D scene building/warming while the player is still
  on the map (`Lap3D` mounts with the game in setup: `LapScene.create`, `warm()`, `LapSound.start`, plus Play's
  2D materials). Make that work yield (chunks between frames, `requestIdleCallback`) or start it only after the
  first interaction settles; keep the map's own render loop smooth.
- Lights out needs two taps. Check whether the first tap lands during a long task, or is eaten by the document
  `pointerup` capture listener in `Lap3D.tsx` (it resumes audio), or by the `[&>*]:pointer-events-auto` controls column
  in `Play.tsx` ViewControls, or by the bottom sheet's drag handling. Reproduce with a Playwright touch tap on an
  emulated phone and fix the root cause.
- During the lap, the 3D still stutters on the S24: measure fps on the emulated phone with the CPU throttled and cut
  per-frame cost on `detail === "lite"` (post passes, shadow map size, rain count, tree impostors).

Remaining, in order of expected gain:
1. The 2D map's procedural materials (`apps/web/src/game/materials.ts`: grass, asphalt, gravel, concrete, water,
   macro, cloudShadows, roofTiles, roofMembrane; fbm value noise at 512 px) cost ~4.5 s at 6x on every game load (2D and 3D).
   Bake them once to WebP files (a Playwright dev script that calls each memo with every argument combination actually
   used: `src/game/scenery.ts` trackMaterials, `src/game/surroundings.ts` worldMaterials per track and wet,
   `src/game/buildings.ts`, `src/game3d/textures.ts`), load them asynchronously before the Game is built (Play.tsx's
   `Promise.all` that loads the track) and seed the memo caches; keep the generators as a fallback.
2. `LapSound.start` (~0.6 to 1.5 s): AudioContext creation plus a 3 s noise buffer of Math.random on the main thread;
   generate the noise smaller or lazily, keep creating the context early (it was moved there on purpose).
3. `buildCircuitWorld` itself (~0.6 s self time plus geometry) runs in one go: split it into chunks yielding to the
   event loop (await a frame between sections), so no single task exceeds ~200 ms on a phone.
4. Canvas textures: ~19 materials share 1024x256 canvases and ~15 at 512x512 (stands, boards); check for duplicates
   that could share one texture; on `detail === "lite"` halve canvas sizes.
5. On lite, review the shadow map (2048), city cap (2500 blocks, Interlagos only) and the post chain.
6. Then measure real fps on a phone (ask the owner to test `lapdle.com` on Interlagos/Spa).

## Other open items

- TV cameras can be blocked by trees (`lapScene.ts` `sightClear` only tests OSM building footprints).
- Livery upload (promised in a video, build once enough players invite): the car has NO UVs, so a texture atlas from
  another game can't map. Plan: a downloadable template of our car (side and top orthographic outlines), the player
  pastes any livery onto it, uploads in the garage, we project side/top in the body shader (zone shader in `carF1.ts`,
  `vZonePos` in the rig frame), stored on the device only (never shared), with Remove and Download template buttons.
  Unlock: three friends who played (`unlocks().friends >= 3` in `src/community.ts`).
- Corner 3D view: style differences (~1 m) are invisible from the chase camera; consider a higher camera.
- 13 per-circuit trivia pages are short (~170 words); add original text if AdSense rejects again.
- Engine sound: loops in `apps/web/src/game3d/assets/engine/*.wav` cut from a FOM onboard (takedown risk accepted by
  the owner); top loops come from steady stretches; crossfade in `lapSound.ts` (`layerWeights`, tested).

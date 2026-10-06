import { useEffect, useMemo, useRef, useState } from "react";
import type { GameTrack } from "@apex/engine";
import { HowToPlay } from "./HowToPlay";
import { AdBelow } from "./Ads";
import { FinishCard } from "./FinishCard";
import { NextToday } from "./NextToday";
import { gameFinished, gameStarted } from "../games/events";
import { Camera } from "../game/camera";
import { loadScenery, loadTrack } from "../game/catalog";
import { Surroundings } from "../game/surroundings";
import { CIRCUITS, circuit } from "../modes/circuits";
import { dailyNumber } from "../modes/daily";
import {
  AERIAL_TRIES,
  CONTINENT_AFTER,
  COUNTRY_AFTER,
  VIEW_WIDTHS,
  aerialCircuit,
  aerialGuesses,
  aerialOver,
  aerialShare,
  aerialSolved,
  aerialSpot,
  aerialStats,
  recordAerialGuess,
} from "../modes/aerial";
import { primaryBtn } from "./styles";

const GROUND = "#466636";

interface Scene {
  world: Surroundings;
  centerline: [number, number][];
  box: [number, number, number, number];
  spot: [number, number];
}

/**
 * Aerial view: guess the circuit from its surroundings, seen from above and
 * drawn from map data without the track. Each wrong guess pulls the view
 * out; solving it (or running out) shows the whole area with the circuit drawn in.
 */
export function AerialView() {
  const id = useMemo(() => aerialCircuit(), []);
  const [scene, setScene] = useState<Scene | null>(null);
  const [failed, setFailed] = useState(false);
  const [guesses, setGuesses] = useState<string[]>(() => aerialGuesses());
  const over = aerialOver(guesses);
  const solved = aerialSolved(guesses);
  const [finish, setFinish] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const cam = useRef(new Camera());
  const raf = useRef(0);

  // the circuit's map data and centreline (the track itself is never drawn until the end)
  useEffect(() => {
    let live = true;
    Promise.all([loadTrack(id), loadScenery(id)])
      .then(([t, osm]: [GameTrack, Awaited<ReturnType<typeof loadScenery>>]) => {
        if (!live) return;
        if (!osm) return setFailed(true);
        const centerline = t.centerline as [number, number][];
        const world = new Surroundings(osm, id, centerline.filter((_, i) => i % 10 === 0));
        world.showRaceway = false;
        const { at, offset } = aerialSpot();
        const i = Math.floor(at * centerline.length);
        const [ax, ay] = centerline[i];
        const [bx, by] = centerline[(i + 5) % centerline.length];
        const len = Math.hypot(bx - ax, by - ay) || 1;
        // a little to one side of the track, so it isn't simply down the middle
        const spot: [number, number] = [ax + (-(by - ay) / len) * offset, ay + ((bx - ax) / len) * offset];
        setScene({ world, centerline, box: osm.box, spot });
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [id]);

  // the view for the number of guesses made: closer to the spot early, the whole map at the end
  const stage = over ? VIEW_WIDTHS.length - 1 : Math.min(guesses.length, VIEW_WIDTHS.length - 1);

  const draw = () => {
    const c = canvas.current;
    if (!c || !scene) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cm = cam.current;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = GROUND;
    ctx.fillRect(0, 0, c.width, c.height);
    cm.apply(ctx, dpr);
    const px = 1 / cm.scale;
    const [x0, y0, x1, y1] = scene.box;
    ctx.fillStyle = GROUND;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    scene.world.draw(ctx, px);
    if (px < 3) scene.world.drawLandmarks(ctx);
    if (over) {
      // the answer: the circuit drawn in over its surroundings
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      scene.centerline.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.strokeStyle = "rgba(10,11,13,0.6)";
      ctx.lineWidth = Math.max(16, 9 * px);
      ctx.stroke();
      ctx.strokeStyle = solved ? "#29cc6a" : "#ff6a13";
      ctx.lineWidth = Math.max(9, 4.5 * px);
      ctx.stroke();
    }
  };

  // size the canvas, aim the camera for this stage, and animate between stages
  useEffect(() => {
    const c = canvas.current;
    if (!c || !scene) return;
    const cm = cam.current;
    const fit = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.round(c.clientWidth * dpr);
      c.height = Math.round(c.clientHeight * dpr);
      cm.w = c.clientWidth;
      cm.h = c.clientHeight;
    };
    fit();
    const [x0, y0, x1, y1] = scene.box;
    const width = VIEW_WIDTHS[stage] ?? Math.max(x1 - x0, y1 - y0);
    // the view drifts from the spot towards the middle of the map as it pulls out
    const k = stage / (VIEW_WIDTHS.length - 1);
    const tx = scene.spot[0] + ((x0 + x1) / 2 - scene.spot[0]) * k;
    const ty = scene.spot[1] + ((y0 + y1) / 2 - scene.spot[1]) * k;
    const scale = cm.w / width;
    const first = cm.scale === 1 && cm.x === 0;
    cm.animateTo(tx, ty, scale, 0, first ? 0 : 900);
    const loop = (now: number) => {
      const moving = cm.tick(now);
      draw();
      if (moving) raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    const ro = new ResizeObserver(() => {
      fit();
      cm.scale = cm.w / width;
      draw();
    });
    ro.observe(c);
    return () => {
      cancelAnimationFrame(raf.current);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, stage, over]);

  const guess = (g: string) => {
    if (over) return;
    if (guesses.length === 0) gameStarted("aerial", "daily");
    const next = recordAerialGuess(g);
    setGuesses(next);
    if (aerialOver(next)) {
      gameFinished("aerial", "daily", { solved: aerialSolved(next), guesses: next.length });
      window.setTimeout(() => setFinish(true), 1800);
    }
  };

  const answer = circuit(id);
  const misses = guesses.filter((g) => g !== id).length;
  const st = aerialStats();
  const shownWidth = VIEW_WIDTHS[stage];

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1080px] px-4 pt-4 pb-12 md:px-8 md:pt-6 lg:pt-10">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="wide text-[clamp(26px,6vw,52px)] leading-none text-paint">Aerial view</h1>
              <HowToPlay game="aerial" />
            </div>
            <p className="mt-1.5 text-[14px] text-steel md:mt-2 md:text-[15px]">
              Which circuit is down there?<span className="hidden md:inline"> Every wrong guess pulls the view further out.</span>
            </p>
          </div>
          <p className="shrink-0 text-right">
            <span className="wide num block text-[22px] leading-none text-paint md:text-[26px]">
              {Math.min(guesses.length + (over ? 0 : 1), AERIAL_TRIES)}
              <span className="text-steel">/{AERIAL_TRIES}</span>
            </span>
            <span className="caption mt-1 block">Guess</span>
          </p>
        </div>

        <div className="mt-4 grid items-start gap-4 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:gap-8">
          {/* phones: the view sized so the answers fit under it on one screen */}
          <figure className="relative mx-auto w-full max-w-[min(100%,44dvh)] md:max-w-none">
            <canvas ref={canvas} className="block aspect-square w-full border border-line bg-board" aria-label={over ? `${answer.name} from above, with the circuit drawn in` : "The circuit's surroundings from above, without the track"} />
            {!scene && (
              <p className="absolute inset-0 grid place-items-center text-[14px] text-steel">{failed ? "The map couldn't be loaded. Check your connection and open the page again." : "Loading the map…"}</p>
            )}
            <figcaption className="mt-1.5 flex justify-between gap-2 text-[11px] text-steel md:text-[12px]">
              <span>{shownWidth ? `About ${shownWidth >= 1000 ? `${(shownWidth / 1000).toFixed(1)} km` : `${shownWidth} m`} across, north up` : "The whole area, north up"}</span>
              <span>Map data © OpenStreetMap contributors</span>
            </figcaption>
          </figure>

          <div>
            {!over && (misses >= CONTINENT_AFTER || misses >= COUNTRY_AFTER) && (
              <p className="rise mb-3 border-l-2 border-ink bg-board/70 px-3 py-2 text-[14px] text-paint/90">
                Hint: it's in {misses >= COUNTRY_AFTER ? `${answer.flag} ${answer.country}` : answer.continent}.
              </p>
            )}
            {over ? (
              <div className="rise">
                <p className="wide text-[clamp(24px,5vw,36px)] leading-none text-paint">{solved ? (guesses.length === 1 ? "First look!" : `${answer.name} in ${guesses.length}`) : `It was ${answer.name}`}</p>
                <p className="mt-2 text-[15px] text-paint/85">
                  {answer.flag} {answer.country}. A new view tomorrow.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button className={primaryBtn} onClick={() => setFinish(true)}>
                    See result
                  </button>
                  <NextToday />
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-[15px] font-semibold text-paint">Your guess</h2>
                <ul className="mt-2 grid grid-cols-3 gap-1.5 md:grid-cols-2">
                  {CIRCUITS.map((c) => {
                    const used = guesses.includes(c.id);
                    return (
                      <li key={c.id}>
                        <button
                          disabled={used || !scene}
                          onClick={() => guess(c.id)}
                          className="guess-chip h-full w-full border border-line bg-board/70 px-2 py-2 text-left text-[13px] leading-tight font-semibold break-words text-paint disabled:text-steel/50 disabled:line-through md:px-3 md:py-2.5 md:text-[14px]"
                        >
                          {c.name}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>

      <AdBelow />

      {finish && over && (
        <FinishCard
          game="aerial"
          eyebrow={`Aerial view #${dailyNumber()}`}
          title={solved ? (guesses.length === 1 ? "First look!" : "Spotted it") : "Not this time"}
          tone={solved ? "win" : "loss"}
          value={`${solved ? guesses.length : "X"}/${AERIAL_TRIES}`}
          valueLabel="guesses"
          message={`It was ${answer.name}, ${answer.country}.`}
          stats={[
            ["Played", String(st.played)],
            ["Solved", String(st.solved)],
            ["Average", st.average !== null ? st.average.toFixed(1) : "-"],
          ]}
          shareText={aerialShare(guesses, `${location.origin}/aerial`)}
          daily="aerial view"
          onClose={() => setFinish(false)}
        />
      )}
    </div>
  );
}

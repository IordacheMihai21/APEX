import { useEffect, useRef, useState } from "react";
import { isChampion, loadGarage, numberToday } from "../game3d/garage";
import { t } from "../i18n";
import { type Game, PLAYBACK_SPEED } from "../game/game";
import { type LapCamera, LapScene } from "../game3d/lapScene";
import { LapSound } from "../game3d/lapSound";

const CAMERAS: LapCamera[] = ["chase", "tcam", "cockpit", "tv"];
const CAMERA_NAME: Record<LapCamera, string> = { chase: "Chase", tcam: "T-cam", cockpit: "Cockpit", tv: "TV" };
/** the 3D lap's playback: real time, or twice as fast (the map's own replay runs at PLAYBACK_SPEED) */
const SPEEDS = [1, 2];
const SPEED_KEY = "apex.lap3d.speed";
const savedSpeed = () => {
  try {
    const x = Number(localStorage.getItem(SPEED_KEY));
    return SPEEDS.includes(x) ? x : 1;
  } catch {
    return 1;
  }
};

/**
 * The Daily Quali lap in 3D, over the map while the lap runs: game3d/lapScene.ts draws the circuit and the car on the
 * game's own race clock, so the timing tower and the sectors above stay in step. A button cycles the cameras.
 * Loaded only when the player watches in 3D, with three.js.
 */
export default function Lap3D({ game, visible, onTooSlow }: { game: Game; visible: boolean; onTooSlow?: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [scene, setScene] = useState<LapScene | null>(null);
  const [cam, setCam] = useState<LapCamera>("chase");
  const [failed, setFailed] = useState(false);
  const sound = useRef<LapSound | null>(null);
  const [muted, setMuted] = useState(false);
  const [ghostName, setGhostName] = useState<string | null>(null);
  const [speed, setSpeed] = useState(savedSpeed);

  // a lap that freezes for seconds is better off continuing on the map
  useEffect(() => {
    if (!scene || !visible) return;
    if (typeof PerformanceObserver === "undefined" || !PerformanceObserver.supportedEntryTypes?.includes("longtask")) return;
    const watch = new PerformanceObserver((list) => {
      if (list.getEntries().some((e) => e.duration > 6000)) {
        watch.disconnect();
        onTooSlow?.();
      }
    });
    watch.observe({ type: "longtask" });
    return () => watch.disconnect();
  }, [scene, visible, onTooSlow]);

  useEffect(() => {
    let live = true;
    let made: LapScene | null = null;
    const debug = new URLSearchParams(location.search).has("perf") || (window as Window & { __lap3dDebug?: boolean }).__lap3dDebug === true;
    const mark = (stage: string) => { if (debug) performance.mark(`lap3d:${stage}`); };
    // the session's hour changes from day to day (the same for everyone on a day): midday, afternoon, qualifying
    // time or the golden evening light
    const day = Math.floor(Date.now() / 86400000);
    const hour = [12, 15, 16.8, 18.6][day % 4];
    const mine = loadGarage();
    mark("create-start");
    LapScene.create(canvas.current!, game.track.id, game.condition, hour, mine)
      .then(async (s) => {
        mark("create-done");
        if (!live) return s.dispose();
        made = s;
        // your number; number 1 if you set yesterday's fastest lap (and want it)
        s.setCarNumber(numberToday(mine, false));
        void isChampion().then((c) => live && c && s.setCarNumber(numberToday(mine, true)));
        // the audio context too: opening the audio device can hold the page for most of a second, so it's made
        // before the 3D scene appears, silent until a tap lets it play
        let audioReady: Promise<void> = Promise.resolve();
        if (!sound.current) {
          sound.current = new LapSound();
          mark("audio-start");
          audioReady = sound.current.start().then(() => mark("audio-done")).catch(() => mark("audio-error"));
          setMuted(sound.current.isMuted);
          if (import.meta.env.DEV) (window as unknown as { __lapSound: LapSound }).__lapSound = sound.current;
        }
        // Keep the map visible until shaders, textures and audio are ready. A
        // tap during preparation starts the lap without this work on its frames.
        s.resize(canvas.current!.clientWidth, canvas.current!.clientHeight);
        mark("warm-start");
        await Promise.all([s.warm().then(() => mark("warm-done")).catch(() => mark("warm-error")), audioReady]);
        if (!live) return;
        mark("scene-visible");
        setScene(s);
      })
      .catch((error) => {
        mark("create-error");
        if (debug) console.error("Lap3D preparation failed", error);
        if (live) setFailed(true);
      });
    return () => {
      live = false;
      made?.dispose();
    };
  }, [game]);

  useEffect(() => {
    if (!scene) return;
    const el = canvas.current!;
    const ro = new ResizeObserver(() => scene.resize(el.clientWidth, el.clientHeight));
    ro.observe(el);
    scene.resize(el.clientWidth, el.clientHeight);
    let raf = 0;
    let lapOf: unknown = null;
    // too slow to watch: under about 15 frames a second for two seconds of the lap, or one frame held 3 s
    let last = 0;
    let slowFor = 0;
    let gaveUp = false;
    const resetTiming = () => { last = 0; slowFor = 0; };
    document.addEventListener("visibilitychange", resetTiming);
    window.addEventListener("pageshow", resetTiming);
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!visible || document.hidden) {
        sound.current?.fade();
        resetTiming();
        return;
      }
      const now = performance.now();
      if (last) {
        const dt = now - last;
        slowFor = dt > 66 ? slowFor + dt : Math.max(0, slowFor - dt);
        if (!gaveUp && (slowFor > 2000 || dt > 3000)) {
          gaveUp = true;
          onTooSlow?.();
        }
      }
      last = now;
      const lv = game.lapView();
      if (!lv) return;
      if (lv.sim !== lapOf) {
        lapOf = lv.sim;
        scene.setLap(lv.sim, lv.ghost, lv.ghostScale);
        setGhostName(lv.ghostName);
        // the sound starts with the lap (the race button was the tap browsers need)
        sound.current?.resume();
      }
      scene.frame(lv.tMs);
      const tele = scene.telemetry;
      // by the game's phase, not the scene's lap clock: on the first frame of the race that clock still reads 0, and
      // fading then silenced the whole lap until the next tap
      if (lv.phase === "race" || lv.phase === "lights") sound.current?.update(tele.v, tele.along, { distance: tele.cameraDistance, onboard: tele.onboard }, tele.crowdNear);
      else sound.current?.fade();
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", resetTiming);
      window.removeEventListener("pageshow", resetTiming);
    };
  }, [scene, game, visible]);
  useEffect(() => {
    // browsers that only let audio start inside a tap (Safari): the race button's tap wakes it
    const wake = () => sound.current?.resume();
    document.addEventListener("pointerup", wake, true);
    return () => {
      document.removeEventListener("pointerup", wake, true);
      sound.current?.dispose();
    };
  }, []);

  useEffect(() => scene?.setCamera(cam), [scene, cam]);

  // while the 3D lap is on screen, the map underneath needn't be drawn
  useEffect(() => {
    if (!scene || !visible) return;
    game.setCovered(true);
    return () => game.setCovered(false);
  }, [scene, visible, game]);

  // Keep the chosen 3D pace even while its scene is preparing: the temporary
  // map must not race through the lap at 4x before the 3D view can appear.
  useEffect(() => {
    if (!visible || failed) return;
    game.setSpeed(speed);
    return () => game.setSpeed(PLAYBACK_SPEED);
  }, [visible, failed, game, speed]);

  return (
    <div className={`absolute inset-0 ${visible && scene ? "" : "pointer-events-none invisible"}`} aria-hidden={!visible || !scene}>
      <canvas ref={canvas} className="h-full w-full" aria-label={t("The lap in 3D")} />
      {!scene && !failed && visible && <p className="absolute inset-0 grid place-items-center bg-night/70 text-[14px] text-steel">{t("Loading the circuit in 3D…")}</p>}
      {/* broadcast-style: a slim row of chips just above the Skip button (bottom right), so the picture stays the show */}
      {scene && visible && (
        <div className="absolute right-2 bottom-[calc(max(12px,env(safe-area-inset-bottom))+52px)] flex flex-col items-end gap-1.5">
          {ghostName !== null && (
            <p className="wide border border-paint/20 bg-night/65 px-2 py-1 text-[11px] uppercase tracking-wide text-paint backdrop-blur-sm normal-case">{t("Ghost: {name}, the day's fastest", { name: ghostName || t("the leader") })}</p>
          )}
          <div className="flex gap-1.5">
            <button className="wide border border-paint/20 bg-night/65 px-2 py-1 text-[11px] uppercase tracking-wide text-paint backdrop-blur-sm" onClick={() => setCam((c) => CAMERAS[(CAMERAS.indexOf(c) + 1) % CAMERAS.length])} aria-label={`${t("Change camera")}: ${t(CAMERA_NAME[cam])}`}>
              <span className="text-steel">{t("Cam")} </span>
              {t(CAMERA_NAME[cam])}
            </button>
            <button
              className="wide border border-paint/20 bg-night/65 px-2 py-1 text-[11px] uppercase tracking-wide text-paint backdrop-blur-sm"
              onClick={() => {
                const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
                setSpeed(next);
                try {
                  localStorage.setItem(SPEED_KEY, String(next));
                } catch {
                  // private mode: the choice lasts the visit
                }
              }}
              aria-label={`${t("Change speed")}: ${speed === 1 ? t("real time") : `${speed}×`}`}
            >
              {speed}×
            </button>
            <button
              className={`wide border border-paint/20 bg-night/65 px-2 py-1 text-[11px] uppercase tracking-wide text-paint backdrop-blur-sm ${muted ? "text-steel line-through" : ""}`}
              onClick={() => {
                const next = !muted;
                sound.current?.setMuted(next);
                setMuted(next);
              }}
              aria-pressed={!muted}
              aria-label={muted ? t("Sound: off") : t("Sound: on")}
            >
              {t("Sound")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

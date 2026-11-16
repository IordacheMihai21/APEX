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
export default function Lap3D({ game, visible }: { game: Game; visible: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [scene, setScene] = useState<LapScene | null>(null);
  const [cam, setCam] = useState<LapCamera>("chase");
  const [failed, setFailed] = useState(false);
  const sound = useRef<LapSound | null>(null);
  const [muted, setMuted] = useState(false);
  const [ghostName, setGhostName] = useState<string | null>(null);
  const [speed, setSpeed] = useState(savedSpeed);

  useEffect(() => {
    let live = true;
    let made: LapScene | null = null;
    // the session's hour changes from day to day (the same for everyone on a day): midday, afternoon, qualifying
    // time or the golden evening light
    const day = Math.floor(Date.now() / 86400000);
    const hour = [12, 15, 16.8, 18.6][day % 4];
    const mine = loadGarage();
    LapScene.create(canvas.current!, game.track.id, game.condition, hour, mine)
      .then((s) => {
        if (!live) return s.dispose();
        made = s;
        // your number; number 1 if you set yesterday's fastest lap (and want it)
        s.setCarNumber(numberToday(mine, false));
        void isChampion().then((c) => live && c && s.setCarNumber(numberToday(mine, true)));
        setScene(s);
        // compile and upload while the line is being drawn, so the lap starts without a freeze
        void s.warm().catch(() => {});
        // the audio context too: opening the audio device can hold the page for most of a second, so it's made
        // now, silent until the race button (a tap) lets it play
        if (!sound.current) {
          sound.current = new LapSound();
          void sound.current.start();
          setMuted(sound.current.isMuted);
          if (import.meta.env.DEV) (window as unknown as { __lapSound: LapSound }).__lapSound = sound.current;
        }
      })
      .catch(() => live && setFailed(true));
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
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!visible) {
        sound.current?.fade();
        return;
      }
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

  // the 3D lap plays at the speed picked here (real time by default); the map goes back to its fast replay
  useEffect(() => {
    if (!scene || !visible) return;
    game.setSpeed(speed);
    return () => game.setSpeed(PLAYBACK_SPEED);
  }, [scene, visible, game, speed]);

  return (
    <div className={`absolute inset-0 ${visible ? "" : "pointer-events-none invisible"}`} aria-hidden={!visible}>
      <canvas ref={canvas} className="h-full w-full" aria-label={t("The lap in 3D")} />
      {!scene && !failed && visible && <p className="absolute inset-0 grid place-items-center bg-night/70 text-[14px] text-steel">{t("Loading the circuit in 3D…")}</p>}
      {/* one column above the Skip button (RaceHud: 112 px up on a phone, 12 px on a computer), so nothing overlaps */}
      {scene && visible && (
        <div className="absolute right-3 bottom-[calc(max(12px,env(safe-area-inset-bottom))+56px)] flex flex-col items-end gap-2 max-[520px]:bottom-[164px]">
          {ghostName !== null && (
            <p className="border border-paint/25 bg-night/70 px-3 py-1.5 text-[13px] font-semibold text-paint backdrop-blur-sm">
              {t("Ghost: {name}, the day's fastest", { name: ghostName || t("the leader") })}
            </p>
          )}
          <button
            className="border border-paint/25 bg-night/70 px-3 py-2 text-[13px] font-semibold text-paint backdrop-blur-sm"
            onClick={() => {
              const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
              setSpeed(next);
              try {
                localStorage.setItem(SPEED_KEY, String(next));
              } catch {
                // private mode: the choice lasts the visit
              }
            }}
            aria-label={t("Change speed")}
          >
            {t("Speed")}: {speed === 1 ? t("real time") : `${speed}×`}
          </button>
          <button
            className="border border-paint/25 bg-night/70 px-3 py-2 text-[13px] font-semibold text-paint backdrop-blur-sm"
            onClick={() => {
              const next = !muted;
              sound.current?.setMuted(next);
              setMuted(next);
            }}
            aria-pressed={!muted}
          >
            {muted ? t("Sound: off") : t("Sound: on")}
          </button>
          <button className="border border-paint/25 bg-night/70 px-3 py-2 text-[13px] font-semibold text-paint backdrop-blur-sm" onClick={() => setCam((c) => CAMERAS[(CAMERAS.indexOf(c) + 1) % CAMERAS.length])} aria-label={t("Change camera")}>
            {t("Camera")}: {t(CAMERA_NAME[cam])}
          </button>
        </div>
      )}
    </div>
  );
}

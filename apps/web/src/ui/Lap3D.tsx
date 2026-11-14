import { useEffect, useRef, useState } from "react";
import { t } from "../i18n";
import type { Game } from "../game/game";
import { type LapCamera, LapScene } from "../game3d/lapScene";

const CAMERAS: LapCamera[] = ["chase", "cockpit", "tv"];
const CAMERA_NAME: Record<LapCamera, string> = { chase: "Chase", cockpit: "Cockpit", tv: "TV" };

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

  useEffect(() => {
    let live = true;
    let made: LapScene | null = null;
    LapScene.create(canvas.current!, game.track.id, game.condition)
      .then((s) => {
        if (!live) return s.dispose();
        made = s;
        setScene(s);
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
      if (!visible) return;
      const lv = game.lapView();
      if (!lv) return;
      if (lv.sim !== lapOf) {
        lapOf = lv.sim;
        scene.setLap(lv.sim, lv.ghost, lv.ghostScale);
      }
      scene.frame(lv.tMs);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [scene, game, visible]);

  useEffect(() => scene?.setCamera(cam), [scene, cam]);

  return (
    <div className={`absolute inset-0 ${visible ? "" : "pointer-events-none invisible"}`} aria-hidden={!visible}>
      <canvas ref={canvas} className="h-full w-full" aria-label={t("The lap in 3D")} />
      {!scene && !failed && visible && <p className="absolute inset-0 grid place-items-center bg-night/70 text-[14px] text-steel">{t("Loading the circuit in 3D…")}</p>}
      {scene && visible && (
        <button
          className="absolute right-3 bottom-[max(120px,22%)] border border-paint/25 bg-night/70 px-3 py-2 text-[13px] font-semibold text-paint backdrop-blur-sm"
          onClick={() => setCam((c) => CAMERAS[(CAMERAS.indexOf(c) + 1) % CAMERAS.length])}
          aria-label={t("Change camera")}
        >
          {t("Camera")}: {t(CAMERA_NAME[cam])}
        </button>
      )}
    </div>
  );
}

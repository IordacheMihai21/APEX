import { useEffect, useRef, useState } from "react";
import type { LineStyle } from "@apex/engine";
import type { Game } from "../game/game";
import { CornerScene } from "../game3d/cornerScene";
import { poseAt } from "../game/stretch";
import type { CornerData } from "../modes/makeCorner";
import { C } from "../game/palette";
import { t } from "../i18n";
import { track } from "../analytics";
import { ChevronRight } from "./icons";
import { primaryBtn, secondaryBtn } from "./styles";

const STYLES: [LineStyle, string][] = [
  ["early", t("Early apex")],
  ["classic", t("Classic")],
  ["late", t("Late apex")],
];

/** A stretch moved into another stretch's coordinates (the scene is built round the first one's apex). */
function shifted(c: CornerData, origin: [number, number]): { x: number[]; y: number[] } {
  const dx = c.origin[0] - origin[0];
  const dy = c.origin[1] - origin[1];
  return { x: c.x.map((v) => v + dx), y: c.y.map((v) => v + dy) };
}

/**
 * The setup screen's 3D view: the selected corner group in 3D, with the player's line painted on the road (and the
 * perfect line, faint, under it), and the car driving it at the speeds the physics gives that line, again and again.
 * Picking a style or another corner here changes the real line, so the 3D view is a way to make the line.
 */
export default function Corner3D({ game, onClose }: { game: Game; onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const scene = useRef<CornerScene | null>(null);
  const origin = useRef<[number, number]>([0, 0]);
  const drive = useRef<{ c: CornerData | null; t: number; hold: number }>({ c: null, t: 0, hold: 0 });
  const [state, setState] = useState<"loading" | "ready" | "nogl">("loading");
  const [snap, setSnap] = useState(game.getSnapshot());
  useEffect(() => {
    const off = game.subscribe(() => setSnap(game.getSnapshot()));
    return () => void off();
  }, [game]);
  const cx = game.controls.complexes[snap.complex];

  // a new scene for each corner group (its surroundings load with it)
  useEffect(() => {
    const c = canvas.current;
    const b = box.current;
    const st = game.cornerStretch();
    if (!c || !b || !st) return;
    let live = true;
    let ro: ResizeObserver | null = null;
    let raf = 0;
    let made: CornerScene | null = null;
    setState("loading");
    origin.current = st.mine.origin;
    drive.current = { c: st.mine, t: 0, hold: 0 };
    if (import.meta.env.DEV) (window as unknown as { __corner3d: unknown }).__corner3d = drive;
    track("Corner 3D", { circuit: game.track.id });
    CornerScene.create(c, st.mine, game.condition).then(
      (s) => {
        if (!live) return s.dispose();
        made = s;
        scene.current = s;
        paint();
        const fit = () => s.resize(b.clientWidth, b.clientHeight);
        fit();
        ro = new ResizeObserver(fit);
        ro.observe(b);
        setState("ready");
        let last = performance.now();
        const loop = (now: number) => {
          const dt = Math.min(0.2, (now - last) / 1000);
          last = now;
          const d = drive.current;
          if (d.c) {
            const pose = poseAt(d.c, d.t);
            const o = shifted(d.c, origin.current);
            const dx = o.x[0] - d.c.x[0];
            const dy = o.y[0] - d.c.y[0];
            s.render({ x: pose.x + dx, y: pose.y + dy, heading: pose.heading, kappa: pose.kappa, s: pose.s }, pose.done ? 0 : pose.speed, pose.braking, dt);
            if (pose.done) {
              d.hold += dt;
              if (d.hold > 1.4) Object.assign(d, { t: 0, hold: 0 });
            } else d.t += dt;
          }
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      },
      () => live && setState("nogl"),
    );
    return () => {
      live = false;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      made?.dispose();
      scene.current = null;
    };
    // one scene per corner group
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.complex]);

  // the lines on the road: yours over the perfect one
  const paint = () => {
    const s = scene.current;
    const st = game.cornerStretch();
    if (!s || !st) return;
    const lines = [];
    if (st.perfect) lines.push({ ...shifted(st.perfect, origin.current), color: "#a259ff", width: 0.4, opacity: 0.7 });
    lines.push({ ...shifted(st.mine, origin.current), color: C.ink, width: 0.55, opacity: 0.95 });
    s.setLines(lines);
    drive.current = { c: st.mine, t: 0, hold: 0 };
  };

  // a new style (or fine-tuning in the 2D view) redraws the line and drives it again
  const lineKey = game.currentKnots().join(",");
  useEffect(() => {
    if (state === "ready") paint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineKey]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const total = game.controls.complexes.length;
  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-night" role="dialog" aria-modal="true" aria-label={t("{corner} in 3D", { corner: cx?.name ?? "" })}>
      <div ref={box} className="relative min-h-0 flex-1">
        <canvas ref={canvas} className="block h-full w-full" />
        {state === "loading" && <p className="absolute inset-0 grid place-items-center text-[15px] text-steel">{t("Loading the corner in 3D…")}</p>}
        {state === "nogl" && <p className="absolute inset-0 grid place-items-center p-6 text-center text-[15px] text-paint">{t("The 3D view needs WebGL, which this browser has turned off.")}</p>}
        <div className="absolute top-0 right-0 left-0 flex items-start justify-between gap-3 bg-gradient-to-b from-night/85 to-transparent p-4">
          <div>
            <p className="caption">{t("Corner {n} of {total}", { n: snap.complex + 1, total })}</p>
            <p className="wide text-[24px] leading-none text-paint">{cx?.name}</p>
            <p className="mt-1.5 flex items-center gap-3 text-[12px] text-paint/80">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-1 w-5" style={{ background: C.ink }} />
                {t("Your line")}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-1 w-5 bg-[#a259ff]" />
                {t("Perfect line")}
              </span>
            </p>
          </div>
          <button onClick={onClose} aria-label={t("Close")} className="grid h-10 w-10 place-items-center text-[26px] leading-none text-paint">
            ×
          </button>
        </div>
      </div>
      <div className="border-t border-line bg-board px-4 pt-3 pb-[max(14px,env(safe-area-inset-bottom))]">
        <div className="grid grid-cols-3 border border-line" role="radiogroup" aria-label={t("Line style")}>
          {STYLES.map(([st, name]) => (
            <button
              key={st}
              role="radio"
              aria-checked={snap.style === st}
              onClick={() => game.applyStyle(st)}
              className={`h-11 border-r border-line text-[13px] font-semibold last:border-r-0 ${snap.style === st ? "bg-paint text-night" : "text-paint/85 hover:bg-graphite"}`}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="mt-2.5 flex gap-2.5">
          <button className={`${secondaryBtn} flex-1`} onClick={() => game.stepComplex(-1)} disabled={snap.complex === 0}>
            {t("Previous corner")}
          </button>
          {snap.complex < total - 1 ? (
            <button className={`${secondaryBtn} flex-1`} onClick={() => game.stepComplex(1)}>
              {t("Next corner")} <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button className={`${primaryBtn} flex-1`} onClick={onClose}>
              {t("Back to the map")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

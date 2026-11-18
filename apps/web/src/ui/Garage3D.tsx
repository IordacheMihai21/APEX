import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { buildPaddock } from "../game3d/paddock";
import { SOFT_RED, buildCarF1, carDetail } from "../game3d/carF1";
import { refreshInvites, useCommunity } from "../community";
import { type Garage, NEON_LIVERY, PULSE_LIVERY, PAINTS, PAINTS2, isChampion, loadGarage, numberToday, saveGarage, validNumber } from "../game3d/garage";
import { syncGarageLook } from "../online";
import { t } from "../i18n";

/**
 * The garage: your car in an F1 pit garage (game3d/paddock.ts), turning slowly until you drag it round, its paint, its
 * second colour and its race number. Kept on this
 * device (others see it once cars are shared, later). Number 1 is only on offer to yesterday's fastest driver.
 */
export function Garage3D({ onClose }: { onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [g, setG] = useState<Garage>(loadGarage);
  // dev builds: set any look from a script (for recordings of liveries the palette doesn't offer)
  if (import.meta.env.DEV) (window as unknown as { __garageSet: typeof setG }).__garageSet = setG;
  const [champion, setChampion] = useState(false);
  const [typed, setTyped] = useState(() => (g.number ? String(g.number) : ""));
  const car = useRef<ReturnType<typeof buildCarF1> | null>(null);
  const look = useRef<((paint: string, number: number | null) => void) | null>(null);
  const { friends } = useCommunity();
  const neonOn = friends >= 3;
  const neonPicked = g.paint === NEON_LIVERY.paint && g.paint2 === NEON_LIVERY.paint2;
  const pulseOn = friends >= 1;
  const pulsePicked = g.paint === PULSE_LIVERY.paint && g.paint2 === PULSE_LIVERY.paint2;

  useEffect(() => { void refreshInvites(); }, []);

  useEffect(() => {
    let live = true;
    void isChampion().then((c) => live && setChampion(c));
    return () => {
      live = false;
    };
  }, []);

  // the pit garage: the car on its floor under the strip lights, turning slowly until you drag it round yourself
  useEffect(() => {
    const el = canvas.current!;
    const renderer = new THREE.WebGLRenderer({ canvas: el, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#1d2025");
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    pmrem.dispose();
    scene.environment = env;
    scene.environmentIntensity = 0.55;
    // the light panels' downlight (no real-time shadows: the paddock paints a soft one under the car)
    const key = new THREE.DirectionalLight("#fff6ea", 2.2);
    key.position.set(1.5, 8, 2.5);
    scene.add(key, new THREE.HemisphereLight("#f4f6fa", "#8a8f96", 0.8));
    const paddock = buildPaddock();
    paddock.setLook(g.paint, numberToday(g, false));
    scene.add(paddock.group);
    look.current = paddock.setLook;
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    const built = buildCarF1(carDetail(), { paint: g.paint, paint2: g.paint2, accent: "#f2f2ee", tyreBand: SOFT_RED });
    built.car.rotation.y = 0.75;
    car.current = built;
    scene.add(built.car);
    // drag the car round on its spot, like a turntable (the camera stays in the garage); up and down tilts the view.
    // It turns slowly by itself until you take it, and again a few seconds after you let go
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let tilt = 0.32;
    let held: { x: number; y: number } | null = null;
    let letGo = -1e9;
    const down = (e: PointerEvent) => {
      held = { x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!held) return;
      built.car.rotation.y += (e.clientX - held.x) * 0.012;
      tilt = THREE.MathUtils.clamp(tilt + (e.clientY - held.y) * 0.003, 0.08, 0.75);
      held = { x: e.clientX, y: e.clientY };
    };
    const up = () => {
      held = null;
      letGo = performance.now();
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    let dist = 8;
    const place = () => {
      camera.position.set(0, 0.45 + dist * Math.sin(tilt), dist * Math.cos(tilt));
      camera.lookAt(0, 0.45, 0);
    };
    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      // the car (about 6 m long, turning) across the frame's width, and its height inside the frame's height
      const tan = Math.tan(THREE.MathUtils.degToRad(15));
      dist = Math.max(3.3 / (tan * camera.aspect), 1.6 / tan);
      camera.updateProjectionMatrix();
      place();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();
    let raf = 0;
    let last = performance.now();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      if (!held && !still && now - letGo > 4000) built.car.rotation.y += ((now - last) / 1000) * 0.3;
      last = now;
      place();
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      built.dispose();
      paddock.dispose();
      env.dispose();
      renderer.dispose();
      car.current = null;
      look.current = null;
    };
    // the garage is built once; changes are applied below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    car.current?.setLook({ paint: g.paint, paint2: g.paint2 });
    car.current?.setNumber(numberToday(g, champion));
    look.current?.(g.paint, numberToday(g, champion));
    saveGarage(g);
    void syncGarageLook();
  }, [g, champion, friends]);

  const pickNumber = (s: string) => {
    const clean = s.replace(/\D/g, "").slice(0, 2);
    setTyped(clean);
    const n = Number(clean);
    setG((x) => ({ ...x, number: validNumber(n) ? n : null }));
  };
  const bad = typed !== "" && !validNumber(Number(typed));

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-night text-paint" style={{ background: "#0a0b0d" }} role="dialog" aria-modal="true" aria-label={t("Garage")}>
      <div className="flex items-center justify-between px-4 pt-4">
        <h2 className="text-[20px] font-black tracking-tight uppercase">{t("Garage")}</h2>
        <button className="border border-paint/25 px-3 py-1.5 text-[13px] font-semibold" onClick={onClose}>
          {t("Done")}
        </button>
      </div>
      <div className="relative min-h-[42vh] w-full flex-1">
        <canvas ref={canvas} className="h-full w-full cursor-grab touch-none active:cursor-grabbing" aria-label={t("Your car")} />
        <p className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 text-[12px] text-steel">{t("Drag to turn the car")}</p>
      </div>
      <div className="mx-auto w-full max-w-[520px] shrink-0 space-y-4 overflow-y-auto px-4 pb-6 max-h-[52vh]">
        <fieldset>
          <legend className="mb-2 text-[12px] font-semibold text-steel uppercase">{t("Paint")}</legend>
          <div className="flex flex-wrap gap-2">
            {PAINTS.map((c) => (
              <button
                key={c}
                className={`h-9 w-9 border-2 ${g.paint === c ? "border-paint" : "border-transparent"}`}
                style={{ background: c }}
                onClick={() => setG((x) => ({ ...x, paint: c }))}
                aria-label={c}
                aria-pressed={g.paint === c}
              />
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-[12px] font-semibold text-steel uppercase">{t("Second colour")}</legend>
          <div className="flex flex-wrap gap-2">
            {PAINTS2.map((c) => (
              <button
                key={c}
                className={`h-9 w-9 border-2 ${g.paint2 === c ? "border-paint" : "border-paint/20"}`}
                style={{ background: c }}
                onClick={() => setG((x) => ({ ...x, paint2: c }))}
                aria-label={c}
                aria-pressed={g.paint2 === c}
              />
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-[12px] font-semibold text-steel uppercase">{t("Special livery")}</legend>
          <div className="mb-3 flex items-center gap-3">
            <button
              className={`h-9 w-16 border-2 ${pulsePicked ? "border-paint" : "border-transparent"} disabled:opacity-35`}
              style={{ background: `linear-gradient(90deg, ${PULSE_LIVERY.paint} 55%, ${PULSE_LIVERY.paint2} 55%)` }}
              disabled={!pulseOn}
              onClick={() => setG((x) => ({ ...x, ...PULSE_LIVERY }))}
              aria-label={t("Pulse livery")}
              aria-pressed={pulsePicked}
            />
            <p className="text-[13px] text-steel">
              {pulseOn ? t("Pulse: unlocked when one invited friend plays.") : <><span>{t("Invite one friend who plays to unlock Pulse.")}</span>{" "}<a className="underline" href="/team">{t("Invite friends")}</a></>}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              className={`h-9 w-16 border-2 ${neonPicked ? "border-paint" : "border-transparent"} disabled:opacity-35`}
              style={{ background: `linear-gradient(90deg, ${NEON_LIVERY.paint} 55%, ${NEON_LIVERY.paint2} 55%)` }}
              disabled={!neonOn}
              onClick={() => setG((x) => ({ ...x, ...NEON_LIVERY }))}
              aria-label={t("Neon livery")}
              aria-pressed={neonPicked}
            />
            <p className="text-[13px] text-steel">
              {neonOn ? t("Neon: yours for bringing three friends.") : (
                <>
                  {t("Bring three friends who play from your link to unlock it.")}{" "}
                  <a className="underline" href="/team">{t("Invite friends")}</a>
                </>
              )}
            </p>
          </div>
        </fieldset>
        <div>
          <label className="mb-2 block text-[12px] font-semibold text-steel uppercase" htmlFor="garage-number">
            {t("Race number")}
          </label>
          <div className="flex items-center gap-3">
            <input
              id="garage-number"
              inputMode="numeric"
              className={`w-20 border bg-transparent px-3 py-2 text-[22px] font-black italic ${bad ? "border-red-500" : "border-paint/30"}`}
              value={typed}
              placeholder="2–99"
              onChange={(e) => pickNumber(e.target.value)}
              aria-invalid={bad}
              aria-describedby="garage-number-help"
            />
            <p id="garage-number-help" className="text-[13px] text-steel">
              {typed === "1" ? t("Number 1 is for yesterday's fastest driver.") : bad ? t("Pick a number from 2 to 99.") : t("From 2 to 99. Number 1 belongs to yesterday's fastest lap.")}
            </p>
          </div>
        </div>
        {champion && (
          <label className="flex items-center gap-2 text-[14px]">
            <input type="checkbox" checked={g.useOne} onChange={(e) => setG((x) => ({ ...x, useOne: e.target.checked }))} />
            {t("You set yesterday's fastest lap: run number 1 today")}
          </label>
        )}
      </div>
    </div>
  );
}

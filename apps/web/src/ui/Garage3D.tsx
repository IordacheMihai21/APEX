import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { buildCarF1, carDetail } from "../game3d/carF1";
import { unlocks } from "../community";
import { type Garage, NEON_LIVERY, PAINTS, PAINTS2, isChampion, loadGarage, numberToday, saveGarage, validNumber } from "../game3d/garage";
import { t } from "../i18n";

/**
 * The garage: your car turning slowly on a stand, its paint, its second colour and its race number. Kept on this
 * device (others see it once cars are shared, later). Number 1 is only on offer to yesterday's fastest driver.
 */
export function Garage3D({ onClose }: { onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [g, setG] = useState<Garage>(loadGarage);
  const [champion, setChampion] = useState(false);
  const [typed, setTyped] = useState(() => (g.number ? String(g.number) : ""));
  const car = useRef<ReturnType<typeof buildCarF1> | null>(null);
  const neonOn = unlocks().friends >= 3;
  const neonPicked = g.paint === NEON_LIVERY.paint && g.paint2 === NEON_LIVERY.paint2;

  useEffect(() => {
    let live = true;
    void isChampion().then((c) => live && setChampion(c));
    return () => {
      live = false;
    };
  }, []);

  // the stand: the car turning under soft studio light
  useEffect(() => {
    const el = canvas.current!;
    const renderer = new THREE.WebGLRenderer({ canvas: el, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    pmrem.dispose();
    scene.environment = env;
    scene.environmentIntensity = 0.8;
    const key = new THREE.DirectionalLight("#ffffff", 2.2);
    key.position.set(3, 6, 4);
    scene.add(key);
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    const built = buildCarF1(carDetail(), { paint: g.paint, paint2: g.paint2, accent: "#f2f2ee", tyreBand: "#f5c518" });
    car.current = built;
    scene.add(built.car);
    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      // the whole car in frame (about 6 m long, turning) whatever the shape of the screen
      const half = Math.atan(Math.tan(THREE.MathUtils.degToRad(15)) * Math.min(1, camera.aspect));
      const dist = 3.3 / Math.tan(half);
      camera.position.set(0, dist * 0.22, dist);
      camera.lookAt(0, 0.35, 0);
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const t0 = performance.now();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      built.car.rotation.y = still ? 0.75 : 0.75 + ((performance.now() - t0) / 1000) * 0.35;
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      built.dispose();
      env.dispose();
      renderer.dispose();
      car.current = null;
    };
    // the stand is built once; changes are applied below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    car.current?.setLook({ paint: g.paint, paint2: g.paint2 });
    car.current?.setNumber(numberToday(g, champion));
    saveGarage(g);
  }, [g, champion]);

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
      <canvas ref={canvas} className="min-h-0 w-full flex-1" aria-label={t("Your car")} />
      <div className="mx-auto w-full max-w-[520px] space-y-4 px-4 pb-6">
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

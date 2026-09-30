"""Fix #4: driver model — the car filters line curvature over a speed-dependent look-ahead."""
import numpy as np
from scipy.ndimage import uniform_filter1d
import sim, corner_fit as C
from sim import fmt
F = C.F
base_curv = F.curvature_stencil

def make_sim(T):
    def simulate_la(p):
        k_raw = base_curv(p, 5.0)
        ds = np.linalg.norm(np.roll(p, -1, 0) - p, axis=1).mean()
        sim.curvature = lambda q: k_raw
        v = sim.simulate(p)[1]
        for _ in range(3):  # fixed point: speed -> window -> curvature -> speed
            win = np.clip(v * T / ds, 1, 60).astype(int)
            k_eff = k_raw.copy()
            for w in np.unique(win):
                if w > 1:
                    sel = win == w
                    k_eff[sel] = uniform_filter1d(k_raw, size=w, mode="wrap")[sel]
            sim.curvature = lambda q, k=k_eff: k
            lap, v, *_ = sim.simulate(p)
        return lap
    return simulate_la

bbox = np.ptp(C.c, axis=0).max()
for T in (0.25, 0.5):
    s = make_sim(T)
    lap = lambda z: s(C.line(z))
    best = lap(C.z_opt)
    print(f"\n== look-ahead T={T}s  (best {fmt(best)})")
    print(f"  centerline +{lap(C.zc)-best:.2f} s")
    for name, shift in [("apex 12 m early", -12), ("apex 12 m late", 12)]:
        idx2 = np.round(np.arange(C.N) - shift/C.ds).astype(int) % C.N
        print(f"  {name:16s} +{s(C.c + np.clip((C.B@C.z_opt)[idx2], -C.HALF, C.HALF)[:,None]*C.nrm)-best:.2f} s")
    for label, pxm in [("real ~7px", 600/bbox), ("3x ~22px", 1800/bbox)]:
        rng = np.random.default_rng(3)
        out = []
        for noise_px in (1, 2, 4):
            nm = noise_px/pxm
            ts = [lap(np.linalg.lstsq(C.B, F.draw(C.B @ C.z_opt, nm, rng), rcond=None)[0]) for _ in range(12)]
            out.append(f"{noise_px}px +{np.mean(ts)-best:.2f}±{np.std(ts):.2f}")
        print(f"  noise {label}: " + " | ".join(out))

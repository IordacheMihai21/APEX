"""Fix #3: represent the player's line by per-corner key points (entry/apex/exit)."""
import json, numpy as np
from scipy.interpolate import CubicSpline
from scipy.optimize import minimize
import sim, fix_test as F   # reuses stencil curvature + helpers (re-runs its prints; ignore)
from sim import simulate, fmt
c, nrm, N, HALF, WIDTH = F.c, F.nrm, F.N, F.HALF, F.WIDTH
ds = np.linalg.norm(np.roll(c, -1, 0) - c, axis=1).mean()

# corner detection on centerline
k = np.abs(F.curvature_stencil(c, 10))
mask = k > 1/250
knots = []
i = 0
regions = []
while i < N:
    if mask[i]:
        j = i
        while j < N and mask[j]: j += 1
        regions.append((i, j-1)); i = j
    else: i += 1
for a, b in regions:
    if (b-a)*ds < 10: continue
    pk = a + int(np.argmax(k[a:b+1]))
    knots += [max(0, a - int(25/ds)), pk, min(N-1, b + int(25/ds))]
knots = sorted(set(knots))
# fill long gaps (straights) sparsely
full = []
for x, y in zip(knots, knots[1:] + [knots[0] + N]):
    full.append(x)
    gap = (y - x) * ds
    for m in range(1, int(gap // 200) + 1):
        full.append(int(x + m * (y - x) / (int(gap // 200) + 1)) % N)
kidx = np.array(sorted(set(full)))
print(f"\n== Corner-knot representation: {len(regions)} corner regions, {len(kidx)} knots")

B = np.empty((N, len(kidx)))
for j in range(len(kidx)):
    e = np.zeros(len(kidx)); e[j] = 1
    B[:, j] = CubicSpline(np.append(kidx, kidx[0] + N), np.append(e, e[0]), bc_type="periodic")(np.arange(N))
def line(z): return c + np.clip(B @ z, -HALF, HALF)[:, None] * nrm
lap = lambda z: simulate(line(z))[0]

zc = np.zeros(len(kidx))
z_opt = minimize(lap, np.linalg.lstsq(B, F.opt_off, rcond=None)[0],
                 bounds=[(-HALF, HALF)]*len(kidx), method="L-BFGS-B", options=dict(maxiter=80)).x
best = lap(z_opt)
print(f"  best achievable in this representation {fmt(best)} (free-form optimum {fmt(F.best)})")
print(f"  centerline +{lap(zc)-best:.2f} s")
# strategy variants: early apex vs late apex at every corner (shift optimum's knots along track)
for name, shift in [("apex everything 12 m early", -12), ("apex everything 12 m late", +12)]:
    idx2 = np.clip(np.round(np.arange(N) - shift/ds).astype(int) % N, 0, N-1)
    print(f"  {name:28s} +{simulate(c + np.clip((B@z_opt)[idx2], -HALF, HALF)[:,None]*nrm)[0]-best:.2f} s")
print(f"  hug inside everywhere        +{lap(np.linalg.lstsq(B, np.clip(-np.sign(F.curvature_stencil(c,10))*HALF*(k>1/400), -HALF, HALF), rcond=None)[0])-best:.2f} s")

bbox = np.ptp(c, axis=0).max()
for label, pxm in [("real scale ~7 px track", 600/bbox), ("3x game scale ~22 px track", 1800/bbox)]:
    rng = np.random.default_rng(3)
    print(f"\n  noise test, {label}")
    for noise_px in (1, 2, 4, 6):
        nm = noise_px / pxm
        ts, offt = [], []
        for _ in range(12):
            drawn = F.draw(B @ z_opt, nm, rng)
            z = np.linalg.lstsq(B, drawn, rcond=None)[0]
            offt.append(np.mean(np.abs(B @ z) > WIDTH/2))
            ts.append(lap(z))
        print(f"    noise {noise_px}px ({nm:4.1f} m): +{np.mean(ts)-best:5.2f} ± {np.std(ts):.2f} s   off-track {100*np.mean(offt):.0f}%")

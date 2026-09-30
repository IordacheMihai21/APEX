"""Run the go/no-go experiments. Usage: python3 experiments.py"""
import time
import json
import numpy as np
from scipy.optimize import minimize
from scipy.interpolate import CubicSpline
from sim import simulate, curvature, fmt, resample_closed
from track import build, WIDTH

N = 1000
HALF = WIDTH / 2 - 1.0  # car half-width margin
c, nrm = build(N)
NODES = 150  # optimisation control nodes (~15 m spacing)
node_idx = np.linspace(0, N, NODES, endpoint=False).astype(int)


def line_from_nodes(z):
    """Smooth periodic offsets from node values -> xy line."""
    t = np.append(node_idx, N)
    cs = CubicSpline(t, np.append(z, z[0]), bc_type="periodic")
    off = np.clip(cs(np.arange(N)), -HALF, HALF)
    return c + off[:, None] * nrm, off


def lap(z):
    return simulate(line_from_nodes(z)[0])[0]


def length(z):
    p = line_from_nodes(z)[0]
    return np.linalg.norm(np.roll(p, -1, 0) - p, axis=1).sum()


def curv2(z):
    return float(np.sum(curvature(line_from_nodes(z)[0]) ** 2))


bounds = [(-HALF, HALF)] * NODES
z0 = np.zeros(NODES)

t = time.perf_counter()
simulate(c)
print(f"single simulation: {1000*(time.perf_counter()-t):.1f} ms (python, N={N})")

lines = {"centerline": z0}
lines["shortest path"] = minimize(length, z0, bounds=bounds, method="L-BFGS-B").x
lines["min curvature"] = minimize(curv2, z0, bounds=bounds, method="L-BFGS-B").x
t = time.perf_counter()
res = minimize(lap, lines["min curvature"], bounds=bounds, method="L-BFGS-B",
               options=dict(maxiter=60))
lines["min time (optimised)"] = res.x
print(f"min-time optimisation: {time.perf_counter()-t:.0f} s, {res.nit} iterations")

results = {}
print("\n== Line comparison (flying lap)")
for name, z in lines.items():
    p, off = line_from_nodes(z)
    lt, v, ds, k = simulate(p)
    results[name] = lt
    print(f"  {name:22s} {fmt(lt)}  len {ds.sum():6.0f} m  "
          f"min {v.min()*3.6:5.1f}  max {v.max()*3.6:5.1f} km/h")
best = results["min time (optimised)"]
for name, lt in results.items():
    print(f"  {name:22s} +{lt-best:.3f} s vs optimum")

# ---------------------------------------------------------- determinism
p_opt = line_from_nodes(lines["min time (optimised)"])[0]
a = [simulate(p_opt)[0] for _ in range(5)]
print(f"\n== Determinism: 5 runs identical -> {len(set(a)) == 1}")

# ---------------------------------------------------------- resolution
print("\n== Resolution sensitivity (optimal line resampled)")
for n in (250, 500, 1000, 2000):
    print(f"  N={n:5d}  {fmt(simulate(resample_closed(p_opt, n))[0])}")

# ---------------------------------------------------------- hand-drawn noise
def smooth_closed(p, n_out, spacing_m):
    """Game input pipeline stand-in: decimate to ~spacing, periodic spline, resample."""
    q = resample_closed(p, max(8, int(round(np.linalg.norm(np.roll(p, -1, 0) - p, axis=1).sum() / spacing_m))))
    q = np.vstack([q, q[:1]])
    t = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(q, axis=0), axis=1))])
    cs = CubicSpline(t, q, bc_type="periodic")
    return resample_closed(cs(np.linspace(0, t[-1], 10 * n_out, endpoint=False)), n_out)


def draw(base_off, noise_m, rng):
    """Simulate a finger tracing an intended line: wobble + jitter, in metres."""
    s = np.arange(N)
    wob = np.zeros(N)
    for _ in range(6):  # low-frequency wobble (arm), 30-120 m wavelength
        wl = rng.uniform(15, 55)
        wob += np.sin(2 * np.pi * s / wl + rng.uniform(0, 6.3))
    wob *= noise_m / np.std(wob)
    jit = rng.normal(0, noise_m * 0.5, N)  # high-frequency jitter (finger/pixels)
    off = base_off + wob + jit
    return c + off[:, None] * nrm, off


rng = np.random.default_rng(42)
bbox = np.ptp(c, axis=0).max()
print(f"\n== Hand-drawn input (track bbox {bbox:.0f} m, width {WIDTH} m)")
print("   phone: longest side ~600 css px ->", f"{bbox/600:.2f} m/px, track = {WIDTH/(bbox/600):.1f} px wide")
base = line_from_nodes(lines["min time (optimised)"])[1]
for noise_px in (1, 2, 4, 8):
    noise_m = noise_px * bbox / 600
    for spacing in (5, 15, 30):
        raw_t, sm_t, off_frac = [], [], []
        for _ in range(8):
            p, off = draw(base, noise_m, rng)
            raw_t.append(simulate(p)[0])
            ps = smooth_closed(p, N, spacing)
            sm_t.append(simulate(ps)[0])
            # how much of the smoothed line leaves the track (validation)
            d = np.einsum("ij,ij->i", ps - c, nrm)  # approx lateral offset
            off_frac.append(np.mean(np.abs(d) > WIDTH / 2))
        print(f"  noise {noise_px}px ({noise_m:4.1f} m) smooth {spacing:2d} m: "
              f"raw +{np.mean(raw_t)-best:6.2f} s | smoothed +{np.mean(sm_t)-best:5.2f} "
              f"± {np.std(sm_t):.2f} s | off-track {100*np.mean(off_frac):4.1f}% of line")

json.dump({k: v.tolist() for k, v in lines.items()}, open("lines.json", "w"))

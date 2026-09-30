"""Test fixes: (1) fixed-metre curvature stencil, (2) offset-space least-squares smoothing."""
import json, numpy as np
from scipy.interpolate import CubicSpline
import sim
from sim import simulate, fmt, resample_closed
from track import build, WIDTH

def curvature_stencil(p, h_m=5.0):
    ds = np.linalg.norm(np.roll(p, -1, 0) - p, axis=1).mean()
    k = max(1, int(round(h_m / ds)))
    a, b, c = np.roll(p, k, 0), p, np.roll(p, -k, 0)
    ab, bc, ca = b - a, c - b, a - c
    cross = ab[:, 0]*bc[:, 1] - ab[:, 1]*bc[:, 0]
    return 2*cross / (np.linalg.norm(ab,axis=1)*np.linalg.norm(bc,axis=1)*np.linalg.norm(ca,axis=1))
sim.curvature = curvature_stencil  # simulate() looks it up at call time

N = 1000; HALF = WIDTH/2 - 1
c, nrm = build(N)
lines = json.load(open("lines.json"))
node_idx = np.linspace(0, N, 150, endpoint=False).astype(int)
def from_nodes(z):
    cs = CubicSpline(np.append(node_idx, N), np.append(z, z[0]), bc_type="periodic")
    return np.clip(cs(np.arange(N)), -HALF, HALF)

opt_off = from_nodes(np.array(lines["min time (optimised)"]))
p_opt = c + opt_off[:, None]*nrm
best = simulate(p_opt)[0]
print("== Resolution with 5 m stencil")
for n in (250, 500, 1000, 2000, 4000):
    print(f"  N={n:5d} {fmt(simulate(resample_closed(p_opt, n))[0])}")
for name, z in lines.items():
    print(f"  {name:22s} {fmt(simulate(c + from_nodes(np.array(z))[:,None]*nrm)[0])}")

def fit_offsets(off, knot_m):
    """Least-squares periodic spline in (distance, lateral offset) space."""
    nk = max(8, int(round(N*2.22/knot_m)))
    kidx = np.linspace(0, N, nk, endpoint=False)
    # basis: periodic cubic spline through unit vectors at knots
    B = np.empty((N, nk))
    for j in range(nk):
        e = np.zeros(nk); e[j] = 1
        B[:, j] = CubicSpline(np.append(kidx, N), np.append(e, e[0]), bc_type="periodic")(np.arange(N))
    z, *_ = np.linalg.lstsq(B, off, rcond=None)
    return B @ z

def draw(base, noise_m, rng):
    s = np.arange(N); wob = np.zeros(N)
    for _ in range(6):
        wob += np.sin(2*np.pi*s/rng.uniform(15, 55) + rng.uniform(0, 6.3))
    return base + wob*noise_m/np.std(wob) + rng.normal(0, noise_m*0.5, N)

def run(scale_label, bbox_px_per_m, knots=(20, 40, 60)):
    rng = np.random.default_rng(7)
    print(f"\n== Offset-space smoothing, {scale_label}")
    center_t = simulate(c)[0]
    print(f"  (reference: centerline +{center_t-best:.2f} s, min-curvature +{simulate(c+from_nodes(np.array(lines['min curvature']))[:,None]*nrm)[0]-best:.2f} s)")
    for noise_px in (1, 2, 4, 6):
        nm = noise_px / bbox_px_per_m
        row = []
        for km in knots:
            ts, offt = [], []
            for _ in range(10):
                o = fit_offsets(draw(opt_off, nm, rng), km)
                offt.append(np.mean(np.abs(o) > WIDTH/2))
                ts.append(simulate(c + np.clip(o, -HALF, HALF)[:, None]*nrm)[0])
            row.append(f"{km}m knots +{np.mean(ts)-best:5.2f}±{np.std(ts):.2f}s off{100*np.mean(offt):3.0f}%")
        print(f"  noise {noise_px}px ({nm:4.1f} m): " + " | ".join(row))

bbox = np.ptp(c, axis=0).max()
run(f"real scale (track {WIDTH/(bbox/600):.0f} px wide on phone)", 600/bbox)
run("game scale: track drawn 3x wider on screen (~22 px)", 3*600/bbox)

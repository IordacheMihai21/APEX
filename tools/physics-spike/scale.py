import numpy as np, corner_fit as C
from sim import simulate
bbox = np.ptp(C.c, axis=0).max()
best = C.best
print("\n== Required on-screen track width (corner-knot input, no look-ahead)")
print("   skill reference: centerline +2.21 s, early apex +1.01 s, late apex +0.75 s")
for mult in (3, 5, 8):
    pxm = mult*600/bbox
    rng = np.random.default_rng(11); out = []
    for noise_px in (2, 4, 6):
        ts = [C.lap(np.linalg.lstsq(C.B, C.F.draw(C.B @ C.z_opt, noise_px/pxm, rng), rcond=None)[0]) for _ in range(12)]
        out.append(f"{noise_px}px +{np.mean(ts)-best:.2f}±{np.std(ts):.2f}")
    print(f"  track {C.WIDTH*pxm:3.0f} px wide: " + " | ".join(out))

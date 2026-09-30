"""Original test circuit 'Kestrel' (~3 km, counter-clockwise, 12 m wide).

Features: long main straight -> hairpin (T1) -> medium right-left -> fast
sweeper -> tight left onto the main straight (exit speed matters).
"""
import numpy as np
from sim import closed_spline, normals, curvature

WIDTH = 12.0
CONTROL = [
    (0, 0), (300, 0), (600, 0), (820, 0),          # main straight
    (880, 20), (890, 60), (860, 85), (810, 80),    # T1 hairpin
    (740, 70), (680, 100), (640, 160),             # T2-T3 medium
    (560, 230), (430, 280), (280, 290),            # T4 fast sweeper
    (150, 270), (80, 230),                         # T5
    (40, 180), (-20, 150), (-70, 110),             # T6 medium
    (-90, 50), (-60, 5),                           # T7 tight left onto straight
]


def build(n=1000):
    c = closed_spline(CONTROL, n)
    return c, normals(c)


if __name__ == "__main__":
    c, nrm = build()
    k = curvature(c)
    ds = np.linalg.norm(np.roll(c, -1, 0) - c, axis=1)
    s = np.cumsum(ds)
    print(f"length {s[-1]:.0f} m, ds {ds.mean():.2f} m")
    # report local curvature peaks (corners)
    r = 1 / np.maximum(np.abs(k), 1e-9)
    for i in range(len(c)):
        if abs(k[i]) > 1 / 300 and abs(k[i]) >= np.abs(k[max(0, i - 15):i + 16]).max():
            print(f"  corner at s={s[i]:6.0f} m  R={r[i]:6.1f} m  {'L' if k[i] > 0 else 'R'}")

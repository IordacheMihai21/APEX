"""APEX physics spike: quasi-steady-state point-mass lap simulation.

Answers one question: does a better racing line produce a convincingly
faster lap, for understandable reasons (exit speed, radius), and is the
result robust to hand-drawn input noise?
"""
import math
import numpy as np
from scipy.interpolate import CubicSpline

# ---------------------------------------------------------------- car model
CAR = dict(
    name="apex_formula_v1",
    mass=750.0,        # kg
    power=600e3,       # W
    mu=1.6,            # tyre friction coefficient
    cla=3.5,           # downforce coefficient * area
    cda=1.1,           # drag coefficient * area
    rho=1.2,
    g=9.81,
)


def grip_lat(v, car=CAR):
    """Max lateral acceleration at speed v (mechanical + aero grip)."""
    k = 0.5 * car["rho"] * car["cla"] / car["mass"]
    return car["mu"] * (car["g"] + k * v * v)


def drag_acc(v, car=CAR):
    return 0.5 * car["rho"] * car["cda"] * v * v / car["mass"]


def corner_speed_limit(kappa, car=CAR, vmax=100.0):
    """Solve v^2 |k| = mu (g + k_aero v^2) for v."""
    k = 0.5 * car["rho"] * car["cla"] / car["mass"]
    denom = np.abs(kappa) - car["mu"] * k
    with np.errstate(divide="ignore", invalid="ignore"):
        v = np.sqrt(car["mu"] * car["g"] / denom)
    v[denom <= 0] = vmax
    return np.minimum(v, vmax)


def top_speed(car=CAR):
    # P = F_drag * v  ->  v^3 = 2P / (rho CdA)
    return (2 * car["power"] / (car["rho"] * car["cda"])) ** (1 / 3)


# ---------------------------------------------------------------- geometry
def closed_spline(points, n):
    """Periodic cubic spline through points, resampled uniformly by arc length."""
    p = np.asarray(points, float)
    p = np.vstack([p, p[:1]])
    t = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(p, axis=0), axis=1))])
    cs = CubicSpline(t, p, bc_type="periodic")
    dense = cs(np.linspace(0, t[-1], 20 * n, endpoint=False))
    return resample_closed(dense, n)


def resample_closed(p, n):
    q = np.vstack([p, p[:1]])
    seg = np.linalg.norm(np.diff(q, axis=0), axis=1)
    s = np.concatenate([[0], np.cumsum(seg)])
    target = np.linspace(0, s[-1], n, endpoint=False)
    x = np.interp(target, s, q[:, 0])
    y = np.interp(target, s, q[:, 1])
    return np.column_stack([x, y])


def normals(c):
    t = np.roll(c, -1, 0) - np.roll(c, 1, 0)
    t /= np.linalg.norm(t, axis=1, keepdims=True)
    return np.column_stack([-t[:, 1], t[:, 0]])  # left normal


def curvature(p):
    """Signed Menger curvature on a closed polyline."""
    a, b, c = np.roll(p, 1, 0), p, np.roll(p, -1, 0)
    ab, bc, ca = b - a, c - b, a - c
    cross = ab[:, 0] * bc[:, 1] - ab[:, 1] * bc[:, 0]
    la, lb, lc = (np.linalg.norm(v, axis=1) for v in (ab, bc, ca))
    return 2 * cross / (la * lb * lc)


# ---------------------------------------------------------------- simulation
def simulate(line, car=CAR):
    """Flying-lap time for a closed line. Returns (lap_s, speed, ds, kappa)."""
    p = np.asarray(line, float)
    n = len(p)
    ds = np.linalg.norm(np.roll(p, -1, 0) - p, axis=1)  # ds[i]: i -> i+1
    kappa = curvature(p)
    vmax = top_speed(car)
    vlim = corner_speed_limit(kappa, car, vmax)

    # Start both passes at the slowest point so the closed loop is well-posed.
    s0 = int(np.argmin(vlim))
    order = (np.arange(n) + s0) % n
    vl, dsr, kr = vlim[order], ds[order], kappa[order]

    m, P = car["mass"], car["power"]

    def ellipse(v, k):
        lat = v * v * abs(k)
        cap = grip_lat(v, car)
        return math.sqrt(max(0.0, 1 - (lat / cap) ** 2)) if cap > 0 else 0.0

    # forward (acceleration) pass
    vf = vl.copy()
    for _ in range(2):  # second sweep closes the loop
        for i in range(n):
            j = (i + 1) % n
            v = vf[i]
            a_grip = grip_lat(v, car) * ellipse(v, kr[i])
            a_pow = P / (m * max(v, 1.0))
            a = min(a_grip, a_pow) - drag_acc(v, car)
            vf[j] = min(vl[j], math.sqrt(max(0.0, v * v + 2 * a * dsr[i])))

    # backward (braking) pass
    vb = vf.copy()
    for _ in range(2):
        for i in range(n - 1, -1, -1):
            j = (i + 1) % n
            v = vb[j]
            a = grip_lat(v, car) * ellipse(v, kr[j]) + drag_acc(v, car)
            vb[i] = min(vb[i], math.sqrt(v * v + 2 * a * dsr[i]))

    v = np.empty(n)
    v[order] = vb
    vavg = 0.5 * (v + np.roll(v, -1))
    lap = float(np.sum(ds / vavg))
    return lap, v, ds, kappa


def fmt(t):
    m, s = divmod(t, 60)
    return f"{int(m)}:{s:06.3f}"

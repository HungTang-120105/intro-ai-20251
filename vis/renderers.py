import numpy as np
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation

def playback_2d(recorder, f = None, bounds = None, interval = 200):
    positions_frames, best_frames = [], []

    for e in recorder.events:
        if e.stage in ("iteration", "generation", "move") and "positions" in e.data:
            positions_frames.append(np.asarray(e.data["positions"]))
            best = e.data.get("gbest") or e.data.get("best")
            best_frames.append(np.asarray(best) if best is not None else None)

    fig, ax = plt.subplots()
    if f is not None and bounds is not None:
        xs = np.linspace(bounds[0][0], bounds[0][1], 150)
        ys = np.linspace(bounds[1][0], bounds[1][1], 150)
        X, Y = np.meshgrid(xs, ys)
        Z = np.vectorize(lambda x, y: f(np.array([x, y])))(X, Y)
        ax.contourf(X, Y, Z, levels = 25, cmap = "Blues", alpha = 0.65)

    scat = ax.scatter([], [], c = "orange", s = 24)
    best_pt, = ax.plot([], [], "r*", ms = 12)

    def init():
        scat.set_offsets(np.empty((0, 2)))
        best_pt.set_data([], [])
        return scat, best_pt

    def update(i):
        P = positions_frames[i]
        scat.set_offsets(P)
        b = best_frames[i] if i < len(best_frames) else None
        if b is not None and b.size == 2:
            best_pt.set_data([b[0]], [b[1]])
        return scat, best_pt

    anim = FuncAnimation(fig, update, init_func = init, frames = len(positions_frames), interval = interval, blit = True)
    return anim

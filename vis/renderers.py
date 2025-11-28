from __future__ import annotations

from typing import Dict, Iterable, Optional, Sequence, Tuple

import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation
import numpy as np

DEFAULT_STAGES = ("iteration", "generation", "move")


def _prepare_positions(positions: Iterable[Sequence[float]]) -> np.ndarray:
  arr = np.asarray(positions, dtype=float)
  if arr.ndim == 1:
    arr = arr.reshape(-1, 2)
  if arr.size == 0:
    return np.empty((0, 2))
  if arr.shape[1] < 2:
    zeros = np.zeros((arr.shape[0], 2 - arr.shape[1]), dtype=float)
    arr = np.hstack([arr, zeros])
  if arr.shape[1] > 2:
    arr = arr[:, :2]
  return arr


def _auto_bounds(frames: Sequence[np.ndarray]) -> Tuple[Tuple[float, float], Tuple[float, float]]:
  stacked = np.vstack(frames)
  xmin, ymin = np.min(stacked, axis=0)
  xmax, ymax = np.max(stacked, axis=0)
  dx = xmax - xmin
  dy = ymax - ymin
  pad_x = 0.05 * dx if dx > 0 else 0.1
  pad_y = 0.05 * dy if dy > 0 else 0.1
  return (xmin - pad_x, xmax + pad_x), (ymin - pad_y, ymax + pad_y)


def playback_2d(
    recorder,
    f=None,
    bounds: Optional[Tuple[Tuple[float, float], Tuple[float, float]]] = None,
    interval: int = 200,
    stages: Sequence[str] = DEFAULT_STAGES,
    scatter_kwargs: Optional[Dict[str, float]] = None,
    figsize: Tuple[float, float] = (9.0, 7.0),
):
  frames, best_points, best_values = [], [], []

  for event in recorder.events:
    if event.stage not in stages:
      continue
    positions = event.data.get("positions")
    if positions is None:
      continue
    frames.append(_prepare_positions(positions))
    best = event.data.get("gbest") or event.data.get("best")
    if best is not None:
      best_points.append(np.asarray(best, dtype=float)[:2])
    else:
      best_points.append(None)
    best_values.append(event.data.get("gbest_value") or event.data.get("best_value"))

  if not frames:
    raise ValueError("Recorder does not contain any 2D positions to render.")

  bounds = bounds or _auto_bounds(frames)

  fig, ax = plt.subplots(figsize=figsize)
  ax.set_xlim(*bounds[0])
  ax.set_ylim(*bounds[1])
  ax.set_xlabel("x")
  ax.set_ylabel("y")

  if f is not None and bounds is not None:
    xs = np.linspace(bounds[0][0], bounds[0][1], 150)
    ys = np.linspace(bounds[1][0], bounds[1][1], 150)
    X, Y = np.meshgrid(xs, ys)
    Z = np.vectorize(lambda x, y: f(np.array([x, y])))(X, Y)
    ax.contourf(X, Y, Z, levels=25, cmap="Blues", alpha=0.65)

  scatter_opts = {"c": "orange", "s": 24}
  if scatter_kwargs:
    scatter_opts.update(scatter_kwargs)

  scat = ax.scatter([], [], **scatter_opts)
  (best_pt,) = ax.plot([], [], "r*", ms=12, label="best")
  info_text = ax.text(0.02, 0.98, "", transform=ax.transAxes, va="top")

  def init():
    scat.set_offsets(np.empty((0, 2)))
    best_pt.set_data([], [])
    info_text.set_text("")
    return scat, best_pt, info_text

  def update(i: int):
    frame = frames[i]
    scat.set_offsets(frame)

    bp = best_points[i] if i < len(best_points) else None
    if bp is not None and bp.size == 2:
      best_pt.set_data([bp[0]], [bp[1]])
    else:
      best_pt.set_data([], [])

    val = best_values[i] if i < len(best_values) else None
    info_text.set_text("" if val is None else f"best = {val:.4g}")
    return scat, best_pt, info_text

  anim = FuncAnimation(
      fig,
      update,
      init_func=init,
      frames=len(frames),
      interval=interval,
      blit=True,
  )
  return anim

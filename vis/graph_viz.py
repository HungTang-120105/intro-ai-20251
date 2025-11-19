from __future__ import annotations

from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation
import networkx as nx
import numpy as np

PATH_KEYS = ("path", "best_path", "route", "current_path")


def _nodes_to_xy(nodes: Iterable, pos: dict) -> np.ndarray:
  pts = [pos[n] for n in nodes if n in pos]
  if not pts:
    return np.empty((0, 2))
  return np.asarray(pts, dtype=float)


def _extract_path(data: dict) -> Optional[List]:
  for key in PATH_KEYS:
    if key in data and data[key]:
      return list(data[key])
  return None


def playback_graph(
    recorder,
    G: nx.Graph,
    pos: Optional[dict] = None,
    interval: int = 400,
    algorithms: Optional[Sequence[str]] = None,
    layout_seed: int = 0,
):
  events = recorder.events
  if algorithms:
    wanted = {name.upper() for name in algorithms}
    events = [e for e in recorder.events if e.algo.upper() in wanted]

  if not events:
    raise ValueError("Recorder does not contain any matching events.")

  pos = dict(pos) if pos is not None else nx.spring_layout(G, seed=layout_seed)

  fig, ax = plt.subplots()
  nx.draw(G, pos=pos, ax=ax, node_color="lightgray",
          edge_color="#ddd", with_labels=True)

  frontier_nodes: List = []
  explored_nodes: List = []
  current_node: Optional = None
  path_nodes: List = []
  latest_cost: Optional[float] = None
  parent_map: Dict[Any, Optional[Any]] = {}

  frontier_scat = ax.scatter([], [], c="#FF9800", label="frontier")
  explored_scat = ax.scatter([], [], c="#2196F3", alpha=0.8, label="explored")
  current_scat = ax.scatter([], [], c="#E91E63", s=80, label="current")
  (path_line,) = ax.plot([], [], color="#4CAF50", linewidth=2.5, label="path")
  info_text = ax.text(0.02, 0.98, "", transform=ax.transAxes, va="top")
  ax.legend(loc="upper right")

  def build_path(node: Optional[Any]) -> List[Any]:
    if node is None or node not in parent_map:
      return []
    path: List[Any] = []
    cur = node
    seen: set[Any] = set()
    while cur is not None and cur not in seen:
      path.append(cur)
      seen.add(cur)
      cur = parent_map.get(cur)
    return list(reversed(path))

  def update(i: int):
    nonlocal current_node, latest_cost, path_nodes
    event = events[i]
    stage = event.stage.lower()
    data = event.data

    parent_updates = data.get("parent_map")
    if parent_updates:
      parent_map.update(parent_updates)

    if stage in {"frontier", "discover"}:
      seq = data.get("frontier") or data.get("queue") or data.get("open")
      if seq is not None:
        frontier_nodes.clear()
        frontier_nodes.extend(seq)

    if stage in {"expand", "process", "visit"}:
      current_node = data.get("current", current_node)
      node = data.get("current")
      if node is not None and node not in explored_nodes:
        explored_nodes.append(node)
        if node in frontier_nodes:
          frontier_nodes.remove(node)

    if "explored" in data:
      explored_nodes[:] = list(dict.fromkeys(data["explored"]))

    path = _extract_path(data)
    if path:
      path_nodes = path
      latest_cost = data.get("cost", latest_cost)

    if "cost" in data and latest_cost is None:
      latest_cost = data["cost"]

    frontier_scat.set_offsets(_nodes_to_xy(frontier_nodes, pos))
    explored_scat.set_offsets(_nodes_to_xy(explored_nodes, pos))
    current_scat.set_offsets(
        _nodes_to_xy(
            [current_node], pos) if current_node is not None else np.empty((0, 2))
    )

    active_path = path or build_path(current_node)
    if not active_path and path_nodes:
      active_path = path_nodes

    if active_path and len(active_path) >= 2:
      coords = _nodes_to_xy(active_path, pos)
      path_line.set_data(coords[:, 0], coords[:, 1])
    else:
      path_line.set_data([], [])

    subtitle = f"{event.algo} - {event.stage} - step {event.step}"
    if latest_cost is not None:
      subtitle += f"\ncost = {latest_cost:.4g}"
    info_text.set_text(subtitle)
    return frontier_scat, explored_scat, current_scat, path_line, info_text

  anim = FuncAnimation(fig, update, frames=len(events),
                       interval=interval, blit=True)
  return anim

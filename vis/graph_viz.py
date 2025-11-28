from __future__ import annotations

from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation
import networkx as nx
import numpy as np
from matplotlib import cm, colors

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


def _edge_weight(G: nx.Graph, u: Any, v: Any) -> str:
  if not G.has_edge(u, v):
    return ""
  data = G.get_edge_data(u, v, default={})
  if isinstance(data, dict) and any(isinstance(val, dict) for val in data.values()):
    first = next(iter(data.values()))
    return str(first.get("weight", ""))
  return str(data.get("weight", ""))


def playback_graph(
    recorder,
    G: nx.Graph,
    pos: Optional[dict] = None,
    interval: int = 400,
    algorithms: Optional[Sequence[str]] = None,
    layout_seed: int = 0,
    figsize: Tuple[float, float] = (12.0, 9.0),
    base_edge_width: float = 0.8,
    node_size: float = 160.0,
    path_linewidth: float = 2.0,
    background=None,           # 2D array / image loaded (e.g., plt.imread)
    extent: Optional[Tuple[float, float, float, float]] = None,  # (xmin,xmax,ymin,ymax) for background
    shapes: Optional[List[Tuple[Any, Dict[str, Any]]]] = None,   # list of (geometry, kwargs) to draw
    dpi: int = 100,
    show_labels: bool = True,
    show_weights: bool = True,
    layer_alpha: float = 1.0,
):
  events = recorder.events
  if algorithms:
    wanted = {name.upper() for name in algorithms}
    events = [e for e in recorder.events if e.algo.upper() in wanted]

  if not events:
    raise ValueError("Recorder does not contain any matching events.")

  pos = dict(pos) if pos is not None else nx.spring_layout(G, seed=layout_seed)

  fig, ax = plt.subplots(figsize=figsize, dpi=dpi)
  if background is not None and extent is not None:
    ax.imshow(background, extent=extent, origin="upper", alpha=layer_alpha)
  if shapes:
    for geom, kw in shapes:
      try:
        if hasattr(geom, "exterior"):
          x, y = geom.exterior.xy
        else:
          x, y = zip(*geom)
        ax.plot(x, y, **kw)
      except Exception:
        continue
  edge_list = list(G.edges())
  edge_artists = None
  if G.is_directed():
    edge_artists = nx.draw_networkx_edges(
        G,
        pos=pos,
        ax=ax,
        edge_color="#ccc",
        arrows=True,
        arrowstyle="->",
        arrowsize=12,
        connectionstyle="arc3,rad=0.08",
        min_source_margin=6,
        min_target_margin=6,
        width=base_edge_width,
    )
    if show_labels:
      nx.draw_networkx_labels(G, pos=pos, ax=ax)
  else:
    edge_artists = nx.draw_networkx_edges(
        G, pos=pos, ax=ax, edge_color="#ddd", width=base_edge_width)
    if show_labels:
      nx.draw_networkx_labels(G, pos=pos, ax=ax)
  edge_labels = {(u, v): _edge_weight(G, u, v) for u, v in G.edges()}
  if show_weights and any(lbl != "" for lbl in edge_labels.values()):
    nx.draw_networkx_edge_labels(
        G,
        pos=pos,
        ax=ax,
        edge_labels=edge_labels,
        font_size=8,
        font_color="#555",
        label_pos=0.5,
    )

  frontier_nodes: List = []
  explored_nodes: List = []
  current_node: Optional = None
  path_nodes: List = []
  latest_cost: Optional[float] = None
  parent_map: Dict[Any, Optional[Any]] = {}
  last_path: List = []

  all_nodes = list(G.nodes())
  node_coords = _nodes_to_xy(all_nodes, pos)
  nodes_scat = ax.scatter(
      [], [], s=node_size, edgecolor="#666", linewidths=0.6, label="nodes")
  frontier_scat = ax.scatter(
      [], [], c="#FF9800", s=node_size * 0.75, label="frontier")
  explored_scat = ax.scatter(
      [], [], c="#2196F3", s=node_size * 0.75, alpha=0.9, label="explored")
  current_scat = ax.scatter([], [], c="#E91E63", s=node_size, label="current")
  (path_line,) = ax.plot([], [], color="#4CAF50",
                         linewidth=path_linewidth, label="path")
  info_text = ax.text(0.02, 0.98, "", transform=ax.transAxes, va="top")
  queue_text = ax.text(0.98, 0.02, "", transform=ax.transAxes,
                       va="bottom", ha="right")
  pher_text = ax.text(0.02, 0.90, "", transform=ax.transAxes, va="top")
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
    nonlocal current_node, latest_cost, path_nodes, last_path
    event = events[i]
    stage = event.stage.lower()
    data = event.data

    parent_updates = data.get("parent_map")
    if parent_updates:
      parent_map.update(parent_updates)

    queue_seq = None
    pheromone_top = data.get("pheromone_top")
    if stage in {"frontier", "discover"}:
      seq = data.get("frontier") or data.get("queue") or data.get("open")
      if seq is not None:
        frontier_nodes.clear()
        frontier_nodes.extend(seq)
        queue_seq = list(seq)
    elif "queue" in data:
      queue_seq = data.get("queue")

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

    if len(all_nodes) == len(node_coords):
      colors = []
      for n in all_nodes:
        if n == current_node:
          colors.append("#E91E63")
        elif n in frontier_nodes:
          colors.append("#FF9800")
        elif n in explored_nodes:
          colors.append("#2196F3")
        else:
          colors.append("#d3d3d3")
      nodes_scat.set_offsets(node_coords)
      nodes_scat.set_facecolors(colors)
      nodes_scat.set_edgecolors("#666")

    if pheromone_top and edge_artists is not None:
      pher_map = {(u, v): w for u, v, w in pheromone_top}
      vals = []
      for u, v in edge_list:
        w = pher_map.get((u, v))
        if w is None and not G.is_directed():
          w = pher_map.get((v, u))
        vals.append(w if w is not None else 0.0)
      vmax = max(vals) if vals else 1.0
      vmin = min(vals) if vals else 0.0
      span = vmax - vmin if vmax != vmin else 1.0
      norm_vals = [max(0.0, (w - vmin) / span) for w in vals]
      cmap = cm.get_cmap("Greens")
      if isinstance(edge_artists, list):
        for artist, val in zip(edge_artists, norm_vals):
          artist.set_linewidth(0.8 + 4.0 * val)
          artist.set_color(cmap(val))
      else:
        edge_artists.set_linewidths(0.8 + 4.0 * np.asarray(norm_vals))
        edge_artists.set_color(cmap(norm_vals))
      pher_text.set_text(f"pheromone max={vmax:.3g}")
    else:
      pher_text.set_text("")

    active_path = path or build_path(current_node)
    if not active_path and path_nodes:
      active_path = path_nodes
    if not active_path and last_path:
      active_path = last_path

    if active_path and len(active_path) >= 2:
      coords = _nodes_to_xy(active_path, pos)
      path_line.set_data(coords[:, 0], coords[:, 1])
      last_path = active_path
    else:
      path_line.set_data([], [])

    subtitle = f"{event.algo} - {event.stage} - step {event.step}"
    if latest_cost is not None:
      subtitle += f"\ncost = {latest_cost:.4g}"
    info_text.set_text(subtitle)
    if queue_seq is None:
      queue_seq = data.get("frontier") or []
    if queue_seq:
      preview = queue_seq[:8]
      suffix = " ..." if len(queue_seq) > 8 else ""
      label = "stack" if event.algo.upper() == "DFS" else "queue"
      queue_text.set_text(
          f"{label}: " + " → ".join(map(str, preview)) + suffix)
    else:
      queue_text.set_text(queue_text.get_text())
    return nodes_scat, frontier_scat, explored_scat, current_scat, path_line, info_text, queue_text, pher_text

  anim = FuncAnimation(fig, update, frames=len(events),
                       interval=interval, blit=True)
  return anim

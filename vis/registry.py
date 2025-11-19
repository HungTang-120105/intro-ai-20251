from __future__ import annotations

from typing import Callable, Dict, Optional

from .graph_viz import playback_graph
from .renderers import playback_2d

Renderer = Callable[..., object]

__all__ = ["register_renderer", "get_renderer", "available_renderers"]

_RENDERERS: Dict[str, Renderer] = {}


def register_renderer(name: str, renderer: Renderer) -> None:
  _RENDERERS[name.upper()] = renderer


def get_renderer(name: str) -> Optional[Renderer]:
  if not name:
    return None
  return _RENDERERS.get(name.upper())


def available_renderers() -> Dict[str, Renderer]:
  return dict(_RENDERERS)


for algo in ("PSO", "GA", "TS"):
  register_renderer(algo, playback_2d)

for algo in (
    "UCS",
    "BFS",
    "DFS",
    "ACO",
    "LPA",
    "LPA*",
    "LPAS",
    "LPA_STAR",
    "DSLITE",
    "DSTAR_LITE",
    "JOHNSON",
    "YEN",
    "K_SP",
    "KSP",
):
  register_renderer(algo, playback_graph)

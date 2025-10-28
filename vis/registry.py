from .renderers import playback_2d
from .graph_viz import playback_graph

RENDERERS = {
    "PSO": playback_2d,
    "GA": playback_graph,
    "TS": playback_2d,
    "ACO": playback_graph,
    "UCS": playback_2d,
}

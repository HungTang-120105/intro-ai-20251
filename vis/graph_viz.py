import numpy as np
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation
import networkx as nx

def playback_graph(recorder, G, pos = None, interval = 400):
    events = [e for e in recorder.events if e.algo in ("UCS", "ACO")]
    pos = pos or nx.spring_layout(G, seed = 0)

    fig, ax = plt.subplots()
    nx.draw(G, pos = pos, ax = ax, node_color = "lightgray", with_labels = True, edge_color = "#ddd")

    frontier_scat = ax.scatter([], [], c="#FF9800", label="frontier")
    explored_scat = ax.scatter([], [], c="#2196F3", label="explored", alpha = 0.8)
    current_scat = ax.scatter([], [], c="#E91E63", label="current", s = 80)
    ax.legend(loc = "upper right")

    frontier, explored, current = set(), set(), None

    def update(i):
        nonlocal frontier, explored, current
        e = events[i]
        if e.stage == "frontier":
            frontier = set(e.data.get("frontier", []))
        if e.stage == "expand":
            current = e.data.get("current")
            if current is not None:
                explored.add(current)

        def to_xy(nodes):
            pts = np.array([pos[n] for n in nodes]) if nodes else np.empty((0,2))
            return pts

        frontier_scat.set_offsets(to_xy(frontier))
        explored_scat.set_offsets(to_xy(explored))
        current_scat.set_offsets(to_xy([current]) if current is not None else np.empty((0,2)))
        return frontier_scat, explored_scat, current_scat

    anim = FuncAnimation(fig, update, frames=len(events), interval=interval, blit=True)
    return anim

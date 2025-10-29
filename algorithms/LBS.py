# Local Beam Search
from queue import PriorityQueue
import networkx as nx
from typing import Any, Optional
import math

def _calculate_heuristic(pos1: tuple[float, float], pos2: tuple[float, float]) -> float:
    return math.hypot(pos1[0]-pos2[0], pos1[1] - pos2[1])

def lbs(
    G: nx.Graph,
    source,
    target,
    k
) -> Optional[tuple[list[Any], float, list[Any]]]:  
    pq = PriorityQueue()
    pq.put((0, source))
    parent = {source : None}
    visit_order = []

    while not pq.empty():
        candidate = PriorityQueue()
        for i in range(k):
            if pq.empty():
                break
            u = pq.get()[1]
            visit_order.append(u)
            if u == target:
                path = []
                cur = u
                while cur is not None:
                    path.append(cur)
                    cur = parent[cur]
                path.reverse()

                total_weigth = 0.0
                if len(path) >= 2:
                    for j in range(len(path)-1):
                        a, b = path[j], path[j+1]
                        if G.has_edge(a,b):
                            data = G.get_edge_data(a,b) or {}
                            if isinstance(data, dict) and any(isinstance(v, dict) for v in data):
                                first_key = next(iter(data))
                                attrs = data[first_key]
                            else:
                                attrs = data
                            w = attrs.get('weight', 1.0)
                        else:
                            w = 1.0
                        try:
                            total_weigth += float(w)
                        except Exception:
                            total_weigth += 1.0
                return path, total_weigth, visit_order

            for v in G.neighbors(u):
                if v not in parent:
                    parent[v] = u
                    candidate.put((_calculate_heuristic(G.nodes[v]['pos'], G.nodes[target]['pos']), v))

        pq = PriorityQueue()
        for _ in range(k):
            if candidate.empty():
                break
            pq.put(candidate.get())
    
    return None



import matplotlib.pyplot as plt

# --- Create the graph ---
G = nx.Graph()

G.add_node('A', pos=(0, 0))
G.add_node('B', pos=(1, 2))
G.add_node('C', pos=(2, 0))
G.add_node('D', pos=(3, 1))
G.add_node('E', pos=(4, 2))
G.add_node('F', pos=(5, 0))

edges = [
    ('A', 'B', 2.2),
    ('A', 'C', 2.0),
    ('B', 'D', 2.1),
    ('C', 'D', 2.0),
    ('D', 'E', 1.5),
    ('E', 'F', 2.2)
]
G.add_weighted_edges_from(edges)

# --- Run Local Beam Search ---
result = lbs(G, 'A', 'F', k=2)

if result is None:
    print("No path found.")
else:
    path, total_weight, visit_order = result
    print("Path found:", path)
    print("Total weight:", total_weight)
    print("Visit order:", visit_order)

    # --- Visualize result ---
    pos = nx.get_node_attributes(G, 'pos')
    plt.figure(figsize=(6, 4))
    nx.draw(G, pos, with_labels=True, node_size=700, node_color="lightblue")
    nx.draw_networkx_edges(
        G, pos, edgelist=[(path[i], path[i + 1]) for i in range(len(path) - 1)],
        width=3, edge_color="red"
    )
    plt.title("Local Beam Search Path")
    plt.show()

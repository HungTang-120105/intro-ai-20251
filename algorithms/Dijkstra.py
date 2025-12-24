from queue import PriorityQueue
import networkx as nx
from typing import Any, Optional, List, Tuple
import math
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from vis.tracer import get_tracer

def dijkstra(
    G: nx.Graph, 
    source: Any, 
    target: Any
) -> Optional[Tuple[List[Any], float, List[Any]]]:
    """
    Dijkstra's algorithm for finding shortest paths.
    
    Parameters
    ----------
    G : nx.Graph
        Graph with optional 'weight' edge attribute.
    source : Any
        Start node.
    target : Any
        Goal node.
    
    Returns
    -------
    (path, total_weight, visit_order) or None if no path exists.
    """
    if source not in G or target not in G:
        return None
    
    tr = get_tracer()
    pq = PriorityQueue()
    dist = {node: float('inf') for node in G.nodes}
    parent = {source: None}
    visit_order = []
    
    pq.put((0, source))
    dist[source] = 0

    while not pq.empty():
        du, u = pq.get()
        
        if du > dist[u]:
            continue
        
        visit_order.append(u)
        
        # Emit expand event
        tr.emit("Dijkstra", "expand", {
            "current": u,
            "cost": du,
            "parent_map": dict(parent),
        })
        
        if u == target:
            # Reconstruct path
            path = []
            cur = target
            while cur is not None:
                path.append(cur)
                cur = parent.get(cur)
            path.reverse()
            
            tr.emit("Dijkstra", "goal", {
                "path": path,
                "cost": dist[target],
                "parent_map": dict(parent),
            })
            
            return path, dist[target], visit_order

        for v in G.neighbors(u):
            w = G[u][v].get('weight', 1)
            alt = dist[u] + w
            
            if alt < dist[v]:
                old_dist = dist[v]
                dist[v] = alt
                parent[v] = u
                pq.put((dist[v], v))
                
                tr.emit("Dijkstra", "relax", {
                    "from": u,
                    "to": v,
                    "weight": w,
                    "old_dist": old_dist if old_dist != float('inf') else None,
                    "new_dist": alt,
                    "parent_map": dict(parent),
                })
    
    tr.emit("Dijkstra", "no_path", {
        "source": source,
        "target": target,
    })
    
    return None


if __name__ == "__main__":
    G = nx.Graph()
    G.add_weighted_edges_from([
        ('A', 'B', 4),
        ('A', 'C', 2),
        ('B', 'C', 1),
        ('B', 'D', 5),
        ('C', 'D', 8),
        ('C', 'E', 10),
        ('D', 'E', 2),
        ('D', 'Z', 6),
        ('E', 'Z', 3)
    ])

    result = dijkstra(G, 'A', 'Z')

    if result is None:
        print("Không có đường đi từ A đến Z")
    else:
        path, total_weight, visit_order = result
        print("Đường đi ngắn nhất A → Z:", path)
        print("Tổng trọng số:", total_weight)
        print("Thứ tự thăm:", visit_order)
from typing import List, Optional, Tuple, Any
import networkx as nx
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from vis.tracer import get_tracer


def bellman_ford(
    G: nx.Graph,
    source: Any,
    target: Any
) -> Optional[Tuple[List[Any], float, List[Any]]]:
    """
    Bellman–Ford algorithm implementation with tracer.
    
    Parameters
    ----------
    G : nx.Graph
        Đồ thị có trọng số, có thể chứa cạnh âm.
    source : Any
        Node bắt đầu.
    target : Any
        Node đích.

    Returns
    -------
    (path, cost, visited_order)
        path : danh sách các node trên đường đi ngắn nhất.
        cost : tổng chi phí đường đi.
        visited_order : thứ tự các node được relax.

    Raises
    ------
    ValueError : nếu đồ thị chứa chu trình âm reachable từ source.
    """
    if source not in G or target not in G:
        return None
    
    tr = get_tracer()

    # Khởi tạo khoảng cách và node cha
    dist = {node: float('inf') for node in G.nodes}
    parent = {node: None for node in G.nodes}
    dist[source] = 0
    visited_order = []
    n = len(G.nodes)
    
    tr.emit("Bellman-Ford", "init", {
        "source": source,
        "target": target,
        "num_nodes": n,
        "num_iterations": n - 1,
    })

    # Relax tất cả các cạnh (|V| - 1) lần
    for i in range(n - 1):
        updated = False
        
        tr.emit("Bellman-Ford", "iteration_start", {
            "iteration": i + 1,
            "distances": {k: v for k, v in dist.items() if v != float('inf')},
        })
        
        for u, v, data in G.edges(data=True):
            w = data.get('weight', 1)
            
            # Try relaxing u -> v
            if dist[u] != float('inf') and dist[u] + w < dist[v]:
                old_dist = dist[v]
                dist[v] = dist[u] + w
                parent[v] = u
                updated = True
                if v not in visited_order:
                    visited_order.append(v)
                
                tr.emit("Bellman-Ford", "relax", {
                    "iteration": i + 1,
                    "from": u,
                    "to": v,
                    "weight": w,
                    "old_dist": old_dist if old_dist != float('inf') else None,
                    "new_dist": dist[v],
                    "parent_map": {k: v for k, v in parent.items() if v is not None},
                })
            
            # For undirected graph, also try v -> u
            if dist[v] != float('inf') and dist[v] + w < dist[u]:
                old_dist = dist[u]
                dist[u] = dist[v] + w
                parent[u] = v
                updated = True
                if u not in visited_order:
                    visited_order.append(u)
                
                tr.emit("Bellman-Ford", "relax", {
                    "iteration": i + 1,
                    "from": v,
                    "to": u,
                    "weight": w,
                    "old_dist": old_dist if old_dist != float('inf') else None,
                    "new_dist": dist[u],
                    "parent_map": {k: v for k, v in parent.items() if v is not None},
                })
        
        tr.emit("Bellman-Ford", "iteration_end", {
            "iteration": i + 1,
            "updated": updated,
        })
        
        if not updated:
            tr.emit("Bellman-Ford", "early_stop", {
                "iteration": i + 1,
            })
            break

    # Kiểm tra chu trình âm
    for u, v, data in G.edges(data=True):
        w = data.get('weight', 1)
        if dist[u] != float('inf') and dist[u] + w < dist[v]:
            tr.emit("Bellman-Ford", "negative_cycle", {})
            raise ValueError("Graph contains a negative-weight cycle")

    # Nếu target unreachable
    if dist[target] == float('inf'):
        tr.emit("Bellman-Ford", "no_path", {
            "source": source,
            "target": target,
        })
        return None

    # Truy vết đường đi ngắn nhất
    path = []
    curr = target
    while curr is not None:
        path.append(curr)
        curr = parent[curr]
    path.reverse()
    
    tr.emit("Bellman-Ford", "goal", {
        "path": path,
        "cost": dist[target],
    })

    return path, dist[target], visited_order


if __name__ == "__main__":
    G = nx.Graph()
    G.add_weighted_edges_from([
        ('A', 'B', 1),
        ('B', 'C', 2),
        ('A', 'C', 4),
        ('C', 'D', 2),
        ('B', 'D', 5)
    ])

    try:
        result = bellman_ford(G, 'A', 'D')
        if result:
            path, cost, visited_order = result
            print("Path:", path)
            print("Cost:", cost)
            print("Visited Order:", visited_order)
        else:
            print("No path found")
    except ValueError as e:
        print(e)
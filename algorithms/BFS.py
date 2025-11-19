from collections import deque
import networkx as nx
from vis.tracer import get_tracer
from typing import List, Optional, Tuple, Any

def bfs(
    G: nx.Graph,
    source: Any,
    target: Any
) -> Optional[Tuple[List[Any], float, List[Any]]]:
    """
    Find a path from source to target using BFS (shortest by number of edges).

    The graph is treated as undirected (use `nx.Graph`). Edges may have a
    'weight' attribute. This function returns the path found and the total
    weight (sum of edge weights along the path). If an edge has no 'weight'
    attribute, a default weight of 1.0 is used.

    Args:
        G: NetworkX graph (preferably `nx.Graph`).
        source: start node.
        target: goal node.

    Returns:
        A tuple (path, total_weight, visit_order) on success, or None on failure.
        - path: List of nodes from source to target.
        - total_weight: Sum of edge weights along the path.
        - visit_order: List of nodes in the order they were processed.
    """
    if source not in G or target not in G:
        return None

    q: deque[Any] = deque([source])
    parent: dict[Any, Optional[Any]] = {source: None}
    visit_order: List[Any] = []  # order of nodes as they are popped/processed
    depth: dict[Any, int] = {source: 0}
    tr = get_tracer()
    while q:
        u = q.popleft()
        tr.emit("BFS", "expand", {
            "current": u,
            "depth": depth[u],
            "parent_map": dict(parent),
        })
        visit_order.append(u)

        if u == target:
            # Reconstruct path
            path: List[Any] = []
            cur = u
            while cur is not None:
                path.append(cur)
                cur = parent[cur]
            path.reverse()

            # Sum weights along path
            total_weight = 0.0
            if len(path) >= 2:
                for i in range(len(path) - 1):
                    a, b = path[i], path[i + 1]
                    if G.has_edge(a, b):
                        data = G.get_edge_data(a, b) or {}
                        # MultiGraph returns dict-of-dicts; pick first edge attrs
                        if isinstance(data, dict) and any(isinstance(v, dict) for v in data.values()):
                            first_key = next(iter(data))
                            attrs = data[first_key] or {}
                        else:
                            attrs = data
                        w = attrs.get('weight', 1.0)
                    else:
                        w = 1.0
                    try:
                        total_weight += float(w)
                    except Exception:
                        total_weight += 1.0

            tr.emit("BFS", "goal", {
                "path": path,
                "length": len(path),
                "total_weight": total_weight,
                "parent_map": dict(parent),
            })

            return path, total_weight, visit_order

        for v in G.neighbors(u):
            if v not in parent:
                parent[v] = u
                depth[v] = depth[u] + 1
                q.append(v)
                tr.emit("BFS", "frontier", {
                    "parent": u,
                    "child": v,
                    "frontier": list(q),
                    "parent_map": dict(parent),
                })


    return None


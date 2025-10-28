from collections import deque
import networkx as nx
from typing import Any, List, Optional, Tuple


def dfs(G: nx.Graph, source, target) -> Optional[Tuple[List[Any], float, List[Any]]]:
    """
    Depth-first search that returns:
      (path, total_weight, visit_order)

    - path: list of nodes from source to target (if found)
    - total_weight: sum of edge 'weight' attributes along path (default 1.0 per edge)
    - visit_order: list of nodes in the order they were popped/processed from the stack

    Returns None if source or target not in G or no path exists.
    """
    if source not in G or target not in G:
        return None

    q = deque([source])
    parent = {source: None}
    visit_order: List[Any] = []

    while q:
        u = q.pop()
        visit_order.append(u)

        if u == target:
            path: List[Any] = []
            cur = u
            while cur is not None:
                path.append(cur)
                cur = parent[cur]
            path.reverse()

            # compute total weight along path
            total_weight = 0.0
            if len(path) >= 2:
                for i in range(len(path) - 1):
                    a, b = path[i], path[i + 1]
                    if G.has_edge(a, b):
                        data = G.get_edge_data(a, b) or {}
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

            return path, total_weight, visit_order

        for v in reversed(list(G.neighbors(u))):
            if v not in parent:
                parent[v] = u
                q.append(v)

    return None
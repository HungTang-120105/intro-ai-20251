# Depth Limit search
from collections import deque
import networkx as nx
from typing import Any, Optional

def dls(G: nx.Graph, source, target, d = 50) -> Optional[tuple[list[Any], float, list[Any]]]:
    if source not in G or target not in G:
        return None
    
    q = deque([source])
    parent = {source: None}
    depth = {source: 0}
    visit_order: list[Any] = []

    while q:
        u = q.pop()
        visit_order.append(u)

        if u == target:
            path = []
            cur = u
            while cur is not None:
                path.append(cur)
                cur = parent[cur]
            path.reverse()

            total_weight = 0.0
            if len(path)>=2 :
                for i in range(len(path)- 1):
                    a, b = path[i], path[i+1]
                    if G.has_edge(a,b):
                        data = G.get_edge_data(a,b) or {}
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
            if v not in parent and depth[u] < d:
                depth[v] = depth[u]+1
                parent[v] = u
                q.append(v)

    return None



    
from collections import deque
import networkx as nx
from typing import List, Optional, Tuple, Any, Dict, Set
import heapq

def _edge_weight(G: nx.Graph, a: Any, b: Any) -> float:
    if not G.has_edge(a, b):
        return float('inf')
    data = G.get_edge_data(a, b) or {}
    if isinstance(data, dict) and any(isinstance(v, dict) for v in data.values()):
        first_key = next(iter(data))
        attrs = data[first_key] or {}
    else:
        attrs = data
    try:
        return float(attrs.get('weight', 1.0))
    except Exception:
        return 1.0

def _dijkstra_limited(G: nx.Graph, source: Any, forbidden: Set[Any], dist_limit: float) -> Dict[Any, float]:
    dist: Dict[Any, float] = {}
    pq: List[Tuple[float, Any]] = [(0.0, source)]
    while pq:
        d, u = heapq.heappop(pq)
        if u in dist:
            continue
        dist[u] = d
        if d > dist_limit:
            continue
        for v in G.neighbors(u):
            if v in forbidden:
                continue
            w = _edge_weight(G, u, v)
            nd = d + w
            if nd <= dist_limit and (v not in dist):
                heapq.heappush(pq, (nd, v))
    return dist

def compute_node_order(G: nx.Graph) -> List[Any]:
    # You can change ordering heuristic here. Keep simple degree-based for now.
    return sorted(G.nodes(), key=lambda x: G.degree(x))

def build_contraction_hierarchy(G_in: nx.Graph) -> Tuple[nx.DiGraph, Dict[Any, int]]:
    working = G_in.copy()
    order = compute_node_order(working)
    rank: Dict[Any, int] = {}
    # collect original edges
    edge_map: Dict[Tuple[Any, Any], float] = {}
    for a, b, data in working.edges(data=True):
        w = data.get('weight', 1.0)
        key = tuple(sorted((a, b)))
        edge_map[key] = min(edge_map.get(key, float('inf')), float(w))

    for idx, v in enumerate(order):
        rank[v] = idx
        if v not in working:
            continue
        neigh = list(working.neighbors(v))
        for i in range(len(neigh)):
            u = neigh[i]
            duv = _edge_weight(working, u, v)
            for j in range(i + 1, len(neigh)):
                w = neigh[j]
                dvw = _edge_weight(working, v, w)
                if u == w:
                    continue
                via_v = duv + dvw
                forbidden = {v}
                dists = _dijkstra_limited(working, u, forbidden, via_v)
                alt = dists.get(w, float('inf'))
                if alt > via_v:
                    key = tuple(sorted((u, w)))
                    edge_map[key] = min(edge_map.get(key, float('inf')), via_v)
        # remove v from working (simulate contraction)
        if v in working:
            working.remove_node(v)

    # Build directed graph for CH. **Temporary fix:** add BOTH directions for reliability.
    G_up = nx.DiGraph()
    for (a, b), w in edge_map.items():
        # Add both directions so forward/backward searches can meet
        G_up.add_edge(a, b, weight=w)
        G_up.add_edge(b, a, weight=w)

    return G_up, rank

def ch_shortest_path(
    G: nx.Graph,
    source: Any,
    target: Any
) -> Optional[Tuple[List[Any], float, List[Any]]]:
    if source not in G or target not in G:
        return None
    if source == target:
        return [source], 0.0, [source]

    G_up, rank = build_contraction_hierarchy(G)
    G_up_rev = G_up.reverse(copy=True)

    dist_f: Dict[Any, float] = {source: 0.0}
    dist_b: Dict[Any, float] = {target: 0.0}
    parent_f: Dict[Any, Any] = {source: None}
    parent_b: Dict[Any, Any] = {target: None}
    pq_f: List[Tuple[float, Any]] = [(0.0, source)]
    pq_b: List[Tuple[float, Any]] = [(0.0, target)]
    visit_order_f: List[Any] = []
    visit_order_b: List[Any] = []

    best_distance = float('inf')
    meeting_node = None

    while pq_f or pq_b:
        if pq_f:
            d, u = heapq.heappop(pq_f)
            if d == dist_f.get(u, float('inf')):
                visit_order_f.append(u)
                for v in G_up.neighbors(u):
                    w = G_up[u][v].get('weight', 1.0)
                    nd = d + w
                    if nd < dist_f.get(v, float('inf')):
                        dist_f[v] = nd
                        parent_f[v] = u
                        heapq.heappush(pq_f, (nd, v))
                if u in dist_b:
                    cand = dist_f[u] + dist_b[u]
                    if cand < best_distance:
                        best_distance = cand
                        meeting_node = u

        if pq_b:
            d, u = heapq.heappop(pq_b)
            if d == dist_b.get(u, float('inf')):
                visit_order_b.append(u)
                for v in G_up_rev.neighbors(u):
                    w = G_up_rev[u][v].get('weight', 1.0)
                    nd = d + w
                    if nd < dist_b.get(v, float('inf')):
                        dist_b[v] = nd
                        parent_b[v] = u
                        heapq.heappush(pq_b, (nd, v))
                if u in dist_f:
                    cand = dist_f[u] + dist_b[u]
                    if cand < best_distance:
                        best_distance = cand
                        meeting_node = u

        # only apply stop if we've found a finite best_distance
        top_f = pq_f[0][0] if pq_f else float('inf')
        top_b = pq_b[0][0] if pq_b else float('inf')
        if best_distance < float('inf') and top_f + top_b >= best_distance:
            break

    if meeting_node is None:
        common = set(dist_f.keys()).intersection(dist_b.keys())
        if not common:
            return None
        for u in common:
            cand = dist_f[u] + dist_b[u]
            if cand < best_distance:
                best_distance = cand
                meeting_node = u

    if meeting_node is None:
        return None

    # reconstruct path
    path_f: List[Any] = []
    cur = meeting_node
    while cur is not None:
        path_f.append(cur)
        cur = parent_f.get(cur)
    path_f.reverse()

    path_b: List[Any] = []
    cur = parent_b.get(meeting_node)
    while cur is not None:
        path_b.append(cur)
        cur = parent_b.get(cur)

    path = path_f + path_b

    total_weight = 0.0
    if len(path) >= 2:
        for i in range(len(path) - 1):
            a, b = path[i], path[i + 1]
            w = _edge_weight(G, a, b)
            total_weight += w

    visit_order = visit_order_f + visit_order_b
    return path, total_weight, visit_order

# Example
if __name__ == "__main__":
    G = nx.Graph()
    edges = [
        ('A','B', 1.0), ('B','C', 2.0), ('A','C', 4.5),
        ('C','D', 1.0), ('B','D', 3.5), ('D','E', 2.0)
    ]
    for u,v,w in edges:
        G.add_edge(u, v, weight=w)

    res = ch_shortest_path(G, 'A', 'E')
    print("CH result:", res)

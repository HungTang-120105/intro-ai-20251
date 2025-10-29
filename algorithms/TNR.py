from collections import deque
import networkx as nx
from typing import List, Optional, Tuple, Any, Dict, Set

def choose_transit_nodes(G: nx.Graph, k: int = 10, method: str = "degree") -> List[Any]:
    """
    Select k transit nodes.
    method: "degree" (highest degree) or "betweenness" (approx centrality).
    """
    if k <= 0:
        return []
    if method == "degree":
        nodes_sorted = sorted(G.nodes(), key=lambda n: G.degree(n), reverse=True)
        return nodes_sorted[:k]
    elif method == "betweenness":
        # For large graphs you may want to use k-node approximate centrality.
        centrality = nx.betweenness_centrality(G)  # expensive for large graphs
        nodes_sorted = sorted(centrality.keys(), key=lambda n: centrality[n], reverse=True)
        return nodes_sorted[:k]
    else:
        raise ValueError("Unknown method for choose_transit_nodes")


def compute_transit_pairwise_distances(G: nx.Graph, transit_nodes: List[Any]) -> Dict[Any, Dict[Any, float]]:
    """
    Precompute shortest path distances between all transit nodes.
    Returns nested dict: dist[a][b] = distance (float)
    Uses Dijkstra (weights if present).
    """
    dist: Dict[Any, Dict[Any, float]] = {t: {} for t in transit_nodes}
    for t in transit_nodes:
        # single-source Dijkstra from t
        lengths = nx.single_source_dijkstra_path_length(G, t, weight='weight')
        for u in transit_nodes:
            if u in lengths:
                dist[t][u] = float(lengths[u])
            else:
                dist[t][u] = float('inf')
    return dist


def compute_access_nodes(
    G: nx.Graph,
    transit_nodes: Set[Any],
    max_access: int = 3,
    search_limit: Optional[float] = None
) -> Dict[Any, List[Tuple[Any, float]]]:
    """
    For each node v in G, find up to max_access nearest transit nodes with their distances.
    search_limit: optional distance cutoff to stop search early (if None, no cutoff).
    Returns access_nodes[v] = [(transit_node, dist), ...] sorted by dist ascending.
    Implementation: run single-source Dijkstra from v until we've seen all transit nodes or exhausted nodes.
    (This is expensive O(|V| * (|E| log |V|)) for naive; ok for small graphs / prototype.)
    """
    access: Dict[Any, List[Tuple[Any, float]]] = {}
    for v in G.nodes():
        # lengths to all nodes from v
        lengths = nx.single_source_dijkstra_path_length(G, v, cutoff=search_limit, weight='weight')
        # collect transit nodes reachable
        t_with_dist = [(t, float(lengths[t])) for t in transit_nodes if t in lengths]
        t_with_dist.sort(key=lambda x: x[1])
        access[v] = t_with_dist[:max_access]
    return access


class TransitNodeIndex:
    """
    Container for precomputed TNR structures.
    """
    def __init__(self, G: nx.Graph, transit_nodes: List[Any], transit_dist: Dict[Any, Dict[Any, float]],
                 access_nodes: Dict[Any, List[Tuple[Any, float]]]):
        self.G = G
        self.transit_nodes = list(transit_nodes)
        self.transit_dist = transit_dist  # nested dict
        self.access_nodes = access_nodes  # node -> list[(transit, dist)]


def build_transit_index(
    G: nx.Graph,
    k: int = 10,
    choose_method: str = "degree",
    max_access: int = 3,
    search_limit: Optional[float] = None
) -> TransitNodeIndex:
    """
    Build the transit node index: choose transit nodes, compute pairwise transit distances,
    compute access nodes for each node.
    """
    transit = choose_transit_nodes(G, k=k, method=choose_method)
    transit_set = set(transit)
    transit_pairwise = compute_transit_pairwise_distances(G, transit)
    access = compute_access_nodes(G, transit_set, max_access=max_access, search_limit=search_limit)
    return TransitNodeIndex(G, transit, transit_pairwise, access)


def query_shortest_path_tnr(index: TransitNodeIndex, source: Any, target: Any) -> Optional[Tuple[List[Any], float]]:
    """
    Query shortest path using transit node routing approximation:
    - Consider direct shortest path (Dijkstra).
    - Consider combinations via access nodes and transit pairwise distances.
    Return best (path, distance). Path reconstructed by concatenating shortest subpaths.
    """
    G = index.G

    if source not in G or target not in G:
        return None

    # 1) direct shortest path (local)
    try:
        direct_path = nx.shortest_path(G, source=source, target=target, weight='weight')
        direct_len = nx.path_weight(G, direct_path, weight='weight') if len(direct_path) >= 2 else 0.0
    except nx.NetworkXNoPath:
        direct_path = None
        direct_len = float('inf')

    best_path = direct_path
    best_len = direct_len

    # 2) use transit nodes via access sets
    source_access = index.access_nodes.get(source, [])
    target_access = index.access_nodes.get(target, [])

    # if no access nodes on either side, we can't use transit (fall back to direct)
    if source_access and target_access:
        # evaluate all pairs t_s in access(source) x t_t in access(target)
        for t_s, d_s in source_access:
            for t_t, d_t in target_access:
                # distance between t_s and t_t
                inter = index.transit_dist.get(t_s, {}).get(t_t, float('inf'))
                if inter == float('inf'):
                    continue
                total = d_s + inter + d_t
                if total < best_len:
                    # build path: source -> t_s, t_s -> t_t, t_t -> target
                    try:
                        p1 = nx.shortest_path(G, source=source, target=t_s, weight='weight')
                        p2 = nx.shortest_path(G, source=t_s, target=t_t, weight='weight')
                        p3 = nx.shortest_path(G, source=t_t, target=target, weight='weight')
                    except nx.NetworkXNoPath:
                        continue
                    # concatenate carefully avoiding duplicate nodes at joins
                    path = p1
                    if len(p2) >= 2:
                        path += p2[1:]
                    if len(p3) >= 2:
                        path += p3[1:]
                    # compute weight (to be robust, recompute)
                    length = nx.path_weight(G, path, weight='weight') if len(path) >= 2 else 0.0
                    # Check numerical closeness to 'total' maybe due to rounding; prefer computed length
                    if length < best_len:
                        best_len = length
                        best_path = path

    if best_path is None:
        return None
    return best_path, float(best_len)


if __name__ == "__main__":
    G = nx.grid_2d_graph(6, 6)  
    G = nx.convert_node_labels_to_integers(G) 
    for u, v in G.edges():
        G[u][v]['weight'] = 1.0

    G.add_edge(0, 35, weight=2.5)
    G.add_edge(5, 30, weight=2.0)

    idx = build_transit_index(G, k=6, choose_method="degree", max_access=3)

    s, t = 2, 33
    res = query_shortest_path_tnr(idx, s, t)
    if res:
        path, dist = res
        print("TNR path:", path)
        print("TNR distance:", dist)
    else:
        print("No path found between", s, t)
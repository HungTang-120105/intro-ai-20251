from collections import deque
from typing import List, Optional, Tuple, Any
import networkx as nx


def spfa(
    G: nx.Graph,
    source: Any,
    target: Any
) -> Optional[Tuple[List[Any], float, List[Any]]]:
    """
    SPFA (Shortest Path Faster Algorithm)
    - Cải tiến của Bellman-Ford, dùng queue để tối ưu hóa.
    - Hoạt động tốt với đồ thị có cạnh âm (nhưng không có chu trình âm).

    Parameters
    ----------
    G : nx.Graph
        Đồ thị có trọng số (có thể âm).
    source : Any
        Node bắt đầu.
    target : Any
        Node đích.

    Returns
    -------
    (path, cost, visited_order)
        path : danh sách node trên đường đi ngắn nhất.
        cost : tổng chi phí đường đi.
        visited_order : thứ tự các node được lấy ra khỏi queue (duyệt relax).
    """

    dist = {node: float('inf') for node in G.nodes}
    parent = {node: None for node in G.nodes}
    in_queue = {node: False for node in G.nodes}
    count = {node: 0 for node in G.nodes}  # số lần node được relax
    dist[source] = 0

    q = deque([source])
    in_queue[source] = True
    visited_order = []

    while q:
        u = q.popleft()
        in_queue[u] = False
        visited_order.append(u)

        for v in G.neighbors(u):
            w = G[u][v].get('weight', 1)
            if dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
                parent[v] = u
                if not in_queue[v]:
                    q.append(v)
                    in_queue[v] = True
                    count[v] += 1
                    # Phát hiện chu trình âm (nếu node được relax quá nhiều lần)
                    if count[v] > len(G.nodes):
                        raise ValueError("Graph contains a negative-weight cycle")

    # Nếu không tìm được đường đi
    if dist[target] == float('inf'):
        return None

    # Truy vết đường đi ngắn nhất
    path = []
    curr = target
    while curr is not None:
        path.append(curr)
        curr = parent[curr]
    path.reverse()

    return path, dist[target], visited_order


if __name__ == "__main__":
    G = nx.DiGraph()
    edges = [
        ('A', 'B', 2),
        ('A', 'C', 5),
        ('B', 'C', 3),
        ('B', 'D', 4),
        ('C', 'D', 2)
    ]
    G.add_weighted_edges_from(edges)

    result = spfa(G, 'A', 'D')
    print("Path:", result[0])
    print("Cost:", result[1])
    print("Visited order:", result[2])
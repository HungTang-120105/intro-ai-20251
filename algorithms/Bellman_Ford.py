from typing import List, Optional, Tuple, Any
import networkx as nx

def bellman_ford(
    G: nx.Graph,
    source: Any,
    target: Any
) -> Optional[Tuple[List[Any], float, List[Any]]]:
    """
    Bellman–Ford algorithm implementation.
    
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
        visited_order : thứ tự các node được relax (dùng để quan sát tiến trình).

    Raises
    ------
    ValueError : nếu đồ thị chứa chu trình âm reachable từ source.
    """

    # Khởi tạo khoảng cách và node cha
    dist = {node: float('inf') for node in G.nodes}
    parent = {node: None for node in G.nodes}
    dist[source] = 0
    visited_order = []

    # Relax tất cả các cạnh (|V| - 1) lần
    for i in range(len(G.nodes) - 1):
        updated = False
        for u, v, data in G.edges(data=True):
            w = data.get('weight', 1)
            if dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
                parent[v] = u
                updated = True
                visited_order.append(v)
            # if dist[v] + w < dist[u]:
            #     dist[u] = dist[v] + w
            #     parent[u] = v
            #     updated = True
            #     visited_order.append(u)
        if not updated:
            break  # không còn thay đổi → dừng sớm

    # Kiểm tra chu trình âm
    for u, v, data in G.edges(data=True):
        w = data.get('weight', 1)
        if dist[u] + w < dist[v]:
            raise ValueError("Graph contains a negative-weight cycle")

    # Nếu target unreachable
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
    G = nx.Graph()
    G.add_weighted_edges_from([
        ('A', 'B', 1),
        ('B', 'C', 2),
        ('A', 'C', 4),
        ('C', 'D', 2),
        ('B', 'D', 5)
    ])

    try:
        path, cost, visited_order = bellman_ford(G, 'A', 'D')
        print("Path:", path)
        print("Cost:", cost)
        print("Visited Order:", visited_order)
    except ValueError as e:
        print(e)
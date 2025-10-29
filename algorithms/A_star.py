from heapq import heappush, heappop
from typing import List, Optional, Tuple, Any, Callable
import networkx as nx

def astar(
    G: nx.Graph,
    source: Any,
    target: Any,
    heuristic: Optional[Callable[[Any, Any], float]] = None
) -> Optional[Tuple[List[Any], float, List[Any]]]:
    """
    A* Search algorithm implementation.

    Parameters
    ----------
    G : nx.Graph
        Đồ thị có thể là có trọng số. 
    source : Any
        Đỉnh bắt đầu.
    target : Any
        Đỉnh đích.
    heuristic : Callable[[Any, Any], float], optional
        Hàm heuristic h(n): ước lượng chi phí từ n -> target.

    Returns
    -------
    (path, cost, visited_order)
        path : danh sách các node trên đường đi ngắn nhất.
        cost : tổng chi phí đường đi.
        visited_order : thứ tự mở rộng node.
    """
    if heuristic is None:
        heuristic = lambda u, v: 0  # nếu không có heuristic thì trở thành Dijkstra

    open_set = []
    heappush(open_set, (0 + heuristic(source, target), 0, source))  # (f = g+h, g, node)
    came_from = {}
    g_score = {source: 0}
    visited_order = []

    while open_set:
        f, g, current = heappop(open_set)
        visited_order.append(current)

        if current == target:
            # reconstruct path
            path = [current]
            while current in came_from:
                current = came_from[current]
                path.append(current)
            path.reverse()
            return path, g_score[target], visited_order

        for neighbor in G.neighbors(current):
            weight = G[current][neighbor].get('weight', 1)
            tentative_g = g_score[current] + weight
            if tentative_g < g_score.get(neighbor, float('inf')):
                came_from[neighbor] = current
                g_score[neighbor] = tentative_g
                f_score = tentative_g + heuristic(neighbor, target)
                heappush(open_set, (f_score, tentative_g, neighbor))

    return None


if __name__ == "__main__":
    G = nx.Graph()
    G.add_node('A', pos=(0, 0))
    G.add_node('B', pos=(1, 2))
    G.add_node('C', pos=(2, 0))
    G.add_node('D', pos=(4, 1))

    # Các cạnh có trọng số
    edges = [
        ('A', 'B', 2.5),
        ('A', 'C', 2.0),
        ('B', 'D', 3.0),
        ('C', 'D', 2.2)
    ]
    G.add_weighted_edges_from(edges)
    
    def heuristic(u, v):
        pos_u = G.nodes[u].get('pos')
        pos_v = G.nodes[v].get('pos')
        if pos_u is None or pos_v is None:
            return 0.0
        (x1, y1), (x2, y2) = pos_u, pos_v
        return ((x1 - x2)**2 + (y1 - y2)**2)**.5

    # Chạy A*
    result = astar(G, 'A', 'D', heuristic)
    print("Path:", result[0])
    print("Cost:", result[1])
    print("Visited:", result[2])
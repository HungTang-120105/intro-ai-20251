from collections import deque
import networkx as nx
from typing import List, Optional, Tuple, Any

def bfs(
    G: nx.Graph,
    source: Any,
    target: Any
) -> Optional[Tuple[List[Any], int]]:
    """
    Tìm đường đi ngắn nhất (theo số cạnh) trong đồ thị vô hướng, không trọng số.

    Args:
        G: Đồ thị NetworkX (nx.Graph hoặc nx.DiGraph).
        source: Đỉnh bắt đầu.
        target: Đỉnh đích.

    Returns:
        Tuple (path, length):
            - path: danh sách các đỉnh trên đường đi.
            - length: số cạnh trên đường đi (0 nếu source == target).
        None nếu không tồn tại đường đi.
    """
    if source not in G or target not in G:
        return None
    
    q: deque[Any] = deque([source])
    parent: dict[Any, Optional[Any]]= {source : None}

    while q:
        u = q.popleft()
        if u == target:
            path = []
            while u is not None:
                path.append(u)
                u = parent[u]
            path.reverse()
            length = len(path) - 1
            return path, length
        
        for v in G.neighbors(u):
            if v not in parent:
                parent[v] = u
                q.append(v)

    return None


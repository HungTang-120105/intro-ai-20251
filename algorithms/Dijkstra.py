from queue import PriorityQueue
import networkx as nx
from typing import Any, Optional
import math

def dijkstra(G: nx.Graph, source, target) -> Optional[tuple[list[Any], float]]:
    pq = PriorityQueue()
    dist = {node : float('inf') for node in G.nodes}
    parent = {source : None}
    pq.put((0, source))
    dist[source] = 0

    while not pq.empty():
        du, u = pq.get()
        if (du > dist[u]):
            continue

        for v in G.neighbors(u):
            w = G[u][v].get('weight', 1)
            alt = dist[u] + w
            if alt < dist[v]:
                dist[v] = alt
                parent[v] = u
                pq.put((dist[v], v))
    
    if dist[target] == float('inf'):
        return None
    else:
        path = []
        cur = target
        while cur is not None:
            path.append(cur)
            cur = parent[cur]
        path.reverse()

        return path, dist[target]



G = nx.Graph()
G.add_weighted_edges_from([
    ('A', 'B', 4),
    ('A', 'C', 2),
    ('B', 'C', 1),
    ('B', 'D', 5),
    ('C', 'D', 8),
    ('C', 'E', 10),
    ('D', 'E', 2),
    ('D', 'Z', 6),
    ('E', 'Z', 3)
])

result = dijkstra(G, 'A', 'Z')

if result is None:
    print("Không có đường đi từ A đến Z")
else:
    path, total_weight = result
    print("Đường đi ngắn nhất A → Z:", path)
    print("Tổng trọng số:", total_weight)
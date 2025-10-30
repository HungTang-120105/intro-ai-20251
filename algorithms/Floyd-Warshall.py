import networkx as nx
import math

def floyd_warshall(G: nx.Graph, source, target):
    nodes = list(G.nodes)
    n = len(nodes)
    idx = {node: i for i, node in enumerate(nodes)}

    dist = [[math.inf] * n for _ in range(n)]
    nxt = [[None] * n for _ in range(n)]

    for i in range(n): dist[i][i] = 0
    for u, v, data in G.edges(data=True):
        w = data.get('weight', 1)
        i, j = idx[u], idx[v]
        dist[i][j] = w; nxt[i][j] = j
        if not G.is_directed():
            dist[j][i] = w; nxt[j][i] = i

    for k in range(n):
        for i in range(n):
            for j in range(n):
                if dist[i][j] > dist[i][k] + dist[k][j]:
                    dist[i][j] = dist[i][k] + dist[k][j]
                    nxt[i][j] = nxt[i][k]

    si, ti = idx[source], idx[target]
    if nxt[si][ti] is None: return None

    path = [source]
    while si != ti:
        si = nxt[si][ti]
        path.append(nodes[si])
    return path, dist[idx[source]][idx[target]]


if __name__ == "__main__":
    G = nx.Graph()
    G.add_weighted_edges_from([
        ('A', 'B', 4), ('A', 'C', 2),
        ('B', 'C', 1), ('B', 'D', 5),
        ('C', 'D', 8), ('C', 'E', 10),
        ('D', 'E', 2), ('D', 'Z', 6),
        ('E', 'Z', 3)
    ])
    G.add_node('F')

    print("A → Z:", floyd_warshall(G, 'A', 'Z'))  # Kỳ vọng: tổng trọng số ≈ 11
    print("A → F:", floyd_warshall(G, 'A', 'F'))  # Kỳ vọng: None

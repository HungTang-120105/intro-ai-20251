from collections import deque
import networkx as nx

def dfs(G: nx.Graph, source, target):
    if source not in G or target not in G:
        return None
    
    q = deque([source])
    parent = {source: None}

    while q:
        u = q.pop()
        if u == target:
            path = []
            while u is not None:
                path.append(u)
                u = parent[u]
            path.reverse()
            length = len(path) - 1
            return path, length
        
        for v in reversed(list(G.neighbors(u))):
            if v not in parent:
                parent[v] = u
                q.append(v)
    
    return None
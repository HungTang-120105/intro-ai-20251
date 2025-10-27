import networkx as nx
import random
from typing import Any, List, Optional, Tuple
from queue import PriorityQueue

def ucs(
    G: nx.Graph,
    source: Any,
    target: Any
) -> Optional[Tuple[List[Any], int]]:

  pq = PriorityQueue()
  pq.put((0, source))
  parent: dict[Any, Optional[Any]] = {source: None}
  visited: dict[Any, int] = {source: 0}

  while not pq.empty():
    current_cost, u = pq.get()

    if u == target:
      path = []
      while u is not None:
        path.append(u)
        u = parent[u]
      path.reverse()
      return path, current_cost
    
    if visited[u] != current_cost:
      continue

    for v in G.neighbors(u):
      weight = G[u][v].get('weight', 1)
      new_cost = current_cost + weight

      if v not in visited or new_cost < visited[v]:
        visited[v] = new_cost
        parent[v] = u
        pq.put((new_cost, v))

  return None
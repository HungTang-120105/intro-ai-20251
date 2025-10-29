# k shotest paths (can loop)
import networkx as nx
from typing import Any, List, Optional, Tuple, Callable
import ds.FibonacciHeap as fh

def k_sp(
    G : nx.Graph, 
    source: Any, 
    target: Any, 
    K: int = 1) -> Optional[List[Tuple[List[Any], float]]]:

  best = {node: fh.FibonacciHeap() for node in G.nodes}
  pq = fh.FibonacciHeap()
  best[source].push((0, source))
  pq.push((0, source))
  
  while not pq.is_empty():
    d, u = pq.pop()
    if d > -best[u].peek()[0]:
      continue
    for v in G.neighbors(u):
      weight = G[u][v].get('weight', 1)
      new_d = d + weight
      if best[v].size() < K:
        best[v].push((-new_d, v))
        pq.push((new_d, v))
      elif -best[v].peek()[0] > new_d:
        best[v].pop()
        best[v].push((-new_d, v))
        pq.push((new_d, v))
  

  ans = []
  while not best[target].is_empty():
    d, v = best[target].pop()
    d = -d
    ans.append(([], d))
  
  return ans
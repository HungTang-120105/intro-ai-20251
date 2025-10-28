# Lifelong Planning A* (LPA*)
from tracemalloc import start
import networkx as nx
from typing import Any, List, Optional, Tuple, Callable
import heapq
import random
import vis.tracer as tracer
import math

class PQ:
  def __init__(self):
    self.heap = []
    self.finder = {}
    self.REMOVED = '<removed>'
  
  def is_empty(self) -> bool:
    return not self.finder or len(self.heap) == 0
  
  def __len__(self) -> int:
    return len(self.finder)

  def push(self, item, priority):
    if item in self.finder:
      old_entry = self.finder.pop(item)
      old_entry[-1] = self.REMOVED

    entry = [priority, item]
    self.finder[item] = entry
    heapq.heappush(self.heap, entry)
    return entry
  
  def peek(self):
    while self.heap:
      priority, item = self.heap[0]
      if item != self.REMOVED:
        return (priority, item)
      heapq.heappop(self.heap)
    raise KeyError('peek from an empty priority queue')

  def contains(self, item) -> bool:
    return item in self.finder

  def pop(self):
    while self.heap:
      priority, item = heapq.heappop(self.heap)
      if item != self.REMOVED:
        del self.finder[item]
        return (priority, item)

    raise KeyError('pop from an empty priority queue')

def lpa_star(
    G: nx.Graph,
    source: Any,
    target: Any,
    heuristic: Optional[Callable[[Any, Any], float]] = None,
    # max_iterations: int = 1000
) -> Optional[Tuple[List[Any], float]]:
  if source not in G or target not in G:
    return None
  if source == target:
    return [source], 0

  INF = math.inf

  if heuristic is None:
    heuristic = lambda u, v: 0.0
  
  directed = G.is_directed()
  preds = (lambda u: G.predecessors(u)) if directed else (lambda u: G.neighbors(u))
  succs = (lambda u: G.successors(u)) if directed else (lambda u: G.neighbors(u))

  def w(u, v) -> float:
    if not G.has_edge(u, v):
      return INF
    if G.is_multigraph():
      return min(data.get('weight', 1.0) for _, data in G[u][v].items())
    return G[u][v].get('weight', 1.0)
  
  g: dict[Any, float] = {}
  rhs: dict[Any, float] = {}
  g[source] = INF
  rhs[source] = 0.0

  def g_val(u) -> float:
    return g.get(u, INF)

  def rhs_val(u) -> float:
    return rhs.get(u, INF)

  def calculate_key(u) -> Tuple[float, float]:
    m = min(g_val(u), rhs_val(u))
    return (m + heuristic(u, target), m)
  
  def update_vertex(u, pq : PQ):
    if u != source:
      rhs[u] = min((g_val(s) + w(s, u) for s in preds(u)), default = INF)
    
    if rhs_val(u) != g_val(u):
      pq.push(u, calculate_key(u))
    
  pq = PQ()
  pq.push(source, calculate_key(source))

  def pq_top_key() -> Tuple[float, float]:
    if pq.is_empty():
      return (INF, INF)
    _, u = pq.pop()
    k_cur = calculate_key(u)
    pq.push(u, k_cur)
    return k_cur

  while True:
    if rhs_val(target) == g_val(target):
      if pq_top_key() >= calculate_key(target):
        break
    
    k_old, u = pq.pop()
    k_cur = calculate_key(u)
    if k_old < k_cur:
      pq.push(u, k_cur)
      continue
  
    if g_val(u) > rhs_val(u):
      g[u] = rhs_val(u)
      for s in succs(u):
        update_vertex(s, pq)
    else:
      g[u] = INF
      update_vertex(u, pq)
      for s in succs(u):
        update_vertex(s, pq)

  if not math.isfinite(g_val(target)):
    return None
  
  path = [source]
  cost = 0.0
  u = source
  guard = 0
  limit = len(G) + 6
  while u != target and guard < limit:
    guard += 1
    best_v = None
    best_cost = INF
    best_w = INF
    for v in succs(u):
      w_uv = w(u, v)
      cand = g_val(v) + w_uv
      if cand < best_cost:
        best_cost = cand
        best_v = v
        best_w = w_uv

    if best_v is None or not math.isfinite(best_cost):
      return None
    
    cost += best_w
    u = best_v
    path.append(u)
  
  if path[-1] != target:
    return None
  
  return path, cost

import networkx as nx
from typing import Any, List, Optional, Tuple, Callable
import ds.FibonacciHeap as fh
import math


def yen(
        G: nx.Graph,
        source: Any,
        target: Any,
        K: int = 1) -> Optional[List[Tuple[List[Any], float]]]:

  if source == target:
    return [([source], 0.0)]

  def edge_weight(u: Any, v: Any) -> float:
    if not G.has_edge(u, v):
      return math.inf
    if hasattr(G, "is_multigraph") and G.is_multigraph():
      data = G.get_edge_data(u, v, default={})
      if not data:
        return math.inf
      return min(float(d.get('weight', 1.0)) for _, d in data.items())
    return float(G[u][v].get('weight', 1.0))

  def path_cost(path: List[Any]) -> float:
    total = 0.0
    for i in range(len(path) - 1):
      w = edge_weight(path[i], path[i + 1])
      if not math.isfinite(w):
        return math.inf
      total += w
    return total

  def SP_with_bans(
      start: Any,
      goal: Any,
      banned_nodes: set[Any],
      banned_edges: set[Tuple[Any, Any]],
  ) -> Optional[Tuple[List[Any], float]]:
    if start in banned_nodes or goal in banned_nodes:
      return None

    dist: dict[Any, float] = {start: 0.0}
    parent: dict[Any, Any] = {}
    pq = fh.FibonacciHeap()
    counter = 0
    pq.push((0.0, counter, start))
    counter += 1

    while not pq.is_empty():
      d, _, u = pq.pop()
      if d > dist.get(u, math.inf):
        continue
      if u == goal:
        break
      if u in banned_nodes:
        continue
      for v in G.neighbors(u):
        if v in banned_nodes:
          continue
        if (u, v) in banned_edges:
          continue
        w = edge_weight(u, v)
        if not math.isfinite(w):
          continue
        nd = d + w
        if nd < dist.get(v, math.inf):
          dist[v] = nd
          parent[v] = u
          pq.push((nd, counter, v))
          counter += 1

    if goal not in dist:
      return None

    path = [goal]
    cur = goal
    while cur != start:
      cur = parent.get(cur)
      if cur is None:
        return None
      path.append(cur)
    path.reverse()
    return path, dist[goal]

  first = SP_with_bans(source, target, set(), set())
  if first is None:
    return []
  A: List[Tuple[List[Any], float]] = [first]

  B = fh.FibonacciHeap()
  cand_seen: set[Tuple[Any, ...]] = set()
  tie = 0

  for _ in range(1, K):
    last_path, _ = A[-1]
    n = len(last_path)
    for i in range(n - 1):
      spur_node = last_path[i]
      root_path = last_path[:i + 1]

      banned_edges: set[Tuple[Any, Any]] = set()
      for p, _cost in A:
        if len(p) > i and p[:i + 1] == root_path:
          u, v = p[i], p[i + 1]
          banned_edges.add((u, v))
          if not G.is_directed():
            banned_edges.add((v, u))

      banned_nodes = set(root_path[:-1])

      spur = SP_with_bans(
          spur_node, target, banned_nodes, banned_edges)
      if spur is None:
        continue
      spur_path, spur_cost = spur
      total_path = root_path[:-1] + spur_path
      total_cost = path_cost(root_path) + spur_cost

      key = tuple(total_path)
      if key not in cand_seen:
        cand_seen.add(key)
        B.push((total_cost, tie, total_path))
        tie += 1

    if B.is_empty():
      break

    cost_k, _, path_k = B.pop()
    A.append((path_k, float(cost_k)))

  return A

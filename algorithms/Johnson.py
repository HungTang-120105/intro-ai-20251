import networkx as nx
from typing import Any, List, Optional, Tuple, Callable
from queue import PriorityQueue
import random
from collections import deque
import vis.tracer as tracer
import ds.FibonacciHeap as fh

def johnson(
    G : nx.Graph) -> Optional[dict[Any, dict[Any, float]]]:
  G_aug = G.copy()
  start = '_start_'
  G_aug.add_node(start)
  for node in G_aug.nodes:
    if node != start:
      G_aug.add_edge(start, node, weight = 0)

  potential = {node: float('inf') for node in G_aug.nodes}
  potential[start] = 0
  in_queue = {node: False for node in G_aug.nodes}
  queue = deque([start])
  cnt = {node: 0 for node in G_aug.nodes}
  while len(queue) > 0:
    u = queue.popleft()
    in_queue[u] = False
    for v in G_aug.neighbors(u):
      weight = G_aug[u][v].get('weight', 1)
      if potential[u] + weight < potential[v]:
        potential[v] = potential[u] + weight
        if not in_queue[v]:
          cnt[v] += 1
          if cnt[v] > len(G_aug.nodes):
            return None
          queue.append(v)
          in_queue[v] = True
  
  for u, v in G_aug.edges:
    if u != start and v != start:
      G_aug[u][v]['weight'] += potential[u] - potential[v]

  dist = {s: {node: float('inf') for node in G.nodes} for s in G.nodes}
  for s in G.nodes:
    dist[s][s] = 0
    # q = PriorityQueue()
    q = fh.FibonacciHeap()
    q.push((0, s))
    while not q.is_empty():
      current_dist, u = q.pop()
      if current_dist > dist[s][u]:
        continue
      for v in G.neighbors(u):
        weight = G_aug[u][v].get('weight', 1)
        if dist[s][u] + weight < dist[s][v]:
          dist[s][v] = dist[s][u] + weight
          q.put((dist[s][v], v))
    
    for v in G.nodes:
      dist[s][v] += potential[v] - potential[s]

  return dist

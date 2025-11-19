import networkx as nx
from typing import Any, List, Optional, Tuple
from vis.tracer import get_tracer
import random

def aco(G : nx.Graph, source: any, target: any, 
        max_iterations: int = 100, num_ants: int = 10, alpha: float = 1.0, beta: float = 2.0, evaporation_rate: float = 0.5, initial_pheromone: float = 1.0) -> Optional[Tuple[List[Any], int]]:
  for e in G.edges():
    G[e[0]][e[1]]['pheromone'] = initial_pheromone
  
  best_path = None
  best_length = float('inf')

  for iteration in range(max_iterations):
    tr = get_tracer()
    successful_paths = []

    for ant in range(num_ants):
      current_path = [source]
      visited = {source}
      current_node = source

      while current_node != target:
        allowed_nodes = [n for n in G.neighbors(current_node) if n not in visited]

        if not allowed_nodes:
          break

        probabilities = []
        for neighbor in allowed_nodes:
          pheromone = G[current_node][neighbor]['pheromone'] ** alpha
          heuristic = (1.0 / G[current_node][neighbor].get('weight', 1.0)) ** beta
          probabilities.append(pheromone * heuristic)

        total = sum(probabilities)
        probabilities = [p / total for p in probabilities]
        next_node = random.choices(allowed_nodes, weights=probabilities)[0]
        current_path.append(next_node)

        tr.emit("ACO", "construct", {
          "path" : current_path,
          "iteration": iteration,
        })

        visited.add(next_node)
        current_node = next_node

      if current_node == target:
        successful_paths.append(current_path)
    
    for u, v in G.edges():
      G[u][v]['pheromone'] *= (1 - evaporation_rate)
    evaporate_snapshot = { (u, v): G[u][v]['pheromone'] for u, v in G.edges() }
    tr.emit("ACO", "evaporate", {
      "iteration": iteration,
      "evaporate" : evaporate_snapshot
    })
    
    for path in successful_paths:
      L = 0
      for i in range(len(path) - 1):
        L += G[path[i]][path[i + 1]].get('weight', 1.0)
      
      if L < best_length:
        best_length = L
        best_path = path
      
      delta_tau = initial_pheromone / L
      for i in range(len(path) - 1):
        u, v = path[i], path[i + 1]
        G[u][v]['pheromone'] += delta_tau
    
    tr.emit("ACO", "iteration", {
      "iteration": iteration,
      "best_path": best_path,
      "best_length": best_length,
      "successful_paths": successful_paths
    })

  if best_path is not None:
    return best_path, int(best_length)
  return None

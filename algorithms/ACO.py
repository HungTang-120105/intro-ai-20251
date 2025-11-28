import networkx as nx
from typing import Any, List, Optional, Tuple
from vis.tracer import get_tracer
import random

def aco(
    G: nx.Graph,
    source: any,
    target: any,
    max_iterations: int = 100,
    num_ants: int = 10,
    alpha: float = 1.0,
    beta: float = 2.0,
    evaporation_rate: float = 0.5,
    initial_pheromone: float = 1.0,
    patience: Optional[int] = None, 
) -> Optional[Tuple[List[Any], int]]:
  for e in G.edges():
    G[e[0]][e[1]]['pheromone'] = initial_pheromone
  
  best_path = None
  best_length = float('inf')
  no_improve = 0

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

        visited.add(next_node)
        current_node = next_node

      if current_node == target:
        successful_paths.append(current_path)
    
    for u, v in G.edges():
      G[u][v]['pheromone'] *= (1 - evaporation_rate)
    pher = sorted(((u, v, G[u][v]['pheromone']) for u, v in G.edges()), key=lambda x: -x[2])[:10]
    tr.emit("ACO", "evaporate", {
      "iteration": iteration,
      "pheromone_top": pher
    })
    
    iter_best_path = None
    iter_best_len = float('inf')
    for path in successful_paths:
      L = 0
      for i in range(len(path) - 1):
        L += G[path[i]][path[i + 1]].get('weight', 1.0)
      if L < iter_best_len:
        iter_best_len = L
        iter_best_path = path
      
      if L < best_length:
        best_length = L
        best_path = path
      
      delta_tau = initial_pheromone / L
      for i in range(len(path) - 1):
        u, v = path[i], path[i + 1]
        G[u][v]['pheromone'] += delta_tau
    
    improved = iter_best_path is not None and iter_best_len < best_length
    if improved:
      best_length = iter_best_len
      best_path = iter_best_path
      no_improve = 0
    else:
      no_improve += 1

    tr.emit("ACO", "iteration", {
      "iteration": iteration,
      "path": iter_best_path if iter_best_path is not None else best_path,
      "iter_best_length": iter_best_len if iter_best_path is not None else None,
      "best_path": best_path,
      "best_length": best_length,
      "successful_paths": successful_paths[:3],
      "num_success": len(successful_paths),
    })

    if patience is not None and no_improve >= patience:
      tr.emit("ACO", "converged", {
        "iteration": iteration,
        "best_path": best_path,
        "best_length": best_length,
        "patience": patience,
      })
      break

  if best_path is not None:
    return best_path, int(best_length)
  return None

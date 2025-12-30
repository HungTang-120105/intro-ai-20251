// Algorithm registry and utilities

import { bfs } from './bfs';
import { dfs } from './dfs';
import { dijkstra } from './dijkstra';
import { astar } from './astar';
import { bellmanFord } from './bellmanFord';
import { ucs } from './ucs';
import { aco } from './aco';
import { lpaStar } from './lpaStar';
import { dStarLite } from './dStarLite';
import { dls } from './dls';
import { ids } from './ids';
import { floydWarshall } from './floydWarshall';
import { spfa } from './spfa';
import { johnson } from './johnson';
import { localBeamSearch } from './localBeamSearch';

/**
 * Available algorithms with metadata
 */
export const algorithms = [
  {
    id: 'bfs',
    name: 'BFS',
    fullName: 'Breadth-First Search',
    description: 'Explores all neighbors at current depth before moving deeper. Finds shortest path by edge count.',
    complexity: 'O(V + E)',
    optimal: 'Unweighted only',
    color: '#3b82f6', // Blue
    run: bfs,
  },
  {
    id: 'dfs',
    name: 'DFS',
    fullName: 'Depth-First Search',
    description: 'Explores as far as possible along each branch before backtracking. Not optimal.',
    complexity: 'O(V + E)',
    optimal: 'No',
    color: '#8b5cf6', // Purple
    run: dfs,
  },
  {
    id: 'dls',
    name: 'DLS',
    fullName: 'Depth Limited Search',
    description: 'DFS with a depth limit to prevent infinite exploration. Useful when solution depth is known.',
    complexity: 'O(b^d)',
    optimal: 'No',
    color: '#a855f7', // Violet
    run: dls,
  },
  {
    id: 'ids',
    name: 'IDS',
    fullName: 'Iterative Deepening Search',
    description: 'Combines DFS space efficiency with BFS completeness. Repeats DLS with increasing depth.',
    complexity: 'O(b^d)',
    optimal: 'Unweighted only',
    color: '#7c3aed', // Purple deeper
    run: ids,
  },
  {
    id: 'ucs',
    name: 'UCS',
    fullName: 'Uniform Cost Search',
    description: 'Always expands the node with lowest path cost. Optimal for non-negative weights.',
    complexity: 'O((V + E) log V)',
    optimal: 'Yes (non-negative)',
    color: '#06b6d4', // Cyan
    run: ucs,
  },
  {
    id: 'dijkstra',
    name: 'Dijkstra',
    fullName: "Dijkstra's Algorithm",
    description: 'Finds shortest path in weighted graphs. Always expands the node with smallest distance.',
    complexity: 'O((V + E) log V)',
    optimal: 'Yes (positive weights)',
    color: '#22c55e', // Green
    run: dijkstra,
  },
  {
    id: 'astar',
    name: 'A*',
    fullName: 'A* Search',
    description: 'Uses heuristic to guide search towards the goal. Often faster than Dijkstra.',
    complexity: 'O((V + E) log V)',
    optimal: 'Yes (with admissible heuristic)',
    color: '#f59e0b', // Amber
    run: astar,
  },
  {
    id: 'lpastar',
    name: 'LPA*',
    fullName: 'Lifelong Planning A*',
    description: 'Incremental A* that efficiently updates when graph changes. Good for dynamic environments.',
    complexity: 'O(V² log V) worst',
    optimal: 'Yes',
    color: '#ec4899', // Pink
    run: lpaStar,
    incremental: true, // Supports incremental replanning
  },
  {
    id: 'dstarlite',
    name: 'D* Lite',
    fullName: 'D* Lite',
    description: 'Incremental heuristic search for robot navigation. Efficiently replans when edges change.',
    complexity: 'O(V² log V) worst',
    optimal: 'Yes',
    color: '#f472b6', // Rose
    run: dStarLite,
    incremental: true, // Supports incremental replanning
  },
  {
    id: 'bellman-ford',
    name: 'Bellman-Ford',
    fullName: 'Bellman-Ford Algorithm',
    description: 'Handles negative edge weights. Can detect negative cycles.',
    complexity: 'O(V × E)',
    optimal: 'Yes',
    color: '#ef4444', // Red
    run: bellmanFord,
  },
  {
    id: 'spfa',
    name: 'SPFA',
    fullName: 'Shortest Path Faster Algorithm',
    description: 'Queue-based optimization of Bellman-Ford. Faster in practice for sparse graphs.',
    complexity: 'O(V × E) worst',
    optimal: 'Yes',
    color: '#f97316', // Orange
    run: spfa,
  },
  {
    id: 'floyd-warshall',
    name: 'Floyd-Warshall',
    fullName: 'Floyd-Warshall Algorithm',
    description: 'Finds shortest paths between all pairs of nodes. Uses dynamic programming.',
    complexity: 'O(V³)',
    optimal: 'Yes',
    color: '#14b8a6', // Teal
    run: floydWarshall,
  },
  {
    id: 'johnson',
    name: 'Johnson',
    fullName: "Johnson's Algorithm",
    description: 'All-pairs shortest paths. Handles negative edges using Bellman-Ford + Dijkstra.',
    complexity: 'O(V² log V + VE)',
    optimal: 'Yes',
    color: '#0ea5e9', // Sky
    run: johnson,
  },
  {
    id: 'local-beam',
    name: 'Local Beam',
    fullName: 'Local Beam Search',
    description: 'Keeps k best states at each level. Uses heuristic to guide search. Memory efficient.',
    complexity: 'O(k × b × d)',
    optimal: 'No (greedy)',
    color: '#d946ef', // Fuchsia
    run: localBeamSearch,
  },
  {
    id: 'aco',
    name: 'ACO',
    fullName: 'Ant Colony Optimization',
    description: 'Metaheuristic inspired by ant behavior. Stochastic, may find different paths each run.',
    complexity: 'O(iterations × ants × E)',
    optimal: 'Approximate',
    color: '#84cc16', // Lime
    run: aco,
  },
];

/**
 * Get algorithm by id
 */
export function getAlgorithm(id) {
  return algorithms.find(a => a.id === id);
}

/**
 * Run an algorithm and return results
 */
export function runAlgorithm(algorithmId, graph, source, target, isDirected = false, options = {}) {
  const algo = getAlgorithm(algorithmId);
  if (!algo) {
    throw new Error(`Unknown algorithm: ${algorithmId}`);
  }

  const startTime = performance.now();
  const result = algo.run(graph, source, target, isDirected, options);
  const endTime = performance.now();

  return {
    ...result,
    algorithmId,
    algorithmName: algo.name,
    executionTime: endTime - startTime,
  };
}

/**
 * Compare multiple algorithms on the same graph
 */
export function compareAlgorithms(algorithmIds, graph, source, target) {
  const results = [];

  for (const id of algorithmIds) {
    const result = runAlgorithm(id, graph, source, target);
    results.push(result);
  }

  return results;
}

export default algorithms;

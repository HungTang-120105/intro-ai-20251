// Algorithm registry and utilities

import { bfs } from './bfs';
import { dfs } from './dfs';
import { dijkstra } from './dijkstra';
import { astar } from './astar';
import { bellmanFord } from './bellmanFord';

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
    id: 'bellman-ford',
    name: 'Bellman-Ford',
    fullName: 'Bellman-Ford Algorithm',
    description: 'Handles negative edge weights. Can detect negative cycles.',
    complexity: 'O(V × E)',
    optimal: 'Yes',
    color: '#ef4444', // Red
    run: bellmanFord,
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
export function runAlgorithm(algorithmId, graph, source, target, isDirected = false) {
  const algo = getAlgorithm(algorithmId);
  if (!algo) {
    throw new Error(`Unknown algorithm: ${algorithmId}`);
  }

  const startTime = performance.now();
  const result = algo.run(graph, source, target, isDirected);
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

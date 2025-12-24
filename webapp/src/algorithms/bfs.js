// Breadth-First Search algorithm with step-by-step visualization

import { getNeighbors } from '../utils/graphUtils';

/**
 * BFS algorithm implementation with event emission for visualization
 * @param {Object} graph - Graph object with nodes and edges
 * @param {string} source - Source node id
 * @param {string} target - Target node id
 * @param {boolean} isDirected - Whether the graph is directed
 * @returns {Object} - Result with path, cost, steps, and visited order
 */
export function bfs(graph, source, target, isDirected = false) {
  const steps = [];
  const visited = new Set();
  const parent = new Map();
  const queue = [source];
  const visitOrder = [];

  parent.set(source, null);

  // Initial step
  steps.push({
    type: 'init',
    current: null,
    queue: [...queue],
    visited: [...visited],
    frontier: [...queue],
    parent: Object.fromEntries(parent),
    message: `Starting BFS from node ${source}`,
  });

  while (queue.length > 0) {
    const current = queue.shift();

    if (visited.has(current)) continue;
    visited.add(current);
    visitOrder.push(current);

    // Expand step
    steps.push({
      type: 'expand',
      current,
      queue: [...queue],
      visited: [...visited],
      frontier: [...queue],
      parent: Object.fromEntries(parent),
      message: `Expanding node ${current}`,
    });

    // Check if we reached the target
    if (current === target) {
      const path = reconstructPath(parent, target);
      const cost = calculatePathCost(graph, path);

      steps.push({
        type: 'goal',
        current,
        path,
        cost,
        visited: [...visited],
        message: `Found target ${target}! Path length: ${path.length}, Cost: ${cost}`,
      });

      return {
        found: true,
        path,
        cost,
        steps,
        visitOrder,
        nodesVisited: visited.size,
      };
    }

    // Explore neighbors
    const neighbors = getNeighbors(graph, current, isDirected);
    for (const { node: neighbor } of neighbors) {
      if (!visited.has(neighbor) && !parent.has(neighbor)) {
        parent.set(neighbor, current);
        queue.push(neighbor);

        steps.push({
          type: 'frontier',
          current,
          neighbor,
          queue: [...queue],
          visited: [...visited],
          frontier: [...queue],
          parent: Object.fromEntries(parent),
          message: `Adding ${neighbor} to queue (parent: ${current})`,
        });
      }
    }
  }

  // No path found
  steps.push({
    type: 'no_path',
    visited: [...visited],
    message: `No path found from ${source} to ${target}`,
  });

  return {
    found: false,
    path: [],
    cost: Infinity,
    steps,
    visitOrder,
    nodesVisited: visited.size,
  };
}

/**
 * Reconstruct path from parent map
 */
function reconstructPath(parent, target) {
  const path = [];
  let current = target;
  while (current !== null) {
    path.unshift(current);
    current = parent.get(current);
  }
  return path;
}

/**
 * Calculate total cost of a path
 */
function calculatePathCost(graph, path) {
  let cost = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const edge = graph.edges.find(
      e => (e.from === path[i] && e.to === path[i + 1]) ||
        (e.from === path[i + 1] && e.to === path[i])
    );
    cost += edge ? edge.weight : 1;
  }
  return cost;
}

export default bfs;

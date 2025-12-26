// Iterative Deepening Search algorithm with step-by-step visualization

import { getNeighbors } from '../utils/graphUtils';

/**
 * IDS algorithm implementation with event emission for visualization
 * @param {Object} graph - Graph object with nodes and edges
 * @param {string} source - Source node id
 * @param {string} target - Target node id
 * @param {boolean} isDirected - Whether the graph is directed
 * @param {Object} options - Options object (can contain maxDepth)
 * @returns {Object} - Result with path, cost, steps, and visited order
 */
export function ids(graph, source, target, isDirected = false, options = {}) {
  const maxDepth = options.maxDepth || 50;
  const steps = [];
  const visitOrder = [];

  // Initial step
  steps.push({
    type: 'init',
    current: null,
    queue: [],
    visited: [],
    frontier: [],
    maxDepth,
    message: `Starting IDS from ${source} to ${target} (max depth: ${maxDepth})`,
  });

  // Iterate through increasing depth limits
  for (let depthLimit = 0; depthLimit <= maxDepth; depthLimit++) {
    steps.push({
      type: 'iteration',
      depthLimit,
      visited: [...visitOrder],
      message: `Starting iteration with depth limit ${depthLimit}`,
    });

    const result = dlsHelper(graph, source, target, isDirected, depthLimit, steps, visitOrder);

    if (result.found) {
      return {
        found: true,
        path: result.path,
        cost: result.cost,
        steps,
        visitOrder,
        nodesVisited: visitOrder.length,
        depthFound: depthLimit,
      };
    }
  }

  // No path found
  steps.push({
    type: 'no_path',
    visited: [...visitOrder],
    message: `No path found from ${source} to ${target} within max depth ${maxDepth}`,
  });

  return {
    found: false,
    path: [],
    cost: Infinity,
    steps,
    visitOrder,
    nodesVisited: visitOrder.length,
  };
}

/**
 * DLS helper for IDS
 */
function dlsHelper(graph, source, target, isDirected, depthLimit, steps, visitOrder) {
  const visited = new Set();
  const parent = new Map();
  const depth = new Map();
  const stack = [source];

  parent.set(source, null);
  depth.set(source, 0);

  while (stack.length > 0) {
    const current = stack.pop();

    if (visited.has(current)) continue;
    visited.add(current);
    visitOrder.push(current);

    const currentDepth = depth.get(current);

    // Expand step
    steps.push({
      type: 'expand',
      current,
      queue: [...stack],
      visited: [...visited],
      frontier: [...stack],
      parent: Object.fromEntries(parent),
      currentDepth,
      depthLimit,
      message: `[Depth ${depthLimit}] Expanding ${current} at depth ${currentDepth}`,
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
        depthLimit,
        message: `Found target at depth ${depthLimit}! Path: ${path.join(' → ')}`,
      });

      return { found: true, path, cost };
    }

    // Explore neighbors if within depth limit
    if (currentDepth < depthLimit) {
      const neighbors = getNeighbors(graph, current, isDirected);
      for (const { node: neighbor } of [...neighbors].reverse()) {
        if (!visited.has(neighbor) && !parent.has(neighbor)) {
          parent.set(neighbor, current);
          depth.set(neighbor, currentDepth + 1);
          stack.push(neighbor);
        }
      }
    }
  }

  return { found: false };
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

export default ids;

// Depth Limited Search algorithm with step-by-step visualization

import { getNeighbors } from '../utils/graphUtils';

/**
 * DLS algorithm implementation with event emission for visualization
 * @param {Object} graph - Graph object with nodes and edges
 * @param {string} source - Source node id
 * @param {string} target - Target node id
 * @param {boolean} isDirected - Whether the graph is directed
 * @param {Object} options - Options object (can contain depthLimit)
 * @returns {Object} - Result with path, cost, steps, and visited order
 */
export function dls(graph, source, target, isDirected = false, options = {}) {
  const depthLimit = options.depthLimit || 50;
  const steps = [];
  const visited = new Set();
  const parent = new Map();
  const depth = new Map();
  const stack = [source];
  const visitOrder = [];

  parent.set(source, null);
  depth.set(source, 0);

  // Initial step
  steps.push({
    type: 'init',
    current: null,
    queue: [...stack],
    visited: [...visited],
    frontier: [...stack],
    parent: Object.fromEntries(parent),
    depthLimit,
    message: `Starting DLS from node ${source} with depth limit ${depthLimit}`,
  });

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
      message: `Expanding node ${current} at depth ${currentDepth}`,
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

    // Explore neighbors if within depth limit
    if (currentDepth < depthLimit) {
      const neighbors = getNeighbors(graph, current, isDirected);
      // Reverse to maintain left-to-right order when popping from stack
      for (const { node: neighbor } of [...neighbors].reverse()) {
        if (!visited.has(neighbor) && !parent.has(neighbor)) {
          parent.set(neighbor, current);
          depth.set(neighbor, currentDepth + 1);
          stack.push(neighbor);

          steps.push({
            type: 'frontier',
            current,
            neighbor,
            queue: [...stack],
            visited: [...visited],
            frontier: [...stack],
            parent: Object.fromEntries(parent),
            neighborDepth: currentDepth + 1,
            message: `Adding ${neighbor} to stack at depth ${currentDepth + 1}`,
          });
        }
      }
    } else {
      steps.push({
        type: 'depth_limit',
        current,
        visited: [...visited],
        message: `Depth limit ${depthLimit} reached at node ${current}`,
      });
    }
  }

  // No path found
  steps.push({
    type: 'no_path',
    visited: [...visited],
    message: `No path found from ${source} to ${target} within depth limit ${depthLimit}`,
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

export default dls;

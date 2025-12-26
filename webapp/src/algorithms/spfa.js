// SPFA (Shortest Path Faster Algorithm) with step-by-step visualization

import { getNeighbors } from '../utils/graphUtils';

/**
 * SPFA algorithm implementation with event emission for visualization
 * An optimization of Bellman-Ford using a queue
 * @param {Object} graph - Graph object with nodes and edges
 * @param {string} source - Source node id
 * @param {string} target - Target node id
 * @param {boolean} isDirected - Whether the graph is directed
 * @returns {Object} - Result with path, cost, steps, and visited order
 */
export function spfa(graph, source, target, isDirected = false) {
  const steps = [];
  const visitOrder = [];
  const dist = new Map();
  const parent = new Map();
  const inQueue = new Map();
  const count = new Map();
  const queue = [source];
  const n = graph.nodes.size;

  // Initialize
  for (const [id] of graph.nodes) {
    dist.set(id, Infinity);
    parent.set(id, null);
    inQueue.set(id, false);
    count.set(id, 0);
  }

  dist.set(source, 0);
  inQueue.set(source, true);

  // Initial step
  steps.push({
    type: 'init',
    current: null,
    queue: [...queue],
    visited: [],
    frontier: [...queue],
    parent: Object.fromEntries(parent),
    distances: Object.fromEntries(dist),
    message: `Starting SPFA from node ${source}`,
  });

  while (queue.length > 0) {
    const current = queue.shift();
    inQueue.set(current, false);
    visitOrder.push(current);

    // Expand step
    steps.push({
      type: 'expand',
      current,
      queue: [...queue],
      visited: [...visitOrder],
      frontier: [...queue],
      parent: Object.fromEntries(parent),
      distances: Object.fromEntries(dist),
      message: `Processing node ${current} with distance ${dist.get(current).toFixed(1)}`,
    });

    const neighbors = getNeighbors(graph, current, isDirected);

    for (const { node: neighbor, weight } of neighbors) {
      const newDist = dist.get(current) + weight;

      if (newDist < dist.get(neighbor)) {
        const oldDist = dist.get(neighbor);
        dist.set(neighbor, newDist);
        parent.set(neighbor, current);

        steps.push({
          type: 'frontier',
          current,
          neighbor,
          queue: [...queue],
          visited: [...visitOrder],
          frontier: [...queue],
          parent: Object.fromEntries(parent),
          distances: Object.fromEntries(dist),
          oldDist,
          newDist,
          message: `Relaxed ${current} → ${neighbor}: ${oldDist === Infinity ? '∞' : oldDist.toFixed(1)} → ${newDist.toFixed(1)}`,
        });

        if (!inQueue.get(neighbor)) {
          queue.push(neighbor);
          inQueue.set(neighbor, true);
          count.set(neighbor, count.get(neighbor) + 1);

          // Check for negative cycle
          if (count.get(neighbor) > n) {
            steps.push({
              type: 'negative_cycle',
              current,
              neighbor,
              visited: [...visitOrder],
              message: `Negative cycle detected at node ${neighbor}!`,
            });

            return {
              found: false,
              path: [],
              cost: -Infinity,
              steps,
              visitOrder,
              nodesVisited: visitOrder.length,
              negativeCycle: true,
            };
          }
        }
      }
    }
  }

  // Check if target is reachable
  if (dist.get(target) === Infinity) {
    steps.push({
      type: 'no_path',
      visited: [...visitOrder],
      distances: Object.fromEntries(dist),
      message: `No path found from ${source} to ${target}`,
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

  // Reconstruct path
  const path = reconstructPath(parent, target);

  steps.push({
    type: 'goal',
    current: target,
    path,
    cost: dist.get(target),
    visited: [...visitOrder],
    distances: Object.fromEntries(dist),
    message: `Found path: ${path.join(' → ')} with cost ${dist.get(target).toFixed(1)}`,
  });

  return {
    found: true,
    path,
    cost: dist.get(target),
    steps,
    visitOrder,
    nodesVisited: visitOrder.length,
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

export default spfa;

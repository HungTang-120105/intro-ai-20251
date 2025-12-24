// Bellman-Ford algorithm with step-by-step visualization

/**
 * Bellman-Ford algorithm implementation with event emission for visualization
 * Supports negative edge weights (but not negative cycles)
 * @param {Object} graph - Graph object with nodes and edges
 * @param {string} source - Source node id
 * @param {string} target - Target node id
 * @param {boolean} isDirected - Whether the graph is directed
 * @returns {Object} - Result with path, cost, steps, and visited order
 */
export function bellmanFord(graph, source, target, isDirected = false) {
  const steps = [];
  const dist = new Map();
  const parent = new Map();
  const visitOrder = [];
  const nodes = Array.from(graph.nodes.keys());
  const n = nodes.length;

  // Initialize distances
  for (const id of nodes) {
    dist.set(id, Infinity);
    parent.set(id, null);
  }
  dist.set(source, 0);

  // Initial step
  steps.push({
    type: 'init',
    iteration: 0,
    distances: Object.fromEntries(dist),
    parent: Object.fromEntries(parent),
    message: `Starting Bellman-Ford from node ${source}. Will run ${n - 1} iterations.`,
  });

  // Relax all edges (n-1) times
  for (let i = 0; i < n - 1; i++) {
    let updated = false;

    steps.push({
      type: 'iteration_start',
      iteration: i + 1,
      distances: Object.fromEntries(dist),
      message: `Iteration ${i + 1}/${n - 1}: Relaxing all edges`,
    });

    for (const edge of graph.edges) {
      // Relaxing edge from -> to
      const u = edge.from;
      const v = edge.to;
      const w = edge.weight;

      if (dist.get(u) !== Infinity && dist.get(u) + w < dist.get(v)) {
        const oldDist = dist.get(v);
        dist.set(v, dist.get(u) + w);
        parent.set(v, u);
        updated = true;

        if (!visitOrder.includes(v)) {
          visitOrder.push(v);
        }

        steps.push({
          type: 'relax',
          iteration: i + 1,
          from: u,
          to: v,
          weight: w,
          oldDistance: oldDist,
          newDistance: dist.get(v),
          distances: Object.fromEntries(dist),
          parent: Object.fromEntries(parent),
          message: oldDist === Infinity 
            ? `Discovered ${v} from ${u} (distance: ${dist.get(v)})`
            : `Updated ${v}: ${oldDist} → ${dist.get(v)} (via ${u})`,
        });
      }

      // For undirected graph, also relax to -> from
      if (!isDirected && dist.get(v) !== Infinity && dist.get(v) + w < dist.get(u)) {
        const oldDist = dist.get(u);
        dist.set(u, dist.get(v) + w);
        parent.set(u, v);
        updated = true;

        if (!visitOrder.includes(u)) {
          visitOrder.push(u);
        }

        steps.push({
          type: 'relax',
          iteration: i + 1,
          from: v,
          to: u,
          weight: w,
          oldDistance: oldDist,
          newDistance: dist.get(u),
          distances: Object.fromEntries(dist),
          parent: Object.fromEntries(parent),
          message: oldDist === Infinity 
            ? `Discovered ${u} from ${v} (distance: ${dist.get(u)})`
            : `Updated ${u}: ${oldDist} → ${dist.get(u)} (via ${v})`,
        });
      }
    }

    steps.push({
      type: 'iteration_end',
      iteration: i + 1,
      updated,
      distances: Object.fromEntries(dist),
      message: updated ? `Iteration ${i + 1} completed with updates` : `Iteration ${i + 1} completed (no updates)`,
    });

    // Early termination if no updates
    if (!updated) {
      steps.push({
        type: 'early_stop',
        iteration: i + 1,
        message: `Early termination: no updates in iteration ${i + 1}`,
      });
      break;
    }
  }

  // Check for negative cycles
  let hasNegativeCycle = false;
  for (const edge of graph.edges) {
    const u = edge.from;
    const v = edge.to;
    const w = edge.weight;

    if (dist.get(u) !== Infinity && dist.get(u) + w < dist.get(v)) {
      hasNegativeCycle = true;
      break;
    }
    // For undirected graphs, check reverse direction too
    if (!isDirected && dist.get(v) !== Infinity && dist.get(v) + w < dist.get(u)) {
      hasNegativeCycle = true;
      break;
    }
  }

  if (hasNegativeCycle) {
    steps.push({
      type: 'negative_cycle',
      message: 'Warning: Negative cycle detected!',
    });

    return {
      found: false,
      path: [],
      cost: Infinity,
      steps,
      visitOrder,
      nodesVisited: visitOrder.length,
      hasNegativeCycle: true,
    };
  }

  // Check if target is reachable
  if (dist.get(target) === Infinity) {
    steps.push({
      type: 'no_path',
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
  const cost = dist.get(target);

  steps.push({
    type: 'goal',
    path,
    cost,
    distances: Object.fromEntries(dist),
    message: `Found shortest path to ${target}! Cost: ${cost}`,
  });

  return {
    found: true,
    path,
    cost,
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
  const visited = new Set();

  while (current !== null && !visited.has(current)) {
    visited.add(current);
    path.unshift(current);
    current = parent.get(current);
  }

  return path;
}

export default bellmanFord;

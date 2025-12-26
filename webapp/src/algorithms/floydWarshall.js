// Floyd-Warshall algorithm with step-by-step visualization

/**
 * Floyd-Warshall algorithm implementation with event emission for visualization
 * Finds shortest paths between all pairs of nodes
 * @param {Object} graph - Graph object with nodes and edges
 * @param {string} source - Source node id
 * @param {string} target - Target node id
 * @param {boolean} isDirected - Whether the graph is directed
 * @returns {Object} - Result with path, cost, steps, and visited order
 */
export function floydWarshall(graph, source, target, isDirected = false) {
  const steps = [];
  const visitOrder = [];
  
  // Get all nodes - graph.nodes is a Map
  const nodes = Array.from(graph.nodes.keys());
  const n = nodes.length;
  const idx = new Map();
  nodes.forEach((node, i) => idx.set(node, i));

  // Initialize distance and next matrices
  const dist = Array.from({ length: n }, () => Array(n).fill(Infinity));
  const next = Array.from({ length: n }, () => Array(n).fill(null));

  // Self-loops have distance 0
  for (let i = 0; i < n; i++) {
    dist[i][i] = 0;
  }

  // Set edge weights - graph.edges is an array
  for (const edge of graph.edges) {
    const i = idx.get(edge.from);
    const j = idx.get(edge.to);
    if (i !== undefined && j !== undefined) {
      const weight = edge.weight || 1;
      dist[i][j] = weight;
      next[i][j] = j;
      if (!isDirected) {
        dist[j][i] = weight;
        next[j][i] = i;
      }
    }
  }

  // Initial step
  steps.push({
    type: 'init',
    current: null,
    queue: [],
    visited: [],
    frontier: [],
    distMatrix: dist.map(row => [...row]),
    message: 'Initialized distance matrix with edge weights',
  });

  // Floyd-Warshall main loop
  for (let k = 0; k < n; k++) {
    const kNode = nodes[k];
    visitOrder.push(kNode);

    steps.push({
      type: 'expand',
      current: kNode,
      queue: [],
      visited: [...visitOrder],
      frontier: [],
      intermediateNode: kNode,
      distMatrix: dist.map(row => [...row]),
      message: `Using node ${kNode} as intermediate vertex`,
    });

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (dist[i][k] + dist[k][j] < dist[i][j]) {
          const oldDist = dist[i][j];
          dist[i][j] = dist[i][k] + dist[k][j];
          next[i][j] = next[i][k];

          steps.push({
            type: 'frontier',
            current: kNode,
            neighbor: `${nodes[i]}→${nodes[j]}`,
            queue: [],
            visited: [...visitOrder],
            frontier: [],
            from: nodes[i],
            to: nodes[j],
            via: kNode,
            oldDist,
            newDist: dist[i][j],
            distMatrix: dist.map(row => [...row]),
            message: `Updated dist[${nodes[i]}][${nodes[j]}]: ${oldDist === Infinity ? '∞' : oldDist.toFixed(1)} → ${dist[i][j].toFixed(1)} via ${kNode}`,
          });
        }
      }
    }
  }

  // Reconstruct path
  const si = idx.get(source);
  const ti = idx.get(target);

  if (si === undefined || ti === undefined || next[si][ti] === null) {
    steps.push({
      type: 'no_path',
      visited: [...visitOrder],
      distMatrix: dist.map(row => [...row]),
      message: `No path found from ${source} to ${target}`,
    });

    return {
      found: false,
      path: [],
      cost: Infinity,
      steps,
      visitOrder,
      nodesVisited: visitOrder.length,
      distMatrix: dist,
      nodeOrder: nodes,
    };
  }

  // Build path
  const path = [source];
  let curr = si;
  while (curr !== ti) {
    curr = next[curr][ti];
    path.push(nodes[curr]);
  }

  steps.push({
    type: 'goal',
    current: target,
    path,
    cost: dist[si][ti],
    visited: [...visitOrder],
    distMatrix: dist.map(row => [...row]),
    message: `Found path: ${path.join(' → ')} with cost ${dist[si][ti].toFixed(1)}`,
  });

  return {
    found: true,
    path,
    cost: dist[si][ti],
    steps,
    visitOrder,
    nodesVisited: visitOrder.length,
    distMatrix: dist,
    nodeOrder: nodes,
  };
}

export default floydWarshall;

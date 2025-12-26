// Local Beam Search algorithm with step-by-step visualization

import { getNeighbors, euclideanDistance, createHeuristic } from '../utils/graphUtils';

/**
 * Local Beam Search algorithm implementation with event emission for visualization
 * Keeps track of k best states at each level instead of just one
 * @param {Object} graph - Graph object with nodes and edges
 * @param {string} source - Source node id
 * @param {string} target - Target node id
 * @param {boolean} isDirected - Whether the graph is directed
 * @param {Object} options - Options object (can contain beamWidth, heuristic, heuristicStrategy)
 * @returns {Object} - Result with path, cost, steps, and visited order
 */
export function localBeamSearch(graph, source, target, isDirected = false, options = {}) {
  const steps = [];
  const beamWidth = options.beamWidth || options.k || 3; // Number of states to keep
  const parent = new Map();
  const visitOrder = [];

  // Extract heuristic from options
  let heuristic;
  const heuristicStrategy = options?.heuristicStrategy || 'euclidean';
  
  if (typeof options === 'function') {
    heuristic = options;
  } else if (options?.heuristic && typeof options.heuristic === 'function') {
    heuristic = options.heuristic;
  } else {
    // Create heuristic from strategy (scale = 1 for beam search since we only use h)
    heuristic = createHeuristic(heuristicStrategy, graph, target, 1);
  }

  // Initialize priority queue with source node
  // pq contains { node, h } sorted by h (lower is better)
  let pq = [{ node: source, h: heuristic(source) }];
  parent.set(source, null);

  // Initial step
  steps.push({
    type: 'init',
    current: null,
    queue: pq.map(b => b.node),
    visited: [...visitOrder],
    frontier: pq.map(b => b.node),
    beamWidth,
    parent: Object.fromEntries(parent),
    heuristicStrategy,
    message: `Starting Local Beam Search from ${source} to ${target} with beam width k=${beamWidth} (heuristic: ${heuristicStrategy})`,
  });

  while (pq.length > 0) {
    // Collect all candidates from expanding up to k nodes from current pq
    const candidates = [];

    // Take up to k nodes from pq and expand them
    const nodesToExpand = pq.slice(0, beamWidth);
    
    for (let i = 0; i < nodesToExpand.length; i++) {
      const { node: current, h: currentH } = nodesToExpand[i];
      
      visitOrder.push(current);

      // Expand step
      steps.push({
        type: 'expand',
        current,
        hScore: currentH,
        queue: pq.map(b => b.node),
        visited: [...visitOrder],
        frontier: pq.map(b => b.node),
        parent: Object.fromEntries(parent),
        beamIndex: i,
        message: `Expanding beam[${i}]: ${current} (h=${currentH.toFixed(1)})`,
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
          visited: [...visitOrder],
          message: `Found target ${target}! Path cost: ${cost.toFixed(1)}`,
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

      // Explore neighbors - add to candidates if not in parent (not visited yet)
      const neighbors = getNeighbors(graph, current, isDirected);
      for (const { node: neighbor } of neighbors) {
        if (!parent.has(neighbor)) {
          parent.set(neighbor, current);
          const h = heuristic(neighbor);
          candidates.push({ node: neighbor, h });

          steps.push({
            type: 'frontier',
            current,
            neighbor,
            hScore: h,
            queue: pq.map(b => b.node),
            visited: [...visitOrder],
            frontier: [...candidates.map(c => c.node)],
            parent: Object.fromEntries(parent),
            message: `Adding candidate ${neighbor} (h=${h.toFixed(1)})`,
          });
        }
      }
    }

    // If no candidates, search failed
    if (candidates.length === 0) {
      break;
    }

    // Sort candidates by heuristic (lower is better) and keep top k for next iteration
    candidates.sort((a, b) => a.h - b.h);
    pq = candidates.slice(0, beamWidth);

    steps.push({
      type: 'beam_select',
      queue: pq.map(b => b.node),
      visited: [...visitOrder],
      frontier: pq.map(b => b.node),
      candidateCount: candidates.length,
      selectedCount: pq.length,
      parent: Object.fromEntries(parent),
      message: `Selected top ${pq.length} from ${candidates.length} candidates: [${pq.map(b => `${b.node}(${b.h.toFixed(1)})`).join(', ')}]`,
    });
  }

  // No path found
  steps.push({
    type: 'no_path',
    visited: [...visitOrder],
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

export default localBeamSearch;

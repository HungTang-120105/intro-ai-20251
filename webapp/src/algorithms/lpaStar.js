// Lifelong Planning A* (LPA*) implementation
// An incremental version of A* that can efficiently update when the graph changes

import { getNeighbors, createHeuristic } from '../utils/graphUtils';

/**
 * Priority Queue for LPA*
 */
class PriorityQueue {
  constructor() {
    this.heap = [];
    this.itemMap = new Map();
  }

  isEmpty() {
    return this.heap.length === 0;
  }

  push(item, priority) {
    this.remove(item);
    const entry = { item, priority };
    this.heap.push(entry);
    this.itemMap.set(item, entry);
    this.bubbleUp(this.heap.length - 1);
  }

  pop() {
    if (this.heap.length === 0) return null;
    const top = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }
    this.itemMap.delete(top.item);
    return { item: top.item, priority: top.priority };
  }

  peek() {
    if (this.heap.length === 0) return null;
    return { item: this.heap[0].item, priority: this.heap[0].priority };
  }

  remove(item) {
    if (!this.itemMap.has(item)) return;
    const entry = this.itemMap.get(item);
    const index = this.heap.indexOf(entry);
    if (index === -1) return;
    const last = this.heap.pop();
    if (index < this.heap.length) {
      this.heap[index] = last;
      this.bubbleUp(index);
      this.bubbleDown(index);
    }
    this.itemMap.delete(item);
  }

  bubbleUp(index) {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.comparePriority(this.heap[parent].priority, this.heap[index].priority) <= 0) break;
      [this.heap[parent], this.heap[index]] = [this.heap[index], this.heap[parent]];
      index = parent;
    }
  }

  bubbleDown(index) {
    while (true) {
      const left = 2 * index + 1;
      const right = 2 * index + 2;
      let smallest = index;
      if (left < this.heap.length &&
          this.comparePriority(this.heap[left].priority, this.heap[smallest].priority) < 0) {
        smallest = left;
      }
      if (right < this.heap.length &&
          this.comparePriority(this.heap[right].priority, this.heap[smallest].priority) < 0) {
        smallest = right;
      }
      if (smallest === index) break;
      [this.heap[smallest], this.heap[index]] = [this.heap[index], this.heap[smallest]];
      index = smallest;
    }
  }

  comparePriority(a, b) {
    if (a[0] !== b[0]) return a[0] - b[0];
    return a[1] - b[1];
  }

  toArray() {
    return this.heap.map(e => e.item);
  }
}

/**
 * LPA* implementation - simpler Dijkstra-based approach for reliability
 * @param {Object} graph - Graph object with nodes and edges
 * @param {string} source - Source node id  
 * @param {string} target - Target node id
 * @param {boolean} isDirected - Whether the graph is directed
 * @param {Object} options - Options object (can contain heuristicStrategy)
 * @returns {Object} - Result with path, cost, steps
 */
export function lpaStar(graph, source, target, isDirected = false, options = {}) {
  const steps = [];
  const visitOrder = [];
  const INF = Infinity;
  
  // Extract heuristic strategy from options
  const heuristicStrategy = options?.heuristicStrategy || 'euclidean';
  const heuristic = createHeuristic(heuristicStrategy, graph, target, 0.01);

  // Get edge weight
  const getWeight = (u, v) => {
    const edge = graph.edges.find(e => 
      (e.from === u && e.to === v) || 
      (!isDirected && e.from === v && e.to === u)
    );
    return edge ? edge.weight : INF;
  };

  // Get successors based on graph direction
  const getSuccessors = (u) => {
    const neighbors = [];
    for (const edge of graph.edges) {
      if (edge.from === u) {
        neighbors.push({ node: edge.to, weight: edge.weight });
      } else if (!isDirected && edge.to === u) {
        neighbors.push({ node: edge.from, weight: edge.weight });
      }
    }
    return neighbors;
  };

  // Get predecessors
  const getPredecessors = (u) => {
    const preds = [];
    for (const edge of graph.edges) {
      if (edge.to === u) {
        preds.push({ node: edge.from, weight: edge.weight });
      } else if (!isDirected && edge.from === u) {
        preds.push({ node: edge.to, weight: edge.weight });
      }
    }
    return preds;
  };

  // Initialize g and rhs for all nodes
  const g = new Map();
  const rhs = new Map();
  const parent = new Map();

  for (const [nodeId] of graph.nodes) {
    g.set(nodeId, INF);
    rhs.set(nodeId, INF);
  }

  // Source has rhs = 0
  rhs.set(source, 0);

  // Priority queue
  const pq = new PriorityQueue();

  // Calculate key
  const calculateKey = (u) => {
    const gU = g.get(u);
    const rhsU = rhs.get(u);
    const minVal = Math.min(gU, rhsU);
    const h = heuristic(u);
    return [minVal + h, minVal];
  };

  // Add source to queue
  pq.push(source, calculateKey(source));

  // Initial step
  steps.push({
    type: 'init',
    current: null,
    visited: [],
    frontier: [source],
    heuristicStrategy,
    message: `LPA* starting from ${source} to ${target} (heuristic: ${heuristicStrategy})`,
  });

  let iterations = 0;
  const maxIterations = graph.nodes.size * 20;

  // Main loop
  while (!pq.isEmpty() && iterations < maxIterations) {
    iterations++;

    // Get top key and target key
    const topEntry = pq.peek();
    if (!topEntry) break;

    const targetG = g.get(target);
    const targetRhs = rhs.get(target);
    const targetKey = calculateKey(target);

    // Termination: target is locally consistent and has best key
    if (targetG === targetRhs && targetG !== INF) {
      const cmp = pq.comparePriority(topEntry.priority, targetKey);
      if (cmp >= 0) {
        break;
      }
    }

    const { item: u } = pq.pop();
    const gU = g.get(u);
    const rhsU = rhs.get(u);

    if (!visitOrder.includes(u)) {
      visitOrder.push(u);
    }

    if (gU > rhsU) {
      // Locally overconsistent: make consistent
      g.set(u, rhsU);

      steps.push({
        type: 'expand',
        current: u,
        visited: [...visitOrder],
        frontier: pq.toArray(),
        message: `LPA* expanding ${u}: g=${rhsU.toFixed(2)}`,
      });

      // Update all successors
      for (const { node: s, weight } of getSuccessors(u)) {
        const newRhs = g.get(u) + weight;
        if (newRhs < rhs.get(s)) {
          rhs.set(s, newRhs);
          parent.set(s, u);
          pq.push(s, calculateKey(s));
        }
      }
    } else {
      // Locally underconsistent or consistent
      g.set(u, INF);

      // Update u itself
      if (u !== source) {
        let minRhs = INF;
        let bestPred = null;
        for (const { node: p, weight } of getPredecessors(u)) {
          const val = g.get(p) + weight;
          if (val < minRhs) {
            minRhs = val;
            bestPred = p;
          }
        }
        rhs.set(u, minRhs);
        if (bestPred) parent.set(u, bestPred);
      }
      if (g.get(u) !== rhs.get(u)) {
        pq.push(u, calculateKey(u));
      }

      // Update all successors
      for (const { node: s } of getSuccessors(u)) {
        if (s !== source) {
          let minRhs = INF;
          let bestPred = null;
          for (const { node: p, weight } of getPredecessors(s)) {
            const val = g.get(p) + weight;
            if (val < minRhs) {
              minRhs = val;
              bestPred = p;
            }
          }
          rhs.set(s, minRhs);
          if (bestPred) parent.set(s, bestPred);
        }
        if (g.get(s) !== rhs.get(s)) {
          pq.push(s, calculateKey(s));
        }
      }
    }
  }

  // Check if path found
  const finalG = g.get(target);
  if (!isFinite(finalG)) {
    steps.push({
      type: 'nopath',
      current: null,
      visited: visitOrder,
      frontier: [],
      message: `LPA* could not find path from ${source} to ${target}`,
    });

    return {
      path: null,
      cost: Infinity,
      found: false,
      steps,
      visitOrder,
      nodesVisited: visitOrder.length,
      edgesExplored: iterations,
    };
  }

  // Reconstruct path using parent pointers
  const path = [];
  let current = target;
  const pathLimit = graph.nodes.size + 5;
  let guard = 0;

  while (current && guard < pathLimit) {
    guard++;
    path.unshift(current);
    if (current === source) break;
    current = parent.get(current);
  }

  // Validate path
  if (path[0] !== source || path[path.length - 1] !== target) {
    // Try alternative reconstruction using g-values
    const altPath = [target];
    current = target;
    guard = 0;

    while (current !== source && guard < pathLimit) {
      guard++;
      const preds = getPredecessors(current);
      let bestPred = null;
      let bestG = INF;

      for (const { node: p, weight } of preds) {
        const gP = g.get(p);
        if (isFinite(gP) && Math.abs(gP + weight - g.get(current)) < 0.001) {
          if (gP < bestG) {
            bestG = gP;
            bestPred = p;
          }
        }
      }

      if (!bestPred) {
        // Fallback
        for (const { node: p } of preds) {
          const gP = g.get(p);
          if (gP < bestG) {
            bestG = gP;
            bestPred = p;
          }
        }
      }

      if (!bestPred) break;
      altPath.unshift(bestPred);
      current = bestPred;
    }

    if (altPath[0] === source && altPath[altPath.length - 1] === target) {
      steps.push({
        type: 'found',
        current: target,
        path: altPath,
        visited: visitOrder,
        frontier: [],
        message: `LPA* found path: ${altPath.join(' → ')}, Cost: ${finalG.toFixed(2)}`,
      });

      return {
        path: altPath,
        cost: finalG,
        found: true,
        steps,
        visitOrder,
        nodesVisited: visitOrder.length,
        edgesExplored: iterations,
      };
    }

    return {
      path: null,
      cost: Infinity,
      found: false,
      steps,
      visitOrder,
      nodesVisited: visitOrder.length,
      edgesExplored: iterations,
    };
  }

  steps.push({
    type: 'found',
    current: target,
    path,
    visited: visitOrder,
    frontier: [],
    message: `LPA* found path: ${path.join(' → ')}, Cost: ${finalG.toFixed(2)}`,
  });

  return {
    path,
    cost: finalG,
    found: true,
    steps,
    visitOrder,
    nodesVisited: visitOrder.length,
    edgesExplored: iterations,
  };
}

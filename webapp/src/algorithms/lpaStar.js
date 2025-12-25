// Lifelong Planning A* (LPA*) implementation
// An incremental version of A* that can efficiently update when the graph changes

import { getNeighbors } from '../utils/graphUtils';

/**
 * Priority Queue with update capability for LPA*
 */
class UpdateablePQ {
  constructor() {
    this.heap = [];
    this.finder = new Map();
  }

  isEmpty() {
    return this.finder.size === 0;
  }

  push(item, priority) {
    // Remove old entry if exists
    if (this.finder.has(item)) {
      const oldEntry = this.finder.get(item);
      oldEntry.removed = true;
    }

    const entry = { item, priority, removed: false };
    this.finder.set(item, entry);
    this.heap.push(entry);
    this.bubbleUp(this.heap.length - 1);
  }

  peek() {
    this.cleanTop();
    if (this.heap.length === 0) return null;
    return { item: this.heap[0].item, priority: this.heap[0].priority };
  }

  pop() {
    this.cleanTop();
    if (this.heap.length === 0) return null;
    
    const top = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0 && last) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }
    
    this.finder.delete(top.item);
    return { item: top.item, priority: top.priority };
  }

  contains(item) {
    return this.finder.has(item) && !this.finder.get(item).removed;
  }

  cleanTop() {
    while (this.heap.length > 0 && this.heap[0].removed) {
      const last = this.heap.pop();
      if (this.heap.length > 0 && last && !last.removed) {
        this.heap[0] = last;
        this.bubbleDown(0);
      }
    }
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
      
      if (left < this.heap.length && !this.heap[left].removed &&
          this.comparePriority(this.heap[left].priority, this.heap[smallest].priority) < 0) {
        smallest = left;
      }
      if (right < this.heap.length && !this.heap[right].removed &&
          this.comparePriority(this.heap[right].priority, this.heap[smallest].priority) < 0) {
        smallest = right;
      }
      if (smallest === index) break;
      [this.heap[smallest], this.heap[index]] = [this.heap[index], this.heap[smallest]];
      index = smallest;
    }
  }

  // Compare [k1, k2] tuple priorities
  comparePriority(a, b) {
    if (a[0] !== b[0]) return a[0] - b[0];
    return a[1] - b[1];
  }

  toArray() {
    return [...this.finder.keys()].filter(k => !this.finder.get(k).removed);
  }
}

/**
 * LPA* implementation
 * @param {Object} graph - Graph object with nodes and edges
 * @param {string} source - Source node id
 * @param {string} target - Target node id
 * @param {boolean} isDirected - Whether the graph is directed
 * @param {Function} heuristic - Heuristic function (optional)
 * @returns {Object} - Result with path, cost, steps
 */
export function lpaStar(graph, source, target, isDirected = false, heuristic = null) {
  const steps = [];
  const visitOrder = [];
  const INF = Infinity;

  // Default heuristic (zero - becomes Dijkstra-like)
  const h = heuristic || ((u, v) => {
    const nodeU = graph.nodes.get(u);
    const nodeV = graph.nodes.get(v);
    if (nodeU && nodeV) {
      // Euclidean distance if positions available
      const dx = (nodeU.x || 0) - (nodeV.x || 0);
      const dy = (nodeU.y || 0) - (nodeV.y || 0);
      return Math.sqrt(dx * dx + dy * dy) * 0.01; // Scale down
    }
    return 0;
  });

  // Get edge weight
  const w = (u, v) => {
    const edge = graph.edges.find(e => 
      (e.from === u && e.to === v) || 
      (!isDirected && e.from === v && e.to === u)
    );
    return edge ? edge.weight : INF;
  };

  // Get predecessors (for LPA* we look at incoming edges)
  const getPreds = (u) => {
    if (isDirected) {
      return graph.edges.filter(e => e.to === u).map(e => e.from);
    }
    return getNeighbors(graph, u, isDirected).map(n => n.node);
  };

  // Get successors
  const getSuccs = (u) => {
    return getNeighbors(graph, u, isDirected).map(n => n.node);
  };

  // LPA* values
  const g = new Map();   // g-values
  const rhs = new Map(); // rhs-values

  const gVal = (u) => g.has(u) ? g.get(u) : INF;
  const rhsVal = (u) => rhs.has(u) ? rhs.get(u) : INF;

  // Calculate key for priority queue
  const calculateKey = (u) => {
    const minVal = Math.min(gVal(u), rhsVal(u));
    return [minVal + h(u, target), minVal];
  };

  // Initialize
  g.set(source, INF);
  rhs.set(source, 0);

  const pq = new UpdateablePQ();
  pq.push(source, calculateKey(source));

  // Update vertex
  const updateVertex = (u) => {
    if (u !== source) {
      const preds = getPreds(u);
      let minRhs = INF;
      for (const s of preds) {
        const val = gVal(s) + w(s, u);
        if (val < minRhs) minRhs = val;
      }
      rhs.set(u, minRhs);
    }

    if (gVal(u) !== rhsVal(u)) {
      pq.push(u, calculateKey(u));
    }
  };

  // Initial step
  steps.push({
    type: 'init',
    current: null,
    gValues: Object.fromEntries(g),
    rhsValues: Object.fromEntries(rhs),
    visited: [],
    frontier: pq.toArray(),
    message: `Starting LPA* from ${source} to ${target}`,
  });

  let iterations = 0;
  const maxIterations = graph.nodes.size * 10;

  // Main loop
  while (iterations < maxIterations) {
    iterations++;

    const topKey = pq.peek();
    const targetKey = calculateKey(target);

    // Check termination
    if (rhsVal(target) === gVal(target) && 
        (!topKey || pq.comparePriority(topKey.priority, targetKey) >= 0)) {
      break;
    }

    if (pq.isEmpty()) break;

    const { item: u, priority: kOld } = pq.pop();
    const kCur = calculateKey(u);

    if (!visitOrder.includes(u)) visitOrder.push(u);

    // Key changed - reinsert
    if (pq.comparePriority(kOld, kCur) < 0) {
      pq.push(u, kCur);
      continue;
    }

    if (gVal(u) > rhsVal(u)) {
      // Locally overconsistent
      g.set(u, rhsVal(u));
      
      steps.push({
        type: 'expand',
        current: u,
        gValues: Object.fromEntries(g),
        rhsValues: Object.fromEntries(rhs),
        visited: [...visitOrder],
        frontier: pq.toArray(),
        message: `LPA* expanding ${u}: g=${gVal(u).toFixed(1)}`,
      });

      for (const s of getSuccs(u)) {
        updateVertex(s);
      }
    } else {
      // Locally underconsistent
      g.set(u, INF);
      updateVertex(u);
      for (const s of getSuccs(u)) {
        updateVertex(s);
      }
    }
  }

  // Check if path found
  if (!isFinite(gVal(target))) {
    steps.push({
      type: 'nopath',
      current: null,
      gValues: Object.fromEntries(g),
      rhsValues: Object.fromEntries(rhs),
      visited: visitOrder,
      frontier: [],
      message: `LPA* could not find path from ${source} to ${target}`,
    });

    return {
      path: null,
      cost: Infinity,
      steps,
      visitOrder,
      nodesVisited: visitOrder.length,
      edgesExplored: iterations,
    };
  }

  // Reconstruct path
  const path = [source];
  let current = source;
  let totalCost = 0;
  const pathLimit = graph.nodes.size + 5;
  let guard = 0;

  while (current !== target && guard < pathLimit) {
    guard++;
    const succs = getSuccs(current);
    let bestNext = null;
    let bestCost = INF;

    for (const v of succs) {
      const edgeCost = w(current, v);
      const totalVia = gVal(v) + edgeCost;
      if (totalVia < bestCost) {
        bestCost = totalVia;
        bestNext = v;
      }
    }

    if (!bestNext) break;

    totalCost += w(current, bestNext);
    current = bestNext;
    path.push(current);
  }

  if (path[path.length - 1] !== target) {
    return {
      path: null,
      cost: Infinity,
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
    gValues: Object.fromEntries(g),
    rhsValues: Object.fromEntries(rhs),
    visited: visitOrder,
    frontier: [],
    message: `LPA* found path: ${path.join(' → ')}, Cost: ${totalCost.toFixed(1)}`,
  });

  return {
    path,
    cost: totalCost,
    steps,
    visitOrder,
    nodesVisited: visitOrder.length,
    edgesExplored: iterations,
  };
}

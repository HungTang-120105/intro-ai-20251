// D* Lite implementation
// An incremental heuristic search algorithm for robot navigation
// Efficiently replans when the graph changes (edges blocked, weights changed)

import { createHeuristic } from '../utils/graphUtils';

/**
 * Priority Queue for D* Lite with lexicographic key comparison
 */
class DStarPriorityQueue {
  constructor() {
    this.heap = [];
    this.itemMap = new Map();
  }

  isEmpty() {
    return this.heap.length === 0;
  }

  has(item) {
    return this.itemMap.has(item);
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
      this.itemMap.set(last.item, last);
      this.bubbleUp(index);
      this.bubbleDown(index);
    }
    this.itemMap.delete(item);
  }

  bubbleUp(index) {
    while (index > 0) {
      const parentIdx = Math.floor((index - 1) / 2);
      if (this.compareKeys(this.heap[parentIdx].priority, this.heap[index].priority) <= 0) break;
      [this.heap[parentIdx], this.heap[index]] = [this.heap[index], this.heap[parentIdx]];
      this.itemMap.set(this.heap[parentIdx].item, this.heap[parentIdx]);
      this.itemMap.set(this.heap[index].item, this.heap[index]);
      index = parentIdx;
    }
  }

  bubbleDown(index) {
    while (true) {
      const left = 2 * index + 1;
      const right = 2 * index + 2;
      let smallest = index;
      if (left < this.heap.length &&
        this.compareKeys(this.heap[left].priority, this.heap[smallest].priority) < 0) {
        smallest = left;
      }
      if (right < this.heap.length &&
        this.compareKeys(this.heap[right].priority, this.heap[smallest].priority) < 0) {
        smallest = right;
      }
      if (smallest === index) break;
      [this.heap[smallest], this.heap[index]] = [this.heap[index], this.heap[smallest]];
      this.itemMap.set(this.heap[smallest].item, this.heap[smallest]);
      this.itemMap.set(this.heap[index].item, this.heap[index]);
      index = smallest;
    }
  }

  // Lexicographic comparison: [k1, k2]
  compareKeys(a, b) {
    if (a[0] !== b[0]) return a[0] - b[0];
    return a[1] - b[1];
  }

  topKey() {
    if (this.heap.length === 0) return [Infinity, Infinity];
    return this.heap[0].priority;
  }

  toArray() {
    return this.heap.map(e => e.item);
  }
}

/**
 * D* Lite State class - holds algorithm state for incremental updates
 */
export class DStarLiteState {
  constructor(graph, source, target, isDirected = false, options = {}) {
    this.graph = graph;
    this.source = source; // Robot's current position (start)
    this.target = target; // Goal
    this.isDirected = isDirected;
    this.options = options;
    this.INF = Infinity;

    // D* Lite searches backwards from goal to start
    this.km = 0; // Key modifier for heuristic updates

    // Extract heuristic strategy
    const heuristicStrategy = options?.heuristicStrategy || 'euclidean';
    this.heuristicStrategy = heuristicStrategy;

    // Heuristic from current robot position - Use weight 1.0 for standard A* behavior
    this.heuristic = createHeuristic(heuristicStrategy, graph, source, 1.0);

    // g and rhs values
    this.g = new Map();
    this.rhs = new Map();

    // Priority queue
    this.U = new DStarPriorityQueue();

    // Steps for visualization - MUST be initialized BEFORE initialize()
    this.steps = [];
    this.visitOrder = [];

    // Initialize algorithm state
    this.initialize();
  }

  initialize() {
    // Initialize all nodes
    for (const [nodeId] of this.graph.nodes) {
      this.g.set(nodeId, this.INF);
      this.rhs.set(nodeId, this.INF);
    }

    // Goal has rhs = 0 (we search backwards)
    this.rhs.set(this.target, 0);
    this.U.push(this.target, this.calculateKey(this.target));

    this.steps.push({
      type: 'init',
      current: null,
      visited: [],
      frontier: [this.target],
      heuristicStrategy: this.heuristicStrategy,
      message: `D* Lite initializing: goal=${this.target}, start=${this.source} (heuristic: ${this.heuristicStrategy})`,
    });
  }

  calculateKey(s) {
    const gS = this.g.get(s);
    const rhsS = this.rhs.get(s);
    const minVal = Math.min(gS, rhsS);
    const h = this.heuristic(s);
    return [minVal + h + this.km, minVal];
  }

  // Get successors (nodes we can reach from s)
  getSuccessors(s) {
    const neighbors = [];
    for (const edge of this.graph.edges) {
      if (edge.blocked) continue; // Skip blocked edges
      if (edge.from === s) {
        neighbors.push({ node: edge.to, weight: edge.weight });
      } else if (!this.isDirected && edge.to === s) {
        neighbors.push({ node: edge.from, weight: edge.weight });
      }
    }
    return neighbors;
  }

  // Get predecessors (nodes that can reach s)
  getPredecessors(s) {
    const preds = [];
    for (const edge of this.graph.edges) {
      if (edge.blocked) continue; // Skip blocked edges
      if (edge.to === s) {
        preds.push({ node: edge.from, weight: edge.weight });
      } else if (!this.isDirected && edge.from === s) {
        preds.push({ node: edge.to, weight: edge.weight });
      }
    }
    return preds;
  }

  // Get edge cost (returns Infinity if edge doesn't exist or is blocked)
  getCost(from, to) {
    const edge = this.graph.edges.find(e =>
      (e.from === from && e.to === to) ||
      (!this.isDirected && e.from === to && e.to === from)
    );
    if (!edge || edge.blocked) return this.INF;
    return edge.weight;
  }

  updateVertex(u) {
    if (u !== this.target) {
      // rhs(u) = min over successors s of (c(u,s) + g(s))
      let minRhs = this.INF;
      for (const { node: s, weight } of this.getSuccessors(u)) {
        const val = weight + this.g.get(s);
        if (val < minRhs) {
          minRhs = val;
        }
      }
      this.rhs.set(u, minRhs);
    }

    // Remove u from queue if present
    this.U.remove(u);

    // If inconsistent, add to queue
    if (this.g.get(u) !== this.rhs.get(u)) {
      this.U.push(u, this.calculateKey(u));
    }
  }

  computeShortestPath() {
    let iterations = 0;
    const maxIterations = Math.max(this.graph.nodes.size * 100, 10000);

    while (iterations < maxIterations) {
      // Check if queue is empty first
      if (this.U.isEmpty()) {
        break;
      }

      const topKey = this.U.topKey();
      const startKey = this.calculateKey(this.source);

      // Check termination conditions
      const startConsistent = this.g.get(this.source) === this.rhs.get(this.source);
      const keyCompare = this.U.compareKeys(topKey, startKey);

      if (keyCompare >= 0 && startConsistent) {
        break;
      }

      iterations++;
      const kOld = topKey;
      const { item: u } = this.U.pop();

      if (!this.visitOrder.includes(u)) {
        this.visitOrder.push(u);
      }

      const kNew = this.calculateKey(u);

      if (this.U.compareKeys(kOld, kNew) < 0) {
        // Key has changed, reinsert with new key
        this.U.push(u, kNew);
      } else if (this.g.get(u) > this.rhs.get(u)) {
        // Locally overconsistent
        this.g.set(u, this.rhs.get(u));

        this.steps.push({
          type: 'expand',
          current: u,
          visited: [...this.visitOrder],
          frontier: this.U.toArray(),
          gValue: this.g.get(u),
          rhsValue: this.rhs.get(u),
          message: `D* Lite expanding ${u}: g=${this.g.get(u).toFixed(2)}, rhs=${this.rhs.get(u).toFixed(2)}`,
        });

        // Update all predecessors
        for (const { node: s } of this.getPredecessors(u)) {
          this.updateVertex(s);
        }
      } else {
        // Locally underconsistent
        this.g.set(u, this.INF);

        // Update u and all predecessors
        this.updateVertex(u);
        for (const { node: s } of this.getPredecessors(u)) {
          this.updateVertex(s);
        }
      }
    }

    return iterations;
  }

  // Get the current path from source to target
  extractPath() {
    if (!isFinite(this.g.get(this.source))) {
      return null;
    }

    const path = [this.source];
    let current = this.source;
    const maxSteps = this.graph.nodes.size + 5;
    let steps = 0;
    const visited = new Set([this.source]);

    while (current !== this.target && steps < maxSteps) {
      steps++;

      // Find best successor - the one that minimizes (edge cost + g(successor))
      // In D* Lite, g values decrease toward the target (g(target) = 0)
      let bestNext = null;
      let bestCost = this.INF;

      for (const { node: s, weight } of this.getSuccessors(current)) {
        if (visited.has(s)) continue; // Prevent loops

        const gS = this.g.get(s);
        // Even if g(s) is INF, we might need to go through it
        // Priority: finite g first, then by cost
        const cost = weight + (isFinite(gS) ? gS : this.INF);

        if (cost < bestCost) {
          bestCost = cost;
          bestNext = s;
        }
      }

      // Fallback: if no good successor found, try any unvisited successor with finite g
      if (!bestNext) {
        for (const { node: s } of this.getSuccessors(current)) {
          if (!visited.has(s) && isFinite(this.g.get(s))) {
            bestNext = s;
            break;
          }
        }
      }

      // Last resort: try rhs values instead of g values
      if (!bestNext) {
        let bestRhs = this.INF;
        for (const { node: s, weight } of this.getSuccessors(current)) {
          if (visited.has(s)) continue;
          const rhsS = this.rhs.get(s);
          const cost = weight + (isFinite(rhsS) ? rhsS : this.INF);
          if (cost < bestRhs) {
            bestRhs = cost;
            bestNext = s;
          }
        }
      }

      if (!bestNext) {
        break;
      }

      path.push(bestNext);
      visited.add(bestNext);
      current = bestNext;
    }

    if (path[path.length - 1] !== this.target) {
      return null;
    }

    return path;
  }

  // Calculate path cost
  calculatePathCost(path) {
    if (!path || path.length < 2) return path ? 0 : Infinity;
    let cost = 0;
    for (let i = 0; i < path.length - 1; i++) {
      cost += this.getCost(path[i], path[i + 1]);
    }
    return cost;
  }

  // Handle edge cost change (the key feature of D* Lite!)
  updateEdgeCost(from, to, newWeight, isBlocked = false) {
    const edge = this.graph.edges.find(e =>
      (e.from === from && e.to === to) ||
      (!this.isDirected && e.from === to && e.to === from)
    );

    if (!edge) return;

    const oldWeight = edge.weight;
    const wasBlocked = edge.blocked || false;

    // Update the edge
    edge.weight = newWeight;
    edge.blocked = isBlocked;

    this.steps.push({
      type: 'edge_change',
      from,
      to,
      oldWeight,
      newWeight,
      wasBlocked,
      isBlocked,
      visited: [...this.visitOrder],
      frontier: this.U.toArray(),
      message: isBlocked
        ? `Edge ${from}-${to} blocked!`
        : `Edge ${from}-${to} weight changed: ${oldWeight.toFixed(1)} → ${newWeight.toFixed(1)}`,
    });

    // Collect all nodes that might be affected
    const affectedNodes = new Set();
    affectedNodes.add(from);
    affectedNodes.add(to);

    // For blocked edges, we need to invalidate all nodes that might have used this edge
    // in their path to the target. In D* Lite, we search from target to source,
    // so nodes that used this edge are "upstream" from the blocked edge (toward source).
    // D* Lite handles blocked edges naturally via the priority queue propagation.
    // When edge u->v cost increases (to Infinity), rhs(u) increases.
    // u is placed in queue. When expanded, g(u) != rhs(u), so it updates predecessors.
    // Proactive BFS invalidation is not strictly necessary and can be error-prone.
    // We rely on the endpoints being updated below.

    // Update all affected nodes
    for (const node of affectedNodes) {
      this.updateVertex(node);
    }

    // Propagate to neighbors of affected nodes
    for (const node of affectedNodes) {
      for (const { node: s } of this.getSuccessors(node)) {
        if (!affectedNodes.has(s)) {
          this.updateVertex(s);
        }
      }
      for (const { node: p } of this.getPredecessors(node)) {
        if (!affectedNodes.has(p)) {
          this.updateVertex(p);
        }
      }
    }
  }

  // Run the algorithm and return result
  run() {
    const iterations = this.computeShortestPath();
    const path = this.extractPath();
    const cost = this.calculatePathCost(path);

    if (path) {
      this.steps.push({
        type: 'found',
        current: this.target,
        path,
        visited: [...this.visitOrder],
        frontier: [],
        message: `D* Lite found path! Cost: ${cost.toFixed(2)}, ${path.length} nodes`,
      });

      return {
        path,
        cost,
        found: true,
        steps: this.steps,
        visitOrder: this.visitOrder,
        nodesVisited: this.visitOrder.length,
        edgesExplored: iterations,
        state: this, // Return state for incremental updates
      };
    } else {
      console.log(`D* Lite no path: g(source)=${this.g.get(this.source)}, g(target)=${this.g.get(this.target)}, rhs(target)=${this.rhs.get(this.target)}, visited=${this.visitOrder.length}`);

      this.steps.push({
        type: 'nopath',
        current: null,
        visited: [...this.visitOrder],
        frontier: [],
        message: `D* Lite could not find path from ${this.source} to ${this.target}`,
      });

      return {
        path: null,
        cost: Infinity,
        found: false,
        steps: this.steps,
        visitOrder: this.visitOrder,
        nodesVisited: this.visitOrder.length,
        edgesExplored: iterations,
        state: this,
      };
    }
  }

  // Replan after edge changes - this is the incremental update!
  replan() {
    // Debug: show queue state before replan
    console.log(`[D* Lite] replan() called. Queue size: ${this.U.toArray().length}`);
    console.log(`[D* Lite] Queue contents:`, this.U.toArray().slice(0, 10));
    console.log(`[D* Lite] g(source)=${this.g.get(this.source)}, rhs(source)=${this.rhs.get(this.source)}`);
    console.log(`[D* Lite] g(target)=${this.g.get(this.target)}, rhs(target)=${this.rhs.get(this.target)}`);

    this.steps.push({
      type: 'replan_start',
      visited: [...this.visitOrder],
      frontier: this.U.toArray(),
      path: [], // Empty path - don't show old path during replan
      message: `D* Lite replanning after graph change...`,
    });

    const iterations = this.computeShortestPath();
    const path = this.extractPath();
    const cost = this.calculatePathCost(path);

    console.log(`[D* Lite] replan done. Iterations: ${iterations}, path: ${path ? path.slice(0, 5).join('->') + '...' : 'null'}`);

    if (path) {
      this.steps.push({
        type: 'replan_found',
        current: this.target,
        path,
        visited: [...this.visitOrder],
        frontier: [],
        message: `D* Lite replanned! Cost: ${cost.toFixed(2)}, ${path.length} nodes, ${iterations} iterations`,
      });

      return {
        path,
        cost,
        found: true,
        steps: this.steps,
        visitOrder: this.visitOrder,
        nodesVisited: this.visitOrder.length,
        edgesExplored: iterations,
        state: this,
      };
    } else {
      this.steps.push({
        type: 'replan_nopath',
        current: null,
        visited: [...this.visitOrder],
        frontier: [],
        message: `D* Lite: No path available after replanning`,
      });

      return {
        path: null,
        cost: Infinity,
        found: false,
        steps: this.steps,
        visitOrder: this.visitOrder,
        nodesVisited: this.visitOrder.length,
        edgesExplored: iterations,
        state: this,
      };
    }
  }
}

/**
 * D* Lite algorithm - main entry point
 * @param {Object} graph - Graph object with nodes and edges
 * @param {string} source - Source node id (robot start)
 * @param {string} target - Target node id (goal)
 * @param {boolean} isDirected - Whether the graph is directed
 * @param {Object} options - Options object
 * @returns {Object} - Result with path, cost, steps, and state for incremental updates
 */
export function dStarLite(graph, source, target, isDirected = false, options = {}) {
  const state = new DStarLiteState(graph, source, target, isDirected, options);
  return state.run();
}

// Lifelong Planning A* (LPA*) implementation
// An incremental version of A* that can efficiently update when the graph changes

import { createHeuristic } from '../utils/graphUtils';

/**
 * Priority Queue for LPA* with lexicographic key comparison
 */
class LPAPriorityQueue {
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
 * LPA* State class - holds algorithm state for incremental updates
 */
export class LPAStarState {
  constructor(graph, source, target, isDirected = false, options = {}) {
    this.graph = graph;
    this.source = source;
    this.target = target;
    this.isDirected = isDirected;
    this.options = options;
    this.INF = Infinity;

    // Extract heuristic strategy
    const heuristicStrategy = options?.heuristicStrategy || 'euclidean';
    this.heuristicStrategy = heuristicStrategy;
    this.heuristic = createHeuristic(heuristicStrategy, graph, target, 1.0);

    // g and rhs values
    this.g = new Map();
    this.rhs = new Map();

    // Priority queue
    this.U = new LPAPriorityQueue();

    // Parent pointers for path reconstruction
    this.parent = new Map();

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

    // Source has rhs = 0
    this.rhs.set(this.source, 0);
    this.U.push(this.source, this.calculateKey(this.source));

    this.steps.push({
      type: 'init',
      current: null,
      visited: [],
      frontier: [this.source],
      heuristicStrategy: this.heuristicStrategy,
      message: `LPA* initializing: source=${this.source}, target=${this.target} (heuristic: ${this.heuristicStrategy})`,
    });
  }

  calculateKey(s) {
    const gS = this.g.get(s);
    const rhsS = this.rhs.get(s);
    const minVal = Math.min(gS, rhsS);
    const h = this.heuristic(s);
    return [minVal + h, minVal];
  }

  // Get successors (nodes we can reach from s)
  getSuccessors(s) {
    const neighbors = [];
    for (const edge of this.graph.edges) {
      if (edge.blocked) continue;
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
      if (edge.blocked) continue;
      if (edge.to === s) {
        preds.push({ node: edge.from, weight: edge.weight });
      } else if (!this.isDirected && edge.from === s) {
        preds.push({ node: edge.to, weight: edge.weight });
      }
    }
    return preds;
  }

  // Get edge cost
  getCost(from, to) {
    const edge = this.graph.edges.find(e =>
      (e.from === from && e.to === to) ||
      (!this.isDirected && e.from === to && e.to === from)
    );
    if (!edge || edge.blocked) return this.INF;
    return edge.weight;
  }

  updateVertex(u) {
    if (u !== this.source) {
      // rhs(u) = min over predecessors p of (g(p) + c(p,u))
      let minRhs = this.INF;
      let bestPred = null;
      for (const { node: p, weight } of this.getPredecessors(u)) {
        const val = this.g.get(p) + weight;
        if (val < minRhs) {
          minRhs = val;
          bestPred = p;
        }
      }
      this.rhs.set(u, minRhs);
      // Always update parent - set to bestPred or clear if no valid predecessor
      if (bestPred !== null) {
        this.parent.set(u, bestPred);
      } else {
        this.parent.delete(u); // Clear parent if no valid predecessor
      }
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
      const targetKey = this.calculateKey(this.target);

      // Check termination conditions
      const targetConsistent = this.g.get(this.target) === this.rhs.get(this.target);
      const keyCompare = this.U.compareKeys(topKey, targetKey);

      if (keyCompare >= 0 && targetConsistent) {
        break;
      }

      iterations++;
      const { item: u } = this.U.pop();

      if (!this.visitOrder.includes(u)) {
        this.visitOrder.push(u);
      }

      const gU = this.g.get(u);
      const rhsU = this.rhs.get(u);

      if (gU > rhsU) {
        // Locally overconsistent
        this.g.set(u, rhsU);

        this.steps.push({
          type: 'expand',
          current: u,
          visited: [...this.visitOrder],
          frontier: this.U.toArray(),
          gValue: this.g.get(u),
          rhsValue: this.rhs.get(u),
          message: `LPA* expanding ${u}: g=${this.g.get(u).toFixed(2)}, rhs=${this.rhs.get(u).toFixed(2)}`,
        });

        // Update all successors
        for (const { node: s } of this.getSuccessors(u)) {
          this.updateVertex(s);
        }
      } else {
        // Locally underconsistent
        this.g.set(u, this.INF);

        // Update u and all successors
        this.updateVertex(u);
        for (const { node: s } of this.getSuccessors(u)) {
          this.updateVertex(s);
        }
      }
    }

    return iterations;
  }

  // Extract path from source to target
  extractPath() {
    if (!isFinite(this.g.get(this.target))) {
      // Try rhs instead
      if (!isFinite(this.rhs.get(this.target))) {
        return null;
      }
    }

    // Use parent pointers first, but validate no blocked edges
    const path = [];
    let current = this.target;
    const maxSteps = this.graph.nodes.size + 5;
    let steps = 0;
    let pathValid = true;

    while (current && steps < maxSteps) {
      steps++;
      path.unshift(current);
      if (current === this.source) break;

      const parent = this.parent.get(current);
      if (!parent) {
        pathValid = false;
        break;
      }

      // Check if edge from parent to current is blocked
      const edgeCost = this.getCost(parent, current);
      if (!isFinite(edgeCost)) {
        pathValid = false;
        break;
      }

      current = parent;
    }

    if (pathValid && path[0] === this.source && path[path.length - 1] === this.target) {
      return path;
    }

    // Fallback: reconstruct using g-values (greedy from source to target)
    const altPath = [this.source];
    current = this.source;
    steps = 0;
    const visited = new Set([this.source]);

    while (current !== this.target && steps < maxSteps) {
      steps++;

      let bestNext = null;
      let bestScore = this.INF;

      for (const { node: s, weight } of this.getSuccessors(current)) {
        if (visited.has(s)) continue;
        const gS = this.g.get(s);
        // Pick successor with smallest g (closest to source via this path)
        // that is on the optimal path (g(s) should equal g(current) + weight for optimal)
        const expectedG = this.g.get(current) + weight;
        const score = Math.abs(gS - expectedG) + gS; // Prefer nodes on optimal path
        if (isFinite(gS) && score < bestScore) {
          bestScore = score;
          bestNext = s;
        }
      }

      if (!bestNext) {
        // Fallback: just pick any successor with finite g
        for (const { node: s } of this.getSuccessors(current)) {
          if (visited.has(s)) continue;
          if (isFinite(this.g.get(s))) {
            bestNext = s;
            break;
          }
        }
      }

      if (!bestNext) {
        break;
      }
      altPath.push(bestNext);
      visited.add(bestNext);
      current = bestNext;
    }

    if (altPath[altPath.length - 1] === this.target) {
      return altPath;
    }

    return null;
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

  // Handle edge cost change - the key feature of LPA*!
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

    // When edge cost increases or edge is blocked, we need to propagate the change
    // through all affected nodes. The key insight is that nodes that were using
    // this edge need to find alternative paths.

    // Collect all nodes that might be affected
    const affectedNodes = new Set();

    // Both endpoints are affected
    affectedNodes.add(from);
    affectedNodes.add(to);

    // If the edge is blocked, we need to invalidate ALL nodes downstream from the blocked edge
    // This means all nodes whose path to source went through this edge
    if (isBlocked) {
      // BFS to find all nodes that depend on the blocked edge
      // Start from 'to' (the node that was reached via 'from')
      const queue = [to];
      const invalidated = new Set([to]);

      while (queue.length > 0) {
        const node = queue.shift();
        affectedNodes.add(node);

        // Force this node to be inconsistent
        this.g.set(node, this.INF);
        this.parent.delete(node); // Clear invalid parent pointer

        // Find all nodes that have this node as their parent (downstream nodes)
        for (const [childNode, parentNode] of this.parent.entries()) {
          if (parentNode === node && !invalidated.has(childNode)) {
            invalidated.add(childNode);
            queue.push(childNode);
          }
        }
      }

      // Also check if 'from' node's path is affected (for undirected graphs)
      if (!this.isDirected) {
        // Check if from's parent was 'to'
        if (this.parent.get(from) === to) {
          const queue2 = [from];
          const invalidated2 = new Set([from]);

          while (queue2.length > 0) {
            const node = queue2.shift();
            affectedNodes.add(node);
            this.g.set(node, this.INF);
            this.parent.delete(node);

            for (const [childNode, parentNode] of this.parent.entries()) {
              if (parentNode === node && !invalidated2.has(childNode)) {
                invalidated2.add(childNode);
                queue2.push(childNode);
              }
            }
          }
        }
      }

      console.log(`[LPA*] Blocked edge ${from}-${to}, invalidated ${affectedNodes.size} nodes:`, [...affectedNodes]);
    }

    // Update all affected nodes - this will recalculate rhs and add to queue if inconsistent
    for (const node of affectedNodes) {
      this.updateVertex(node);
    }

    // Also update neighbors of affected nodes to propagate changes
    for (const node of affectedNodes) {
      for (const { node: s } of this.getSuccessors(node)) {
        if (!affectedNodes.has(s)) {
          this.updateVertex(s);
        }
      }
    }
  }

  // Run initial computation
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
        message: `LPA* found path! Cost: ${cost.toFixed(2)}, ${path.length} nodes`,
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
      console.log(`LPA* no path: g(source)=${this.g.get(this.source)}, g(target)=${this.g.get(this.target)}, visited=${this.visitOrder.length}`);

      this.steps.push({
        type: 'nopath',
        current: null,
        visited: [...this.visitOrder],
        frontier: [],
        message: `LPA* could not find path from ${this.source} to ${this.target}`,
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

  // Replan after edge changes - incremental update!
  replan() {
    // Debug: show queue state before replan
    console.log(`[LPA*] replan() called. Queue size: ${this.U.toArray().length}`);
    console.log(`[LPA*] Queue contents:`, this.U.toArray().slice(0, 10));
    console.log(`[LPA*] g(target)=${this.g.get(this.target)}, rhs(target)=${this.rhs.get(this.target)}`);
    console.log(`[LPA*] g(source)=${this.g.get(this.source)}, rhs(source)=${this.rhs.get(this.source)}`);

    // Clear the path while replanning (don't show old path during replan)
    this.steps.push({
      type: 'replan_start',
      visited: [...this.visitOrder],
      frontier: this.U.toArray(),
      path: [], // Empty path - don't show old path during replan
      message: `LPA* replanning after graph change...`,
    });

    const iterations = this.computeShortestPath();
    const path = this.extractPath();
    const cost = this.calculatePathCost(path);

    console.log(`[LPA*] replan done. Iterations: ${iterations}, path: ${path ? path.join('->') : 'null'}`);

    if (path) {
      this.steps.push({
        type: 'replan_found',
        current: this.target,
        path,
        visited: [...this.visitOrder],
        frontier: [],
        message: `LPA* replanned! Cost: ${cost.toFixed(2)}, ${path.length} nodes, ${iterations} iterations`,
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
        message: `LPA*: No path available after replanning`,
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
 * LPA* algorithm - main entry point
 * @param {Object} graph - Graph object with nodes and edges
 * @param {string} source - Source node id
 * @param {string} target - Target node id
 * @param {boolean} isDirected - Whether the graph is directed
 * @param {Object} options - Options object
 * @returns {Object} - Result with path, cost, steps, and state for incremental updates
 */
export function lpaStar(graph, source, target, isDirected = false, options = {}) {
  const state = new LPAStarState(graph, source, target, isDirected, options);
  return state.run();
}

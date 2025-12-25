// Uniform Cost Search (UCS) - Similar to Dijkstra but different structure
// UCS always expands the node with lowest total path cost

import { getNeighbors } from '../utils/graphUtils';

/**
 * Priority Queue implementation for UCS
 */
class PriorityQueue {
  constructor() {
    this.heap = [];
  }

  push(item, priority) {
    this.heap.push({ item, priority });
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
    return top;
  }

  isEmpty() {
    return this.heap.length === 0;
  }

  bubbleUp(index) {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.heap[parent].priority <= this.heap[index].priority) break;
      [this.heap[parent], this.heap[index]] = [this.heap[index], this.heap[parent]];
      index = parent;
    }
  }

  bubbleDown(index) {
    while (true) {
      const left = 2 * index + 1;
      const right = 2 * index + 2;
      let smallest = index;
      if (left < this.heap.length && this.heap[left].priority < this.heap[smallest].priority) {
        smallest = left;
      }
      if (right < this.heap.length && this.heap[right].priority < this.heap[smallest].priority) {
        smallest = right;
      }
      if (smallest === index) break;
      [this.heap[smallest], this.heap[index]] = [this.heap[index], this.heap[smallest]];
      index = smallest;
    }
  }

  toArray() {
    return this.heap.map(h => h.item);
  }
}

/**
 * Uniform Cost Search implementation
 * @param {Object} graph - Graph object with nodes and edges
 * @param {string} source - Source node id
 * @param {string} target - Target node id
 * @param {boolean} isDirected - Whether the graph is directed
 * @returns {Object} - Result with path, cost, steps, and visited order
 */
export function ucs(graph, source, target, isDirected = false) {
  const steps = [];
  const cost = new Map();
  const parent = new Map();
  const visited = new Set();
  const pq = new PriorityQueue();
  const visitOrder = [];

  // Initialize
  cost.set(source, 0);
  parent.set(source, null);
  pq.push(source, 0);

  // Initial step
  steps.push({
    type: 'init',
    current: null,
    costs: Object.fromEntries(cost),
    visited: [...visited],
    frontier: pq.toArray(),
    parent: Object.fromEntries(parent),
    message: `Starting UCS from node ${source}`,
  });

  while (!pq.isEmpty()) {
    const { item: current, priority: currentCost } = pq.pop();

    // Skip if already visited with better cost
    if (visited.has(current)) continue;

    visited.add(current);
    visitOrder.push(current);

    // Expand step
    steps.push({
      type: 'expand',
      current,
      costs: Object.fromEntries(cost),
      visited: [...visited],
      frontier: pq.toArray(),
      parent: Object.fromEntries(parent),
      message: `Expanding node ${current} with cost ${currentCost}`,
    });

    // Found target
    if (current === target) {
      const path = [];
      let node = target;
      while (node !== null) {
        path.unshift(node);
        node = parent.get(node);
      }

      steps.push({
        type: 'found',
        current,
        path,
        costs: Object.fromEntries(cost),
        visited: [...visited],
        frontier: pq.toArray(),
        parent: Object.fromEntries(parent),
        message: `Found target! Path: ${path.join(' → ')}, Cost: ${currentCost}`,
      });

      return {
        path,
        cost: currentCost,
        steps,
        visitOrder,
        nodesVisited: visited.size,
        edgesExplored: steps.filter(s => s.type === 'neighbor').length,
      };
    }

    // Explore neighbors
    const neighbors = getNeighbors(graph, current, isDirected);
    for (const { node: neighbor, weight } of neighbors) {
      const newCost = currentCost + weight;

      if (!cost.has(neighbor) || newCost < cost.get(neighbor)) {
        cost.set(neighbor, newCost);
        parent.set(neighbor, current);
        pq.push(neighbor, newCost);

        steps.push({
          type: 'neighbor',
          current,
          neighbor,
          edgeWeight: weight,
          newCost,
          costs: Object.fromEntries(cost),
          visited: [...visited],
          frontier: pq.toArray(),
          parent: Object.fromEntries(parent),
          message: `Update ${neighbor}: cost = ${newCost}`,
        });
      }
    }
  }

  // No path found
  steps.push({
    type: 'nopath',
    current: null,
    costs: Object.fromEntries(cost),
    visited: [...visited],
    frontier: [],
    parent: Object.fromEntries(parent),
    message: `No path found from ${source} to ${target}`,
  });

  return {
    path: null,
    cost: Infinity,
    steps,
    visitOrder,
    nodesVisited: visited.size,
    edgesExplored: steps.filter(s => s.type === 'neighbor').length,
  };
}

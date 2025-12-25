// A* Search algorithm with step-by-step visualization

import { getNeighbors, euclideanDistance } from '../utils/graphUtils';

/**
 * Min-heap priority queue implementation
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
 * A* Search algorithm implementation with event emission for visualization
 * @param {Object} graph - Graph object with nodes and edges
 * @param {string} source - Source node id
 * @param {string} target - Target node id
 * @param {boolean} isDirected - Whether the graph is directed
 * @param {Object} options - Options object (can contain custom heuristic)
 * @returns {Object} - Result with path, cost, steps, and visited order
 */
export function astar(graph, source, target, isDirected = false, options = {}) {
  const steps = [];
  const gScore = new Map(); // Cost from start
  const fScore = new Map(); // Estimated total cost
  const parent = new Map();
  const visited = new Set();
  const pq = new PriorityQueue();
  const visitOrder = [];

  // Extract heuristic from options or use default
  let heuristic = typeof options === 'function' ? options : options?.heuristic;
  
  // Default heuristic: Euclidean distance
  if (!heuristic || typeof heuristic !== 'function') {
    heuristic = (node) => euclideanDistance(graph, node, target) * 0.5;
  }

  // Initialize
  for (const [id] of graph.nodes) {
    gScore.set(id, Infinity);
    fScore.set(id, Infinity);
  }

  gScore.set(source, 0);
  fScore.set(source, heuristic(source));
  parent.set(source, null);
  pq.push(source, fScore.get(source));

  // Initial step
  steps.push({
    type: 'init',
    current: null,
    gScores: Object.fromEntries(gScore),
    fScores: Object.fromEntries(fScore),
    visited: [...visited],
    frontier: pq.toArray(),
    parent: Object.fromEntries(parent),
    message: `Starting A* from node ${source} to ${target}`,
  });

  while (!pq.isEmpty()) {
    const { item: current } = pq.pop();

    if (visited.has(current)) continue;

    visited.add(current);
    visitOrder.push(current);

    const g = gScore.get(current);
    const f = fScore.get(current);
    const h = f - g;

    // Expand step
    steps.push({
      type: 'expand',
      current,
      gScore: g,
      hScore: h,
      fScore: f,
      gScores: Object.fromEntries(gScore),
      fScores: Object.fromEntries(fScore),
      visited: [...visited],
      frontier: pq.toArray(),
      parent: Object.fromEntries(parent),
      message: `Expanding ${current}: g=${g.toFixed(1)}, h=${h.toFixed(1)}, f=${f.toFixed(1)}`,
    });

    // Check if we reached the target
    if (current === target) {
      const path = reconstructPath(parent, target);
      const cost = gScore.get(target);

      steps.push({
        type: 'goal',
        current,
        path,
        cost,
        gScores: Object.fromEntries(gScore),
        visited: [...visited],
        message: `Found target ${target}! Path cost: ${cost.toFixed(1)}`,
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

    // Explore neighbors
    const neighbors = getNeighbors(graph, current, isDirected);
    for (const { node: neighbor, weight } of neighbors) {
      if (visited.has(neighbor)) continue;

      const tentativeG = gScore.get(current) + weight;

      if (tentativeG < gScore.get(neighbor)) {
        const oldG = gScore.get(neighbor);
        const h = heuristic(neighbor);

        parent.set(neighbor, current);
        gScore.set(neighbor, tentativeG);
        fScore.set(neighbor, tentativeG + h);
        pq.push(neighbor, tentativeG + h);

        steps.push({
          type: 'relax',
          current,
          neighbor,
          oldGScore: oldG,
          newGScore: tentativeG,
          hScore: h,
          fScore: tentativeG + h,
          weight,
          gScores: Object.fromEntries(gScore),
          fScores: Object.fromEntries(fScore),
          visited: [...visited],
          frontier: pq.toArray(),
          parent: Object.fromEntries(parent),
          message: `Relaxing ${current}→${neighbor}: g=${tentativeG.toFixed(1)}, h=${h.toFixed(1)}, f=${(tentativeG + h).toFixed(1)}`,
        });
      }
    }
  }

  // No path found
  steps.push({
    type: 'no_path',
    visited: [...visited],
    message: `No path found from ${source} to ${target}`,
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

export default astar;

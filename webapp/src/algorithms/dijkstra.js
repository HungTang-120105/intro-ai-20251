// Dijkstra's algorithm with step-by-step visualization

import { getNeighbors } from '../utils/graphUtils';

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
 * Dijkstra's algorithm implementation with event emission for visualization
 * @param {Object} graph - Graph object with nodes and edges
 * @param {string} source - Source node id
 * @param {string} target - Target node id
 * @returns {Object} - Result with path, cost, steps, and visited order
 */
export function dijkstra(graph, source, target) {
  const steps = [];
  const dist = new Map();
  const parent = new Map();
  const visited = new Set();
  const pq = new PriorityQueue();
  const visitOrder = [];

  // Initialize distances
  for (const [id] of graph.nodes) {
    dist.set(id, Infinity);
  }
  dist.set(source, 0);
  parent.set(source, null);
  pq.push(source, 0);

  // Initial step
  steps.push({
    type: 'init',
    current: null,
    distances: Object.fromEntries(dist),
    visited: [...visited],
    frontier: pq.toArray(),
    parent: Object.fromEntries(parent),
    message: `Starting Dijkstra from node ${source}`,
  });

  while (!pq.isEmpty()) {
    const { item: current, priority: currentDist } = pq.pop();

    if (visited.has(current)) continue;
    if (currentDist > dist.get(current)) continue;

    visited.add(current);
    visitOrder.push(current);

    // Expand step
    steps.push({
      type: 'expand',
      current,
      currentDistance: dist.get(current),
      distances: Object.fromEntries(dist),
      visited: [...visited],
      frontier: pq.toArray(),
      parent: Object.fromEntries(parent),
      message: `Expanding node ${current} (distance: ${dist.get(current)})`,
    });

    // Check if we reached the target
    if (current === target) {
      const path = reconstructPath(parent, target);
      const cost = dist.get(target);

      steps.push({
        type: 'goal',
        current,
        path,
        cost,
        distances: Object.fromEntries(dist),
        visited: [...visited],
        message: `Found target ${target}! Shortest path cost: ${cost}`,
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

    // Relax edges
    const neighbors = getNeighbors(graph, current);
    for (const { node: neighbor, weight } of neighbors) {
      if (visited.has(neighbor)) continue;

      const newDist = dist.get(current) + weight;

      if (newDist < dist.get(neighbor)) {
        const oldDist = dist.get(neighbor);
        dist.set(neighbor, newDist);
        parent.set(neighbor, current);
        pq.push(neighbor, newDist);

        steps.push({
          type: 'relax',
          current,
          neighbor,
          oldDistance: oldDist,
          newDistance: newDist,
          weight,
          distances: Object.fromEntries(dist),
          visited: [...visited],
          frontier: pq.toArray(),
          parent: Object.fromEntries(parent),
          message: `Relaxing edge ${current} → ${neighbor}: ${oldDist === Infinity ? '∞' : oldDist} → ${newDist}`,
        });
      }
    }
  }

  // No path found
  steps.push({
    type: 'no_path',
    visited: [...visited],
    distances: Object.fromEntries(dist),
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

export default dijkstra;

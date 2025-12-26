// Johnson's algorithm with step-by-step visualization

import { getNeighbors } from '../utils/graphUtils';

/**
 * Priority Queue for Dijkstra
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
}

/**
 * Johnson's algorithm implementation with event emission for visualization
 * Finds shortest paths between all pairs, handles negative edges
 * @param {Object} graph - Graph object with nodes and edges
 * @param {string} source - Source node id
 * @param {string} target - Target node id
 * @param {boolean} isDirected - Whether the graph is directed
 * @returns {Object} - Result with path, cost, steps, and visited order
 */
export function johnson(graph, source, target, isDirected = false) {
  const steps = [];
  const visitOrder = [];
  const nodes = Array.from(graph.nodes.keys());
  const n = nodes.length;

  // Step 1: Add virtual node and run Bellman-Ford to compute potentials
  const potential = new Map();
  const inQueue = new Map();
  const count = new Map();
  const queue = ['_virtual_'];

  // Initialize
  for (const node of nodes) {
    potential.set(node, Infinity);
    inQueue.set(node, false);
    count.set(node, 0);
  }
  potential.set('_virtual_', 0);
  inQueue.set('_virtual_', true);

  steps.push({
    type: 'init',
    current: null,
    queue: [],
    visited: [],
    frontier: [],
    phase: 'bellman-ford',
    message: 'Phase 1: Computing vertex potentials using Bellman-Ford',
  });

  // Bellman-Ford from virtual node
  while (queue.length > 0) {
    const u = queue.shift();
    inQueue.set(u, false);

    if (u === '_virtual_') {
      // Virtual node connects to all other nodes with weight 0
      for (const v of nodes) {
        if (potential.get(v) > 0) {
          potential.set(v, 0);
          if (!inQueue.get(v)) {
            queue.push(v);
            inQueue.set(v, true);
            count.set(v, count.get(v) + 1);
          }
        }
      }
    } else {
      visitOrder.push(u);
      const neighbors = getNeighbors(graph, u, isDirected);
      
      for (const { node: v, weight } of neighbors) {
        const newPotential = potential.get(u) + weight;
        if (newPotential < potential.get(v)) {
          potential.set(v, newPotential);
          if (!inQueue.get(v)) {
            queue.push(v);
            inQueue.set(v, true);
            count.set(v, count.get(v) + 1);
            
            if (count.get(v) > n) {
              steps.push({
                type: 'negative_cycle',
                visited: [...visitOrder],
                message: 'Negative cycle detected! Johnson\'s algorithm cannot proceed.',
              });
              return {
                found: false,
                path: [],
                cost: -Infinity,
                steps,
                visitOrder,
                nodesVisited: visitOrder.length,
                negativeCycle: true,
              };
            }
          }
        }
      }
    }
  }

  steps.push({
    type: 'expand',
    current: null,
    queue: [],
    visited: [...visitOrder],
    frontier: [],
    potentials: Object.fromEntries(potential),
    message: 'Vertex potentials computed successfully',
  });

  // Step 2: Reweight edges using potentials
  const reweightedEdges = new Map();
  for (const edge of graph.edges) {
    const newWeight = edge.weight + potential.get(edge.from) - potential.get(edge.to);
    reweightedEdges.set(`${edge.from}-${edge.to}`, newWeight);
    if (!isDirected) {
      const reverseWeight = edge.weight + potential.get(edge.to) - potential.get(edge.from);
      reweightedEdges.set(`${edge.to}-${edge.from}`, reverseWeight);
    }
  }

  steps.push({
    type: 'expand',
    current: null,
    queue: [],
    visited: [...visitOrder],
    frontier: [],
    phase: 'dijkstra',
    message: 'Phase 2: Running Dijkstra with reweighted edges',
  });

  // Step 3: Run Dijkstra from source using reweighted edges
  const dist = new Map();
  const parent = new Map();
  const pq = new PriorityQueue();
  const dijkstraVisited = new Set();

  for (const node of nodes) {
    dist.set(node, Infinity);
  }
  dist.set(source, 0);
  parent.set(source, null);
  pq.push(source, 0);

  while (!pq.isEmpty()) {
    const { item: u, priority: d } = pq.pop();
    
    if (d > dist.get(u)) continue;
    if (dijkstraVisited.has(u)) continue;
    dijkstraVisited.add(u);
    
    if (!visitOrder.includes(u)) visitOrder.push(u);

    steps.push({
      type: 'expand',
      current: u,
      queue: [],
      visited: [...visitOrder],
      frontier: [],
      parent: Object.fromEntries(parent),
      distances: Object.fromEntries(dist),
      message: `Dijkstra: visiting node ${u}`,
    });

    const neighbors = getNeighbors(graph, u, isDirected);
    
    for (const { node: v, weight } of neighbors) {
      const edgeKey = `${u}-${v}`;
      const reweightedWeight = reweightedEdges.get(edgeKey) ?? weight;
      const newDist = dist.get(u) + reweightedWeight;
      
      if (newDist < dist.get(v)) {
        dist.set(v, newDist);
        parent.set(v, u);
        pq.push(v, newDist);

        steps.push({
          type: 'frontier',
          current: u,
          neighbor: v,
          queue: [],
          visited: [...visitOrder],
          frontier: [],
          parent: Object.fromEntries(parent),
          message: `Updated distance to ${v}`,
        });
      }
    }
  }

  // Convert back to original distances
  for (const node of nodes) {
    if (dist.get(node) !== Infinity) {
      dist.set(node, dist.get(node) - potential.get(source) + potential.get(node));
    }
  }

  // Check if target is reachable
  if (dist.get(target) === Infinity) {
    steps.push({
      type: 'no_path',
      visited: [...visitOrder],
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

  steps.push({
    type: 'goal',
    current: target,
    path,
    cost: dist.get(target),
    visited: [...visitOrder],
    distances: Object.fromEntries(dist),
    message: `Found path: ${path.join(' → ')} with cost ${dist.get(target).toFixed(1)}`,
  });

  return {
    found: true,
    path,
    cost: dist.get(target),
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

export default johnson;

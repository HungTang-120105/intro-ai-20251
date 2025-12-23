// Graph utilities for the visualization webapp

/**
 * Create a new graph with given nodes and edges
 */
export function createGraph(nodes = [], edges = []) {
  return {
    nodes: new Map(nodes.map(n => [n.id, { ...n }])),
    edges: edges.map(e => ({ ...e })),
  };
}

/**
 * Add a node to the graph
 */
export function addNode(graph, id, x, y, label = null) {
  graph.nodes.set(id, { id, x, y, label: label || id });
  return graph;
}

/**
 * Remove a node and its connected edges
 */
export function removeNode(graph, id) {
  graph.nodes.delete(id);
  graph.edges = graph.edges.filter(e => e.from !== id && e.to !== id);
  return graph;
}

/**
 * Add an edge to the graph
 */
export function addEdge(graph, from, to, weight = 1) {
  // Check if edge already exists
  const exists = graph.edges.some(
    e => (e.from === from && e.to === to) || (e.from === to && e.to === from)
  );
  if (!exists) {
    graph.edges.push({ from, to, weight });
  }
  return graph;
}

/**
 * Remove an edge from the graph
 */
export function removeEdge(graph, from, to) {
  graph.edges = graph.edges.filter(
    e => !((e.from === from && e.to === to) || (e.from === to && e.to === from))
  );
  return graph;
}

/**
 * Get neighbors of a node
 */
export function getNeighbors(graph, nodeId) {
  const neighbors = [];
  for (const edge of graph.edges) {
    if (edge.from === nodeId) {
      neighbors.push({ node: edge.to, weight: edge.weight });
    } else if (edge.to === nodeId) {
      neighbors.push({ node: edge.from, weight: edge.weight });
    }
  }
  return neighbors;
}

/**
 * Get edge weight between two nodes
 */
export function getEdgeWeight(graph, from, to) {
  const edge = graph.edges.find(
    e => (e.from === from && e.to === to) || (e.from === to && e.to === from)
  );
  return edge ? edge.weight : Infinity;
}

/**
 * Convert graph to adjacency list
 */
export function toAdjacencyList(graph) {
  const adj = new Map();
  for (const [id] of graph.nodes) {
    adj.set(id, []);
  }
  for (const edge of graph.edges) {
    adj.get(edge.from).push({ node: edge.to, weight: edge.weight });
    adj.get(edge.to).push({ node: edge.from, weight: edge.weight });
  }
  return adj;
}

/**
 * Clone a graph
 */
export function cloneGraph(graph) {
  return {
    nodes: new Map(Array.from(graph.nodes.entries()).map(([k, v]) => [k, { ...v }])),
    edges: graph.edges.map(e => ({ ...e })),
  };
}

/**
 * Export graph to JSON
 */
export function exportGraphToJSON(graph) {
  return JSON.stringify({
    nodes: Array.from(graph.nodes.values()),
    edges: graph.edges,
  }, null, 2);
}

/**
 * Import graph from JSON
 */
export function importGraphFromJSON(json) {
  try {
    const data = JSON.parse(json);
    return createGraph(data.nodes, data.edges);
  } catch (e) {
    console.error('Failed to parse graph JSON:', e);
    return null;
  }
}

/**
 * Calculate Euclidean distance between two nodes (for A* heuristic)
 */
export function euclideanDistance(graph, nodeA, nodeB) {
  const a = graph.nodes.get(nodeA);
  const b = graph.nodes.get(nodeB);
  if (!a || !b) return Infinity;
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
}

/**
 * Calculate Manhattan distance between two nodes
 */
export function manhattanDistance(graph, nodeA, nodeB) {
  const a = graph.nodes.get(nodeA);
  const b = graph.nodes.get(nodeB);
  if (!a || !b) return Infinity;
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * Generate random position within bounds
 */
export function randomPosition(minX, maxX, minY, maxY) {
  return {
    x: minX + Math.random() * (maxX - minX),
    y: minY + Math.random() * (maxY - minY),
  };
}

/**
 * Auto-layout nodes using force-directed algorithm (simple version)
 */
export function autoLayout(graph, width, height, iterations = 100) {
  const nodes = Array.from(graph.nodes.values());
  const k = Math.sqrt((width * height) / nodes.length);
  
  // Initialize random positions if not set
  for (const node of nodes) {
    if (node.x === undefined) node.x = Math.random() * width;
    if (node.y === undefined) node.y = Math.random() * height;
  }
  
  // Simple force-directed layout
  for (let iter = 0; iter < iterations; iter++) {
    // Repulsive forces between all nodes
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = (k * k) / dist;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        nodes[i].x -= fx * 0.1;
        nodes[i].y -= fy * 0.1;
        nodes[j].x += fx * 0.1;
        nodes[j].y += fy * 0.1;
      }
    }
    
    // Attractive forces along edges
    for (const edge of graph.edges) {
      const a = graph.nodes.get(edge.from);
      const b = graph.nodes.get(edge.to);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const force = (dist * dist) / k;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.x += fx * 0.05;
      a.y += fy * 0.05;
      b.x -= fx * 0.05;
      b.y -= fy * 0.05;
    }
    
    // Keep nodes within bounds
    const padding = 50;
    for (const node of nodes) {
      node.x = Math.max(padding, Math.min(width - padding, node.x));
      node.y = Math.max(padding, Math.min(height - padding, node.y));
    }
  }
  
  return graph;
}

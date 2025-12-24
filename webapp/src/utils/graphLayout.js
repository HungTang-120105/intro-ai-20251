// Graph layout utilities using d3-force
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force';

/**
 * Apply force-directed layout to a graph
 * @param {Object} graphData - Graph data with nodes and edges arrays
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {Object} options - Layout options
 * @returns {Object} - Graph data with updated node positions
 */
export function applyForceLayout(graphData, width = 800, height = 600, options = {}) {
  const {
    iterations = 300,        // Number of simulation iterations
    linkDistance = 120,      // Desired distance between linked nodes
    chargeStrength = -400,   // Repulsion strength (negative = repel)
    centerStrength = 0.1,    // Pull towards center
    collideRadius = 35,      // Minimum distance between nodes
  } = options;

  // Create copies of nodes with initial positions if not set
  const nodes = graphData.nodes.map((node, i) => ({
    ...node,
    x: node.x || width / 2 + (Math.random() - 0.5) * 200,
    y: node.y || height / 2 + (Math.random() - 0.5) * 200,
  }));

  // Create links array for d3-force (using indices)
  const nodeIndex = new Map(nodes.map((n, i) => [n.id, i]));
  const links = graphData.edges.map(edge => ({
    source: nodeIndex.get(edge.from),
    target: nodeIndex.get(edge.to),
    weight: edge.weight || 1,
  })).filter(link => link.source !== undefined && link.target !== undefined);

  // Create force simulation
  const simulation = forceSimulation(nodes)
    .force('link', forceLink(links)
      .distance(linkDistance)
      .strength(0.5)
    )
    .force('charge', forceManyBody()
      .strength(chargeStrength)
    )
    .force('center', forceCenter(width / 2, height / 2)
      .strength(centerStrength)
    )
    .force('collide', forceCollide(collideRadius))
    .stop();

  // Run simulation for specified iterations
  for (let i = 0; i < iterations; i++) {
    simulation.tick();
  }

  // Apply boundary constraints (keep nodes within canvas)
  const padding = 50;
  nodes.forEach(node => {
    node.x = Math.max(padding, Math.min(width - padding, node.x));
    node.y = Math.max(padding, Math.min(height - padding, node.y));
  });

  return {
    nodes,
    edges: graphData.edges,
  };
}

/**
 * Apply circular layout - nodes arranged in a circle
 */
export function applyCircularLayout(graphData, width = 800, height = 600) {
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.35;
  const n = graphData.nodes.length;

  const nodes = graphData.nodes.map((node, i) => ({
    ...node,
    x: centerX + radius * Math.cos((2 * Math.PI * i) / n - Math.PI / 2),
    y: centerY + radius * Math.sin((2 * Math.PI * i) / n - Math.PI / 2),
  }));

  return {
    nodes,
    edges: graphData.edges,
  };
}

/**
 * Apply grid layout - nodes arranged in a grid
 */
export function applyGridLayout(graphData, width = 800, height = 600) {
  const n = graphData.nodes.length;
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  
  const cellWidth = (width - 100) / cols;
  const cellHeight = (height - 100) / rows;
  const startX = 50 + cellWidth / 2;
  const startY = 50 + cellHeight / 2;

  const nodes = graphData.nodes.map((node, i) => ({
    ...node,
    x: startX + (i % cols) * cellWidth,
    y: startY + Math.floor(i / cols) * cellHeight,
  }));

  return {
    nodes,
    edges: graphData.edges,
  };
}

/**
 * Apply hierarchical layout (for DAGs) - simple top-down
 */
export function applyHierarchicalLayout(graphData, width = 800, height = 600) {
  const nodes = graphData.nodes.map(n => ({ ...n }));
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  
  // Calculate node depths using BFS
  const depths = new Map();
  const inDegree = new Map();
  
  nodes.forEach(n => {
    depths.set(n.id, 0);
    inDegree.set(n.id, 0);
  });
  
  graphData.edges.forEach(e => {
    inDegree.set(e.to, (inDegree.get(e.to) || 0) + 1);
  });
  
  // Find root nodes (no incoming edges)
  const queue = nodes.filter(n => inDegree.get(n.id) === 0).map(n => n.id);
  if (queue.length === 0 && nodes.length > 0) {
    queue.push(nodes[0].id); // Fallback to first node
  }
  
  // BFS to assign depths
  const visited = new Set();
  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);
    
    graphData.edges.filter(e => e.from === nodeId).forEach(e => {
      if (!visited.has(e.to)) {
        depths.set(e.to, Math.max(depths.get(e.to), depths.get(nodeId) + 1));
        queue.push(e.to);
      }
    });
  }
  
  // Group nodes by depth
  const levels = new Map();
  nodes.forEach(n => {
    const d = depths.get(n.id);
    if (!levels.has(d)) levels.set(d, []);
    levels.get(d).push(n);
  });
  
  // Position nodes
  const maxDepth = Math.max(...depths.values());
  const levelHeight = (height - 100) / Math.max(1, maxDepth);
  
  levels.forEach((levelNodes, depth) => {
    const levelWidth = (width - 100) / levelNodes.length;
    levelNodes.forEach((node, i) => {
      node.x = 50 + levelWidth * (i + 0.5);
      node.y = 50 + depth * levelHeight;
    });
  });
  
  return {
    nodes,
    edges: graphData.edges,
  };
}

/**
 * Auto-select best layout based on graph properties
 */
export function autoLayout(graphData, width = 800, height = 600) {
  const n = graphData.nodes.length;
  const m = graphData.edges.length;
  
  if (n <= 2) {
    return applyGridLayout(graphData, width, height);
  }
  
  // For small graphs, force layout works well
  if (n <= 20) {
    return applyForceLayout(graphData, width, height);
  }
  
  // For larger graphs, use force layout with adjusted parameters
  return applyForceLayout(graphData, width, height, {
    iterations: 200,
    linkDistance: 100,
    chargeStrength: -300,
  });
}

export default autoLayout;

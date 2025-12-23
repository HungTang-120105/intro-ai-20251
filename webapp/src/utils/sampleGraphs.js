// Sample graphs for testing and demonstration

import { createGraph } from './graphUtils';

/**
 * Simple graph - basic example
 */
export function createSimpleGraph() {
  const nodes = [
    { id: 'A', x: 100, y: 200, label: 'A' },
    { id: 'B', x: 250, y: 100, label: 'B' },
    { id: 'C', x: 250, y: 300, label: 'C' },
    { id: 'D', x: 400, y: 150, label: 'D' },
    { id: 'E', x: 400, y: 250, label: 'E' },
    { id: 'F', x: 550, y: 200, label: 'F' },
  ];

  const edges = [
    { from: 'A', to: 'B', weight: 4 },
    { from: 'A', to: 'C', weight: 2 },
    { from: 'B', to: 'C', weight: 1 },
    { from: 'B', to: 'D', weight: 5 },
    { from: 'C', to: 'D', weight: 8 },
    { from: 'C', to: 'E', weight: 10 },
    { from: 'D', to: 'E', weight: 2 },
    { from: 'D', to: 'F', weight: 6 },
    { from: 'E', to: 'F', weight: 3 },
  ];

  return { graph: createGraph(nodes, edges), source: 'A', target: 'F' };
}

/**
 * Grid graph - for pathfinding visualization
 */
export function createGridGraph(rows = 5, cols = 5, cellSize = 80) {
  const nodes = [];
  const edges = [];
  const offsetX = 100;
  const offsetY = 80;

  // Create nodes
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const id = `${r}-${c}`;
      nodes.push({
        id,
        x: offsetX + c * cellSize,
        y: offsetY + r * cellSize,
        label: id,
      });
    }
  }

  // Create edges (4-connected grid)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const id = `${r}-${c}`;
      // Right neighbor
      if (c < cols - 1) {
        edges.push({ from: id, to: `${r}-${c + 1}`, weight: 1 });
      }
      // Bottom neighbor
      if (r < rows - 1) {
        edges.push({ from: id, to: `${r + 1}-${c}`, weight: 1 });
      }
    }
  }

  return {
    graph: createGraph(nodes, edges),
    source: '0-0',
    target: `${rows - 1}-${cols - 1}`
  };
}

/**
 * Weighted graph - with varied edge weights
 */
export function createWeightedGraph() {
  const nodes = [
    { id: 'S', x: 80, y: 250, label: 'Start' },
    { id: '1', x: 200, y: 120, label: '1' },
    { id: '2', x: 200, y: 380, label: '2' },
    { id: '3', x: 350, y: 180, label: '3' },
    { id: '4', x: 350, y: 320, label: '4' },
    { id: '5', x: 500, y: 120, label: '5' },
    { id: '6', x: 500, y: 250, label: '6' },
    { id: '7', x: 500, y: 380, label: '7' },
    { id: 'G', x: 650, y: 250, label: 'Goal' },
  ];

  const edges = [
    { from: 'S', to: '1', weight: 7 },
    { from: 'S', to: '2', weight: 2 },
    { from: '1', to: '3', weight: 3 },
    { from: '1', to: '5', weight: 9 },
    { from: '2', to: '4', weight: 3 },
    { from: '2', to: '7', weight: 8 },
    { from: '3', to: '4', weight: 4 },
    { from: '3', to: '5', weight: 2 },
    { from: '3', to: '6', weight: 1 },
    { from: '4', to: '6', weight: 6 },
    { from: '4', to: '7', weight: 3 },
    { from: '5', to: 'G', weight: 4 },
    { from: '6', to: 'G', weight: 2 },
    { from: '7', to: 'G', weight: 5 },
  ];

  return { graph: createGraph(nodes, edges), source: 'S', target: 'G' };
}

/**
 * Complex graph - larger for testing
 */
export function createComplexGraph() {
  const nodes = [
    { id: 'A', x: 100, y: 200, label: 'A' },
    { id: 'B', x: 200, y: 80, label: 'B' },
    { id: 'C', x: 200, y: 320, label: 'C' },
    { id: 'D', x: 320, y: 140, label: 'D' },
    { id: 'E', x: 320, y: 260, label: 'E' },
    { id: 'F', x: 440, y: 80, label: 'F' },
    { id: 'G', x: 440, y: 200, label: 'G' },
    { id: 'H', x: 440, y: 320, label: 'H' },
    { id: 'I', x: 560, y: 140, label: 'I' },
    { id: 'J', x: 560, y: 260, label: 'J' },
    { id: 'K', x: 680, y: 200, label: 'K' },
  ];

  const edges = [
    { from: 'A', to: 'B', weight: 3 },
    { from: 'A', to: 'C', weight: 5 },
    { from: 'B', to: 'D', weight: 2 },
    { from: 'B', to: 'F', weight: 8 },
    { from: 'C', to: 'E', weight: 4 },
    { from: 'C', to: 'H', weight: 7 },
    { from: 'D', to: 'E', weight: 1 },
    { from: 'D', to: 'F', weight: 4 },
    { from: 'D', to: 'G', weight: 3 },
    { from: 'E', to: 'G', weight: 2 },
    { from: 'E', to: 'H', weight: 3 },
    { from: 'F', to: 'G', weight: 2 },
    { from: 'F', to: 'I', weight: 5 },
    { from: 'G', to: 'I', weight: 4 },
    { from: 'G', to: 'J', weight: 3 },
    { from: 'H', to: 'J', weight: 6 },
    { from: 'I', to: 'J', weight: 2 },
    { from: 'I', to: 'K', weight: 3 },
    { from: 'J', to: 'K', weight: 4 },
  ];

  return { graph: createGraph(nodes, edges), source: 'A', target: 'K' };
}

/**
 * Negative weight graph (for Bellman-Ford demo)
 */
export function createNegativeWeightGraph() {
  const nodes = [
    { id: 'A', x: 100, y: 200, label: 'A' },
    { id: 'B', x: 250, y: 100, label: 'B' },
    { id: 'C', x: 250, y: 300, label: 'C' },
    { id: 'D', x: 400, y: 150, label: 'D' },
    { id: 'E', x: 400, y: 250, label: 'E' },
    { id: 'F', x: 550, y: 200, label: 'F' },
  ];

  const edges = [
    { from: 'A', to: 'B', weight: 6 },
    { from: 'A', to: 'C', weight: 4 },
    { from: 'B', to: 'C', weight: -2 },  // Negative weight
    { from: 'B', to: 'D', weight: 3 },
    { from: 'C', to: 'E', weight: 2 },
    { from: 'D', to: 'E', weight: -1 },  // Negative weight
    { from: 'D', to: 'F', weight: 4 },
    { from: 'E', to: 'F', weight: 2 },
  ];

  return { graph: createGraph(nodes, edges), source: 'A', target: 'F' };
}

/**
 * Disconnected graph (to test edge cases)
 */
export function createDisconnectedGraph() {
  const nodes = [
    { id: 'A', x: 100, y: 150, label: 'A' },
    { id: 'B', x: 200, y: 100, label: 'B' },
    { id: 'C', x: 200, y: 200, label: 'C' },
    // Disconnected component
    { id: 'X', x: 400, y: 150, label: 'X' },
    { id: 'Y', x: 500, y: 100, label: 'Y' },
    { id: 'Z', x: 500, y: 200, label: 'Z' },
  ];

  const edges = [
    { from: 'A', to: 'B', weight: 2 },
    { from: 'A', to: 'C', weight: 3 },
    { from: 'B', to: 'C', weight: 1 },
    // Second component
    { from: 'X', to: 'Y', weight: 4 },
    { from: 'X', to: 'Z', weight: 2 },
    { from: 'Y', to: 'Z', weight: 3 },
  ];

  return { graph: createGraph(nodes, edges), source: 'A', target: 'Z' };
}

/**
 * All sample graphs
 */
export const sampleGraphs = [
  {
    id: 'simple',
    name: 'Simple Graph',
    description: 'Basic 6-node graph',
    create: createSimpleGraph
  },
  {
    id: 'grid',
    name: 'Grid Graph (5x5)',
    description: '25-node grid for pathfinding',
    create: createGridGraph
  },
  {
    id: 'weighted',
    name: 'Weighted Graph',
    description: 'Graph with varied edge weights',
    create: createWeightedGraph
  },
  {
    id: 'complex',
    name: 'Complex Graph',
    description: 'Larger 11-node graph',
    create: createComplexGraph
  },
  {
    id: 'negative',
    name: 'Negative Weights',
    description: 'Graph with negative edge weights',
    create: createNegativeWeightGraph
  },
  {
    id: 'disconnected',
    name: 'Disconnected Graph',
    description: 'Two separate components',
    create: createDisconnectedGraph
  },
];

export default sampleGraphs;

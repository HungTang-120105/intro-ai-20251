// Ant Colony Optimization (ACO) for pathfinding
// A metaheuristic algorithm inspired by ant behavior

import { getNeighbors, createHeuristic } from '../utils/graphUtils.js';

/**
 * Ant Colony Optimization implementation
 * @param {Object} graph - Graph object with nodes and edges
 * @param {string} source - Source node id
 * @param {string} target - Target node id
 * @param {boolean} isDirected - Whether the graph is directed
 * @param {Object} options - ACO parameters
 * @returns {Object} - Result with path, cost, steps, and visited order
 */
export function aco(graph, source, target, isDirected = false, options = {}) {
  const {
    maxIterations = 50,
    numAnts = 10,
    alpha = 1.0,        // Pheromone importance
    beta = 2.0,         // Heuristic importance
    evaporationRate = 0.5,
    initialPheromone = 1.0,
    patience = 10,      // Stop if no improvement for this many iterations
    heuristicStrategy = 'zero', // Default to zero if not provided
    logAnts = false,
  } = options;

  // Create heuristic function (defaults to zero/Dijkstra-like if strategy is 'zero')
  // We use scale 1.0 to match edge weights directly
  const getHeuristic = createHeuristic(heuristicStrategy, graph, target, 1.0);

  const steps = [];
  const visitOrder = [];

  // Initialize pheromone on all edges
  const pheromone = new Map();
  for (const edge of graph.edges) {
    const key = `${edge.from}-${edge.to}`;
    pheromone.set(key, initialPheromone);
    if (!isDirected) {
      pheromone.set(`${edge.to}-${edge.from}`, initialPheromone);
    }
  }

  let bestPath = null;
  let bestLength = Infinity;
  let noImprove = 0;
  let hasFoundAny = false;

  // Initial step
  steps.push({
    type: 'init',
    current: null,
    iteration: 0,
    bestPath: null,
    bestLength: Infinity,
    visited: [],
    frontier: [],
    message: `Starting ACO: ${numAnts} ants, ${maxIterations} max iterations`,
  });

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const successfulPaths = [];
    const allAntsVisited = new Set();
    const antLogs = logAnts ? [] : null;
    let totalStepsAll = 0;
    let totalCostAll = 0;
    let totalCostFound = 0;
    let minCostFound = Infinity;
    let maxCostFound = 0;

    // Run all ants
    for (let ant = 0; ant < numAnts; ant++) {
      const path = [source];
      const visited = new Set([source]);
      let currentNode = source;
      let pathCost = 0;
      let deadEndAt = null;
      let foundLength = null;

      // Ant builds path
      while (currentNode !== target) {
        const neighbors = getNeighbors(graph, currentNode, isDirected);
        const allowed = neighbors.filter(n => !visited.has(n.node));

        if (allowed.length === 0) {
          deadEndAt = currentNode;
          break; // Dead end
        }

        // Calculate probabilities
        const probabilities = [];
        let total = 0;

        for (const { node: neighbor, weight } of allowed) {
          const pherKey = `${currentNode}-${neighbor}`;
          const pher = Math.pow(pheromone.get(pherKey) || initialPheromone, alpha);
          // Avoid division by zero if weight is 0 (use small epsilon)
          const validWeight = Math.max(weight, 0.0001);

          // Calculate heuristic to target (h(n))
          const hVal = getHeuristic(neighbor);

          // ACO Visibility (eta): usually 1/weight. 
          // For Informed ACO, we use 1 / (weight + h(n)) effectively minimizing f = g + h
          const totalMeas = validWeight + hVal;
          // Avoid zero division again
          const validTotal = Math.max(totalMeas, 0.0001);

          const heuristicFactor = Math.pow(1.0 / validTotal, beta);
          const prob = pher * heuristicFactor;
          probabilities.push({ node: neighbor, prob, weight });
          total += prob;
        }

        // Avoid division by zero if total is 0
        if (total === 0) {
          probabilities.forEach(p => p.prob = 1.0 / probabilities.length);
        } else {
          probabilities.forEach(p => p.prob /= total);
        }



        // Roulette wheel selection
        const rand = Math.random();
        let cumulative = 0;
        let selected = probabilities[0];
        for (const p of probabilities) {
          cumulative += p.prob;
          if (rand <= cumulative) {
            selected = p;
            break;
          }
        }

        const nextNode = selected.node;
        const stepCost = selected.weight;
        path.push(nextNode);
        visited.add(nextNode);
        pathCost += stepCost;
        currentNode = nextNode;
      }

      // If ant reached target
      if (currentNode === target) {
        let pathLength = 0;
        for (let i = 0; i < path.length - 1; i++) {
          const edge = graph.edges.find(e =>
            (e.from === path[i] && e.to === path[i + 1]) ||
            (!isDirected && e.from === path[i + 1] && e.to === path[i])
          );
          pathLength += edge ? edge.weight : 1;
        }
        foundLength = pathLength;
        successfulPaths.push({ path, length: pathLength });
        totalCostFound += pathLength;
        minCostFound = Math.min(minCostFound, pathLength);
        maxCostFound = Math.max(maxCostFound, pathLength);
        path.forEach(n => allAntsVisited.add(n));
      }

      totalStepsAll += Math.max(0, path.length - 1);
      totalCostAll += pathCost;

      if (logAnts) {
        antLogs.push({
          antId: ant + 1,
          found: currentNode === target,
          steps: Math.max(0, path.length - 1),
          cost: foundLength !== null ? foundLength : pathCost,
          path: [...path],
          reason: currentNode === target ? 'target' : 'dead-end',
          stoppedAt: currentNode === target ? null : deadEndAt,
        });
      }
    }

    // Evaporate pheromone
    for (const [key, value] of pheromone) {
      pheromone.set(key, value * (1 - evaporationRate));
    }

    // Deposit pheromone on successful paths
    let iterBestPath = null;
    let iterBestLength = Infinity;

    for (const { path, length } of successfulPaths) {
      if (length < iterBestLength) {
        iterBestLength = length;
        iterBestPath = path;
      }

      const deltaTau = initialPheromone / length;
      for (let i = 0; i < path.length - 1; i++) {
        const key = `${path[i]}-${path[i + 1]}`;
        pheromone.set(key, (pheromone.get(key) || 0) + deltaTau);
        if (!isDirected) {
          const revKey = `${path[i + 1]}-${path[i]}`;
          pheromone.set(revKey, (pheromone.get(revKey) || 0) + deltaTau);
        }
      }
    }

    // Update best
    if (iterBestPath && iterBestLength < bestLength) {
      bestLength = iterBestLength;
      bestPath = iterBestPath;
      noImprove = 0;
      hasFoundAny = true;
    } else {
      if (iterBestPath) {
        hasFoundAny = true;
      }
      if (hasFoundAny) {
        noImprove++;
      }
    }

    // Track visited for visualization
    if (iterBestPath) {
      iterBestPath.forEach(n => {
        if (!visitOrder.includes(n)) visitOrder.push(n);
      });
    }

    // Convert pheromone map to object for visualization
    const pheromoneData = {};
    let maxPheromone = 0;
    for (const [key, value] of pheromone) {
      pheromoneData[key] = value;
      if (value > maxPheromone) maxPheromone = value;
    }

    const successCount = successfulPaths.length;
    const deadEndCount = numAnts - successCount;
    const antStats = {
      numAnts,
      successCount,
      deadEndCount,
      avgStepsAll: totalStepsAll / Math.max(1, numAnts),
      avgCostAll: totalCostAll / Math.max(1, numAnts),
      avgCostFound: successCount > 0 ? (totalCostFound / successCount) : null,
      minCostFound: successCount > 0 ? minCostFound : null,
      maxCostFound: successCount > 0 ? maxCostFound : null,
    };

    // Iteration step - include pheromone data for visualization
    steps.push({
      type: 'iteration',
      current: iterBestPath ? iterBestPath[iterBestPath.length - 1] : null,
      iteration,
      iterBestPath,
      iterBestLength: iterBestLength !== Infinity ? iterBestLength : null,
      bestPath,
      bestLength: bestLength !== Infinity ? bestLength : null,
      successCount: successfulPaths.length,
      visited: [...allAntsVisited],
      frontier: [],
      path: bestPath,
      antStats,
      antLogs: logAnts ? antLogs : undefined,
      // Pheromone data for visualization
      pheromone: pheromoneData,
      maxPheromone,
      // All successful paths from this iteration
      antPaths: successfulPaths.map(sp => sp.path),
      message: `Iteration ${iteration + 1}: ${successCount}/${numAnts} found. Dead-ends: ${deadEndCount}. Best: ${bestLength !== Infinity ? bestLength : 'N/A'}`,
    });

    // Early stopping
    if (patience && hasFoundAny && noImprove >= patience) {
      steps.push({
        type: 'converged',
        current: bestPath ? bestPath[bestPath.length - 1] : null,
        iteration,
        bestPath,
        bestLength,
        path: bestPath,
        visited: visitOrder,
        frontier: [],
        message: `Converged after ${iteration + 1} iterations (no improvement for ${patience} iterations)`,
      });
      break;
    }
  }

  // Final result
  if (bestPath) {
    steps.push({
      type: 'found',
      current: target,
      path: bestPath,
      bestLength,
      visited: visitOrder,
      frontier: [],
      message: `ACO found path: ${bestPath.join(' → ')}, Cost: ${bestLength}`,
    });

    return {
      path: bestPath,
      cost: bestLength,
      found: true,
      steps,
      visitOrder,
      nodesVisited: visitOrder.length,
      edgesExplored: steps.filter(s => s.type === 'iteration').length * numAnts,
    };
  }

  steps.push({
    type: 'nopath',
    current: null,
    visited: visitOrder,
    frontier: [],
    message: `ACO could not find path from ${source} to ${target}`,
  });

  return {
    path: null,
    cost: Infinity,
    found: false,
    steps,
    visitOrder,
    nodesVisited: visitOrder.length,
    edgesExplored: 0,
  };
}

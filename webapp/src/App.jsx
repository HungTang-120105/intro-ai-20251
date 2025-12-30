import { useState, useEffect, useCallback, useRef } from 'react';
import GraphCanvas from './components/GraphCanvas';
import AlgorithmPanel from './components/AlgorithmPanel';
import ControlPanel from './components/ControlPanel';
import StatisticsPanel from './components/StatisticsPanel';
import GraphSelector from './components/GraphSelector';
import GraphEditor from './components/GraphEditor';
import OSMSelector from './components/OSMSelector';
import StateSpacePanel from './components/StateSpacePanel';
import { sampleGraphs } from './utils/sampleGraphs';
import { cityGraphs } from './utils/cityGraphs';
import { runAlgorithm } from './algorithms';
import { createGraph, cloneGraph } from './utils/graphUtils';
import { applyForceLayout } from './utils/graphLayout';
import './index.css';

// Combine all graph sources
const allGraphs = [...sampleGraphs, ...cityGraphs];

// Algorithm colors for visualization
const algoColors = {
  bfs: '#3b82f6',
  dfs: '#8b5cf6',
  ucs: '#06b6d4',
  dijkstra: '#22c55e',
  astar: '#f59e0b',
  lpastar: '#ec4899',
  'bellman-ford': '#ef4444',
  aco: '#84cc16',
};

function getAlgoColor(algorithmId) {
  return algoColors[algorithmId] || '#64748b';
}

function App() {
  // Graph state
  const [selectedGraphId, setSelectedGraphId] = useState('simple');
  const [graph, setGraph] = useState(null);
  const [source, setSource] = useState(null);
  const [target, setTarget] = useState(null);
  const [isDirected, setIsDirected] = useState(false);

  // Undo/Redo history
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const maxHistorySize = 50;

  // Editor state
  const [editorMode, setEditorMode] = useState('view');
  const [nodeCounter, setNodeCounter] = useState(1);
  const [selectionMode, setSelectionMode] = useState(null); // 'source' | 'target' | null

  // Data source mode: 'sample' | 'osm' | 'state-space'
  const [dataSourceMode, setDataSourceMode] = useState('sample');
  const [osmLoading, setOsmLoading] = useState(false);
  const [problemInfo, setProblemInfo] = useState(null);
  const [osmBounds, setOsmBounds] = useState(null); // For map tile rendering

  // Algorithm state
  const [selectedAlgorithms, setSelectedAlgorithms] = useState(['dijkstra']);
  const [results, setResults] = useState([]);
  const [currentSteps, setCurrentSteps] = useState({});
  const [activeAlgorithmIndex, setActiveAlgorithmIndex] = useState(0); // Which algorithm to visualize

  // ACO parameters
  const [acoParams, setAcoParams] = useState({
    maxIterations: 50,
    numAnts: 10,
    alpha: 1.0,
    beta: 2.0,
    evaporationRate: 0.5,
  });

  // Local Beam Search parameters
  const [lbsParams, setLbsParams] = useState({
    beamWidth: 3,
  });

  // DLS parameters
  const [dlsParams, setDlsParams] = useState({
    depthLimit: 50,
  });

  // Heuristic parameters (for A*, LPA*, Local Beam Search, D* Lite)
  const [heuristicParams, setHeuristicParams] = useState({
    heuristicStrategy: 'euclidean',
  });

  // Incremental algorithms state (LPA*, D* Lite)
  const [incrementalMode, setIncrementalMode] = useState(false);
  const [algorithmStates, setAlgorithmStates] = useState({}); // Store algorithm state objects for replanning
  const [blockedEdges, setBlockedEdges] = useState(new Set()); // Track blocked edges
  const [edgeWeightModal, setEdgeWeightModal] = useState(null); // { from, to, currentWeight }
  const [replanVersion, setReplanVersion] = useState(0); // Force re-render after replan

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(400);
  const playIntervalRef = useRef(null);
  const mainCanvasRef = useRef(null);

  // Canvas dimensions - responsive
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  // Shared zoom/pan state for synchronized view
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Resize canvas to fit container
  useEffect(() => {
    const updateCanvasSize = () => {
      if (mainCanvasRef.current) {
        const rect = mainCanvasRef.current.getBoundingClientRect();
        setCanvasSize({
          width: Math.floor(rect.width) - 20,
          height: Math.floor(rect.height) - 20
        });
      }
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);

    // Also update after a short delay (for initial render)
    const timeout = setTimeout(updateCanvasSize, 100);

    return () => {
      window.removeEventListener('resize', updateCanvasSize);
      clearTimeout(timeout);
    };
  }, []);

  // City map state
  const [showStreetGrid, setShowStreetGrid] = useState(false);
  const [gridInfo, setGridInfo] = useState(null);
  const [hasCityMap, setHasCityMap] = useState(false);
  const [mapStyle, setMapStyle] = useState(null);

  // Load initial graph
  useEffect(() => {
    const graphConfig = allGraphs.find(g => g.id === selectedGraphId);
    if (graphConfig) {
      const result = graphConfig.create();
      setGraph(result.graph);
      setSource(result.source);
      setTarget(result.target);
      setIsDirected(result.isDirected || graphConfig.isDirected || false);

      // Set city map properties
      setShowStreetGrid(result.hasStreetGrid || graphConfig.hasStreetGrid || false);
      setGridInfo(result.gridInfo || null);
      setHasCityMap(result.hasCityMap || graphConfig.hasCityMap || false);
      setMapStyle(result.mapStyle || null);

      // Clear OSM bounds when switching to sample graph
      setOsmBounds(null);

      // Reset zoom and pan for sample graphs
      setZoom(1);
      setPan({ x: 0, y: 0 });

      setResults([]);
      setCurrentSteps({});
      setIsPlaying(false);
      setEditorMode('view');
    }
  }, [selectedGraphId]);

  // Get visualization state for a specific algorithm by index
  const getVisualizationStateForIndex = useCallback((index) => {
    if (results.length === 0 || index >= results.length) return null;

    const result = results[index];
    if (!result) return null;

    const stepIndex = currentSteps[result.algorithmId] || 0;
    const step = result.steps[stepIndex];

    return step || null;
  }, [results, currentSteps, replanVersion]); // replanVersion forces re-creation after replan

  // Get current visualization state for active algorithm (for single view)
  const getVisualizationState = useCallback(() => {
    return getVisualizationStateForIndex(activeAlgorithmIndex);
  }, [getVisualizationStateForIndex, activeAlgorithmIndex]);

  // Algorithms that use heuristics
  const heuristicAlgorithms = ['astar', 'lpastar', 'dstarlite', 'local-beam'];

  // Algorithms that support incremental replanning
  const incrementalAlgorithms = ['lpastar', 'dstarlite'];

  // Run selected algorithms
  const handleRunAll = useCallback(() => {
    if (!graph || !source || !target || selectedAlgorithms.length === 0) return;

    setIsPlaying(false);
    setEditorMode('view');
    setActiveAlgorithmIndex(0); // Reset to first algorithm
    setBlockedEdges(new Set()); // Clear blocked edges on new run

    const newResults = selectedAlgorithms.map(algoId => {
      // Pass params for algorithms that need them
      let options = {};
      if (algoId === 'aco') {
        options = acoParams;
      } else if (algoId === 'local-beam') {
        options = { ...lbsParams, ...heuristicParams };
      } else if (algoId === 'dls') {
        options = dlsParams;
      } else if (heuristicAlgorithms.includes(algoId)) {
        options = heuristicParams;
      }
      try {
        return runAlgorithm(algoId, graph, source, target, isDirected, options);
      } catch (error) {
        console.error(`Error running algorithm ${algoId}:`, error);
        // Return an empty result to avoid crashing
        return {
          algorithmId: algoId,
          algorithmName: algoId,
          path: null,
          cost: Infinity,
          found: false,
          steps: [{
            type: 'error',
            message: `Error: ${error.message}`,
            visited: [],
            frontier: [],
          }],
          visitOrder: [],
          nodesVisited: 0,
          edgesExplored: 0,
          executionTime: 0,
        };
      }
    });

    setResults(newResults);

    // Store algorithm states for incremental updates
    const newAlgorithmStates = {};
    newResults.forEach(r => {
      if (r.state && incrementalAlgorithms.includes(r.algorithmId)) {
        newAlgorithmStates[r.algorithmId] = r.state;
      }
    });
    setAlgorithmStates(newAlgorithmStates);

    // Initialize step counters to 0, then auto-play
    const initialSteps = {};
    newResults.forEach(r => {
      initialSteps[r.algorithmId] = 0;
    });
    setCurrentSteps(initialSteps);

    // Enable incremental mode if any incremental algorithm is selected
    const hasIncrementalAlgo = selectedAlgorithms.some(id => incrementalAlgorithms.includes(id));
    setIncrementalMode(hasIncrementalAlgo);

    // Auto-start playing after a short delay
    setTimeout(() => setIsPlaying(true), 100);
  }, [graph, source, target, selectedAlgorithms, isDirected, acoParams, lbsParams, dlsParams, heuristicParams, incrementalAlgorithms]);

  // Handle edge click in incremental mode - show modal for weight change
  const handleEdgeBlock = useCallback((from, to) => {
    if (!incrementalMode || Object.keys(algorithmStates).length === 0) return;

    // Find the edge in the graph to get current weight
    const edge = graph.edges.find(e =>
      (e.from === from && e.to === to) ||
      (!isDirected && e.from === to && e.to === from)
    );

    if (!edge) return;

    const edgeKey = `${from}-${to}`;
    const reverseKey = `${to}-${from}`;
    const isCurrentlyBlocked = blockedEdges.has(edgeKey) || blockedEdges.has(reverseKey);

    // Detect if this is a bidirectional edge (undirected OR directed but has a reverse edge)
    // OSM graphs are directed but effectively bidirectional for most roads (represented as two edges)
    // We want to offer 'Block Both' if there is a reverse edge.
    const hasReverseEdge = graph.edges.some(e => e.from === to && e.to === from);
    const edgeDirection = (!isDirected || hasReverseEdge) ? 'both' : 'forward';

    // Open modal to let user choose action
    setEdgeWeightModal({
      from,
      to,
      currentWeight: edge.weight,
      originalWeight: edge.originalWeight || edge.weight,
      isBlocked: isCurrentlyBlocked,
      edgeDirection,
    });
  }, [incrementalMode, algorithmStates, blockedEdges, isDirected, graph]);

  // Apply edge change (block, unblock, or change weight)
  const handleApplyEdgeChange = useCallback((action, newWeight = null) => {
    if (!edgeWeightModal) return;

    const { from, to, originalWeight } = edgeWeightModal;
    const edgeKey = `${from}-${to}`;
    const reverseKey = `${to}-${from}`;

    // Find the edge
    const edge = graph.edges.find(e =>
      (e.from === from && e.to === to) ||
      (!isDirected && e.from === to && e.to === from)
    );

    if (!edge) {
      setEdgeWeightModal(null);
      return;
    }

    // Store original weight if not already stored
    if (!edge.originalWeight) {
      edge.originalWeight = edge.weight;
    }

    let finalWeight = edge.weight;
    let isBlocked = false;

    if (action.startsWith('block')) {
      finalWeight = Infinity;
      isBlocked = true;
      setBlockedEdges(prev => {
        const next = new Set(prev);
        // Handle specific directions
        if (action === 'block' || action === 'block-both') {
          next.add(edgeKey);
          next.add(reverseKey);
        } else if (action === 'block-forward') {
          next.add(edgeKey);
        } else if (action === 'block-reverse') {
          next.add(reverseKey);
        }
        return next;
      });
    } else if (action === 'unblock') {
      finalWeight = originalWeight;
      isBlocked = false;
      setBlockedEdges(prev => {
        const next = new Set(prev);
        next.delete(edgeKey);
        next.delete(reverseKey);
        return next;
      });
    } else if (action === 'change' && newWeight !== null) {
      finalWeight = parseFloat(newWeight);
      if (isNaN(finalWeight) || finalWeight <= 0) {
        finalWeight = edge.weight; // Keep current if invalid
      }
      isBlocked = false;
      // Remove from blocked if was blocked
      setBlockedEdges(prev => {
        const next = new Set(prev);
        next.delete(edgeKey);
        next.delete(reverseKey);
        return next;
      });
      // Update edge weight in graph
      edge.weight = finalWeight;
    }

    // Update algorithm states and replan
    // Also update the edge in the main graph for non-incremental algos
    // Note: This logic assumes simple graph model where edge object is shared or we block by modifying weight
    // Ideally we should have separate edge objects for each direction if we want to support one-way blocking in undirected graph visualization
    // But currently undirected edges are stored as one object. 
    // For visualization purposes, if we block one direction, we might need to rely on `blockedEdges` set which GraphCanvas uses.

    if (action.startsWith('block')) {
      edge.blocked = true;
      edge.weight = Infinity;
    } else if (action === 'unblock') {
      edge.blocked = false;
      edge.weight = originalWeight;
    } else {
      edge.blocked = false;
    }

    if (Object.keys(algorithmStates).length === 0) {
      setEdgeWeightModal(null);
      return;
    }

    const updatedResults = [];
    const updatedStates = { ...algorithmStates };

    // Capture current step counts BEFORE replanning (as replan mutates the steps array)
    const preReplanCounts = {};
    for (const [algoId, state] of Object.entries(algorithmStates)) {
      const currentState = results.find(r => r.algorithmId === algoId);
      preReplanCounts[algoId] = currentState ? currentState.steps.length : 0;
    }

    for (const [algoId, state] of Object.entries(algorithmStates)) {
      // Pass direction info to updateEdgeCost if supported, or handle logic here
      // The current updateEdgeCost takes (from, to, weight, blocked)

      if (action === 'block' || action === 'block-both') {
        state.updateEdgeCost(from, to, Infinity, true);
        if (!isDirected) state.updateEdgeCost(to, from, Infinity, true);
      } else if (action === 'block-forward') {
        state.updateEdgeCost(from, to, Infinity, true);
      } else if (action === 'block-reverse') {
        state.updateEdgeCost(to, from, Infinity, true);
      } else {
        // Unblock or change weight - applies to potentially both if undirected
        state.updateEdgeCost(from, to, finalWeight, isBlocked);
        if (!isDirected) state.updateEdgeCost(to, from, finalWeight, isBlocked);
      }

      const startTime = performance.now();
      const result = state.replan();
      const endTime = performance.now();

      result.algorithmId = algoId;
      result.algorithmName = algoId === 'lpastar' ? 'LPA*' : 'D* Lite';
      result.executionTime = endTime - startTime;
      updatedResults.push(result);
      updatedStates[algoId] = result.state;
    }

    // Merge results: update incremental ones, keep non-incremental ones in original order
    const mergedResults = results.map(r => {
      const updated = updatedResults.find(ur => ur.algorithmId === r.algorithmId);
      return updated || r;
    });

    // Stop any current playback first
    setIsPlaying(false);

    // Update algorithm states and close modal
    setAlgorithmStates(updatedStates);
    setEdgeWeightModal(null);

    // Update results
    setResults(mergedResults);

    // Update step counters to show replan process
    const newSteps = {};
    mergedResults.forEach(r => {
      // Use captured count minus 1 to start before new steps
      if (updatedResults.some(ur => ur.algorithmId === r.algorithmId)) {
        newSteps[r.algorithmId] = Math.max(0, (preReplanCounts[r.algorithmId] || 0) - 1);
      } else {
        newSteps[r.algorithmId] = r.steps.length - 1;
      }
    });
    setCurrentSteps(newSteps);
    setReplanVersion(v => v + 1);

    // Auto-play the replanning
    setTimeout(() => setIsPlaying(true), 100);
  }, [edgeWeightModal, algorithmStates, isDirected, results, currentSteps, incrementalAlgorithms, graph]);

  // Jump to end - show final result immediately
  const handleJumpToEnd = useCallback(() => {
    setIsPlaying(false);
    setCurrentSteps(prev => {
      const next = { ...prev };
      for (const result of results) {
        next[result.algorithmId] = result.steps.length - 1;
      }
      return next;
    });
  }, [results]);

  // Jump to start - reset visualization
  const handleJumpToStart = useCallback(() => {
    setIsPlaying(false);
    setCurrentSteps(prev => {
      const next = { ...prev };
      for (const result of results) {
        next[result.algorithmId] = 0;
      }
      return next;
    });
  }, [results]);

  // Playback controls
  const handlePlay = useCallback(() => {
    setIsPlaying(true);
  }, []);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const handleStepForward = useCallback(() => {
    setCurrentSteps(prev => {
      const next = { ...prev };
      for (const result of results) {
        const current = next[result.algorithmId] || 0;
        if (current < result.steps.length - 1) {
          next[result.algorithmId] = current + 1;
        }
      }
      return next;
    });
  }, [results]);

  const handleStepBackward = useCallback(() => {
    setCurrentSteps(prev => {
      const next = { ...prev };
      for (const result of results) {
        const current = next[result.algorithmId] || 0;
        if (current > 0) {
          next[result.algorithmId] = current - 1;
        }
      }
      return next;
    });
  }, [results]);

  const handleReset = useCallback(() => {
    setIsPlaying(false);
    const resetSteps = {};
    results.forEach(r => {
      resetSteps[r.algorithmId] = 0;
    });
    setCurrentSteps(resetSteps);
  }, [results]);

  // Auto-play effect
  useEffect(() => {
    if (isPlaying && results.length > 0) {
      playIntervalRef.current = setInterval(() => {
        setCurrentSteps(prev => {
          const next = { ...prev };
          let allComplete = true;

          for (const result of results) {
            const current = next[result.algorithmId] || 0;
            if (current < result.steps.length - 1) {
              next[result.algorithmId] = current + 1;
              allComplete = false;
            }
          }

          if (allComplete) {
            setIsPlaying(false);
          }

          return next;
        });
      }, speed);
    }

    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, [isPlaying, speed, results]);

  // Note: pendingReplanPlayback useEffect removed - we now set currentSteps directly
  // in handleApplyEdgeChange to avoid stale closure issues

  // Push state to history for undo/redo
  const pushToHistory = useCallback((graphState) => {
    setHistory(prev => {
      // Remove any future states if we're not at the end
      const newHistory = prev.slice(0, historyIndex + 1);
      // Add current state
      newHistory.push(JSON.stringify({
        nodes: Array.from(graphState.nodes.entries()),
        edges: graphState.edges,
        edgeGeometries: graphState.edgeGeometries ? Array.from(graphState.edgeGeometries.entries()) : []
      }));
      // Limit history size
      if (newHistory.length > maxHistorySize) {
        newHistory.shift();
        return newHistory;
      }
      return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, maxHistorySize - 1));
  }, [historyIndex, maxHistorySize]);

  // Undo function
  const handleUndo = useCallback(() => {
    if (historyIndex <= 0 || history.length === 0) return;

    const newIndex = historyIndex - 1;
    const state = JSON.parse(history[newIndex]);

    const restoredGraph = {
      nodes: new Map(state.nodes),
      edges: state.edges,
      edgeGeometries: state.edgeGeometries ? new Map(state.edgeGeometries) : new Map()
    };

    setGraph(restoredGraph);
    setHistoryIndex(newIndex);
  }, [history, historyIndex]);

  // Redo function
  const handleRedo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;

    const newIndex = historyIndex + 1;
    const state = JSON.parse(history[newIndex]);

    const restoredGraph = {
      nodes: new Map(state.nodes),
      edges: state.edges,
      edgeGeometries: state.edgeGeometries ? new Map(state.edgeGeometries) : new Map()
    };

    setGraph(restoredGraph);
    setHistoryIndex(newIndex);
  }, [history, historyIndex]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Node drag handler - only updates position, doesn't affect algorithm results
  const handleNodeDrag = useCallback((nodeId, x, y) => {
    if (!graph) return;

    setGraph(prevGraph => {
      const newGraph = cloneGraph(prevGraph);
      const node = newGraph.nodes.get(nodeId);
      if (node) {
        node.x = x;
        node.y = y;
      }
      return newGraph;
    });

    // Don't clear results - moving nodes doesn't change graph structure
    // Results are still valid since edges and weights remain the same
  }, [graph]);

  // Save state before drag starts (for undo)
  const handleNodeDragStart = useCallback(() => {
    if (graph) {
      pushToHistory(graph);
    }
  }, [graph, pushToHistory]);

  // Helper function to update running incremental algorithms
  const updateIncrementalAlgorithms = useCallback((from, to, weight, isBlocked) => {
    if (Object.keys(algorithmStates).length === 0) return;

    const updatedResults = [];
    const updatedStates = { ...algorithmStates };
    let hasUpdates = false;

    // Capture current step counts BEFORE replanning
    const preReplanCounts = {};
    for (const [algoId, state] of Object.entries(algorithmStates)) {
      const currentState = results.find(r => r.algorithmId === algoId);
      preReplanCounts[algoId] = currentState ? currentState.steps.length : 0;
    }

    // Iterate through all running algorithms
    for (const [algoId, state] of Object.entries(algorithmStates)) {
      // For Add Edge: if edge doesn't exist in algorithm's graph, we need to add it
      // This is tricky because the algo state has its own graph reference or copy
      // But usually they share the node objects but might have copied edge lists

      // Let's check if the edge exists
      let edge = state.graph.edges.find(e =>
        (e.from === from && e.to === to) ||
        (!isDirected && e.from === to && e.to === from)
      );

      if (!edge && !isBlocked) {
        // Warning: Direct mutation of internal graph state
        // This is necessary because the algorithm instance is already created
        state.graph.edges.push({ from, to, weight, blocked: false });
      }

      // Now update the cost
      state.updateEdgeCost(from, to, weight, isBlocked);

      const startTime = performance.now();
      const result = state.replan();
      const endTime = performance.now();

      result.algorithmId = algoId;
      result.algorithmName = algoId === 'lpastar' ? 'LPA*' : 'D* Lite';
      result.executionTime = endTime - startTime;
      updatedResults.push(result);
      updatedStates[algoId] = result.state;
      hasUpdates = true;
    }

    if (hasUpdates) {
      // Merge results
      const mergedResults = results.map(r => {
        const updated = updatedResults.find(ur => ur.algorithmId === r.algorithmId);
        return updated || r;
      });

      setAlgorithmStates(updatedStates);
      setResults(mergedResults);

      // Update step counters to show replan process
      const newSteps = {};
      mergedResults.forEach(r => {
        if (updatedResults.some(ur => ur.algorithmId === r.algorithmId)) {
          newSteps[r.algorithmId] = Math.max(0, (preReplanCounts[r.algorithmId] || 0) - 1);
        } else {
          newSteps[r.algorithmId] = r.steps.length - 1;
        }
      });
      setCurrentSteps(newSteps);
      setReplanVersion(v => v + 1);

      // Auto-play the replanning
      setTimeout(() => setIsPlaying(true), 100);
    }
  }, [algorithmStates, isDirected, results]);

  // Add node handler
  const handleAddNode = useCallback((x, y) => {
    if (!graph) return;

    // Save current state for undo
    pushToHistory(graph);

    const newId = `N${nodeCounter}`;
    setNodeCounter(prev => prev + 1);

    setGraph(prevGraph => {
      const newGraph = cloneGraph(prevGraph);
      newGraph.nodes.set(newId, { id: newId, x, y, label: newId });
      return newGraph;
    });

    // Don't clear results - allow editing while viewing parallel comparison
    // User can re-run algorithms when ready
  }, [graph, nodeCounter, pushToHistory]);

  // Add edge handler
  const handleAddEdge = useCallback((from, to) => {
    if (!graph) return;

    // Check if edge already exists
    const exists = graph.edges.some(
      e => (e.from === from && e.to === to) || (!isDirected && e.from === to && e.to === from)
    );
    if (exists) return;

    const weight = parseFloat(prompt('Enter edge weight:', '1') || '1');

    // Save current state for undo
    pushToHistory(graph);

    setGraph(prevGraph => {
      const newGraph = cloneGraph(prevGraph);
      newGraph.edges.push({ from, to, weight });
      return newGraph;
    });

    // Don't clear results - allow editing while viewing parallel comparison

    // Update incremental algorithms if running
    updateIncrementalAlgorithms(from, to, weight, false);
  }, [graph, isDirected, pushToHistory, updateIncrementalAlgorithms]);

  // Delete node handler
  const handleDeleteNode = useCallback((nodeId) => {
    if (!graph) return;

    // Save current state for undo
    pushToHistory(graph);

    // If deleting source or target, clear them
    if (nodeId === source) {
      setSource(null);
    }
    if (nodeId === target) {
      setTarget(null);
    }

    setGraph(prevGraph => {
      const newGraph = cloneGraph(prevGraph);
      newGraph.nodes.delete(nodeId);
      newGraph.edges = newGraph.edges.filter(e => e.from !== nodeId && e.to !== nodeId);
      return newGraph;
    });

    // Don't clear results - allow editing while viewing parallel comparison
  }, [graph, source, target, pushToHistory]);

  // Delete edge handler
  const handleDeleteEdge = useCallback((from, to) => {
    if (!graph) return;

    // Save current state for undo
    pushToHistory(graph);

    setGraph(prevGraph => {
      const newGraph = cloneGraph(prevGraph);
      newGraph.edges = newGraph.edges.filter(
        e => !((e.from === from && e.to === to) || (!isDirected && e.from === to && e.to === from))
      );
      return newGraph;
    });

    // Don't clear results - allow editing while viewing parallel comparison

    // Update incremental algorithms (mark as blocked)
    updateIncrementalAlgorithms(from, to, Infinity, true);
  }, [graph, isDirected, pushToHistory, updateIncrementalAlgorithms]);

  // Clear graph handler
  const handleClearGraph = useCallback(() => {
    if (confirm('Clear all nodes and edges?')) {
      setGraph(createGraph([], []));
      setSource(null);
      setTarget(null);
      setResults([]);
      setCurrentSteps({});
      setNodeCounter(1);
      setOsmBounds(null); // Clear OSM bounds
    }
  }, []);

  // Import graph handler
  const handleImportGraph = useCallback((data) => {
    try {
      const newGraph = createGraph(data.nodes, data.edges);
      setGraph(newGraph);
      if (data.nodes.length > 0) {
        setSource(data.nodes[0].id);
        setTarget(data.nodes[data.nodes.length - 1].id);
      }
      if (data.isDirected !== undefined) {
        setIsDirected(data.isDirected);
      }
      setResults([]);
      setCurrentSteps({});
      setOsmBounds(null); // Clear OSM bounds for imported graphs
    } catch (e) {
      alert('Failed to import graph');
    }
  }, []);

  // OSM map loading handler - connects to Python backend
  const handleLoadOSM = useCallback(async (params) => {
    setOsmLoading(true);
    setDataSourceMode('osm');

    try {
      console.log('Fetching OSM data:', params);

      // Call backend API
      const response = await fetch(params.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params.apiBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch OSM data');
      }

      const data = await response.json();
      console.log('Received OSM data:', data.metadata);

      // Convert to graph format
      const nodes = data.nodes.map(n => ({
        id: n.id,
        x: n.x,
        y: n.y,
        label: '', // OSM nodes don't need labels
        lat: n.lat,
        lng: n.lng,
      }));

      // Store edge geometries for rendering streets
      const edges = data.edges.map(e => ({
        from: e.from,
        to: e.to,
        weight: Math.round(e.weight), // Length in meters
        name: e.name || '',
        highway: e.highway || 'road',
        geometry: e.geometry || null, // Street geometry for drawing
      }));

      const newGraph = createGraph(nodes, edges);

      // Store edge geometries separately for rendering
      newGraph.edgeGeometries = new Map();
      edges.forEach(e => {
        if (e.geometry) {
          newGraph.edgeGeometries.set(`${e.from}-${e.to}`, e.geometry);
        }
      });

      setGraph(newGraph);

      // Set source and target to first and last nodes
      if (nodes.length > 0) {
        setSource(nodes[0].id);
        setTarget(nodes[nodes.length - 1].id);
      }

      setIsDirected(true); // OSM has one-way streets
      setShowStreetGrid(params.includeGeometry);
      setHasCityMap(true);
      setMapStyle({
        showStreetGeometry: params.includeGeometry,
        displayMode: params.displayMode,
      });

      // Store bounds for map tile rendering
      if (data.metadata?.bounds) {
        setOsmBounds(data.metadata.bounds);
      }

      // Set default zoom to 500% for OSM maps
      // Graph will be centered by getGraphOffset in GraphCanvas
      // Pan = {0, 0} means zoom happens around canvas center where graph is centered
      setZoom(5);
      setPan({ x: 0, y: 0 });

      setResults([]);
      setCurrentSteps({});
      setProblemInfo(null);

      console.log(`Loaded ${nodes.length} nodes, ${edges.length} edges from OSM`);

    } catch (error) {
      console.error('Failed to load OSM:', error);
      alert(`Không thể tải dữ liệu OSM: ${error.message}\n\nĐảm bảo backend đang chạy: python backend/server.py`);
    } finally {
      setOsmLoading(false);
    }
  }, []);

  // State-space problem loading handler
  const handleLoadStateProblem = useCallback((graphData) => {
    setDataSourceMode('state-space');

    // Apply force layout to state graph for better visualization
    const nodesArray = graphData.nodes.map(n => ({
      id: n.id,
      label: n.label,
      x: Math.random() * 600 + 100,
      y: Math.random() * 400 + 100,
      isStart: n.isStart,
      isGoal: n.isGoal,
      state: n.state,
    }));

    // Apply force-directed layout
    const layoutedNodes = applyForceLayout(nodesArray, graphData.edges, 800, 600);

    const newGraph = createGraph(layoutedNodes, graphData.edges);
    setGraph(newGraph);
    setSource(graphData.start);
    setTarget(graphData.goal);
    setIsDirected(true); // State space is usually directed
    setShowStreetGrid(false);
    setHasCityMap(false);
    setResults([]);
    setCurrentSteps({});
    setProblemInfo(graphData.problemInfo);
  }, []);

  // Node click handler (set source/target based on selectionMode)
  const handleNodeClick = useCallback((nodeId) => {
    if (editorMode !== 'view') return;

    // Only select source/target when in selection mode
    if (selectionMode === 'source') {
      if (nodeId !== target) {
        setSource(nodeId);
      }
      setSelectionMode(null); // Exit selection mode after selecting
    } else if (selectionMode === 'target') {
      if (nodeId !== source) {
        setTarget(nodeId);
      }
      setSelectionMode(null); // Exit selection mode after selecting
    }
    // If not in selection mode, do nothing (allows double-click to work)
  }, [editorMode, selectionMode, source, target]);

  // Get total steps and current step for active algorithm's visualization
  const activeResult = results[activeAlgorithmIndex] || results[0];
  const totalSteps = activeResult ? activeResult.steps.length : 0;
  const currentStep = activeResult ? (currentSteps[activeResult.algorithmId] || 0) : 0;

  return (
    <div className="app">
      {/* Left Sidebar */}
      <aside className="sidebar-left">
        {/* Data Source Tabs */}
        <div className="data-source-tabs">
          <button
            className={`data-tab ${dataSourceMode === 'sample' ? 'active' : ''}`}
            onClick={() => setDataSourceMode('sample')}
          >
            📊 Samples
          </button>
          <button
            className={`data-tab ${dataSourceMode === 'osm' ? 'active' : ''}`}
            onClick={() => setDataSourceMode('osm')}
          >
            🗺️ OSM
          </button>
          <button
            className={`data-tab ${dataSourceMode === 'state-space' ? 'active' : ''}`}
            onClick={() => setDataSourceMode('state-space')}
          >
            🎯 States
          </button>
        </div>

        {/* Conditional rendering based on data source mode */}
        {dataSourceMode === 'sample' && (
          <GraphSelector
            selectedGraph={selectedGraphId}
            source={source}
            target={target}
            onGraphChange={setSelectedGraphId}
            onSourceChange={setSource}
            onTargetChange={setTarget}
            graph={graph}
            allGraphs={allGraphs}
          />
        )}

        {dataSourceMode === 'osm' && (
          <OSMSelector
            onLoadMap={handleLoadOSM}
            isLoading={osmLoading}
            osmBounds={osmBounds}
          />
        )}

        {dataSourceMode === 'state-space' && (
          <StateSpacePanel
            onLoadProblem={handleLoadStateProblem}
          />
        )}

        {/* Problem info display */}
        {problemInfo && dataSourceMode === 'state-space' && (
          <div className="problem-info-badge">
            <span className="problem-type">{problemInfo.description}</span>
          </div>
        )}

        <div className="divider" />

        <GraphEditor
          editorMode={editorMode}
          onModeChange={setEditorMode}
          isDirected={isDirected}
          onDirectedChange={setIsDirected}
          onClearGraph={handleClearGraph}
          onImportGraph={handleImportGraph}
          onDeleteNode={handleDeleteNode}
          onDeleteEdge={handleDeleteEdge}
          graph={graph}
          canvasWidth={800}
          canvasHeight={600}
          selectionMode={selectionMode}
          onSelectionModeChange={setSelectionMode}
          source={source}
          target={target}
          onClearSource={() => setSource(null)}
          onClearTarget={() => setTarget(null)}
        />

        <div className="divider" />

        <AlgorithmPanel
          selectedAlgorithms={selectedAlgorithms}
          onAlgorithmToggle={setSelectedAlgorithms}
          onRunAll={handleRunAll}
          disabled={!graph || !source || !target}
          acoParams={acoParams}
          onAcoParamsChange={setAcoParams}
          lbsParams={lbsParams}
          onLbsParamsChange={setLbsParams}
          dlsParams={dlsParams}
          onDlsParamsChange={setDlsParams}
          heuristicParams={heuristicParams}
          onHeuristicParamsChange={setHeuristicParams}
        />
      </aside>

      {/* Main Canvas Area */}
      <main className="main-canvas" ref={mainCanvasRef}>
        {/* Incremental mode indicator */}
        {incrementalMode && (
          <div className="incremental-mode-banner">
            <span className="incremental-icon">⚡</span>
            <span className="incremental-text">Incremental Mode Active</span>
            <span className="incremental-hint">Click on edges to block/unblock them. Path will recompute automatically.</span>
            <button
              className="incremental-exit-btn"
              onClick={() => {
                setIncrementalMode(false);
                setAlgorithmStates({});
                setBlockedEdges(new Set());
              }}
            >
              Exit
            </button>
          </div>
        )}
        {/* Show dual view when 2+ algorithms have results */}
        {results.length >= 2 ? (
          <div className="dual-canvas-container">
            <div className="canvas-panel">
              <div className="canvas-panel-header" style={{ '--algo-color': getAlgoColor(results[0]?.algorithmId) }}>
                {results[0]?.algorithmName}
                <span className="step-info">Step {(currentSteps[results[0]?.algorithmId] || 0) + 1}/{results[0]?.steps.length}</span>
              </div>
              <GraphCanvas
                graph={graph}
                visualizationState={getVisualizationStateForIndex(0)}
                source={source}
                target={target}
                isDirected={isDirected}
                editorMode={editorMode}
                onNodeClick={handleNodeClick}
                onNodeDrag={handleNodeDrag}
                onAddNode={handleAddNode}
                onAddEdge={handleAddEdge}
                onDeleteNode={handleDeleteNode}
                onDeleteEdge={handleDeleteEdge}
                onEdgeBlock={handleEdgeBlock}
                blockedEdges={blockedEdges}
                incrementalMode={incrementalMode}
                showStreetGrid={showStreetGrid}
                gridInfo={gridInfo}
                hasCityMap={hasCityMap}
                mapStyle={mapStyle}
                osmBounds={osmBounds}
                width={Math.floor((canvasSize.width - 20) / 2)}
                height={canvasSize.height - 40}
                zoom={zoom}
                onZoomChange={setZoom}
                pan={pan}
                onPanChange={setPan}
              />
            </div>
            <div className="canvas-panel">
              <div className="canvas-panel-header" style={{ '--algo-color': getAlgoColor(results[1]?.algorithmId) }}>
                {results[1]?.algorithmName}
                <span className="step-info">Step {(currentSteps[results[1]?.algorithmId] || 0) + 1}/{results[1]?.steps.length}</span>
              </div>
              <GraphCanvas
                graph={graph}
                visualizationState={getVisualizationStateForIndex(1)}
                source={source}
                target={target}
                isDirected={isDirected}
                editorMode={editorMode}
                onNodeClick={handleNodeClick}
                onNodeDrag={handleNodeDrag}
                onAddNode={handleAddNode}
                onAddEdge={handleAddEdge}
                onDeleteNode={handleDeleteNode}
                onDeleteEdge={handleDeleteEdge}
                onEdgeBlock={handleEdgeBlock}
                blockedEdges={blockedEdges}
                incrementalMode={incrementalMode}
                showStreetGrid={showStreetGrid}
                gridInfo={gridInfo}
                hasCityMap={hasCityMap}
                mapStyle={mapStyle}
                osmBounds={osmBounds}
                width={Math.floor((canvasSize.width - 20) / 2)}
                height={canvasSize.height - 40}
                zoom={zoom}
                onZoomChange={setZoom}
                pan={pan}
                onPanChange={setPan}
              />
            </div>
          </div>
        ) : (
          <GraphCanvas
            graph={graph}
            visualizationState={getVisualizationState()}
            source={source}
            target={target}
            isDirected={isDirected}
            editorMode={editorMode}
            onNodeClick={handleNodeClick}
            onNodeDrag={handleNodeDrag}
            onNodeDragStart={handleNodeDragStart}
            onAddNode={handleAddNode}
            onAddEdge={handleAddEdge}
            onDeleteNode={handleDeleteNode}
            onDeleteEdge={handleDeleteEdge}
            onEdgeBlock={handleEdgeBlock}
            blockedEdges={blockedEdges}
            incrementalMode={incrementalMode}
            showStreetGrid={showStreetGrid}
            gridInfo={gridInfo}
            hasCityMap={hasCityMap}
            mapStyle={mapStyle}
            osmBounds={osmBounds}
            width={canvasSize.width}
            height={canvasSize.height}
            zoom={zoom}
            onZoomChange={setZoom}
            pan={pan}
            onPanChange={setPan}
          />
        )}
      </main>

      {/* Right Sidebar */}
      <aside className="sidebar-right">
        <div className="card">
          <ControlPanel
            isPlaying={isPlaying}
            currentStep={currentStep}
            totalSteps={totalSteps}
            speed={speed}
            onPlay={handlePlay}
            onPause={handlePause}
            onStepForward={handleStepForward}
            onStepBackward={handleStepBackward}
            onReset={handleReset}
            onSpeedChange={setSpeed}
            onJumpToEnd={handleJumpToEnd}
            onJumpToStart={handleJumpToStart}
            disabled={results.length === 0}
            results={results}
            activeAlgorithmIndex={activeAlgorithmIndex}
            onActiveAlgorithmChange={setActiveAlgorithmIndex}
          />
        </div>

        <StatisticsPanel
          results={results}
          currentSteps={currentSteps}
        />
      </aside>

      {/* Edge Weight Change Modal */}
      {edgeWeightModal && (
        <div className="modal-overlay" onClick={() => setEdgeWeightModal(null)}>
          <div className="modal-content edge-weight-modal" onClick={e => e.stopPropagation()}>
            <h3>Modify Edge</h3>
            <p className="edge-info">
              Edge: <strong>{edgeWeightModal.from}</strong> → <strong>{edgeWeightModal.to}</strong>
            </p>
            <p className="edge-info">
              Current Weight: <strong>{edgeWeightModal.isBlocked ? '∞ (Blocked)' : edgeWeightModal.currentWeight.toFixed(1)}</strong>
            </p>
            {edgeWeightModal.originalWeight !== edgeWeightModal.currentWeight && (
              <p className="edge-info original">
                Original Weight: <strong>{edgeWeightModal.originalWeight.toFixed(1)}</strong>
              </p>
            )}

            <div className="modal-actions">
              {!edgeWeightModal.isBlocked ? (
                // Show different blocking options based on directionality
                edgeWeightModal.edgeDirection === 'both' ? (
                  <div className="block-actions">
                    <button
                      className="btn btn-danger"
                      onClick={() => handleApplyEdgeChange('block-both')}
                      title="Block both directions"
                    >
                      🚫 Both
                    </button>
                    <button
                      className="btn btn-warning"
                      onClick={() => handleApplyEdgeChange('block-forward')}
                      title={`Block only ${edgeWeightModal.from} → ${edgeWeightModal.to}`}
                    >
                      ➡️ Forward
                    </button>
                    <button
                      className="btn btn-warning"
                      onClick={() => handleApplyEdgeChange('block-reverse')}
                      title={`Block only ${edgeWeightModal.to} → ${edgeWeightModal.from}`}
                    >
                      ⬅️ Reverse
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn btn-danger"
                    onClick={() => handleApplyEdgeChange('block')}
                  >
                    🚫 Block Edge
                  </button>
                )
              ) : (
                <button
                  className="btn btn-success"
                  onClick={() => handleApplyEdgeChange('unblock')}
                >
                  ✓ Unblock Edge
                </button>
              )}

              <div className="weight-input-group">
                <label>New Weight:</label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  defaultValue={edgeWeightModal.isBlocked ? edgeWeightModal.originalWeight : edgeWeightModal.currentWeight}
                  id="new-edge-weight"
                  className="weight-input"
                />
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    const input = document.getElementById('new-edge-weight');
                    handleApplyEdgeChange('change', input.value);
                  }}
                >
                  Apply
                </button>
              </div>

              {edgeWeightModal.currentWeight !== edgeWeightModal.originalWeight && !edgeWeightModal.isBlocked && (
                <button
                  className="btn btn-secondary"
                  onClick={() => handleApplyEdgeChange('change', edgeWeightModal.originalWeight)}
                >
                  ↩ Reset to Original
                </button>
              )}
            </div>

            <button className="modal-close" onClick={() => setEdgeWeightModal(null)}>×</button>
          </div>
        </div>
      )
      }
    </div >
  );
}

export default App;

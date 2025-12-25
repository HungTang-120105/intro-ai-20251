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
  }, [results, currentSteps]);

  // Get current visualization state for active algorithm (for single view)
  const getVisualizationState = useCallback(() => {
    return getVisualizationStateForIndex(activeAlgorithmIndex);
  }, [getVisualizationStateForIndex, activeAlgorithmIndex]);

  // Run selected algorithms
  const handleRunAll = useCallback(() => {
    if (!graph || !source || !target || selectedAlgorithms.length === 0) return;

    setIsPlaying(false);
    setEditorMode('view');
    setActiveAlgorithmIndex(0); // Reset to first algorithm

    const newResults = selectedAlgorithms.map(algoId => {
      return runAlgorithm(algoId, graph, source, target, isDirected);
    });

    setResults(newResults);

    // Initialize step counters
    const initialSteps = {};
    newResults.forEach(r => {
      initialSteps[r.algorithmId] = 0;
    });
    setCurrentSteps(initialSteps);
  }, [graph, source, target, selectedAlgorithms]);

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
  }, [graph, isDirected, pushToHistory]);

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
  }, [graph, isDirected, pushToHistory]);

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
        />
      </aside>

      {/* Main Canvas Area */}
      <main className="main-canvas" ref={mainCanvasRef}>
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
    </div>
  );
}

export default App;

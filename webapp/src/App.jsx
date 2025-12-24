import { useState, useEffect, useCallback, useRef } from 'react';
import GraphCanvas from './components/GraphCanvas';
import AlgorithmPanel from './components/AlgorithmPanel';
import ControlPanel from './components/ControlPanel';
import StatisticsPanel from './components/StatisticsPanel';
import GraphSelector from './components/GraphSelector';
import GraphEditor from './components/GraphEditor';
import { sampleGraphs } from './utils/sampleGraphs';
import { cityGraphs } from './utils/cityGraphs';
import { runAlgorithm } from './algorithms';
import { createGraph, cloneGraph } from './utils/graphUtils';
import './index.css';

// Combine all graph sources
const allGraphs = [...sampleGraphs, ...cityGraphs];

function App() {
  // Graph state
  const [selectedGraphId, setSelectedGraphId] = useState('simple');
  const [graph, setGraph] = useState(null);
  const [source, setSource] = useState(null);
  const [target, setTarget] = useState(null);
  const [isDirected, setIsDirected] = useState(false);

  // Editor state
  const [editorMode, setEditorMode] = useState('view');
  const [nodeCounter, setNodeCounter] = useState(1);

  // Algorithm state
  const [selectedAlgorithms, setSelectedAlgorithms] = useState(['dijkstra']);
  const [results, setResults] = useState([]);
  const [currentSteps, setCurrentSteps] = useState({});

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(400);
  const playIntervalRef = useRef(null);
  const mainCanvasRef = useRef(null);

  // Canvas dimensions - responsive
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

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
      
      setResults([]);
      setCurrentSteps({});
      setIsPlaying(false);
      setEditorMode('view');
    }
  }, [selectedGraphId]);

  // Get current visualization state for active algorithm
  const getVisualizationState = useCallback(() => {
    if (results.length === 0) return null;

    // Use first selected algorithm's state
    const activeResult = results[0];
    const stepIndex = currentSteps[activeResult.algorithmId] || 0;
    const step = activeResult.steps[stepIndex];

    return step || null;
  }, [results, currentSteps]);

  // Run selected algorithms
  const handleRunAll = useCallback(() => {
    if (!graph || !source || !target || selectedAlgorithms.length === 0) return;

    setIsPlaying(false);
    setEditorMode('view');

    const newResults = selectedAlgorithms.map(algoId => {
      return runAlgorithm(algoId, graph, source, target);
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

  // Node drag handler
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

    // Clear results when graph changes
    setResults([]);
    setCurrentSteps({});
  }, [graph]);

  // Add node handler
  const handleAddNode = useCallback((x, y) => {
    if (!graph) return;

    const newId = `N${nodeCounter}`;
    setNodeCounter(prev => prev + 1);

    setGraph(prevGraph => {
      const newGraph = cloneGraph(prevGraph);
      newGraph.nodes.set(newId, { id: newId, x, y, label: newId });
      return newGraph;
    });

    setResults([]);
    setCurrentSteps({});
  }, [graph, nodeCounter]);

  // Add edge handler
  const handleAddEdge = useCallback((from, to) => {
    if (!graph) return;

    // Check if edge already exists
    const exists = graph.edges.some(
      e => (e.from === from && e.to === to) || (!isDirected && e.from === to && e.to === from)
    );
    if (exists) return;

    const weight = parseFloat(prompt('Enter edge weight:', '1') || '1');

    setGraph(prevGraph => {
      const newGraph = cloneGraph(prevGraph);
      newGraph.edges.push({ from, to, weight });
      return newGraph;
    });

    setResults([]);
    setCurrentSteps({});
  }, [graph, isDirected]);

  // Clear graph handler
  const handleClearGraph = useCallback(() => {
    if (confirm('Clear all nodes and edges?')) {
      setGraph(createGraph([], []));
      setSource(null);
      setTarget(null);
      setResults([]);
      setCurrentSteps({});
      setNodeCounter(1);
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
    } catch (e) {
      alert('Failed to import graph');
    }
  }, []);

  // Node click handler (set source/target)
  const handleNodeClick = useCallback((nodeId) => {
    if (editorMode !== 'view') return;

    // Shift+click for target, normal click for source
    // For simplicity, toggle between setting source and target
    if (source === nodeId) {
      // Already source, do nothing
    } else if (target === nodeId) {
      // Already target, do nothing
    } else if (!source) {
      setSource(nodeId);
    } else if (!target) {
      setTarget(nodeId);
    } else {
      // Both set, update source
      setSource(nodeId);
    }
  }, [editorMode, source, target]);

  // Get total steps and current step for controls
  const totalSteps = results.length > 0
    ? Math.max(...results.map(r => r.steps.length))
    : 0;
  const currentStep = results.length > 0
    ? Math.max(...Object.values(currentSteps))
    : 0;

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="app-logo">
          <div className="app-logo-icon">🔍</div>
          <h1>PathViz</h1>
        </div>
        <div className="app-subtitle">
          Shortest Path Algorithm Visualizer
        </div>
      </header>

      {/* Left Sidebar */}
      <aside className="sidebar-left">
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

        <div className="divider" />

        <GraphEditor
          editorMode={editorMode}
          onModeChange={setEditorMode}
          isDirected={isDirected}
          onDirectedChange={setIsDirected}
          onClearGraph={handleClearGraph}
          onImportGraph={handleImportGraph}
          graph={graph}
        />

        <div className="divider" />

        <AlgorithmPanel
          selectedAlgorithms={selectedAlgorithms}
          onAlgorithmToggle={setSelectedAlgorithms}
          onRunAll={handleRunAll}
          disabled={!graph || !source || !target}
        />
      </aside>

      {/* Main Canvas */}
      <main className="main-canvas" ref={mainCanvasRef}>
        <GraphCanvas
          graph={graph}
          visualizationState={getVisualizationState()}
          source={source}
          target={target}
          isDirected={isDirected}
          editorMode={editorMode}
          onNodeClick={handleNodeClick}
          onNodeDrag={handleNodeDrag}
          onAddNode={handleAddNode}
          onAddEdge={handleAddEdge}
          showStreetGrid={showStreetGrid}
          gridInfo={gridInfo}
          hasCityMap={hasCityMap}
          mapStyle={mapStyle}
          width={canvasSize.width}
          height={canvasSize.height}
        />
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

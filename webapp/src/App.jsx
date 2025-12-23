import { useState, useEffect, useCallback, useRef } from 'react';
import GraphCanvas from './components/GraphCanvas';
import AlgorithmPanel from './components/AlgorithmPanel';
import ControlPanel from './components/ControlPanel';
import StatisticsPanel from './components/StatisticsPanel';
import GraphSelector from './components/GraphSelector';
import { sampleGraphs } from './utils/sampleGraphs';
import { runAlgorithm } from './algorithms';
import './index.css';

function App() {
  // Graph state
  const [selectedGraphId, setSelectedGraphId] = useState('simple');
  const [graph, setGraph] = useState(null);
  const [source, setSource] = useState(null);
  const [target, setTarget] = useState(null);

  // Algorithm state
  const [selectedAlgorithms, setSelectedAlgorithms] = useState(['dijkstra']);
  const [results, setResults] = useState([]);
  const [currentSteps, setCurrentSteps] = useState({});

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(400);
  const playIntervalRef = useRef(null);

  // Canvas dimensions
  const [canvasSize, setCanvasSize] = useState({ width: 700, height: 450 });

  // Load initial graph
  useEffect(() => {
    const graphConfig = sampleGraphs.find(g => g.id === selectedGraphId);
    if (graphConfig) {
      const { graph: newGraph, source: newSource, target: newTarget } = graphConfig.create();
      setGraph(newGraph);
      setSource(newSource);
      setTarget(newTarget);
      setResults([]);
      setCurrentSteps({});
      setIsPlaying(false);
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
      <main className="main-canvas">
        <GraphCanvas
          graph={graph}
          visualizationState={getVisualizationState()}
          source={source}
          target={target}
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

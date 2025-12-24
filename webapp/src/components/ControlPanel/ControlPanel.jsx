import './ControlPanel.css';

// Algorithm colors
const algoColors = {
  bfs: '#3b82f6',
  dfs: '#8b5cf6',
  dijkstra: '#22c55e',
  astar: '#f59e0b',
  'bellman-ford': '#ef4444',
};

function getAlgoColor(algorithmId) {
  return algoColors[algorithmId] || '#64748b';
}

/**
 * ControlPanel - Controls for visualization playback
 */
function ControlPanel({
  isPlaying = false,
  currentStep = 0,
  totalSteps = 0,
  speed = 500,
  onPlay,
  onPause,
  onStepForward,
  onStepBackward,
  onReset,
  onSpeedChange,
  disabled = false,
  // Multi-algorithm support
  results = [],
  activeAlgorithmIndex = 0,
  onActiveAlgorithmChange,
}) {
  const progress = totalSteps > 0 ? ((currentStep + 1) / totalSteps) * 100 : 0;

  const handleSpeedChange = (e) => {
    onSpeedChange(parseInt(e.target.value));
  };

  const speedLabel = speed <= 100 ? 'Fast' : speed <= 300 ? 'Medium' : speed <= 600 ? 'Normal' : 'Slow';

  return (
    <div className="control-panel-container">
      <div className="section-header">
        <span className="section-icon">🎮</span>
        <span className="section-title">Controls</span>
      </div>

      {/* Algorithm selector when multiple results */}
      {results.length > 1 && (
        <div className="algorithm-selector">
          <label className="algo-label">Visualizing:</label>
          <div className="algo-tabs">
            {results.map((result, index) => (
              <button
                key={result.algorithmId}
                className={`algo-tab ${activeAlgorithmIndex === index ? 'active' : ''}`}
                onClick={() => onActiveAlgorithmChange(index)}
                style={{
                  '--algo-color': getAlgoColor(result.algorithmId)
                }}
              >
                {result.algorithmName}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="control-buttons">
        <button
          className="btn btn-icon btn-secondary"
          onClick={onReset}
          disabled={disabled || currentStep === 0}
          title="Reset"
        >
          ⏮
        </button>

        <button
          className="btn btn-icon btn-secondary"
          onClick={onStepBackward}
          disabled={disabled || currentStep === 0}
          title="Step Back"
        >
          ⏪
        </button>

        <button
          className="btn btn-icon btn-primary play-btn"
          onClick={isPlaying ? onPause : onPlay}
          disabled={disabled || currentStep >= totalSteps - 1}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        <button
          className="btn btn-icon btn-secondary"
          onClick={onStepForward}
          disabled={disabled || currentStep >= totalSteps - 1}
          title="Step Forward"
        >
          ⏩
        </button>

        <button
          className="btn btn-icon btn-secondary"
          onClick={() => {
            // Jump to end
            while (currentStep < totalSteps - 1) {
              onStepForward();
            }
          }}
          disabled={disabled || currentStep >= totalSteps - 1}
          title="Jump to End"
        >
          ⏭
        </button>
      </div>

      <div className="progress-section">
        <div className="progress-bar">
          <div
            className="progress-bar-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="progress-label">
          Step {currentStep + 1} / {totalSteps}
        </div>
      </div>

      <div className="speed-control">
        <label className="speed-label">
          Speed: <span className="speed-value">{speedLabel}</span>
        </label>
        <input
          type="range"
          className="slider"
          min="50"
          max="1000"
          value={speed}
          onChange={handleSpeedChange}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

export default ControlPanel;

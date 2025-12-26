import { algorithms } from '../../algorithms';
import './AlgorithmPanel.css';

/**
 * AlgorithmPanel - Select and configure algorithms to run
 */
function AlgorithmPanel({
  selectedAlgorithms = [],
  onAlgorithmToggle,
  onRunAll,
  disabled = false,
  acoParams = {},
  onAcoParamsChange = null,
  lbsParams = {},
  onLbsParamsChange = null,
  dlsParams = {},
  onDlsParamsChange = null,
}) {
  const handleToggle = (algorithmId) => {
    if (disabled) return;

    if (selectedAlgorithms.includes(algorithmId)) {
      onAlgorithmToggle(selectedAlgorithms.filter(id => id !== algorithmId));
    } else {
      onAlgorithmToggle([...selectedAlgorithms, algorithmId]);
    }
  };

  const handleAcoParamChange = (param, value) => {
    if (onAcoParamsChange) {
      onAcoParamsChange({ ...acoParams, [param]: parseFloat(value) });
    }
  };

  const handleLbsParamChange = (param, value) => {
    if (onLbsParamsChange) {
      const numValue = parseInt(value, 10);
      if (!isNaN(numValue) && numValue >= 1) {
        onLbsParamsChange({ ...lbsParams, [param]: numValue });
      }
    }
  };

  const handleDlsParamChange = (param, value) => {
    if (onDlsParamsChange) {
      const numValue = parseInt(value, 10);
      if (!isNaN(numValue) && numValue >= 1) {
        onDlsParamsChange({ ...dlsParams, [param]: numValue });
      }
    }
  };

  const isAcoSelected = selectedAlgorithms.includes('aco');
  const isLbsSelected = selectedAlgorithms.includes('local-beam');
  const isDlsSelected = selectedAlgorithms.includes('dls');

  return (
    <div className="algorithm-panel">
      <div className="section-header">
        <span className="section-icon">🧮</span>
        <span className="section-title">Algorithms</span>
      </div>

      <div className="algorithm-list">
        {algorithms.map(algo => (
          <div
            key={algo.id}
            className={`algorithm-card ${selectedAlgorithms.includes(algo.id) ? 'selected' : ''}`}
            onClick={() => handleToggle(algo.id)}
          >
            <div className="algorithm-card-header">
              <div className="algorithm-card-title">
                <span
                  className="algorithm-color-dot"
                  style={{ backgroundColor: algo.color }}
                />
                {algo.name}
              </div>
              <span className="badge badge-primary">{algo.complexity}</span>
            </div>
            <div className="algorithm-card-desc">{algo.description}</div>
            <div className="algorithm-card-meta">
              <span className="algorithm-optimal">
                Optimal: <strong>{algo.optimal}</strong>
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ACO Parameters */}
      {isAcoSelected && (
        <div className="aco-params">
          <div className="aco-params-title">🐜 ACO Parameters</div>
          <div className="aco-param-row">
            <label>Iterations:</label>
            <input
              type="number"
              min="10"
              max="200"
              value={acoParams.maxIterations || 50}
              onChange={(e) => handleAcoParamChange('maxIterations', e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="aco-param-row">
            <label>Ants:</label>
            <input
              type="number"
              min="5"
              max="50"
              value={acoParams.numAnts || 10}
              onChange={(e) => handleAcoParamChange('numAnts', e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="aco-param-row">
            <label>α (pheromone):</label>
            <input
              type="number"
              min="0.1"
              max="5"
              step="0.1"
              value={acoParams.alpha || 1.0}
              onChange={(e) => handleAcoParamChange('alpha', e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="aco-param-row">
            <label>β (heuristic):</label>
            <input
              type="number"
              min="0.1"
              max="5"
              step="0.1"
              value={acoParams.beta || 2.0}
              onChange={(e) => handleAcoParamChange('beta', e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="aco-param-row">
            <label>Evaporation:</label>
            <input
              type="number"
              min="0.1"
              max="0.9"
              step="0.1"
              value={acoParams.evaporationRate || 0.5}
              onChange={(e) => handleAcoParamChange('evaporationRate', e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* Local Beam Search Parameters */}
      {isLbsSelected && (
        <div className="aco-params" onClick={(e) => e.stopPropagation()}>
          <div className="aco-params-title">🔦 Local Beam Search Parameters</div>
          <div className="aco-param-row">
            <label>Beam Width (k):</label>
            <input
              type="number"
              min="1"
              max="20"
              value={lbsParams.beamWidth || 3}
              onChange={(e) => handleLbsParamChange('beamWidth', e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* DLS Parameters */}
      {isDlsSelected && (
        <div className="aco-params" onClick={(e) => e.stopPropagation()}>
          <div className="aco-params-title">📏 DLS Parameters</div>
          <div className="aco-param-row">
            <label>Depth Limit:</label>
            <input
              type="number"
              min="1"
              max="100"
              value={dlsParams.depthLimit || 50}
              onChange={(e) => handleDlsParamChange('depthLimit', e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      <button
        className="btn btn-primary btn-run-all"
        onClick={onRunAll}
        disabled={disabled || selectedAlgorithms.length === 0}
      >
        <span>▶</span>
        Run {selectedAlgorithms.length > 0 ? `${selectedAlgorithms.length} Algorithm${selectedAlgorithms.length > 1 ? 's' : ''}` : 'Selected'}
      </button>

      {selectedAlgorithms.length === 0 && (
        <p className="algorithm-hint">Click algorithms above to select them for comparison</p>
      )}
    </div>
  );
}

export default AlgorithmPanel;

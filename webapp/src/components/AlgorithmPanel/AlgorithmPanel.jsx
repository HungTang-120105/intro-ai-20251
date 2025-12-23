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
}) {
  const handleToggle = (algorithmId) => {
    if (disabled) return;

    if (selectedAlgorithms.includes(algorithmId)) {
      onAlgorithmToggle(selectedAlgorithms.filter(id => id !== algorithmId));
    } else {
      onAlgorithmToggle([...selectedAlgorithms, algorithmId]);
    }
  };

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

import { getAlgorithm } from '../../algorithms';
import './StatisticsPanel.css';

/**
 * StatisticsPanel - Display algorithm results and comparison
 */
function StatisticsPanel({ results = [], currentSteps = {} }) {
  if (results.length === 0) {
    return (
      <div className="statistics-panel">
        <div className="section-header">
          <span className="section-icon">📊</span>
          <span className="section-title">Statistics</span>
        </div>
        <div className="stats-empty">
          <p>No results yet</p>
          <p className="stats-hint">Select algorithms and run to see comparison</p>
        </div>
      </div>
    );
  }

  return (
    <div className="statistics-panel">
      <div className="section-header">
        <span className="section-icon">📊</span>
        <span className="section-title">Comparison</span>
      </div>

      <div className="stats-table-container">
        <table className="stats-table">
          <thead>
            <tr>
              <th>Algorithm</th>
              <th>Path Cost</th>
              <th>Nodes</th>
              <th>Steps</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result, idx) => {
              const algo = getAlgorithm(result.algorithmId);
              const currentStep = currentSteps[result.algorithmId] || 0;
              const progress = result.steps.length > 0
                ? Math.round((currentStep / result.steps.length) * 100)
                : 0;

              return (
                <tr key={result.algorithmId} className={result.found ? '' : 'no-path'}>
                  <td>
                    <div className="algo-name">
                      <span
                        className="algo-dot"
                        style={{ backgroundColor: algo?.color }}
                      />
                      {result.algorithmName}
                    </div>
                  </td>
                  <td className="stat-value">
                    {result.found ? result.cost.toFixed(1) : '—'}
                  </td>
                  <td className="stat-value">
                    {result.nodesVisited}
                  </td>
                  <td className="stat-value">
                    <div className="step-progress">
                      {result.steps.length}
                      <div className="mini-progress">
                        <div
                          className="mini-progress-fill"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="stat-value time">
                    {(result.executionTime ?? 0).toFixed(2)}ms
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="stats-legend">
        <div className="legend-item">
          <span className="legend-dot" style={{ backgroundColor: 'var(--node-start)' }} />
          Start
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ backgroundColor: 'var(--node-end)' }} />
          Target
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ backgroundColor: 'var(--node-visiting)' }} />
          Current
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ backgroundColor: 'var(--node-visited)' }} />
          Visited
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ backgroundColor: 'var(--node-frontier)' }} />
          Frontier
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ backgroundColor: 'var(--node-path)' }} />
          Path
        </div>
      </div>

      {/* Best result highlight */}
      {results.length > 1 && results.some(r => r.found) && (
        <div className="best-result">
          <div className="best-result-title">🏆 Best Results</div>
          <div className="best-result-items">
            <div className="best-item">
              <span className="best-label">Shortest Path:</span>
              <span className="best-value">
                {getBestByMetric(results, 'cost')?.algorithmName || '—'}
              </span>
            </div>
            <div className="best-item">
              <span className="best-label">Fewest Nodes:</span>
              <span className="best-value">
                {getBestByMetric(results, 'nodesVisited')?.algorithmName || '—'}
              </span>
            </div>
            <div className="best-item">
              <span className="best-label">Fastest:</span>
              <span className="best-value">
                {getBestByMetric(results, 'executionTime')?.algorithmName || '—'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getBestByMetric(results, metric) {
  const found = results.filter(r => r.found);
  if (found.length === 0) return null;
  return found.reduce((best, curr) =>
    curr[metric] < best[metric] ? curr : best
  );
}

export default StatisticsPanel;

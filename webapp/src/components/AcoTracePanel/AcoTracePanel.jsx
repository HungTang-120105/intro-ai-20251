import './AcoTracePanel.css';

const formatNumber = (value, digits = 1) => {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '-';
  }
  return value.toFixed(digits);
};

const formatPath = (path, maxNodes = 10) => {
  if (!path || path.length === 0) return '-';
  if (path.length <= maxNodes) return path.join(' -> ');
  const head = path.slice(0, maxNodes - 1).join(' -> ');
  return `${head} -> ... (${path.length} nodes)`;
};

function AcoTracePanel({ result, step, logEnabled = false }) {
  if (!result || result.algorithmId !== 'aco') return null;

  const antStats = step?.antStats;
  const antLogs = step?.antLogs;
  const iteration = step?.iteration !== undefined ? step.iteration + 1 : '-';
  const bestLength = step?.iterBestLength ?? step?.bestLength ?? null;

  return (
    <div className="aco-trace-panel">
      <div className="section-header">
        <span className="section-icon">ACO</span>
        <span className="section-title">Ant Trace</span>
      </div>

      {!antStats && (
        <div className="aco-trace-empty">
          {logEnabled
            ? 'No ant details for this step.'
            : 'Enable "Log ants (detailed)" to see per-ant traces.'}
        </div>
      )}

      {antStats && (
        <>
          <div className="aco-trace-stats">
            <div className="aco-trace-stat">
              <span>Iteration</span>
              <span>{iteration}</span>
            </div>
            <div className="aco-trace-stat">
              <span>Found</span>
              <span>{antStats.successCount}/{antStats.numAnts}</span>
            </div>
            <div className="aco-trace-stat">
              <span>Dead-ends</span>
              <span>{antStats.deadEndCount}</span>
            </div>
            <div className="aco-trace-stat">
              <span>Avg steps (all)</span>
              <span>{formatNumber(antStats.avgStepsAll, 1)}</span>
            </div>
            <div className="aco-trace-stat">
              <span>Avg cost (found)</span>
              <span>{formatNumber(antStats.avgCostFound, 1)}</span>
            </div>
            <div className="aco-trace-stat">
              <span>Best cost</span>
              <span>{formatNumber(bestLength, 1)}</span>
            </div>
          </div>

          {antLogs ? (
            <div className="aco-trace-list">
              {antLogs.map((log) => {
                const statusClass = log.found ? 'found' : 'dead-end';
                const statusLabel = log.found ? 'FOUND' : 'DEAD-END';
                const meta = log.found
                  ? `cost ${formatNumber(log.cost, 1)} / steps ${log.steps}`
                  : `steps ${log.steps} / stop ${log.stoppedAt ?? '-'}`;
                const fullPath = log.path ? log.path.join(' -> ') : '';
                const pathPreview = formatPath(log.path, 8);

                return (
                  <div key={log.antId} className={`aco-trace-row ${statusClass}`}>
                    <div className="aco-trace-row-header">
                      <span className="aco-trace-id">Ant {log.antId}</span>
                      <span className={`aco-trace-status ${statusClass}`}>{statusLabel}</span>
                    </div>
                    <div className="aco-trace-meta">{meta}</div>
                    <div className="aco-trace-path" title={fullPath}>
                      {pathPreview}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="aco-trace-empty">
              Enable "Log ants (detailed)" to see per-ant traces.
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default AcoTracePanel;

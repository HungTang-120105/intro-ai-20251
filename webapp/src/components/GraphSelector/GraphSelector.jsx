import './GraphSelector.css';

/**
 * GraphSelector - Select sample graphs and configure source/target
 */
function GraphSelector({
  selectedGraph,
  source,
  target,
  onGraphChange,
  onSourceChange,
  onTargetChange,
  graph,
  allGraphs = [],
}) {
  const nodes = graph ? Array.from(graph.nodes.keys()) : [];

  // Group graphs by category
  const basicGraphs = allGraphs.filter(g => !g.id.includes('hanoi') && !g.id.includes('hcm') && !g.id.includes('directed_city'));
  const cityGraphs = allGraphs.filter(g => g.id.includes('hanoi') || g.id.includes('hcm') || g.id.includes('directed_city'));

  return (
    <div className="graph-selector">
      <div className="section-header">
        <span className="section-icon">🗺️</span>
        <span className="section-title">Graph</span>
      </div>

      <div className="input-group">
        <label className="input-label">Sample Graph</label>
        <select
          className="select"
          value={selectedGraph || ''}
          onChange={(e) => onGraphChange(e.target.value)}
        >
          <optgroup label="Basic Graphs">
            {basicGraphs.map(g => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </optgroup>
          {cityGraphs.length > 0 && (
            <optgroup label="City Maps">
              {cityGraphs.map(g => (
                <option key={g.id} value={g.id}>
                  {g.name} {g.isDirected ? '(→)' : ''}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      <div className="node-selectors">
        <div className="input-group">
          <label className="input-label">
            <span className="source-dot" /> Source
          </label>
          <select
            className="select"
            value={source || ''}
            onChange={(e) => onSourceChange(e.target.value)}
          >
            {nodes.map(node => (
              <option key={node} value={node}>{node}</option>
            ))}
          </select>
        </div>

        <div className="input-group">
          <label className="input-label">
            <span className="target-dot" /> Target
          </label>
          <select
            className="select"
            value={target || ''}
            onChange={(e) => onTargetChange(e.target.value)}
          >
            {nodes.map(node => (
              <option key={node} value={node}>{node}</option>
            ))}
          </select>
        </div>
      </div>

      {graph && (
        <div className="graph-info">
          <div className="info-item">
            <span className="info-label">Nodes:</span>
            <span className="info-value">{graph.nodes.size}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Edges:</span>
            <span className="info-value">{graph.edges.length}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default GraphSelector;

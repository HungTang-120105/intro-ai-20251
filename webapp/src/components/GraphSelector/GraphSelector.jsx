import { sampleGraphs } from '../../utils/sampleGraphs';
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
}) {
  const nodes = graph ? Array.from(graph.nodes.keys()) : [];

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
          {sampleGraphs.map(g => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
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

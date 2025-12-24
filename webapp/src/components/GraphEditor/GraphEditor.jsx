import { useState, useRef, useEffect } from 'react';
import { applyForceLayout, applyCircularLayout, applyGridLayout, applyHierarchicalLayout } from '../../utils/graphLayout';
import './GraphEditor.css';

/**
 * GraphEditor - Tools for editing the graph
 */
function GraphEditor({
  editorMode,
  onModeChange,
  isDirected,
  onDirectedChange,
  onClearGraph,
  onImportGraph,
  onDeleteNode,
  onDeleteEdge,
  graph,
  canvasWidth = 800,
  canvasHeight = 600,
  // Selection mode for source/target
  selectionMode,
  onSelectionModeChange,
  source,
  target,
  onClearSource,
  onClearTarget,
}) {
  const [edgeListText, setEdgeListText] = useState('');
  const [weightInput, setWeightInput] = useState('1');
  const [layoutType, setLayoutType] = useState('force'); // 'force' | 'circular' | 'grid' | 'hierarchical'
  const textareaRef = useRef(null);

  // Convert graph to edge list text whenever graph changes
  useEffect(() => {
    if (graph && graph.edges) {
      const lines = graph.edges.map(e => `${e.from} ${e.to} ${e.weight}`);
      setEdgeListText(lines.join('\n'));
    } else {
      setEdgeListText('');
    }
  }, [graph]);

  // Apply layout to graph data
  const applyLayout = (graphData) => {
    switch (layoutType) {
      case 'circular':
        return applyCircularLayout(graphData, canvasWidth, canvasHeight);
      case 'grid':
        return applyGridLayout(graphData, canvasWidth, canvasHeight);
      case 'hierarchical':
        return applyHierarchicalLayout(graphData, canvasWidth, canvasHeight);
      case 'force':
      default:
        return applyForceLayout(graphData, canvasWidth, canvasHeight);
    }
  };

  // Parse edge list format: "u v w" or "u v"
  const parseEdgeList = (text) => {
    const lines = text.trim().split('\n');
    const nodes = new Map();
    const edges = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;

      const parts = trimmed.split(/\s+/);
      if (parts.length < 2) continue;

      const u = parts[0];
      const v = parts[1];
      const w = parts.length >= 3 ? parseFloat(parts[2]) : 1;

      // Add nodes if not exist (positions will be set by layout)
      if (!nodes.has(u)) {
        nodes.set(u, { id: u, label: u, x: 0, y: 0 });
      }
      if (!nodes.has(v)) {
        nodes.set(v, { id: v, label: v, x: 0, y: 0 });
      }

      // Add edge
      edges.push({ from: u, to: v, weight: isNaN(w) ? 1 : w });
    }

    return {
      nodes: Array.from(nodes.values()),
      edges,
    };
  };

  // Apply changes from text editor
  const handleApplyText = () => {
    try {
      let data = parseEdgeList(edgeListText);
      if (data.nodes && data.nodes.length > 0) {
        // Apply automatic layout for better visual
        data = applyLayout(data);
        if (onImportGraph) onImportGraph(data);
      } else {
        alert('Không tìm thấy cạnh hợp lệ');
      }
    } catch (e) {
      alert('Lỗi định dạng: ' + e.message);
    }
  };

  // Re-layout current graph
  const handleRelayout = () => {
    if (graph && graph.nodes && graph.nodes.size > 0) {
      const graphData = {
        nodes: Array.from(graph.nodes.values()),
        edges: graph.edges
      };
      const layouted = applyLayout(graphData);
      if (onImportGraph) onImportGraph(layouted);
    }
  };

  const handleExport = () => {
    if (!graph) return;
    const data = {
      nodes: Array.from(graph.nodes.values()),
      edges: graph.edges,
      isDirected,
    };
    const json = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(json);
    alert('Graph copied to clipboard!');
  };

  const handleExportEdgeList = () => {
    if (!graph) return;
    const lines = graph.edges.map(e => `${e.from} ${e.to} ${e.weight}`);
    const text = lines.join('\n');
    navigator.clipboard.writeText(text);
    alert('Edge list copied to clipboard!');
  };

  return (
    <div className="graph-editor">
      <div className="section-header">
        <span className="section-icon">✏️</span>
        <span className="section-title">Graph Editor</span>
      </div>

      {/* Graph Type Toggle */}
      <div className="editor-row">
        <label className="input-label">Graph Type</label>
        <div className="toggle-group">
          <button
            className={`toggle-btn ${!isDirected ? 'active' : ''}`}
            onClick={() => onDirectedChange(false)}
          >
            Undirected
          </button>
          <button
            className={`toggle-btn ${isDirected ? 'active' : ''}`}
            onClick={() => onDirectedChange(true)}
          >
            Directed
          </button>
        </div>
      </div>

      {/* Source/Target Selection */}
      <div className="editor-row">
        <label className="input-label">Select Nodes</label>
        <div className="selection-buttons">
          <button
            className={`selection-btn source ${selectionMode === 'source' ? 'active' : ''}`}
            onClick={() => onSelectionModeChange(selectionMode === 'source' ? null : 'source')}
            title="Click to select source node"
          >
            🟢 Source: {source || '?'}
          </button>
          <button
            className={`selection-btn target ${selectionMode === 'target' ? 'active' : ''}`}
            onClick={() => onSelectionModeChange(selectionMode === 'target' ? null : 'target')}
            title="Click to select target node"
          >
            🔴 Target: {target || '?'}
          </button>
        </div>
        {(source || target) && (
          <div className="selection-actions">
            {source && <button className="btn btn-xs btn-ghost" onClick={onClearSource}>Clear Source</button>}
            {target && <button className="btn btn-xs btn-ghost" onClick={onClearTarget}>Clear Target</button>}
          </div>
        )}
      </div>

      {/* Selection Mode Help */}
      {selectionMode && (
        <div className="editor-row">
          <div className={`mode-help selection-help ${selectionMode}`}>
            🖱️ Click vào một đỉnh để chọn làm {selectionMode === 'source' ? 'điểm xuất phát' : 'điểm đích'}
          </div>
        </div>
      )}

      {/* Editor Mode Buttons */}
      <div className="editor-row">
        <label className="input-label">Edit Mode</label>
        <div className="mode-buttons">
          <button
            className={`mode-btn ${editorMode === 'view' ? 'active' : ''}`}
            onClick={() => onModeChange('view')}
            title="View/Drag nodes"
          >
            ✋ Move
          </button>
          <button
            className={`mode-btn ${editorMode === 'addNode' ? 'active' : ''}`}
            onClick={() => onModeChange('addNode')}
            title="Click to add node"
          >
            ⊕ Node
          </button>
          <button
            className={`mode-btn ${editorMode === 'addEdge' ? 'active' : ''}`}
            onClick={() => onModeChange('addEdge')}
            title="Drag between nodes to add edge"
          >
            ↔ Edge
          </button>
          <button
            className={`mode-btn delete ${editorMode === 'delete' ? 'active' : ''}`}
            onClick={() => onModeChange('delete')}
            title="Click node/edge to delete"
          >
            🗑️ Delete
          </button>
        </div>
      </div>

      {/* Delete Mode Help */}
      {editorMode === 'delete' && (
        <div className="editor-row">
          <div className="mode-help delete-help">
            ⚠️ Click node hoặc edge để xóa. Double-click cũng xóa trong mọi mode.
          </div>
        </div>
      )}

      {/* Edge Weight (for addEdge mode) */}
      {editorMode === 'addEdge' && (
        <div className="editor-row">
          <label className="input-label">New Edge Weight</label>
          <input
            type="number"
            className="input weight-input"
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
            min="1"
          />
        </div>
      )}

      {/* Inline Edge List Editor - Always visible */}
      <div className="edge-list-editor">
        <div className="edge-list-header">
          <label className="input-label">📝 Edge List (u v w)</label>
          <div className="edge-list-actions">
            <button className="btn btn-xs btn-ghost" onClick={handleExport} title="Copy JSON">
              JSON
            </button>
            <button className="btn btn-xs btn-ghost" onClick={handleExportEdgeList} title="Copy Text">
              Copy
            </button>
          </div>
        </div>
        <textarea
          ref={textareaRef}
          className="input edge-list-textarea"
          placeholder="A B 4&#10;B C 2&#10;C D 3"
          value={edgeListText}
          onChange={(e) => setEdgeListText(e.target.value)}
          rows={6}
        />
        
        {/* Layout Selector */}
        <div className="layout-selector">
          <label className="input-label-sm">Layout:</label>
          <select 
            className="input layout-select"
            value={layoutType}
            onChange={(e) => setLayoutType(e.target.value)}
          >
            <option value="force">🔄 Force-Directed</option>
            <option value="circular">⭕ Circular</option>
            <option value="grid">⊞ Grid</option>
            <option value="hierarchical">📊 Hierarchical</option>
          </select>
          <button 
            className="btn btn-xs btn-ghost" 
            onClick={handleRelayout}
            title="Re-apply layout to current graph"
          >
            🔄
          </button>
        </div>

        <div className="edge-list-footer">
          <span className="edge-count">{graph?.edges?.length || 0} edges</span>
          <button className="btn btn-xs btn-primary" onClick={handleApplyText}>
            ✓ Apply
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="editor-actions">
        <button className="btn btn-secondary btn-sm danger" onClick={onClearGraph}>
          🗑️ Clear All
        </button>
      </div>

      {/* Instructions */}
      <div className="editor-help">
        {editorMode === 'view' && !selectionMode && <p>🖱️ Drag nodes to move. Double-click node/edge to delete.</p>}
        {editorMode === 'view' && selectionMode && <p>🖱️ Click node to select as {selectionMode}</p>}
        {editorMode === 'addNode' && <p>🖱️ Click canvas to add node</p>}
        {editorMode === 'addEdge' && <p>🖱️ Drag from one node to another</p>}
        {editorMode === 'delete' && <p>🖱️ Click node or edge to delete</p>}
      </div>
    </div>
  );
}

export default GraphEditor;

import { useState, useRef } from 'react';
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
  onExportGraph,
  onImportEdgeList,
  graph,
}) {
  const [showImport, setShowImport] = useState(false);
  const [importMode, setImportMode] = useState('text'); // 'text' | 'json'
  const [importData, setImportData] = useState('');
  const [weightInput, setWeightInput] = useState('1');
  const [showQuickInput, setShowQuickInput] = useState(false);
  const [quickInputData, setQuickInputData] = useState('');
  const textareaRef = useRef(null);

  // Parse edge list format: "u v w" or "u v"
  const parseEdgeList = (text) => {
    const lines = text.trim().split('\n');
    const nodes = new Map();
    const edges = [];
    let nodeCounter = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;

      const parts = trimmed.split(/\s+/);
      if (parts.length < 2) continue;

      const u = parts[0];
      const v = parts[1];
      const w = parts.length >= 3 ? parseFloat(parts[2]) : 1;

      // Add nodes if not exist
      if (!nodes.has(u)) {
        const col = nodeCounter % 5;
        const row = Math.floor(nodeCounter / 5);
        nodes.set(u, {
          id: u,
          label: u,
          x: 120 + col * 120,
          y: 100 + row * 100
        });
        nodeCounter++;
      }
      if (!nodes.has(v)) {
        const col = nodeCounter % 5;
        const row = Math.floor(nodeCounter / 5);
        nodes.set(v, {
          id: v,
          label: v,
          x: 120 + col * 120,
          y: 100 + row * 100
        });
        nodeCounter++;
      }

      // Add edge
      edges.push({ from: u, to: v, weight: isNaN(w) ? 1 : w });
    }

    return {
      nodes: Array.from(nodes.values()),
      edges,
    };
  };

  const handleImport = () => {
    try {
      let data;

      if (importMode === 'json') {
        data = JSON.parse(importData);
      } else {
        // Text/edge list format
        data = parseEdgeList(importData);
      }

      if (data.nodes && data.nodes.length > 0) {
        if (onImportGraph) onImportGraph(data);
        setShowImport(false);
        setImportData('');
      } else {
        alert('No valid edges found');
      }
    } catch (e) {
      alert('Invalid format: ' + e.message);
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

  // Quick add edge from input
  const handleQuickAdd = () => {
    if (!quickInputData.trim()) return;
    try {
      const data = parseEdgeList(quickInputData);
      if (data.nodes && data.nodes.length > 0) {
        if (onImportGraph) onImportGraph(data);
        setQuickInputData('');
        setShowQuickInput(false);
      } else {
        alert('Không tìm thấy cạnh hợp lệ');
      }
    } catch (e) {
      alert('Lỗi định dạng: ' + e.message);
    }
  };

  // Sample edge list for quick reference
  const sampleEdgeList = `# Ví dụ nhập graph:
# Có trọng số: A B 5
# Không trọng số: A B
A B 4
B C 2
C D 3
D E 1
A D 7
B E 5`;

  const fillSample = () => {
    setImportData(sampleEdgeList);
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
        </div>
      </div>

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

      {/* Actions */}
      <div className="editor-actions">
        <button className="btn btn-secondary btn-sm" onClick={() => setShowQuickInput(!showQuickInput)}>
          ✍️ Nhập tay
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => setShowImport(!showImport)}>
          📥 Import
        </button>
        <button className="btn btn-secondary btn-sm" onClick={handleExport}>
          📤 JSON
        </button>
        <button className="btn btn-secondary btn-sm" onClick={handleExportEdgeList}>
          📤 Text
        </button>
        <button className="btn btn-secondary btn-sm danger" onClick={onClearGraph}>
          🗑️
        </button>
      </div>

      {/* Quick Input Panel - Nhập tay */}
      {showQuickInput && (
        <div className="quick-input-panel">
          <div className="quick-input-header">
            <h4>📝 Nhập Graph (Danh sách cạnh)</h4>
            <button className="btn-close" onClick={() => setShowQuickInput(false)}>×</button>
          </div>
          <div className="quick-input-help">
            <p>Mỗi dòng là một cạnh theo định dạng:</p>
            <code>u v w</code> <span>– có trọng số w</span><br/>
            <code>u v</code> <span>– không có trọng số (mặc định = 1)</span>
            <p className="quick-input-note">Node mới sẽ tự động được tạo</p>
          </div>
          <textarea
            ref={textareaRef}
            className="input quick-textarea"
            placeholder={`A B 4\nB C 2\nC D\nD E 3`}
            value={quickInputData}
            onChange={(e) => setQuickInputData(e.target.value)}
            rows={8}
          />
          <div className="quick-input-actions">
            <button className="btn btn-sm btn-ghost" onClick={() => setQuickInputData('')}>
              Xóa
            </button>
            <button className="btn btn-sm btn-primary" onClick={handleQuickAdd}>
              ✓ Tạo Graph
            </button>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImport && (
        <div className="import-modal">
          <div className="import-mode-toggle">
            <button
              className={`mode-btn ${importMode === 'text' ? 'active' : ''}`}
              onClick={() => setImportMode('text')}
            >
              📝 Edge List
            </button>
            <button
              className={`mode-btn ${importMode === 'json' ? 'active' : ''}`}
              onClick={() => setImportMode('json')}
            >
              { } JSON
            </button>
          </div>

          <textarea
            className="input import-textarea"
            placeholder={importMode === 'text'
              ? 'Nhập danh sách cạnh:\nA B 4\nB C 2\nC D\n(mỗi dòng: node1 node2 [weight])'
              : 'Paste JSON: {"nodes": [...], "edges": [...]}'}
            value={importData}
            onChange={(e) => setImportData(e.target.value)}
          />

          <div className="import-actions">
            {importMode === 'text' && (
              <button className="btn btn-sm btn-ghost" onClick={fillSample}>
                Ví dụ
              </button>
            )}
            <button className="btn btn-sm btn-secondary" onClick={() => setShowImport(false)}>
              Cancel
            </button>
            <button className="btn btn-sm btn-primary" onClick={handleImport}>
              Import
            </button>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="editor-help">
        {editorMode === 'view' && <p>🖱️ Drag nodes to move them</p>}
        {editorMode === 'addNode' && <p>🖱️ Click canvas to add node</p>}
        {editorMode === 'addEdge' && <p>🖱️ Drag from one node to another</p>}
      </div>
    </div>
  );
}

export default GraphEditor;

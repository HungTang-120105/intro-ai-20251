import { useRef, useEffect, useCallback } from 'react';
import './GraphCanvas.css';

/**
 * GraphCanvas component - Canvas-based graph rendering with visualization support
 */
function GraphCanvas({
  graph,
  visualizationState = null,
  source = null,
  target = null,
  onNodeClick = null,
  onCanvasClick = null,
  width = 800,
  height = 500,
}) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  // Colors for different states
  const colors = {
    node: {
      default: '#334155',
      start: '#00d9ff',
      end: '#ef4444',
      visiting: '#f59e0b',
      visited: '#6366f1',
      path: '#22c55e',
      frontier: '#a855f7',
    },
    edge: {
      default: '#475569',
      path: '#22c55e',
      exploring: '#f59e0b',
    },
    text: {
      default: '#e2e8f0',
      weight: '#94a3b8',
    },
  };

  // Get node state for coloring
  const getNodeState = useCallback((nodeId) => {
    if (!visualizationState) return 'default';

    if (visualizationState.path?.includes(nodeId)) return 'path';
    if (visualizationState.current === nodeId) return 'visiting';
    if (visualizationState.frontier?.includes(nodeId)) return 'frontier';
    if (visualizationState.visited?.includes(nodeId)) return 'visited';

    return 'default';
  }, [visualizationState]);

  // Check if edge is in path
  const isEdgeInPath = useCallback((from, to) => {
    if (!visualizationState?.path) return false;
    const path = visualizationState.path;
    for (let i = 0; i < path.length - 1; i++) {
      if ((path[i] === from && path[i + 1] === to) ||
        (path[i] === to && path[i + 1] === from)) {
        return true;
      }
    }
    return false;
  }, [visualizationState]);

  // Draw function
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !graph) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Scale for retina displays
    ctx.save();
    ctx.scale(dpr, dpr);

    // Draw edges first
    for (const edge of graph.edges) {
      const fromNode = graph.nodes.get(edge.from);
      const toNode = graph.nodes.get(edge.to);
      if (!fromNode || !toNode) continue;

      const inPath = isEdgeInPath(edge.from, edge.to);

      // Edge line
      ctx.beginPath();
      ctx.moveTo(fromNode.x, fromNode.y);
      ctx.lineTo(toNode.x, toNode.y);
      ctx.strokeStyle = inPath ? colors.edge.path : colors.edge.default;
      ctx.lineWidth = inPath ? 4 : 2;
      ctx.stroke();

      // Edge weight label
      const midX = (fromNode.x + toNode.x) / 2;
      const midY = (fromNode.y + toNode.y) / 2;

      // Background for weight text
      ctx.fillStyle = inPath ? 'rgba(34, 197, 94, 0.9)' : 'rgba(22, 33, 62, 0.9)';
      ctx.beginPath();
      ctx.arc(midX, midY, 14, 0, Math.PI * 2);
      ctx.fill();

      // Weight text
      ctx.fillStyle = inPath ? '#ffffff' : colors.text.weight;
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(edge.weight.toString(), midX, midY);
    }

    // Draw nodes
    for (const [id, node] of graph.nodes) {
      let state = getNodeState(id);

      // Override for source and target
      if (id === source) state = 'start';
      else if (id === target) state = 'end';

      const color = colors.node[state] || colors.node.default;
      const radius = state === 'visiting' ? 26 : 22;

      // Node glow effect for active states
      if (['visiting', 'path', 'start', 'end'].includes(state)) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 15;
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);

      // Gradient fill
      const gradient = ctx.createRadialGradient(
        node.x - 5, node.y - 5, 0,
        node.x, node.y, radius
      );
      gradient.addColorStop(0, lightenColor(color, 20));
      gradient.addColorStop(1, color);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Border
      ctx.strokeStyle = lightenColor(color, 30);
      ctx.lineWidth = 2;
      ctx.stroke();

      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      // Node label
      ctx.fillStyle = colors.text.default;
      ctx.font = 'bold 14px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.label || id, node.x, node.y);
    }

    ctx.restore();
  }, [graph, visualizationState, source, target, getNodeState, isEdgeInPath, colors]);

  // Handle canvas resize and setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    draw();
  }, [width, height, draw]);

  // Redraw when state changes
  useEffect(() => {
    draw();
  }, [draw]);

  // Handle click
  const handleClick = useCallback((e) => {
    if (!graph) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if clicked on a node
    for (const [id, node] of graph.nodes) {
      const dx = x - node.x;
      const dy = y - node.y;
      if (dx * dx + dy * dy <= 22 * 22) {
        if (onNodeClick) onNodeClick(id);
        return;
      }
    }

    // Click on canvas background
    if (onCanvasClick) onCanvasClick(x, y);
  }, [graph, onNodeClick, onCanvasClick]);

  return (
    <div className="graph-canvas-container">
      <canvas
        ref={canvasRef}
        className="graph-canvas"
        onClick={handleClick}
      />
      {visualizationState?.message && (
        <div className="canvas-message">
          {visualizationState.message}
        </div>
      )}
    </div>
  );
}

// Helper function to lighten a color
function lightenColor(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, ((num >> 16) & 0xFF) + amt);
  const G = Math.min(255, ((num >> 8) & 0xFF) + amt);
  const B = Math.min(255, (num & 0xFF) + amt);
  return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

export default GraphCanvas;

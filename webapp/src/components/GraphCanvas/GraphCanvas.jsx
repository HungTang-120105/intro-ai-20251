import { useRef, useEffect, useCallback, useState } from 'react';
import './GraphCanvas.css';

/**
 * GraphCanvas component - Canvas-based graph rendering with visualization support
 * Now supports: node dragging, adding nodes/edges, directed/undirected graphs, street grid, delete mode
 */
function GraphCanvas({
  graph,
  visualizationState = null,
  source = null,
  target = null,
  onNodeClick = null,
  onCanvasClick = null,
  onNodeDrag = null,
  onAddNode = null,
  onAddEdge = null,
  onDeleteNode = null,
  onDeleteEdge = null,
  isDirected = false,
  editorMode = 'view',
  showStreetGrid = false,
  gridInfo = null,
  hasCityMap = false,
  mapStyle = null,
  width = 800,
  height = 500,
  // Zoom and pan props for synchronized view
  zoom = 1,
  onZoomChange = null,
  pan = { x: 0, y: 0 },
  onPanChange = null,
}) {
  const canvasRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragNode, setDragNode] = useState(null);
  const [edgeStart, setEdgeStart] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

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
    street: {
      background: '#1a1f2e',
      road: '#2d3748',
      marking: '#4a5568',
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
      if (path[i] === from && path[i + 1] === to) return true;
      if (!isDirected && path[i] === to && path[i + 1] === from) return true;
    }
    return false;
  }, [visualizationState, isDirected]);

  // Draw arrow for directed edges
  const drawArrow = useCallback((ctx, fromX, fromY, toX, toY, color) => {
    const headLen = 12;
    const dx = toX - fromX;
    const dy = toY - fromY;
    const angle = Math.atan2(dy, dx);

    const nodeRadius = 22;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const ratio = (dist - nodeRadius) / dist;
    const endX = fromX + dx * ratio;
    const endY = fromY + dy * ratio;

    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - headLen * Math.cos(angle - Math.PI / 6), endY - headLen * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - headLen * Math.cos(angle + Math.PI / 6), endY - headLen * Math.sin(angle + Math.PI / 6));
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();
  }, []);

  // Draw street grid background
  const drawStreetGrid = useCallback((ctx) => {
    if (!showStreetGrid || !gridInfo) return;

    const { rows, cols, startX, startY, spacingX, spacingY, streetNames } = gridInfo;
    const roadWidth = 28;
    const padding = 50;

    // Draw background - city base
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, width, height);

    // Draw city blocks (buildings) with gradient effect
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const x = startX + c * spacingX + roadWidth / 2 + 6;
        const y = startY + r * spacingY + roadWidth / 2 + 6;
        const blockW = spacingX - roadWidth - 12;
        const blockH = spacingY - roadWidth - 12;
        
        // Building block gradient
        const gradient = ctx.createLinearGradient(x, y, x + blockW, y + blockH);
        gradient.addColorStop(0, '#1a2233');
        gradient.addColorStop(1, '#0f1520');
        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, blockW, blockH);
        
        // Building outline
        ctx.strokeStyle = '#2a3a50';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, blockW, blockH);
        
        // Add some building details (windows pattern)
        ctx.fillStyle = 'rgba(0, 217, 255, 0.05)';
        const windowSize = 4;
        const windowGap = 8;
        for (let wx = x + 8; wx < x + blockW - 8; wx += windowGap) {
          for (let wy = y + 8; wy < y + blockH - 8; wy += windowGap) {
            if (Math.random() > 0.4) {
              ctx.fillRect(wx, wy, windowSize, windowSize);
            }
          }
        }
      }
    }

    // Draw horizontal roads
    ctx.fillStyle = '#2d3748';
    for (let r = 0; r < rows; r++) {
      const y = startY + r * spacingY;
      ctx.fillRect(startX - padding, y - roadWidth / 2, (cols - 1) * spacingX + padding * 2, roadWidth);
    }

    // Draw vertical roads
    for (let c = 0; c < cols; c++) {
      const x = startX + c * spacingX;
      ctx.fillRect(x - roadWidth / 2, startY - padding, roadWidth, (rows - 1) * spacingY + padding * 2);
    }

    // Draw intersections (brighter)
    ctx.fillStyle = '#3d4a5c';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = startX + c * spacingX;
        const y = startY + r * spacingY;
        ctx.fillRect(x - roadWidth / 2, y - roadWidth / 2, roadWidth, roadWidth);
      }
    }

    // Draw road markings (center lines)
    ctx.strokeStyle = '#f59e0b';
    ctx.setLineDash([15, 10]);
    ctx.lineWidth = 2;

    // Horizontal markings
    for (let r = 0; r < rows; r++) {
      const y = startY + r * spacingY;
      ctx.beginPath();
      ctx.moveTo(startX - padding, y);
      ctx.lineTo(startX + (cols - 1) * spacingX + padding, y);
      ctx.stroke();
    }

    // Vertical markings
    for (let c = 0; c < cols; c++) {
      const x = startX + c * spacingX;
      ctx.beginPath();
      ctx.moveTo(x, startY - padding);
      ctx.lineTo(x, startY + (rows - 1) * spacingY + padding);
      ctx.stroke();
    }

    ctx.setLineDash([]);

    // Draw lane markings (white edge lines)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;

    // Horizontal lanes
    for (let r = 0; r < rows; r++) {
      const y = startY + r * spacingY;
      // Top line
      ctx.beginPath();
      ctx.moveTo(startX - padding, y - roadWidth / 2 + 2);
      ctx.lineTo(startX + (cols - 1) * spacingX + padding, y - roadWidth / 2 + 2);
      ctx.stroke();
      // Bottom line
      ctx.beginPath();
      ctx.moveTo(startX - padding, y + roadWidth / 2 - 2);
      ctx.lineTo(startX + (cols - 1) * spacingX + padding, y + roadWidth / 2 - 2);
      ctx.stroke();
    }

    // Vertical lanes
    for (let c = 0; c < cols; c++) {
      const x = startX + c * spacingX;
      // Left line
      ctx.beginPath();
      ctx.moveTo(x - roadWidth / 2 + 2, startY - padding);
      ctx.lineTo(x - roadWidth / 2 + 2, startY + (rows - 1) * spacingY + padding);
      ctx.stroke();
      // Right line
      ctx.beginPath();
      ctx.moveTo(x + roadWidth / 2 - 2, startY - padding);
      ctx.lineTo(x + roadWidth / 2 - 2, startY + (rows - 1) * spacingY + padding);
      ctx.stroke();
    }

    // Draw street labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Horizontal street names (on the left)
    if (streetNames?.horizontal) {
      ctx.save();
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.fillStyle = '#64748b';
      for (let r = 0; r < Math.min(rows, streetNames.horizontal.length); r++) {
        const y = startY + r * spacingY;
        ctx.fillText(streetNames.horizontal[r], startX - padding - 25, y);
      }
      ctx.restore();
    }

    // Vertical street names (on top)
    if (streetNames?.vertical) {
      ctx.save();
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.fillStyle = '#64748b';
      for (let c = 0; c < Math.min(cols, streetNames.vertical.length); c++) {
        const x = startX + c * spacingX;
        ctx.save();
        ctx.translate(x, startY - padding - 15);
        ctx.rotate(-Math.PI / 4);
        ctx.fillText(streetNames.vertical[c], 0, 0);
        ctx.restore();
      }
      ctx.restore();
    }

    // Draw compass indicator
    const compassX = width - 40;
    const compassY = 40;
    ctx.save();
    ctx.translate(compassX, compassY);
    
    // Compass background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.fill();
    
    // Compass arrow (North)
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.lineTo(5, 5);
    ctx.lineTo(0, 0);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    
    // South arrow
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.moveTo(0, 15);
    ctx.lineTo(5, -5);
    ctx.lineTo(0, 0);
    ctx.lineTo(-5, -5);
    ctx.closePath();
    ctx.fill();
    
    // N label
    ctx.font = 'bold 8px Inter, sans-serif';
    ctx.fillStyle = '#ef4444';
    ctx.textAlign = 'center';
    ctx.fillText('N', 0, -22);
    
    ctx.restore();

    // Draw scale bar
    const scaleX = width - 80;
    const scaleY = height - 25;
    ctx.fillStyle = '#64748b';
    ctx.fillRect(scaleX, scaleY, 60, 3);
    ctx.font = '9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('~100m', scaleX + 30, scaleY - 8);

  }, [showStreetGrid, gridInfo, width, height]);

  // Draw city map background (non-grid style)
  const drawCityMapBackground = useCallback((ctx) => {
    if (!hasCityMap || showStreetGrid) return; // Skip if grid style

    // Dark city background
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, width, height);

    // Add subtle texture pattern
    ctx.fillStyle = 'rgba(30, 40, 60, 0.3)';
    for (let x = 0; x < width; x += 30) {
      for (let y = 0; y < height; y += 30) {
        if ((x + y) % 60 === 0) {
          ctx.fillRect(x, y, 20, 20);
        }
      }
    }

    // Draw decorative elements based on map style
    if (mapStyle === 'hanoi_old_quarter') {
      // Draw Hồ Gươm as a special lake area
      const lakeNode = graph?.nodes?.get('ho_guom');
      if (lakeNode) {
        // Lake glow
        const gradient = ctx.createRadialGradient(
          lakeNode.x, lakeNode.y, 20,
          lakeNode.x, lakeNode.y, 80
        );
        gradient.addColorStop(0, 'rgba(34, 197, 94, 0.15)');
        gradient.addColorStop(0.5, 'rgba(34, 197, 94, 0.05)');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.fillRect(lakeNode.x - 80, lakeNode.y - 80, 160, 160);

        // Lake outline
        ctx.beginPath();
        ctx.ellipse(lakeNode.x, lakeNode.y, 50, 35, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(34, 197, 94, 0.2)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Lake label
        ctx.font = '9px Inter, sans-serif';
        ctx.fillStyle = 'rgba(34, 197, 94, 0.8)';
        ctx.textAlign = 'center';
        ctx.fillText('🌳 Hồ Hoàn Kiếm', lakeNode.x, lakeNode.y + 55);
      }

      // Draw Chợ Đồng Xuân marker
      const marketNode = graph?.nodes?.get('dong_xuan');
      if (marketNode) {
        ctx.beginPath();
        ctx.arc(marketNode.x, marketNode.y, 35, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
        ctx.fill();
      }
    }

    // Title for map
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'left';
    if (mapStyle === 'hanoi_old_quarter') {
      ctx.fillText('🏮 Khu Phố Cổ Hà Nội', 15, 20);
      ctx.font = '9px Inter, sans-serif';
      ctx.fillStyle = '#4a5568';
      ctx.fillText('36 Phố Phường', 15, 35);
    }

    // Mini compass (for non-grid maps)
    const compassX = width - 35;
    const compassY = 35;
    ctx.save();
    ctx.translate(compassX, compassY);
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(4, 4);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fill();
    
    ctx.font = 'bold 7px Inter, sans-serif';
    ctx.fillStyle = '#ef4444';
    ctx.textAlign = 'center';
    ctx.fillText('N', 0, -15);
    ctx.restore();

  }, [hasCityMap, showStreetGrid, mapStyle, graph, width, height]);

  // Calculate graph bounds and offset to center
  const getGraphOffset = useCallback(() => {
    if (!graph || graph.nodes.size === 0) return { offsetX: 0, offsetY: 0 };
    
    // Don't center if it's a street grid (has fixed layout)
    if (showStreetGrid) return { offsetX: 0, offsetY: 0 };
    
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    for (const [, node] of graph.nodes) {
      minX = Math.min(minX, node.x);
      maxX = Math.max(maxX, node.x);
      minY = Math.min(minY, node.y);
      maxY = Math.max(maxY, node.y);
    }
    
    const graphWidth = maxX - minX;
    const graphHeight = maxY - minY;
    const padding = 50; // padding around graph
    
    const offsetX = (width - graphWidth) / 2 - minX + padding / 2;
    const offsetY = (height - graphHeight) / 2 - minY + padding / 2;
    
    return { offsetX, offsetY };
  }, [graph, width, height, showStreetGrid]);

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

    // Apply zoom and pan transform
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.translate(width / 2, height / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-width / 2, -height / 2);

    // Draw backgrounds
    drawStreetGrid(ctx);
    drawCityMapBackground(ctx);

    // Calculate offset to center the graph
    const { offsetX, offsetY } = getGraphOffset();

    // Draw edges
    for (const edge of graph.edges) {
      const fromNode = graph.nodes.get(edge.from);
      const toNode = graph.nodes.get(edge.to);
      if (!fromNode || !toNode) continue;

      // Apply offset
      const fromX = fromNode.x + offsetX;
      const fromY = fromNode.y + offsetY;
      const toX = toNode.x + offsetX;
      const toY = toNode.y + offsetY;

      const inPath = isEdgeInPath(edge.from, edge.to);
      const edgeColor = inPath ? colors.edge.path : colors.edge.default;

      // Edge line
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.strokeStyle = edgeColor;
      ctx.lineWidth = inPath ? 5 : 3;

      // Add glow for path edges
      if (inPath) {
        ctx.shadowColor = colors.edge.path;
        ctx.shadowBlur = 8;
      }
      ctx.stroke();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      // Arrow for directed graph
      if (isDirected) {
        drawArrow(ctx, fromX, fromY, toX, toY, edgeColor);
      }

      // Edge weight label
      const midX = (fromX + toX) / 2;
      const midY = (fromY + toY) / 2;

      const dx = toX - fromX;
      const dy = toY - fromY;
      const len = Math.sqrt(dx * dx + dy * dy);
      const perpX = len > 0 ? -dy / len * 12 : 0;
      const perpY = len > 0 ? dx / len * 12 : 0;

      const labelX = midX + (isDirected ? perpX : 0);
      const labelY = midY + (isDirected ? perpY : 0);

      // Background for weight text
      ctx.fillStyle = inPath ? 'rgba(34, 197, 94, 0.95)' : 'rgba(22, 33, 62, 0.95)';
      ctx.beginPath();
      ctx.arc(labelX, labelY, 14, 0, Math.PI * 2);
      ctx.fill();

      // Weight text
      ctx.fillStyle = inPath ? '#ffffff' : colors.text.weight;
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(edge.weight.toString(), labelX, labelY);
    }

    // Draw edge being created
    if (edgeStart && mousePos) {
      const startNode = graph.nodes.get(edgeStart);
      if (startNode) {
        ctx.beginPath();
        ctx.moveTo(startNode.x + offsetX, startNode.y + offsetY);
        ctx.lineTo(mousePos.x, mousePos.y);
        ctx.strokeStyle = 'rgba(0, 217, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Draw nodes
    for (const [id, node] of graph.nodes) {
      let state = getNodeState(id);

      if (id === source) state = 'start';
      else if (id === target) state = 'end';

      const color = colors.node[state] || colors.node.default;
      const radius = state === 'visiting' || (isDragging && dragNode === id) ? 26 : 22;

      // Apply offset
      const nodeX = node.x + offsetX;
      const nodeY = node.y + offsetY;

      // Node glow effect
      if (['visiting', 'path', 'start', 'end'].includes(state) || (isDragging && dragNode === id)) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 15;
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(nodeX, nodeY, radius, 0, Math.PI * 2);

      // Gradient fill
      const gradient = ctx.createRadialGradient(
        nodeX - 5, nodeY - 5, 0,
        nodeX, nodeY, radius
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
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.label || id, nodeX, nodeY);
    }

    ctx.restore(); // Restore zoom/pan transform
    ctx.restore(); // Restore dpr scale
  }, [graph, visualizationState, source, target, getNodeState, isEdgeInPath, isDirected, drawArrow, drawStreetGrid, drawCityMapBackground, getGraphOffset, colors, isDragging, dragNode, edgeStart, mousePos, zoom, pan, width, height]);

  // Canvas resize and setup
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

  // Convert screen coordinates to graph coordinates (accounting for zoom and pan)
  const screenToGraph = useCallback((screenX, screenY) => {
    // Reverse the transform: translate, scale, translate
    const x = (screenX - pan.x - width / 2) / zoom + width / 2;
    const y = (screenY - pan.y - height / 2) / zoom + height / 2;
    return { x, y };
  }, [zoom, pan, width, height]);

  // Get node at position (accounting for offset, zoom, and pan)
  const getNodeAt = useCallback((screenX, screenY) => {
    if (!graph) return null;
    const { offsetX, offsetY } = getGraphOffset();
    const { x, y } = screenToGraph(screenX, screenY);
    
    for (const [id, node] of graph.nodes) {
      const nodeX = node.x + offsetX;
      const nodeY = node.y + offsetY;
      const dx = x - nodeX;
      const dy = y - nodeY;
      // Adjust hit radius based on zoom
      const hitRadius = 22 / zoom;
      if (dx * dx + dy * dy <= hitRadius * hitRadius * zoom * zoom) {
        return id;
      }
    }
    return null;
  }, [graph, getGraphOffset, screenToGraph, zoom]);

  // Get edge at position (check if point is near edge line)
  const getEdgeAt = useCallback((screenX, screenY) => {
    if (!graph) return null;
    const { offsetX, offsetY } = getGraphOffset();
    const { x, y } = screenToGraph(screenX, screenY);
    const threshold = 10 / zoom; // Distance threshold for edge detection, adjusted for zoom

    for (const edge of graph.edges) {
      const fromNode = graph.nodes.get(edge.from);
      const toNode = graph.nodes.get(edge.to);
      if (!fromNode || !toNode) continue;

      const x1 = fromNode.x + offsetX;
      const y1 = fromNode.y + offsetY;
      const x2 = toNode.x + offsetX;
      const y2 = toNode.y + offsetY;

      // Calculate distance from point to line segment
      const A = x - x1;
      const B = y - y1;
      const C = x2 - x1;
      const D = y2 - y1;

      const dot = A * C + B * D;
      const lenSq = C * C + D * D;
      let param = -1;
      if (lenSq !== 0) param = dot / lenSq;

      let xx, yy;
      if (param < 0) {
        xx = x1;
        yy = y1;
      } else if (param > 1) {
        xx = x2;
        yy = y2;
      } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
      }

      const dist = Math.sqrt((x - xx) * (x - xx) + (y - yy) * (y - yy));
      if (dist < threshold) {
        return { from: edge.from, to: edge.to };
      }
    }
    return null;
  }, [graph, getGraphOffset, screenToGraph, zoom]);

  // Mouse event handlers
  const handleMouseDown = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const nodeId = getNodeAt(screenX, screenY);
    const { offsetX, offsetY } = getGraphOffset();
    const graphCoords = screenToGraph(screenX, screenY);

    if (editorMode === 'addEdge' && nodeId) {
      setEdgeStart(nodeId);
      setMousePos({ x: screenX, y: screenY });
    } else if (editorMode === 'view' && nodeId) {
      setIsDragging(true);
      setDragNode(nodeId);
    } else if (editorMode === 'view' && !nodeId && e.button === 0) {
      // Start panning (when clicking on empty space in view mode)
      setIsPanning(true);
      setPanStart({ x: screenX - pan.x, y: screenY - pan.y });
    } else if (editorMode === 'addNode' && !nodeId) {
      // Convert screen to graph coordinates, then subtract offset
      if (onAddNode) onAddNode(graphCoords.x - offsetX, graphCoords.y - offsetY);
    }
  }, [getNodeAt, getGraphOffset, screenToGraph, editorMode, onAddNode, pan]);

  const handleMouseMove = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    setMousePos({ x: screenX, y: screenY });

    if (isPanning && onPanChange) {
      // Update pan position
      onPanChange({ x: screenX - panStart.x, y: screenY - panStart.y });
    } else if (isDragging && dragNode && onNodeDrag) {
      const { offsetX, offsetY } = getGraphOffset();
      const graphCoords = screenToGraph(screenX, screenY);
      // Convert screen to graph coordinates, then subtract offset
      onNodeDrag(dragNode, graphCoords.x - offsetX, graphCoords.y - offsetY);
    }
  }, [isDragging, dragNode, onNodeDrag, getGraphOffset, screenToGraph, isPanning, panStart, onPanChange]);

  const handleMouseUp = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (edgeStart) {
      const targetNode = getNodeAt(x, y);
      if (targetNode && targetNode !== edgeStart && onAddEdge) {
        onAddEdge(edgeStart, targetNode);
      }
      setEdgeStart(null);
    }

    if (isDragging) {
      setIsDragging(false);
      setDragNode(null);
    }

    if (isPanning) {
      setIsPanning(false);
    }
  }, [edgeStart, getNodeAt, onAddEdge, isDragging, isPanning]);

  const handleClick = useCallback((e) => {
    if (!graph || isDragging) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const nodeId = getNodeAt(x, y);

    // Delete mode - delete node or edge on click
    if (editorMode === 'delete') {
      if (nodeId) {
        if (onDeleteNode) onDeleteNode(nodeId);
      } else {
        const edge = getEdgeAt(x, y);
        if (edge && onDeleteEdge) {
          onDeleteEdge(edge.from, edge.to);
        }
      }
      return;
    }

    if (nodeId) {
      if (onNodeClick) onNodeClick(nodeId);
    } else {
      if (onCanvasClick) onCanvasClick(x, y);
    }
  }, [graph, isDragging, getNodeAt, getEdgeAt, onNodeClick, onCanvasClick, editorMode, onDeleteNode, onDeleteEdge]);

  // Double-click to delete (works in all modes)
  const handleDoubleClick = useCallback((e) => {
    if (!graph) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const nodeId = getNodeAt(x, y);

    if (nodeId) {
      if (onDeleteNode) onDeleteNode(nodeId);
    } else {
      const edge = getEdgeAt(x, y);
      if (edge && onDeleteEdge) {
        onDeleteEdge(edge.from, edge.to);
      }
    }
  }, [graph, getNodeAt, getEdgeAt, onDeleteNode, onDeleteEdge]);

  // Wheel handler for zoom
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    if (!onZoomChange) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calculate zoom factor
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.2, Math.min(5, zoom * delta));

    // Adjust pan to zoom towards mouse position
    if (onPanChange) {
      const zoomRatio = newZoom / zoom;
      const newPanX = mouseX - (mouseX - pan.x) * zoomRatio;
      const newPanY = mouseY - (mouseY - pan.y) * zoomRatio;
      onPanChange({ x: newPanX, y: newPanY });
    }

    onZoomChange(newZoom);
  }, [zoom, pan, onZoomChange, onPanChange]);

  // Add wheel event listener (need to use native to prevent default)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel]);

  const getCursorStyle = () => {
    if (isPanning) return 'grabbing';
    if (isDragging) return 'grabbing';
    if (editorMode === 'addNode') return 'cell';
    if (editorMode === 'addEdge') return 'crosshair';
    if (editorMode === 'delete') return 'not-allowed';
    return 'grab';
  };

  return (
    <div className="graph-canvas-container">
      <canvas
        ref={canvasRef}
        className="graph-canvas"
        style={{ cursor: getCursorStyle() }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      {visualizationState?.message && (
        <div className="canvas-message">
          {visualizationState.message}
        </div>
      )}
      {/* Zoom controls */}
      <div className="zoom-controls">
        <button 
          className="zoom-btn"
          onClick={() => onZoomChange && onZoomChange(Math.min(5, zoom * 1.2))}
          title="Zoom In"
        >
          +
        </button>
        <button 
          className="zoom-btn"
          onClick={() => {
            onZoomChange && onZoomChange(1);
            onPanChange && onPanChange({ x: 0, y: 0 });
          }}
          title="Reset View"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button 
          className="zoom-btn"
          onClick={() => onZoomChange && onZoomChange(Math.max(0.2, zoom / 1.2))}
          title="Zoom Out"
        >
          −
        </button>
      </div>
      {isDirected && (
        <div className="graph-type-badge directed">Directed</div>
      )}
      {!isDirected && (
        <div className="graph-type-badge undirected">Undirected</div>
      )}
      {(showStreetGrid || hasCityMap) && (
        <div className="graph-type-badge city-map">🗺️ City Map</div>
      )}
    </div>
  );
}

function lightenColor(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, ((num >> 16) & 0xFF) + amt);
  const G = Math.min(255, ((num >> 8) & 0xFF) + amt);
  const B = Math.min(255, (num & 0xFF) + amt);
  return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

export default GraphCanvas;

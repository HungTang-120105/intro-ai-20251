import { useRef, useEffect, useCallback, useState } from 'react';
import './GraphCanvas.css';

/**
 * GraphCanvas component - Canvas-based graph rendering with visualization support
 * Now supports: node dragging, adding nodes/edges, directed/undirected graphs, street grid, delete mode, edge blocking
 */
function GraphCanvas({
  graph,
  visualizationState = null,
  source = null,
  target = null,
  onNodeClick = null,
  onCanvasClick = null,
  onNodeDrag = null,
  onNodeDragStart = null,
  onAddNode = null,
  onAddEdge = null,
  onDeleteNode = null,
  onDeleteEdge = null,
  onEdgeBlock = null,
  blockedEdges = new Set(),
  incrementalMode = false,
  isDirected = false,
  editorMode = 'view',
  showStreetGrid = false,
  gridInfo = null,
  hasCityMap = false,
  mapStyle = null,
  osmBounds = null,
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
  const [hoveredEdge, setHoveredEdge] = useState(null); // For edge hover
  const [hoveredNode, setHoveredNode] = useState(null); // For node hover
  const [tooltip, setTooltip] = useState(null); // { text, x, y }

  // Map tiles state for OSM tiles
  const [mapTiles, setMapTiles] = useState([]);
  const [tileInfo, setTileInfo] = useState(null);
  const tileCache = useRef(new Map());

  // Tile math functions - Web Mercator projection
  const TILE_SIZE = 256;

  const lng2tileX = (lng, zoom) => ((lng + 180) / 360) * Math.pow(2, zoom);
  const lat2tileY = (lat, zoom) => ((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2) * Math.pow(2, zoom);

  // Load OSM Standard tiles when bounds change
  useEffect(() => {
    if (!osmBounds) {
      setMapTiles([]);
      setTileInfo(null);
      return;
    }

    // Clear old cache to ensure fresh OSM tiles
    tileCache.current.clear();

    const { minLat, maxLat, minLng, maxLng } = osmBounds;

    // Use zoom 18 for high resolution tiles (OSM max is 19)
    // Higher zoom = more detail but more tiles to load
    const tileZoom = 18;

    // Calculate tile coordinates with extra margin for full canvas coverage
    const marginLat = (maxLat - minLat) * 0.15;
    const marginLng = (maxLng - minLng) * 0.15;

    const finalMinTileX = Math.floor(lng2tileX(minLng - marginLng, tileZoom));
    const finalMaxTileX = Math.ceil(lng2tileX(maxLng + marginLng, tileZoom));
    const finalMinTileY = Math.floor(lat2tileY(maxLat + marginLat, tileZoom));
    const finalMaxTileY = Math.ceil(lat2tileY(minLat - marginLat, tileZoom));

    // Store tile info for rendering
    const info = {
      zoom: tileZoom,
      minTileX: finalMinTileX,
      maxTileX: finalMaxTileX,
      minTileY: finalMinTileY,
      maxTileY: finalMaxTileY,
      // Precise positions for alignment (use original bounds without margin for graph alignment)
      startTileX: lng2tileX(minLng, tileZoom),
      startTileY: lat2tileY(maxLat, tileZoom),
      endTileX: lng2tileX(maxLng, tileZoom),
      endTileY: lat2tileY(minLat, tileZoom),
      bounds: osmBounds,
    };
    setTileInfo(info);

    const tiles = [];

    // Load all tiles in range
    for (let x = finalMinTileX; x <= finalMaxTileX; x++) {
      for (let y = finalMinTileY; y <= finalMaxTileY; y++) {
        tiles.push({ x, y, zoom: tileZoom });
      }
    }

    console.log(`Loading ${tiles.length} OSM tiles for zoom ${tileZoom}`);

    // Load tiles from OpenStreetMap
    const loadTiles = async () => {
      const loadedTiles = await Promise.all(
        tiles.map(async (tile) => {
          const key = `osm/${tile.zoom}/${tile.x}/${tile.y}`;

          if (tileCache.current.has(key)) {
            return { ...tile, img: tileCache.current.get(key) };
          }

          // Use OpenStreetMap standard tiles
          // Using multiple tile servers for load balancing
          const servers = ['a', 'b', 'c'];
          const server = servers[Math.abs(tile.x + tile.y) % 3];
          const url = `https://${server}.tile.openstreetmap.org/${tile.zoom}/${tile.x}/${tile.y}.png`;

          try {
            const img = new Image();
            img.crossOrigin = 'anonymous';

            await new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = reject;
              img.src = url;
            });

            tileCache.current.set(key, img);
            return { ...tile, img };
          } catch (e) {
            console.warn(`Failed to load tile ${key}`);
            return { ...tile, img: null };
          }
        })
      );

      setMapTiles(loadedTiles.filter(t => t.img));
    };

    loadTiles();
  }, [osmBounds]);

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
      intermediate: '#ec4899', // Pink for Floyd-Warshall intermediate node k
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

  // Beam colors for Local Beam Search (k different colors)
  const beamColors = [
    '#f59e0b', // amber
    '#8b5cf6', // violet
    '#06b6d4', // cyan
    '#ec4899', // pink
    '#10b981', // emerald
    '#f97316', // orange
    '#6366f1', // indigo
    '#14b8a6', // teal
  ];

  // Get node state for coloring
  const getNodeState = useCallback((nodeId) => {
    if (!visualizationState) return 'default';

    if (visualizationState.path?.includes(nodeId)) return 'path';
    if (visualizationState.current === nodeId) return 'visiting';

    // Floyd-Warshall: highlight intermediate node k
    if (visualizationState.intermediateNode === nodeId) return 'intermediate';

    // Check if node is in beam (for Local Beam Search)
    const queue = visualizationState.queue || visualizationState.frontier;
    if (queue && visualizationState.beamIndex !== undefined) {
      const beamIdx = queue.indexOf(nodeId);
      if (beamIdx !== -1 && beamIdx < (visualizationState.beamWidth || 3)) {
        return `beam-${beamIdx}`;
      }
    }

    if (visualizationState.frontier?.includes(nodeId)) return 'frontier';
    if (visualizationState.visited?.includes(nodeId)) return 'visited';

    return 'default';
  }, [visualizationState]);

  // Check if edge is in path - read directly from visualizationState
  const isEdgeInPath = useCallback((from, to) => {
    if (!visualizationState?.path) return false;
    const path = visualizationState.path;
    for (let i = 0; i < path.length - 1; i++) {
      if (path[i] === from && path[i + 1] === to) return true;
      if (!isDirected && path[i] === to && path[i + 1] === from) return true;
    }
    return false;
  }, [visualizationState?.path, isDirected]); // Use path directly as dependency

  // Check if edge has been visited (explored)
  const isEdgeVisited = useCallback((from, to) => {
    if (!visualizationState?.visited) return false;
    const visited = visualizationState.visited;
    // Edge is visited if both endpoints have been visited
    return visited.includes(from) && visited.includes(to);
  }, [visualizationState]);

  // Check if edge is being explored (from current node)
  const isEdgeExploring = useCallback((from, to) => {
    if (!visualizationState?.current) return false;
    const current = visualizationState.current;
    const frontier = visualizationState.frontier || [];
    // Edge is exploring if it connects current node to a frontier node
    return (from === current && frontier.includes(to)) ||
      (!isDirected && to === current && frontier.includes(from));
  }, [visualizationState, isDirected]);

  // Check if edge is blocked (for incremental algorithms)
  const isEdgeBlocked = useCallback((from, to) => {
    if (!blockedEdges || blockedEdges.size === 0) return false;
    const key1 = `${from}-${to}`;
    const key2 = `${to}-${from}`;
    return blockedEdges.has(key1) || blockedEdges.has(key2);
  }, [blockedEdges]);

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

    // Don't center if it's a street grid (has fixed layout) - but DO center for OSM maps
    // OSM maps use showStreetGrid for geometry display but still need centering
    if (showStreetGrid && !osmBounds) return { offsetX: 0, offsetY: 0 };

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

    // Calculate offset to center graph in canvas
    // Note: zoom transform centers on canvas center, so offset calculation
    // should be based on canvas center coordinates
    const offsetX = (width - graphWidth) / 2 - minX + padding / 2;
    const offsetY = (height - graphHeight) / 2 - minY + padding / 2;

    return { offsetX, offsetY };
  }, [graph, width, height, showStreetGrid, osmBounds]);

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

    // Calculate offset to center the graph - do this early for tile alignment
    const { offsetX, offsetY } = getGraphOffset();

    // Determine if this is OSM data (has osmBounds means it came from OSM)
    const isOSMData = osmBounds != null;
    const hasTiles = mapTiles.length > 0 && isOSMData;

    // Calculate scaled canvas bounds for filling
    // After zoom transform, we need to fill a larger area to cover the visible canvas
    const scaledWidth = width / zoom;
    const scaledHeight = height / zoom;
    const fillOffsetX = (width - scaledWidth) / 2;
    const fillOffsetY = (height - scaledHeight) / 2;

    // Draw background based on mode - fill entire visible area
    if (isOSMData) {
      // OSM mode: light background
      ctx.fillStyle = '#e8e4dc';
    } else {
      // Normal mode: dark theme background
      ctx.fillStyle = '#0d1117';
    }
    // Fill larger area to account for zoom
    ctx.fillRect(-width, -height, width * 3, height * 3);

    // Draw OSM tiles if available
    if (hasTiles && tileInfo) {
      // Calculate graph bounds in canvas coordinates
      let graphMinX = Infinity, graphMaxX = -Infinity;
      let graphMinY = Infinity, graphMaxY = -Infinity;

      for (const [, node] of graph.nodes) {
        graphMinX = Math.min(graphMinX, node.x);
        graphMaxX = Math.max(graphMaxX, node.x);
        graphMinY = Math.min(graphMinY, node.y);
        graphMaxY = Math.max(graphMaxY, node.y);
      }

      const graphWidth = graphMaxX - graphMinX || 1;
      const graphHeight = graphMaxY - graphMinY || 1;

      // Use tile info for alignment
      const { startTileX, startTileY, endTileX, endTileY } = tileInfo;
      const tileRangeX = endTileX - startTileX;
      const tileRangeY = endTileY - startTileY;

      // Scale: how many canvas pixels per tile unit
      const scaleX = graphWidth / tileRangeX;
      const scaleY = graphHeight / tileRangeY;

      // Draw all tiles - covering the graph area and beyond
      for (const tile of mapTiles) {
        if (!tile.img) continue;

        // Tile's position relative to the start tile
        const relTileX = tile.x - startTileX;
        const relTileY = tile.y - startTileY;

        // Convert to canvas coordinates
        const tileCanvasX = graphMinX + relTileX * scaleX + offsetX;
        const tileCanvasY = graphMinY + relTileY * scaleY + offsetY;

        ctx.drawImage(tile.img, tileCanvasX, tileCanvasY, scaleX, scaleY);
      }
    }

    // Draw backgrounds for normal (non-OSM) graphs only
    if (!isOSMData) {
      drawStreetGrid(ctx);
      drawCityMapBackground(ctx);
    }

    // For OSM: Draw edges in multiple passes for proper layering
    // Pass 0: Blocked edges (bottom layer - red dashed)
    // Pass 1: Normal edges (bottom layer)
    // Pass 2: Visited edges
    // Pass 3: Exploring edges  
    // Pass 4: Path edges (top layer)

    const drawOSMEdge = (edge, style, isBlocked = false) => {
      const fromNode = graph.nodes.get(edge.from);
      const toNode = graph.nodes.get(edge.to);
      if (!fromNode || !toNode) return;

      const edgeKey = `${edge.from}-${edge.to}`;
      const geometry = graph.edgeGeometries?.get(edgeKey) || edge.geometry;

      ctx.beginPath();

      if (isBlocked) {
        ctx.setLineDash([8, 4]);
      }
      if (geometry && geometry.length > 1) {
        // Draw along street geometry
        ctx.moveTo(geometry[0].x + offsetX, geometry[0].y + offsetY);
        for (let i = 1; i < geometry.length; i++) {
          ctx.lineTo(geometry[i].x + offsetX, geometry[i].y + offsetY);
        }
      } else {
        // Fallback: draw straight line between nodes
        ctx.moveTo(fromNode.x + offsetX, fromNode.y + offsetY);
        ctx.lineTo(toNode.x + offsetX, toNode.y + offsetY);
      }

      ctx.strokeStyle = style.color;
      ctx.lineWidth = style.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.setLineDash([]);
    };

    // Helper function to draw pheromone trails for ACO
    const drawPheromoneTrails = () => {
      if (!visualizationState?.pheromone || !visualizationState?.maxPheromone) return;

      const { pheromone, maxPheromone } = visualizationState;

      for (const edge of graph.edges) {
        // Check both directions for pheromone
        const key1 = `${edge.from}-${edge.to}`;
        const key2 = `${edge.to}-${edge.from}`;
        const pherValue = Math.max(pheromone[key1] || 0, pheromone[key2] || 0);

        if (pherValue <= 0) continue;

        // Normalize pheromone to 0-1 range with log scale for better visualization
        const intensity = Math.min(1, Math.log(1 + pherValue) / Math.log(1 + maxPheromone));

        if (intensity < 0.1) continue; // Skip very weak trails

        const fromNode = graph.nodes.get(edge.from);
        const toNode = graph.nodes.get(edge.to);
        if (!fromNode || !toNode) continue;

        // Color from yellow (weak) to orange/red (strong)
        const r = Math.round(255);
        const g = Math.round(255 * (1 - intensity * 0.7));
        const b = Math.round(50 * (1 - intensity));
        const alpha = 0.3 + intensity * 0.5;

        const edgeKey = `${edge.from}-${edge.to}`;
        const geometry = graph.edgeGeometries?.get(edgeKey) || edge.geometry;

        ctx.beginPath();

        if (geometry && geometry.length > 1 && isOSMData) {
          ctx.moveTo(geometry[0].x + offsetX, geometry[0].y + offsetY);
          for (let i = 1; i < geometry.length; i++) {
            ctx.lineTo(geometry[i].x + offsetX, geometry[i].y + offsetY);
          }
        } else {
          ctx.moveTo(fromNode.x + offsetX, fromNode.y + offsetY);
          ctx.lineTo(toNode.x + offsetX, toNode.y + offsetY);
        }

        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.lineWidth = 2 + intensity * 4; // Thicker for stronger pheromone
        ctx.lineCap = 'round';
        ctx.stroke();
      }
    };

    // Helper to check if edge is hovered
    const isEdgeHovered = (from, to) => {
      if (!hoveredEdge) return false;
      return (hoveredEdge.from === from && hoveredEdge.to === to) ||
        (hoveredEdge.from === to && hoveredEdge.to === from);
    };

    // Helper to draw hovered edge highlight (works for all modes)
    const drawHoveredEdgeHighlight = () => {
      if (!hoveredEdge) return;

      const edge = graph.edges.find(e =>
        (e.from === hoveredEdge.from && e.to === hoveredEdge.to) ||
        (!isDirected && e.from === hoveredEdge.to && e.to === hoveredEdge.from)
      );
      if (!edge) return;

      const fromNode = graph.nodes.get(edge.from);
      const toNode = graph.nodes.get(edge.to);
      if (!fromNode || !toNode) return;

      const edgeKey = `${edge.from}-${edge.to}`;
      const geometry = graph.edgeGeometries?.get(edgeKey) || edge.geometry;

      ctx.beginPath();

      if (geometry && geometry.length > 1 && isOSMData) {
        ctx.moveTo(geometry[0].x + offsetX, geometry[0].y + offsetY);
        for (let i = 1; i < geometry.length; i++) {
          ctx.lineTo(geometry[i].x + offsetX, geometry[i].y + offsetY);
        }
      } else {
        ctx.moveTo(fromNode.x + offsetX, fromNode.y + offsetY);
        ctx.lineTo(toNode.x + offsetX, toNode.y + offsetY);
      }

      // Cyan highlight for hovered edge - scale with zoom to keep consistent screen appearance
      ctx.strokeStyle = '#00d9ff';
      // Line width: ~4px on screen for OSM, ~6px for normal
      const baseLineWidth = isOSMData ? 4 : 6;
      ctx.lineWidth = baseLineWidth / zoom;
      ctx.lineCap = 'round';
      ctx.shadowColor = '#00d9ff';
      // Shadow blur: ~8px on screen
      ctx.shadowBlur = 8 / zoom;
      ctx.stroke();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    };

    if (isOSMData) {
      // Draw pheromone trails for ACO (below normal edges)
      drawPheromoneTrails();

      // Pass 0: Blocked edges - red dashed
      for (const edge of graph.edges) {
        const blocked = isEdgeBlocked(edge.from, edge.to);
        if (blocked) {
          drawOSMEdge(edge, { color: '#ef4444', width: 3 }, true);
        }
      }

      // Pass 1: Normal edges - thin but visible
      for (const edge of graph.edges) {
        const inPath = isEdgeInPath(edge.from, edge.to);
        const edgeVisited = isEdgeVisited(edge.from, edge.to);
        const edgeExploring = isEdgeExploring(edge.from, edge.to);
        const blocked = isEdgeBlocked(edge.from, edge.to);

        if (!inPath && !edgeVisited && !edgeExploring && !blocked) {
          drawOSMEdge(edge, {
            color: hasTiles ? 'rgba(71, 85, 105, 0.7)' : 'rgba(100, 116, 139, 0.8)',
            width: 1.5
          });
        }
      }

      // Pass 2: Visited edges (light trail)
      for (const edge of graph.edges) {
        const inPath = isEdgeInPath(edge.from, edge.to);
        const edgeVisited = isEdgeVisited(edge.from, edge.to);
        const edgeExploring = isEdgeExploring(edge.from, edge.to);
        const blocked = isEdgeBlocked(edge.from, edge.to);

        if (edgeVisited && !inPath && !edgeExploring && !blocked) {
          drawOSMEdge(edge, { color: 'rgba(134, 239, 172, 0.7)', width: 2 });
        }
      }

      // Pass 3: Exploring edges (from current node)
      for (const edge of graph.edges) {
        const inPath = isEdgeInPath(edge.from, edge.to);
        const edgeExploring = isEdgeExploring(edge.from, edge.to);
        const blocked = isEdgeBlocked(edge.from, edge.to);

        if (edgeExploring && !inPath && !blocked) {
          drawOSMEdge(edge, { color: '#fb923c', width: 2.5 });
        }
      }

      // Pass 4: Path edges (final result) - thicker
      for (const edge of graph.edges) {
        const inPath = isEdgeInPath(edge.from, edge.to);
        const blocked = isEdgeBlocked(edge.from, edge.to);

        if (inPath && !blocked) {
          drawOSMEdge(edge, { color: '#22c55e', width: 3.5 });
        }
      }
    }

    // Draw edges for non-OSM graphs
    if (!isOSMData) {
      // Draw pheromone trails for ACO first (below normal edges)
      drawPheromoneTrails();

      for (const edge of graph.edges) {
        const fromNode = graph.nodes.get(edge.from);
        const toNode = graph.nodes.get(edge.to);
        if (!fromNode || !toNode) continue;

        const fromX = fromNode.x + offsetX;
        const fromY = fromNode.y + offsetY;
        const toX = toNode.x + offsetX;
        const toY = toNode.y + offsetY;

        const inPath = isEdgeInPath(edge.from, edge.to);
        const blocked = isEdgeBlocked(edge.from, edge.to);

        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);

        if (blocked) {
          // Blocked edge - red dashed line
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 3;
          ctx.setLineDash([8, 4]);
        } else if (inPath) {
          ctx.strokeStyle = colors.edge.path;
          ctx.lineWidth = 5;
          ctx.shadowColor = colors.edge.path;
          ctx.shadowBlur = 6;
          ctx.setLineDash([]);
        } else {
          ctx.strokeStyle = colors.edge.default;
          ctx.lineWidth = 3;
          ctx.setLineDash([]);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        // Draw X marker for blocked edges
        if (blocked) {
          const midX = (fromX + toX) / 2;
          const midY = (fromY + toY) / 2;
          const markerSize = 8;

          ctx.beginPath();
          ctx.moveTo(midX - markerSize, midY - markerSize);
          ctx.lineTo(midX + markerSize, midY + markerSize);
          ctx.moveTo(midX + markerSize, midY - markerSize);
          ctx.lineTo(midX - markerSize, midY + markerSize);
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 3;
          ctx.stroke();
        }

        if (isDirected && !blocked) {
          const edgeColor = inPath ? colors.edge.path : colors.edge.default;
          drawArrow(ctx, fromX, fromY, toX, toY, edgeColor);
        }
      }
    }

    // Edge weight labels - only for normal graphs
    if (!isOSMData) {
      for (const edge of graph.edges) {
        const fromNode = graph.nodes.get(edge.from);
        const toNode = graph.nodes.get(edge.to);
        if (!fromNode || !toNode) continue;

        const fromX = fromNode.x + offsetX;
        const fromY = fromNode.y + offsetY;
        const toX = toNode.x + offsetX;
        const toY = toNode.y + offsetY;
        const inPath = isEdgeInPath(edge.from, edge.to);
        const blocked = isEdgeBlocked(edge.from, edge.to);

        // Skip weight label for blocked edges (X marker is shown instead)
        if (blocked) continue;

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
    }

    // Draw hovered edge highlight (for incremental mode)
    drawHoveredEdgeHighlight();

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
    const nodeCount = graph.nodes.size;
    const useSmallNodes = nodeCount > 30;

    for (const [id, node] of graph.nodes) {
      let state = getNodeState(id);

      if (id === source) state = 'start';
      else if (id === target) state = 'end';

      // Handle beam states for Local Beam Search
      let color;
      let isBeamNode = false;
      if (state.startsWith('beam-')) {
        const beamIdx = parseInt(state.split('-')[1], 10);
        color = beamColors[beamIdx % beamColors.length];
        isBeamNode = true;
      } else {
        color = colors.node[state] || colors.node.default;
      }

      const isSpecial = ['visiting', 'path', 'start', 'end', 'frontier', 'intermediate'].includes(state) || isBeamNode;

      // Apply offset
      const nodeX = node.x + offsetX;
      const nodeY = node.y + offsetY;

      let radius;

      // Check if this node is hovered
      const isHovered = hoveredNode === id;

      // Scale hover increase with zoom (smaller increase at high zoom)
      const hoverIncrease = Math.max(0.5, 2 / zoom);

      if (isOSMData) {
        // OSM mode: scale node sizes inversely with zoom to maintain consistent screen size
        // At zoom 1, use base sizes. At higher zoom, nodes appear smaller relative to map.
        const zoomScale = Math.max(0.3, 1 / Math.sqrt(zoom)); // Diminishing effect

        if (isSpecial) {
          // Start/End nodes: scale with zoom to stay proportional
          if (state === 'start' || state === 'end') {
            const baseSize = 5; // Reduced from 8 to be even less obtrusive
            radius = baseSize * zoomScale;
            if (isHovered) radius += hoverIncrease;
          } else if (state === 'path') {
            const baseSize = 4;
            radius = Math.max(1.5, baseSize * zoomScale);
            if (isHovered) radius += hoverIncrease * 0.5;
          } else if (state === 'visiting') {
            const baseSize = 6;
            radius = Math.max(2, baseSize * zoomScale);
            if (isHovered) radius += hoverIncrease * 0.5;
          } else if (state === 'frontier') {
            const baseSize = 4;
            radius = Math.max(1.5, baseSize * zoomScale);
            if (isHovered) radius += hoverIncrease * 0.5;
          } else {
            const baseSize = 3;
            radius = Math.max(1, baseSize * zoomScale);
            if (isHovered) radius += hoverIncrease * 0.3;
          }
        } else {
          // Draw intersection nodes as tiny visible dots (also scale)
          const dotRadius = Math.max(0.5, 2 * zoomScale);
          const finalRadius = isHovered ? dotRadius + hoverIncrease * 0.3 : dotRadius;
          ctx.beginPath();
          ctx.arc(nodeX, nodeY, finalRadius, 0, Math.PI * 2);
          ctx.fillStyle = isHovered ? 'rgba(0, 217, 255, 0.9)' : 'rgba(59, 130, 246, 0.6)';
          ctx.fill();
          continue;
        }
      } else {
        // Normal mode: standard node sizes (reduced start/end from 26 to 20)
        const baseRadius = useSmallNodes ? 6 : 22;
        const specialRadius = useSmallNodes ? 8 : 20; // Reduced from 10/26
        radius = isSpecial
          ? (isHovered ? specialRadius + hoverIncrease : specialRadius)
          : (isDragging && dragNode === id ? baseRadius + 4 : (isHovered ? baseRadius + hoverIncrease : baseRadius));
      }

      // Node glow effect for special/dragging/hovered nodes (scale with zoom)
      if (isSpecial || (isDragging && dragNode === id) || isHovered) {
        ctx.shadowColor = isHovered ? '#00d9ff' : color;
        // Scale shadow blur inversely with zoom to keep consistent visual appearance
        const baseBlur = isOSMData ? (isHovered ? 6 : 2) : (useSmallNodes ? 10 : (isHovered ? 20 : 15));
        ctx.shadowBlur = Math.max(2, baseBlur / Math.sqrt(zoom));
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(nodeX, nodeY, radius, 0, Math.PI * 2);

      // Gradient fill
      const gradient = ctx.createRadialGradient(
        nodeX - 2, nodeY - 2, 0,
        nodeX, nodeY, radius
      );
      gradient.addColorStop(0, lightenColor(color, 20));
      gradient.addColorStop(1, color);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Border
      ctx.strokeStyle = lightenColor(color, 30);
      ctx.lineWidth = isOSMData ? 0.5 : (useSmallNodes ? 1 : 2);
      ctx.stroke();

      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      // Node label - only for non-OSM or very special nodes
      if (isSpecial && !isOSMData) {
        ctx.fillStyle = colors.text.default;
        ctx.font = `bold ${useSmallNodes ? '9px' : '12px'} Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (state === 'start') {
          ctx.fillText('S', nodeX, nodeY);
        } else if (state === 'end') {
          ctx.fillText('T', nodeX, nodeY);
        }
      } else if (!useSmallNodes && !isOSMData) {
        ctx.fillStyle = colors.text.default;
        ctx.font = 'bold 12px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const label = node.label || id;
        ctx.fillText(label, nodeX, nodeY);
      }
    }

    ctx.restore(); // Restore zoom/pan transform
    ctx.restore(); // Restore dpr scale
  }, [graph, visualizationState, source, target, getNodeState, isEdgeInPath, isEdgeVisited, isEdgeExploring, isEdgeBlocked, isDirected, drawArrow, drawStreetGrid, drawCityMapBackground, getGraphOffset, colors, isDragging, dragNode, edgeStart, mousePos, zoom, pan, width, height, mapTiles, osmBounds, tileInfo, blockedEdges, hoveredNode, hoveredEdge]);

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

    // Determine if OSM map for hit radius calculation
    const isOSMMap = (graph.edgeGeometries && graph.edgeGeometries.size > 0) || graph.nodes.size > 50;
    const nodeCount = graph.nodes.size;
    const useSmallNodes = nodeCount > 30;

    for (const [id, node] of graph.nodes) {
      const nodeX = node.x + offsetX;
      const nodeY = node.y + offsetY;
      const dx = x - nodeX;
      const dy = y - nodeY;

      // Visual node radius (what's drawn on screen)
      const isSpecial = id === source || id === target;
      let visualRadius;
      if (isOSMMap) {
        visualRadius = isSpecial ? 5 : 2;
      } else {
        const baseRadius = useSmallNodes ? 6 : 22;
        visualRadius = isSpecial ? (useSmallNodes ? 8 : 20) : baseRadius;
      }

      // Hit radius in graph coordinates = visual radius
      // But we also want a minimum screen-space hit area (e.g., 8px radius on screen)
      // In graph coords, 8px on screen = 8 / zoom in graph coords
      const minScreenHitRadius = 8 / zoom;
      const hitRadius = Math.max(visualRadius, minScreenHitRadius);

      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= hitRadius) {
        return id;
      }
    }
    return null;
  }, [graph, getGraphOffset, screenToGraph, zoom, source, target]);

  // Get edge at position (check if point is near edge line)
  const getEdgeAt = useCallback((screenX, screenY) => {
    if (!graph) return null;
    const { offsetX, offsetY } = getGraphOffset();
    const { x, y } = screenToGraph(screenX, screenY);

    // Determine if OSM map
    const isOSMMap = (graph.edgeGeometries && graph.edgeGeometries.size > 0) || graph.nodes.size > 50;
    const nodeCount = graph.nodes.size;
    const useSmallNodes = nodeCount > 30;

    // Hit threshold - keep consistent in screen space (8px on screen)
    const threshold = 8 / zoom;

    let closestEdge = null;
    let closestDist = threshold;

    for (const edge of graph.edges) {
      const fromNode = graph.nodes.get(edge.from);
      const toNode = graph.nodes.get(edge.to);
      if (!fromNode || !toNode) continue;

      const x1 = fromNode.x + offsetX;
      const y1 = fromNode.y + offsetY;
      const x2 = toNode.x + offsetX;
      const y2 = toNode.y + offsetY;

      // Calculate visual node radii
      const isFromSpecial = edge.from === source || edge.from === target;
      const isToSpecial = edge.to === source || edge.to === target;
      let fromVisualRadius, toVisualRadius;

      if (isOSMMap) {
        fromVisualRadius = isFromSpecial ? 5 : 2;
        toVisualRadius = isToSpecial ? 5 : 2;
      } else {
        const baseRadius = useSmallNodes ? 6 : 22;
        fromVisualRadius = isFromSpecial ? (useSmallNodes ? 8 : 20) : baseRadius;
        toVisualRadius = isToSpecial ? (useSmallNodes ? 8 : 20) : baseRadius;
      }

      // Exclusion radius = visual radius + small margin (2px on screen)
      const marginInGraph = 2 / zoom;
      const fromRadius = fromVisualRadius + marginInGraph;
      const toRadius = toVisualRadius + marginInGraph;

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

      // Check if click point is inside either node's visual area
      // Use visual radius only (no extra margin) to allow clicking edges close to nodes
      const distToFrom = Math.sqrt(A * A + B * B);
      const distToTo = Math.sqrt((x - x2) * (x - x2) + (y - y2) * (y - y2));

      // Only skip if click is inside the visual node circle itself
      if (distToFrom <= fromVisualRadius || distToTo <= toVisualRadius) {
        continue; // Skip this edge, let node detection handle it
      }

      // Keep track of closest edge within threshold
      if (dist < closestDist) {
        closestDist = dist;
        closestEdge = { from: edge.from, to: edge.to };
      }
    }
    return closestEdge;
  }, [graph, getGraphOffset, screenToGraph, zoom, source, target]);

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
      // Call onNodeDragStart before starting drag (for undo history)
      if (onNodeDragStart) onNodeDragStart();
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

    // Track hovered node and edge for visual feedback
    if (!isDragging && !isPanning) {
      const nodeId = getNodeAt(screenX, screenY);

      if (hoveredNode !== nodeId) {
        setHoveredNode(nodeId);
        if (nodeId) {
          const node = graph.nodes.get(nodeId);
          const label = node.label || node.id;
          setTooltip({
            text: label,
            x: screenX + 10,
            y: screenY + 10,
          });
          document.body.style.cursor = 'pointer';
        } else {
          setTooltip(null);
          document.body.style.cursor = 'default';
        }
      }

      // Only check edge if no node is hovered
      if (!nodeId) {
        const edge = getEdgeAt(screenX, screenY);
        setHoveredEdge(edge);
        if (edge) {
          document.body.style.cursor = 'pointer';
        } else {
          document.body.style.cursor = 'default';
        }
      } else {
        setHoveredEdge(null);
      }
    } else {
      setHoveredNode(null);
      setHoveredEdge(null);
      setTooltip(null);
    }
  }, [isDragging, dragNode, onNodeDrag, getGraphOffset, screenToGraph, isPanning, panStart, onPanChange, getNodeAt, getEdgeAt]);

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

    // Incremental mode - block/unblock edges on click
    if (incrementalMode && !nodeId) {
      const edge = getEdgeAt(x, y);
      if (edge && onEdgeBlock) {
        onEdgeBlock(edge.from, edge.to);
        return;
      }
    }

    if (nodeId) {
      if (onNodeClick) onNodeClick(nodeId);
    } else {
      if (onCanvasClick) onCanvasClick(x, y);
    }
  }, [graph, isDragging, getNodeAt, getEdgeAt, onNodeClick, onCanvasClick, editorMode, onDeleteNode, onDeleteEdge, incrementalMode, onEdgeBlock]);

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

  // Wheel handler for zoom - zoom towards mouse cursor
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    if (!onZoomChange) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calculate zoom factor - allow up to 20x zoom for OSM data
    const maxZoom = osmBounds ? 20 : 5;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.2, Math.min(maxZoom, zoom * delta));

    // Zoom towards mouse position
    // The transform is: translate(pan) -> translate(center) -> scale(zoom) -> translate(-center)
    // So world point at screen (mouseX, mouseY) is: 
    //   worldX = (mouseX - pan.x - width/2) / zoom + width/2
    //   worldY = (mouseY - pan.y - height/2) / zoom + height/2
    // After zoom change, we want the same world point to stay under the mouse:
    //   mouseX = worldX * newZoom - width/2 * newZoom + width/2 + newPanX
    //   newPanX = mouseX - (worldX - width/2) * newZoom - width/2
    if (onPanChange) {
      const centerX = width / 2;
      const centerY = height / 2;

      // World coordinates under mouse cursor
      const worldX = (mouseX - pan.x - centerX) / zoom + centerX;
      const worldY = (mouseY - pan.y - centerY) / zoom + centerY;

      // New pan to keep world point under mouse
      const newPanX = mouseX - (worldX - centerX) * newZoom - centerX;
      const newPanY = mouseY - (worldY - centerY) * newZoom - centerY;

      onPanChange({ x: newPanX, y: newPanY });
    }

    onZoomChange(newZoom);
  }, [zoom, pan, width, height, onZoomChange, onPanChange, osmBounds]);

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
    if (hoveredNode) return 'pointer';
    if (hoveredEdge) return 'pointer';
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
          {visualizationState.message.length > 100
            ? visualizationState.message.substring(0, 100) + '...'
            : visualizationState.message}
        </div>
      )}
      {/* OSM Info badge */}
      {osmBounds && (
        <div className="osm-info-badge">
          <span>📍 {graph?.nodes?.size || 0} nodes · {graph?.edges?.length || 0} edges</span>
          {osmBounds && (
            <span className="coords">
              {osmBounds.minLat.toFixed(4)}°N, {osmBounds.minLng.toFixed(4)}°E
            </span>
          )}
        </div>
      )}
      {/* Zoom controls */}
      <div className="zoom-controls">
        <button
          className="zoom-btn"
          onClick={() => {
            const maxZoom = osmBounds ? 20 : 5;
            onZoomChange && onZoomChange(Math.min(maxZoom, zoom * 1.3));
          }}
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
          onClick={() => onZoomChange && onZoomChange(Math.max(0.2, zoom / 1.3))}
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
      {(showStreetGrid || hasCityMap) && !osmBounds && (
        <div className="graph-type-badge city-map">🗺️ City Map</div>
      )}

      {/* Node Tooltip */}
      {tooltip && (
        <div
          className="canvas-tooltip"
          style={{
            position: 'absolute',
            left: tooltip.x,
            top: tooltip.y,
            background: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            pointerEvents: 'none',
            zIndex: 1000,
            whiteSpace: 'nowrap',
          }}
        >
          {tooltip.text}
        </div>
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

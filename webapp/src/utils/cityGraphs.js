// City map sample data with street grid and background
// Simplified street network for visualization

import { createGraph } from './graphUtils';

/**
 * Simple Grid City - A fictional city with numbered streets
 * This creates a realistic-looking street grid
 */
export function createGridCityGraph() {
  // 5x4 grid of intersections
  const rows = 4;
  const cols = 5;
  const startX = 100;
  const startY = 80;
  const spacingX = 140;
  const spacingY = 100;

  const nodes = [];
  const edges = [];

  // Street names
  const horizontalStreets = ['Đường 1', 'Đường 2', 'Đường 3', 'Đường 4'];
  const verticalStreets = ['Phố A', 'Phố B', 'Phố C', 'Phố D', 'Phố E'];

  // Create intersections (nodes)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const id = `${r}_${c}`;
      nodes.push({
        id,
        x: startX + c * spacingX,
        y: startY + r * spacingY,
        label: `${verticalStreets[c].slice(-1)}${r + 1}`,
        street1: horizontalStreets[r],
        street2: verticalStreets[c],
      });
    }
  }

  // Create streets (edges)
  // Horizontal streets
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const from = `${r}_${c}`;
      const to = `${r}_${c + 1}`;
      // Vary weights to simulate different road conditions
      const weight = 2 + Math.floor(Math.random() * 3);
      edges.push({ from, to, weight });
    }
  }

  // Vertical streets
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols; c++) {
      const from = `${r}_${c}`;
      const to = `${r + 1}_${c}`;
      const weight = 2 + Math.floor(Math.random() * 3);
      edges.push({ from, to, weight });
    }
  }

  return {
    graph: createGraph(nodes, edges),
    source: '0_0',
    target: '3_4',
    name: 'Grid City',
    hasStreetGrid: true,
    gridInfo: { rows, cols, startX, startY, spacingX, spacingY },
  };
}

/**
 * Manhattan-style City Map - Based on real NYC grid pattern
 * With street names and realistic block structure
 */
export function createManhattanStyleGraph() {
  const nodes = [
    // Main intersections with street names
    { id: 'A1', x: 80, y: 60, label: '1st & A', streetH: '1st St', streetV: 'Ave A' },
    { id: 'B1', x: 200, y: 60, label: '1st & B', streetH: '1st St', streetV: 'Ave B' },
    { id: 'C1', x: 320, y: 60, label: '1st & C', streetH: '1st St', streetV: 'Ave C' },
    { id: 'D1', x: 440, y: 60, label: '1st & D', streetH: '1st St', streetV: 'Ave D' },
    { id: 'E1', x: 560, y: 60, label: '1st & E', streetH: '1st St', streetV: 'Ave E' },
    { id: 'F1', x: 680, y: 60, label: '1st & F', streetH: '1st St', streetV: 'Ave F' },
    
    { id: 'A2', x: 80, y: 150, label: '2nd & A', streetH: '2nd St', streetV: 'Ave A' },
    { id: 'B2', x: 200, y: 150, label: '2nd & B', streetH: '2nd St', streetV: 'Ave B' },
    { id: 'C2', x: 320, y: 150, label: '2nd & C', streetH: '2nd St', streetV: 'Ave C' },
    { id: 'D2', x: 440, y: 150, label: '2nd & D', streetH: '2nd St', streetV: 'Ave D' },
    { id: 'E2', x: 560, y: 150, label: '2nd & E', streetH: '2nd St', streetV: 'Ave E' },
    { id: 'F2', x: 680, y: 150, label: '2nd & F', streetH: '2nd St', streetV: 'Ave F' },
    
    { id: 'A3', x: 80, y: 240, label: '3rd & A', streetH: '3rd St', streetV: 'Ave A' },
    { id: 'B3', x: 200, y: 240, label: '3rd & B', streetH: '3rd St', streetV: 'Ave B' },
    { id: 'C3', x: 320, y: 240, label: '3rd & C', streetH: '3rd St', streetV: 'Ave C', isCenter: true },
    { id: 'D3', x: 440, y: 240, label: '3rd & D', streetH: '3rd St', streetV: 'Ave D' },
    { id: 'E3', x: 560, y: 240, label: '3rd & E', streetH: '3rd St', streetV: 'Ave E' },
    { id: 'F3', x: 680, y: 240, label: '3rd & F', streetH: '3rd St', streetV: 'Ave F' },
    
    { id: 'A4', x: 80, y: 330, label: '4th & A', streetH: '4th St', streetV: 'Ave A' },
    { id: 'B4', x: 200, y: 330, label: '4th & B', streetH: '4th St', streetV: 'Ave B' },
    { id: 'C4', x: 320, y: 330, label: '4th & C', streetH: '4th St', streetV: 'Ave C' },
    { id: 'D4', x: 440, y: 330, label: '4th & D', streetH: '4th St', streetV: 'Ave D' },
    { id: 'E4', x: 560, y: 330, label: '4th & E', streetH: '4th St', streetV: 'Ave E' },
    { id: 'F4', x: 680, y: 330, label: '4th & F', streetH: '4th St', streetV: 'Ave F' },
    
    { id: 'A5', x: 80, y: 420, label: '5th & A', streetH: '5th St', streetV: 'Ave A' },
    { id: 'B5', x: 200, y: 420, label: '5th & B', streetH: '5th St', streetV: 'Ave B' },
    { id: 'C5', x: 320, y: 420, label: '5th & C', streetH: '5th St', streetV: 'Ave C' },
    { id: 'D5', x: 440, y: 420, label: '5th & D', streetH: '5th St', streetV: 'Ave D' },
    { id: 'E5', x: 560, y: 420, label: '5th & E', streetH: '5th St', streetV: 'Ave E' },
    { id: 'F5', x: 680, y: 420, label: '5th & F', streetH: '5th St', streetV: 'Ave F' },
  ];

  const edges = [];
  const avenues = ['A', 'B', 'C', 'D', 'E', 'F'];
  
  // Horizontal streets (varied weights based on traffic)
  for (let row = 1; row <= 5; row++) {
    for (let i = 0; i < avenues.length - 1; i++) {
      const from = `${avenues[i]}${row}`;
      const to = `${avenues[i + 1]}${row}`;
      // Main streets have lower weights (faster)
      const weight = row === 3 ? 2 : (3 + Math.floor(Math.random() * 2));
      edges.push({ from, to, weight });
    }
  }
  
  // Vertical avenues
  for (const ave of avenues) {
    for (let row = 1; row <= 4; row++) {
      const from = `${ave}${row}`;
      const to = `${ave}${row + 1}`;
      // Main avenues have lower weights
      const weight = (ave === 'C' || ave === 'D') ? 2 : (3 + Math.floor(Math.random() * 2));
      edges.push({ from, to, weight });
    }
  }

  return {
    graph: createGraph(nodes, edges),
    source: 'A1',
    target: 'F5',
    name: 'Manhattan Style',
    hasStreetGrid: true,
    hasCityMap: true,
    mapStyle: 'manhattan',
    gridInfo: {
      rows: 5,
      cols: 6,
      startX: 80,
      startY: 60,
      spacingX: 120,
      spacingY: 90,
      streetNames: {
        horizontal: ['1st St', '2nd St', '3rd St', '4th St', '5th St'],
        vertical: ['Ave A', 'Ave B', 'Ave C', 'Ave D', 'Ave E', 'Ave F'],
      },
    },
  };
}

/**
 * Hanoi Old Quarter (Phố Cổ) - Real street map
 * Realistic map with actual street names from Hanoi's 36 streets
 */
export function createHanoiOldQuarterGraph() {
  const nodes = [
    // Major intersections with real street names
    { id: 'dong_xuan', x: 380, y: 60, label: 'Chợ Đồng Xuân', isCenter: true },
    { id: 'hang_dao', x: 420, y: 140, label: 'Hàng Đào' },
    { id: 'hang_ngang', x: 320, y: 120, label: 'Hàng Ngang' },
    { id: 'hang_duong', x: 260, y: 80, label: 'Hàng Đường' },
    { id: 'hang_buom', x: 480, y: 100, label: 'Hàng Buồm' },
    { id: 'ta_hien', x: 540, y: 160, label: 'Tạ Hiện' },
    { id: 'hang_bac', x: 380, y: 200, label: 'Hàng Bạc' },
    { id: 'hang_bo', x: 300, y: 180, label: 'Hàng Bồ' },
    { id: 'hang_gai', x: 340, y: 260, label: 'Hàng Gai' },
    { id: 'hang_trong', x: 420, y: 280, label: 'Hàng Trống' },
    { id: 'ly_thai_to', x: 500, y: 240, label: 'Lý Thái Tổ' },
    { id: 'cau_go', x: 460, y: 340, label: 'Cầu Gỗ' },
    { id: 'ho_guom', x: 400, y: 380, label: 'Hồ Gươm', isLake: true },
    { id: 'trang_tien', x: 500, y: 400, label: 'Tràng Tiền' },
    { id: 'hang_khay', x: 340, y: 360, label: 'Hàng Khay' },
    { id: 'nha_tho', x: 260, y: 300, label: 'Nhà Thờ' },
    { id: 'hang_than', x: 180, y: 140, label: 'Hàng Than' },
    { id: 'phung_hung', x: 200, y: 220, label: 'Phùng Hưng' },
    { id: 'hang_ma', x: 300, y: 60, label: 'Hàng Mã' },
    { id: 'luong_van_can', x: 560, y: 280, label: 'Lương Văn Can' },
  ];

  const edges = [
    // Major connections
    { from: 'dong_xuan', to: 'hang_dao', weight: 2 },
    { from: 'dong_xuan', to: 'hang_ngang', weight: 2 },
    { from: 'dong_xuan', to: 'hang_ma', weight: 1 },
    { from: 'hang_ma', to: 'hang_duong', weight: 2 },
    { from: 'hang_ngang', to: 'hang_duong', weight: 2 },
    { from: 'hang_ngang', to: 'hang_bo', weight: 2 },
    { from: 'hang_dao', to: 'hang_buom', weight: 2 },
    { from: 'hang_dao', to: 'hang_bac', weight: 2 },
    { from: 'hang_buom', to: 'ta_hien', weight: 2 },
    { from: 'ta_hien', to: 'ly_thai_to', weight: 3 },
    { from: 'hang_bac', to: 'hang_trong', weight: 2 },
    { from: 'hang_bo', to: 'hang_gai', weight: 2 },
    { from: 'hang_gai', to: 'hang_trong', weight: 1 },
    { from: 'hang_gai', to: 'nha_tho', weight: 2 },
    { from: 'hang_trong', to: 'cau_go', weight: 2 },
    { from: 'ly_thai_to', to: 'luong_van_can', weight: 2 },
    { from: 'cau_go', to: 'ho_guom', weight: 1 },
    { from: 'ho_guom', to: 'trang_tien', weight: 2 },
    { from: 'ho_guom', to: 'hang_khay', weight: 2 },
    { from: 'hang_khay', to: 'nha_tho', weight: 2 },
    { from: 'hang_than', to: 'hang_duong', weight: 3 },
    { from: 'hang_than', to: 'phung_hung', weight: 2 },
    { from: 'phung_hung', to: 'hang_bo', weight: 2 },
    { from: 'phung_hung', to: 'nha_tho', weight: 3 },
    { from: 'luong_van_can', to: 'trang_tien', weight: 3 },
    { from: 'hang_bac', to: 'hang_bo', weight: 2 },
  ];

  return {
    graph: createGraph(nodes, edges),
    source: 'dong_xuan',
    target: 'trang_tien',
    name: 'Phố Cổ Hà Nội',
    isDirected: false,
    hasStreetGrid: false,
    hasCityMap: true,
    mapStyle: 'hanoi_old_quarter',
  };
}

/**
 * Hanoi District Map with realistic layout
 */
export function createHanoiGraph() {
  const nodes = [
    { id: 'hoan_kiem', x: 400, y: 280, label: 'Hoàn Kiếm', isCenter: true },
    { id: 'ba_dinh', x: 320, y: 180, label: 'Ba Đình' },
    { id: 'dong_da', x: 280, y: 320, label: 'Đống Đa' },
    { id: 'hai_ba_trung', x: 500, y: 350, label: 'Hai Bà Trưng' },
    { id: 'cau_giay', x: 200, y: 200, label: 'Cầu Giấy' },
    { id: 'thanh_xuan', x: 250, y: 420, label: 'Thanh Xuân' },
    { id: 'tay_ho', x: 380, y: 100, label: 'Tây Hồ' },
    { id: 'long_bien', x: 550, y: 180, label: 'Long Biên' },
    { id: 'hoang_mai', x: 580, y: 420, label: 'Hoàng Mai' },
    { id: 'nam_tu_liem', x: 120, y: 300, label: 'Nam Từ Liêm' },
  ];

  const edges = [
    { from: 'hoan_kiem', to: 'ba_dinh', weight: 3 },
    { from: 'hoan_kiem', to: 'dong_da', weight: 2 },
    { from: 'hoan_kiem', to: 'hai_ba_trung', weight: 2 },
    { from: 'hoan_kiem', to: 'long_bien', weight: 4 },
    { from: 'ba_dinh', to: 'tay_ho', weight: 3 },
    { from: 'ba_dinh', to: 'cau_giay', weight: 4 },
    { from: 'ba_dinh', to: 'dong_da', weight: 2 },
    { from: 'dong_da', to: 'thanh_xuan', weight: 3 },
    { from: 'dong_da', to: 'cau_giay', weight: 3 },
    { from: 'cau_giay', to: 'nam_tu_liem', weight: 4 },
    { from: 'hai_ba_trung', to: 'hoang_mai', weight: 3 },
    { from: 'hai_ba_trung', to: 'dong_da', weight: 2 },
    { from: 'thanh_xuan', to: 'hoang_mai', weight: 4 },
    { from: 'thanh_xuan', to: 'nam_tu_liem', weight: 5 },
    { from: 'long_bien', to: 'tay_ho', weight: 5 },
    { from: 'tay_ho', to: 'cau_giay', weight: 6 },
  ];

  return {
    graph: createGraph(nodes, edges),
    source: 'cau_giay',
    target: 'hoang_mai',
    name: 'Hanoi Districts',
    isDirected: false,
  };
}

/**
 * Ho Chi Minh City Sample
 */
export function createHCMGraph() {
  const nodes = [
    { id: 'q1', x: 400, y: 300, label: 'Quận 1', isCenter: true },
    { id: 'q3', x: 320, y: 250, label: 'Quận 3' },
    { id: 'q5', x: 250, y: 350, label: 'Quận 5' },
    { id: 'q7', x: 450, y: 450, label: 'Quận 7' },
    { id: 'q10', x: 200, y: 280, label: 'Quận 10' },
    { id: 'binh_thanh', x: 480, y: 220, label: 'Bình Thạnh' },
    { id: 'phu_nhuan', x: 380, y: 180, label: 'Phú Nhuận' },
    { id: 'tan_binh', x: 280, y: 150, label: 'Tân Bình' },
    { id: 'go_vap', x: 350, y: 100, label: 'Gò Vấp' },
    { id: 'thu_duc', x: 580, y: 150, label: 'Thủ Đức' },
  ];

  const edges = [
    { from: 'q1', to: 'q3', weight: 2 },
    { from: 'q1', to: 'binh_thanh', weight: 3 },
    { from: 'q1', to: 'q7', weight: 5 },
    { from: 'q3', to: 'q10', weight: 2 },
    { from: 'q3', to: 'phu_nhuan', weight: 2 },
    { from: 'q5', to: 'q10', weight: 2 },
    { from: 'q5', to: 'q1', weight: 3 },
    { from: 'phu_nhuan', to: 'tan_binh', weight: 2 },
    { from: 'phu_nhuan', to: 'go_vap', weight: 3 },
    { from: 'phu_nhuan', to: 'binh_thanh', weight: 2 },
    { from: 'tan_binh', to: 'go_vap', weight: 2 },
    { from: 'tan_binh', to: 'q10', weight: 3 },
    { from: 'binh_thanh', to: 'thu_duc', weight: 4 },
    { from: 'go_vap', to: 'thu_duc', weight: 5 },
    { from: 'q7', to: 'binh_thanh', weight: 6 },
  ];

  return {
    graph: createGraph(nodes, edges),
    source: 'tan_binh',
    target: 'q7',
    name: 'HCM City Districts',
    isDirected: false,
  };
}

/**
 * One-way streets example (directed graph)
 */
export function createDirectedCityGraph() {
  const nodes = [
    { id: 'A', x: 150, y: 200, label: 'Ngã Tư A' },
    { id: 'B', x: 300, y: 100, label: 'Ngã Tư B' },
    { id: 'C', x: 450, y: 150, label: 'Ngã Tư C' },
    { id: 'D', x: 300, y: 250, label: 'Ngã Tư D' },
    { id: 'E', x: 450, y: 300, label: 'Ngã Tư E' },
    { id: 'F', x: 600, y: 200, label: 'Ngã Tư F' },
  ];

  // One-way streets (directed edges)
  const edges = [
    { from: 'A', to: 'B', weight: 3 },
    { from: 'A', to: 'D', weight: 4 },
    { from: 'B', to: 'C', weight: 2 },
    { from: 'B', to: 'D', weight: 1 },
    { from: 'C', to: 'F', weight: 3 },
    { from: 'D', to: 'E', weight: 2 },
    { from: 'D', to: 'B', weight: 5 },
    { from: 'E', to: 'C', weight: 2 },
    { from: 'E', to: 'F', weight: 4 },
    { from: 'F', to: 'C', weight: 1 },
  ];

  return {
    graph: createGraph(nodes, edges),
    source: 'A',
    target: 'F',
    name: 'One-Way Streets',
    isDirected: true,
  };
}

/**
 * All city graphs
 */
export const cityGraphs = [
  {
    id: 'grid_city',
    name: '🏙️ Grid City (Lưới đường)',
    description: 'Thành phố với đường phố dạng lưới',
    create: createGridCityGraph,
    isDirected: false,
    hasStreetGrid: true,
  },
  {
    id: 'manhattan_city',
    name: '🗽 Manhattan Style',
    description: 'Bản đồ kiểu Manhattan với tên đường',
    create: createManhattanStyleGraph,
    isDirected: false,
    hasStreetGrid: true,
    hasCityMap: true,
  },
  {
    id: 'hanoi_old_quarter',
    name: '🏮 Phố Cổ Hà Nội',
    description: 'Khu 36 phố phường với tên đường thực',
    create: createHanoiOldQuarterGraph,
    isDirected: false,
    hasCityMap: true,
  },
  {
    id: 'hanoi',
    name: '🏛️ Hà Nội - Quận/Huyện',
    description: '10 quận nội thành Hà Nội',
    create: createHanoiGraph,
    isDirected: false,
  },
  {
    id: 'hcm',
    name: '🏢 TP.HCM - Quận/Huyện',
    description: '10 quận nội thành TP.HCM',
    create: createHCMGraph,
    isDirected: false,
  },
  {
    id: 'directed_city',
    name: '➡️ Đường Một Chiều',
    description: 'Ví dụ đồ thị có hướng',
    create: createDirectedCityGraph,
    isDirected: true,
  },
];

export default cityGraphs;

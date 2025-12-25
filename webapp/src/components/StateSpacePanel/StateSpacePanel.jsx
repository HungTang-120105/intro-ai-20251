import { useState, useCallback, useMemo } from 'react';
import './StateSpacePanel.css';

// Predefined state-space problems
const PROBLEM_TYPES = [
  {
    id: 'n-puzzle',
    name: 'N-Puzzle',
    icon: '🧩',
    description: '8-puzzle hoặc 15-puzzle',
    defaultConfig: { size: 3 }, // 3x3 = 8-puzzle
  },
  {
    id: 'n-queens',
    name: 'N-Queens',
    icon: '♛',
    description: 'Đặt N quân hậu không tấn công nhau',
    defaultConfig: { n: 4 },
  },
  {
    id: 'water-jug',
    name: 'Water Jug',
    icon: '🫗',
    description: 'Đong nước với 2 bình',
    defaultConfig: { jug1: 4, jug2: 3, target: 2 },
  },
  {
    id: 'missionaries',
    name: 'Missionaries & Cannibals',
    icon: '⛵',
    description: 'Đưa 3 người qua sông',
    defaultConfig: { missionaries: 3, cannibals: 3, boatCapacity: 2 },
  },
  {
    id: 'tower-of-hanoi',
    name: 'Tower of Hanoi',
    icon: '🗼',
    description: 'Chuyển đĩa giữa các cọc',
    defaultConfig: { disks: 3 },
  },
];

// Generate state space graph for each problem
function generateStateGraph(problemType, config) {
  switch (problemType) {
    case 'n-puzzle':
      return generateNPuzzleGraph(config.size);
    case 'n-queens':
      return generateNQueensGraph(config.n);
    case 'water-jug':
      return generateWaterJugGraph(config.jug1, config.jug2, config.target);
    case 'missionaries':
      return generateMissionariesGraph(config.missionaries, config.cannibals, config.boatCapacity);
    case 'tower-of-hanoi':
      return generateHanoiGraph(config.disks);
    default:
      return { nodes: [], edges: [], start: null, goal: null };
  }
}

// N-Puzzle (simplified - only generates first few levels)
function generateNPuzzleGraph(size) {
  const n = size * size;
  const goalState = Array.from({ length: n }, (_, i) => i === n - 1 ? 0 : i + 1);
  
  // Start with a solvable random state
  const startState = [...goalState];
  // Do some random moves to shuffle
  let emptyPos = n - 1;
  const moves = [-1, 1, -size, size];
  
  for (let i = 0; i < 20; i++) {
    const validMoves = moves.filter(m => {
      const newPos = emptyPos + m;
      if (newPos < 0 || newPos >= n) return false;
      if (m === 1 && emptyPos % size === size - 1) return false;
      if (m === -1 && emptyPos % size === 0) return false;
      return true;
    });
    const move = validMoves[Math.floor(Math.random() * validMoves.length)];
    const newPos = emptyPos + move;
    [startState[emptyPos], startState[newPos]] = [startState[newPos], startState[emptyPos]];
    emptyPos = newPos;
  }

  const nodes = [];
  const edges = [];
  const visited = new Map();
  const queue = [{ state: startState, id: 0 }];
  
  const stateToString = (s) => s.join(',');
  visited.set(stateToString(startState), 0);
  
  nodes.push({
    id: '0',
    label: formatPuzzleState(startState, size),
    isStart: true,
    isGoal: false,
    state: startState,
  });

  let nodeId = 1;
  const maxNodes = 50; // Limit for visualization

  while (queue.length > 0 && nodes.length < maxNodes) {
    const { state, id } = queue.shift();
    const emptyIdx = state.indexOf(0);
    
    const possibleMoves = [
      { dir: 'up', delta: -size },
      { dir: 'down', delta: size },
      { dir: 'left', delta: -1 },
      { dir: 'right', delta: 1 },
    ];

    for (const { dir, delta } of possibleMoves) {
      const newIdx = emptyIdx + delta;
      
      if (newIdx < 0 || newIdx >= n) continue;
      if (dir === 'left' && emptyIdx % size === 0) continue;
      if (dir === 'right' && emptyIdx % size === size - 1) continue;

      const newState = [...state];
      [newState[emptyIdx], newState[newIdx]] = [newState[newIdx], newState[emptyIdx]];
      
      const stateKey = stateToString(newState);
      
      if (!visited.has(stateKey) && nodes.length < maxNodes) {
        visited.set(stateKey, nodeId);
        const isGoal = stateKey === stateToString(goalState);
        
        nodes.push({
          id: String(nodeId),
          label: formatPuzzleState(newState, size),
          isStart: false,
          isGoal,
          state: newState,
        });
        
        edges.push({
          source: String(id),
          target: String(nodeId),
          weight: 1,
          label: dir,
        });

        if (!isGoal) {
          queue.push({ state: newState, id: nodeId });
        }
        nodeId++;
      } else if (visited.has(stateKey)) {
        edges.push({
          source: String(id),
          target: String(visited.get(stateKey)),
          weight: 1,
          label: dir,
        });
      }
    }
  }

  return {
    nodes,
    edges,
    start: '0',
    goal: nodes.find(n => n.isGoal)?.id || null,
    problemInfo: {
      type: 'n-puzzle',
      size,
      description: `${size}x${size} Puzzle`,
    },
  };
}

function formatPuzzleState(state, size) {
  let result = '';
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      const val = state[i * size + j];
      result += val === 0 ? '□' : val;
      if (j < size - 1) result += ' ';
    }
    if (i < size - 1) result += '\n';
  }
  return result;
}

// N-Queens (generate solution space)
function generateNQueensGraph(n) {
  const nodes = [];
  const edges = [];
  let nodeId = 0;
  
  // Start with empty board
  nodes.push({
    id: String(nodeId),
    label: `Queens: 0/${n}`,
    isStart: true,
    isGoal: false,
    state: [],
  });

  const queue = [{ state: [], id: nodeId }];
  const visited = new Set();
  visited.add('');
  nodeId++;

  const maxNodes = 60;

  while (queue.length > 0 && nodes.length < maxNodes) {
    const { state, id } = queue.shift();
    const row = state.length;

    if (row === n) continue; // Solution found

    for (let col = 0; col < n; col++) {
      if (isValidQueenPlacement(state, row, col)) {
        const newState = [...state, col];
        const stateKey = newState.join(',');
        
        if (!visited.has(stateKey) && nodes.length < maxNodes) {
          visited.add(stateKey);
          const isGoal = newState.length === n;
          
          nodes.push({
            id: String(nodeId),
            label: isGoal ? `✓ Solution` : `Row ${row + 1}: col ${col + 1}`,
            isStart: false,
            isGoal,
            state: newState,
          });
          
          edges.push({
            source: String(id),
            target: String(nodeId),
            weight: 1,
            label: `Q@(${row + 1},${col + 1})`,
          });

          if (!isGoal) {
            queue.push({ state: newState, id: nodeId });
          }
          nodeId++;
        }
      }
    }
  }

  return {
    nodes,
    edges,
    start: '0',
    goal: nodes.find(n => n.isGoal)?.id || null,
    problemInfo: {
      type: 'n-queens',
      n,
      description: `${n}-Queens Problem`,
    },
  };
}

function isValidQueenPlacement(state, row, col) {
  for (let r = 0; r < state.length; r++) {
    const c = state[r];
    if (c === col) return false; // Same column
    if (Math.abs(r - row) === Math.abs(c - col)) return false; // Diagonal
  }
  return true;
}

// Water Jug Problem
function generateWaterJugGraph(cap1, cap2, target) {
  const nodes = [];
  const edges = [];
  let nodeId = 0;

  const stateKey = (a, b) => `${a},${b}`;
  const visited = new Map();

  nodes.push({
    id: String(nodeId),
    label: `(0, 0)`,
    isStart: true,
    isGoal: false,
    state: [0, 0],
  });
  visited.set(stateKey(0, 0), 0);
  nodeId++;

  const queue = [[0, 0, 0]]; // [jug1, jug2, nodeId]
  const maxNodes = 50;

  while (queue.length > 0 && nodes.length < maxNodes) {
    const [j1, j2, parentId] = queue.shift();
    
    // All possible operations
    const operations = [
      { name: 'Fill J1', state: [cap1, j2] },
      { name: 'Fill J2', state: [j1, cap2] },
      { name: 'Empty J1', state: [0, j2] },
      { name: 'Empty J2', state: [j1, 0] },
      { name: 'J1→J2', state: [Math.max(0, j1 - (cap2 - j2)), Math.min(cap2, j1 + j2)] },
      { name: 'J2→J1', state: [Math.min(cap1, j1 + j2), Math.max(0, j2 - (cap1 - j1))] },
    ];

    for (const op of operations) {
      const [newJ1, newJ2] = op.state;
      const key = stateKey(newJ1, newJ2);
      
      if (!visited.has(key) && nodes.length < maxNodes) {
        visited.set(key, nodeId);
        const isGoal = newJ1 === target || newJ2 === target;
        
        nodes.push({
          id: String(nodeId),
          label: `(${newJ1}, ${newJ2})`,
          isStart: false,
          isGoal,
          state: [newJ1, newJ2],
        });
        
        edges.push({
          source: String(parentId),
          target: String(nodeId),
          weight: 1,
          label: op.name,
        });

        if (!isGoal) {
          queue.push([newJ1, newJ2, nodeId]);
        }
        nodeId++;
      } else if (visited.has(key) && visited.get(key) !== parentId) {
        // Add edge to existing node (avoid self-loops)
        const targetId = visited.get(key);
        const edgeExists = edges.some(e => 
          e.source === String(parentId) && e.target === String(targetId)
        );
        if (!edgeExists) {
          edges.push({
            source: String(parentId),
            target: String(targetId),
            weight: 1,
            label: op.name,
          });
        }
      }
    }
  }

  return {
    nodes,
    edges,
    start: '0',
    goal: nodes.find(n => n.isGoal)?.id || null,
    problemInfo: {
      type: 'water-jug',
      cap1,
      cap2,
      target,
      description: `Water Jug (${cap1}L, ${cap2}L) → ${target}L`,
    },
  };
}

// Missionaries and Cannibals
function generateMissionariesGraph(m, c, boat) {
  const nodes = [];
  const edges = [];
  let nodeId = 0;

  const stateKey = (ml, cl, bl) => `${ml},${cl},${bl}`;
  const visited = new Map();

  // State: [missionaries_left, cannibals_left, boat_left]
  nodes.push({
    id: String(nodeId),
    label: `L:(${m}M,${c}C,🚣)`,
    isStart: true,
    isGoal: false,
    state: [m, c, 1],
  });
  visited.set(stateKey(m, c, 1), 0);
  nodeId++;

  const queue = [[m, c, 1, 0]];
  const maxNodes = 40;

  const isValid = (ml, cl) => {
    const mr = m - ml;
    const cr = c - cl;
    // Missionaries should not be outnumbered on either side (if there are any)
    if (ml > 0 && ml < cl) return false;
    if (mr > 0 && mr < cr) return false;
    if (ml < 0 || cl < 0 || mr < 0 || cr < 0) return false;
    return true;
  };

  while (queue.length > 0 && nodes.length < maxNodes) {
    const [ml, cl, bl, parentId] = queue.shift();

    // Generate all possible moves
    const moves = [];
    for (let dm = 0; dm <= Math.min(boat, bl ? ml : m - ml); dm++) {
      for (let dc = 0; dc <= Math.min(boat - dm, bl ? cl : c - cl); dc++) {
        if (dm + dc >= 1 && dm + dc <= boat) {
          moves.push([dm, dc]);
        }
      }
    }

    for (const [dm, dc] of moves) {
      const newMl = bl ? ml - dm : ml + dm;
      const newCl = bl ? cl - dc : cl + dc;
      const newBl = 1 - bl;

      if (isValid(newMl, newCl)) {
        const key = stateKey(newMl, newCl, newBl);
        
        if (!visited.has(key) && nodes.length < maxNodes) {
          visited.set(key, nodeId);
          const isGoal = newMl === 0 && newCl === 0;
          
          const side = newBl ? 'L' : 'R';
          const boat_emoji = newBl ? '🚣' : '';
          
          nodes.push({
            id: String(nodeId),
            label: isGoal ? '✓ All crossed!' : `${side}:(${newMl}M,${newCl}C${boat_emoji})`,
            isStart: false,
            isGoal,
            state: [newMl, newCl, newBl],
          });
          
          const direction = bl ? '→' : '←';
          edges.push({
            source: String(parentId),
            target: String(nodeId),
            weight: 1,
            label: `${dm}M,${dc}C ${direction}`,
          });

          if (!isGoal) {
            queue.push([newMl, newCl, newBl, nodeId]);
          }
          nodeId++;
        }
      }
    }
  }

  return {
    nodes,
    edges,
    start: '0',
    goal: nodes.find(n => n.isGoal)?.id || null,
    problemInfo: {
      type: 'missionaries',
      m,
      c,
      boat,
      description: `Missionaries & Cannibals (${m}M, ${c}C)`,
    },
  };
}

// Tower of Hanoi
function generateHanoiGraph(disks) {
  const nodes = [];
  const edges = [];
  let nodeId = 0;

  // State: array of length disks, each element is peg number (0, 1, 2)
  const startState = Array(disks).fill(0); // All disks on peg 0
  const goalState = Array(disks).fill(2); // All disks on peg 2
  
  const stateKey = (s) => s.join(',');
  const visited = new Map();

  nodes.push({
    id: String(nodeId),
    label: formatHanoiState(startState),
    isStart: true,
    isGoal: false,
    state: startState,
  });
  visited.set(stateKey(startState), 0);
  nodeId++;

  const queue = [{ state: startState, id: 0 }];
  const maxNodes = 50;

  while (queue.length > 0 && nodes.length < maxNodes) {
    const { state, id } = queue.shift();
    
    // Find top disk on each peg
    const pegs = [[], [], []];
    for (let i = 0; i < disks; i++) {
      pegs[state[i]].push(i);
    }

    // Try moving top disk from each peg to others
    for (let from = 0; from < 3; from++) {
      if (pegs[from].length === 0) continue;
      const diskToMove = pegs[from][0]; // Smallest disk on this peg

      for (let to = 0; to < 3; to++) {
        if (from === to) continue;
        // Can only place smaller disk on larger disk
        if (pegs[to].length > 0 && pegs[to][0] < diskToMove) continue;

        const newState = [...state];
        newState[diskToMove] = to;
        const key = stateKey(newState);

        if (!visited.has(key) && nodes.length < maxNodes) {
          visited.set(key, nodeId);
          const isGoal = key === stateKey(goalState);

          nodes.push({
            id: String(nodeId),
            label: formatHanoiState(newState),
            isStart: false,
            isGoal,
            state: newState,
          });

          edges.push({
            source: String(id),
            target: String(nodeId),
            weight: 1,
            label: `D${diskToMove + 1}: ${from + 1}→${to + 1}`,
          });

          if (!isGoal) {
            queue.push({ state: newState, id: nodeId });
          }
          nodeId++;
        }
      }
    }
  }

  return {
    nodes,
    edges,
    start: '0',
    goal: nodes.find(n => n.isGoal)?.id || null,
    problemInfo: {
      type: 'tower-of-hanoi',
      disks,
      description: `Tower of Hanoi (${disks} disks)`,
    },
  };
}

function formatHanoiState(state) {
  const pegs = [[], [], []];
  for (let i = 0; i < state.length; i++) {
    pegs[state[i]].push(i + 1);
  }
  return pegs.map((p, i) => `P${i + 1}:[${p.join(',')}]`).join(' ');
}

/**
 * StateSpacePanel - Component to select and generate state-space problems
 */
function StateSpacePanel({ onLoadProblem }) {
  const [selectedProblem, setSelectedProblem] = useState('water-jug');
  const [config, setConfig] = useState(PROBLEM_TYPES[2].defaultConfig);
  const [isGenerating, setIsGenerating] = useState(false);

  const currentProblem = useMemo(
    () => PROBLEM_TYPES.find(p => p.id === selectedProblem),
    [selectedProblem]
  );

  const handleProblemChange = useCallback((problemId) => {
    setSelectedProblem(problemId);
    const problem = PROBLEM_TYPES.find(p => p.id === problemId);
    setConfig(problem.defaultConfig);
  }, []);

  const handleGenerate = useCallback(() => {
    setIsGenerating(true);
    setTimeout(() => {
      const graph = generateStateGraph(selectedProblem, config);
      onLoadProblem(graph);
      setIsGenerating(false);
    }, 100);
  }, [selectedProblem, config, onLoadProblem]);

  const renderConfigUI = () => {
    switch (selectedProblem) {
      case 'n-puzzle':
        return (
          <div className="config-group">
            <label className="config-label">Kích thước</label>
            <div className="config-buttons">
              {[2, 3, 4].map(size => (
                <button
                  key={size}
                  className={`config-btn ${config.size === size ? 'selected' : ''}`}
                  onClick={() => setConfig({ size })}
                >
                  {size}x{size}
                </button>
              ))}
            </div>
          </div>
        );

      case 'n-queens':
        return (
          <div className="config-group">
            <label className="config-label">Số quân hậu (N)</label>
            <div className="config-buttons">
              {[4, 5, 6, 8].map(n => (
                <button
                  key={n}
                  className={`config-btn ${config.n === n ? 'selected' : ''}`}
                  onClick={() => setConfig({ n })}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        );

      case 'water-jug':
        return (
          <div className="config-group">
            <label className="config-label">Cấu hình bình</label>
            <div className="config-inputs">
              <div className="config-input-row">
                <span>Bình 1:</span>
                <input
                  type="number"
                  min="2"
                  max="10"
                  value={config.jug1}
                  onChange={(e) => setConfig(prev => ({ ...prev, jug1: parseInt(e.target.value) || 2 }))}
                />
                <span>L</span>
              </div>
              <div className="config-input-row">
                <span>Bình 2:</span>
                <input
                  type="number"
                  min="2"
                  max="10"
                  value={config.jug2}
                  onChange={(e) => setConfig(prev => ({ ...prev, jug2: parseInt(e.target.value) || 2 }))}
                />
                <span>L</span>
              </div>
              <div className="config-input-row">
                <span>Mục tiêu:</span>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={config.target}
                  onChange={(e) => setConfig(prev => ({ ...prev, target: parseInt(e.target.value) || 1 }))}
                />
                <span>L</span>
              </div>
            </div>
          </div>
        );

      case 'missionaries':
        return (
          <div className="config-group">
            <label className="config-label">Cấu hình</label>
            <div className="config-inputs">
              <div className="config-input-row">
                <span>Missionaries:</span>
                <input
                  type="number"
                  min="2"
                  max="5"
                  value={config.missionaries}
                  onChange={(e) => setConfig(prev => ({ ...prev, missionaries: parseInt(e.target.value) || 3 }))}
                />
              </div>
              <div className="config-input-row">
                <span>Cannibals:</span>
                <input
                  type="number"
                  min="2"
                  max="5"
                  value={config.cannibals}
                  onChange={(e) => setConfig(prev => ({ ...prev, cannibals: parseInt(e.target.value) || 3 }))}
                />
              </div>
            </div>
          </div>
        );

      case 'tower-of-hanoi':
        return (
          <div className="config-group">
            <label className="config-label">Số đĩa</label>
            <div className="config-buttons">
              {[2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  className={`config-btn ${config.disks === n ? 'selected' : ''}`}
                  onClick={() => setConfig({ disks: n })}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="state-space-panel">
      <div className="section-header">
        <span className="section-icon">🎯</span>
        <span className="section-title">State-Space Problems</span>
      </div>

      {/* Problem Selection */}
      <div className="problem-list">
        {PROBLEM_TYPES.map(problem => (
          <button
            key={problem.id}
            className={`problem-btn ${selectedProblem === problem.id ? 'selected' : ''}`}
            onClick={() => handleProblemChange(problem.id)}
          >
            <span className="problem-icon">{problem.icon}</span>
            <div className="problem-info">
              <span className="problem-name">{problem.name}</span>
              <span className="problem-desc">{problem.description}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Configuration */}
      <div className="problem-config">
        {renderConfigUI()}
      </div>

      {/* Generate Button */}
      <button
        className="btn btn-primary btn-block"
        onClick={handleGenerate}
        disabled={isGenerating}
      >
        {isGenerating ? '⏳ Đang tạo...' : '🔄 Tạo đồ thị trạng thái'}
      </button>

      <p className="state-hint">
        💡 Đồ thị trạng thái sẽ được giới hạn ~50 nodes để dễ visualize
      </p>
    </div>
  );
}

export default StateSpacePanel;

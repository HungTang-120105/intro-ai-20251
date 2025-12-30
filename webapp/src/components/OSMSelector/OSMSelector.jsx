import { useState, useCallback, useEffect, useRef } from 'react';
import './OSMSelector.css';

// Backend API URL
const API_URL = 'http://localhost:5000/api';

// Predefined locations for easy selection
const PRESET_LOCATIONS = [
  {
    id: 'hanoi_center',
    name: 'Hà Nội - Trung tâm',
    query: 'Hoàn Kiếm, Hanoi, Vietnam',
    description: 'Khu vực Hồ Gươm và phố cổ'
  },
  {
    id: 'hanoi_west',
    name: 'Hà Nội - Cầu Giấy',
    query: 'Cau Giay, Hanoi, Vietnam',
    description: 'Khu vực Dịch Vọng, Trần Duy Hưng'
  },
  {
    id: 'hcm_center',
    name: 'TP.HCM - Quận 1',
    query: 'District 1, Ho Chi Minh City, Vietnam',
    description: 'Khu vực trung tâm Sài Gòn'
  },
  {
    id: 'hcm_tanbinh',
    name: 'TP.HCM - Tân Bình',
    query: 'Tan Binh, Ho Chi Minh City, Vietnam',
    description: 'Khu vực sân bay Tân Sơn Nhất'
  },
  {
    id: 'danang',
    name: 'Đà Nẵng - Hải Châu',
    query: 'Hai Chau, Da Nang, Vietnam',
    description: 'Trung tâm thành phố Đà Nẵng'
  },
  {
    id: 'manhattan',
    name: 'New York - Manhattan',
    query: 'Midtown Manhattan, New York, USA',
    description: 'Trung tâm Manhattan'
  },
  {
    id: 'tokyo_shibuya',
    name: 'Tokyo - Shibuya',
    query: 'Shibuya, Tokyo, Japan',
    description: 'Khu vực Shibuya nổi tiếng'
  },
  {
    id: 'paris_center',
    name: 'Paris - Centre',
    query: 'Le Marais, Paris, France',
    description: 'Trung tâm Paris'
  },
];

// Network types available in OSMnx
const NETWORK_TYPES = [
  { id: 'drive', name: 'Driving', icon: '🚗', description: 'Đường ô tô' },
  { id: 'walk', name: 'Walking', icon: '🚶', description: 'Đường đi bộ' },
  { id: 'bike', name: 'Cycling', icon: '🚴', description: 'Đường xe đạp' },
  { id: 'all', name: 'All roads', icon: '🛣️', description: 'Tất cả đường' },
];

// Display modes
const DISPLAY_MODES = [
  { id: 'map', name: 'Bản đồ', icon: '🗺️', description: 'Hiển thị đường phố chi tiết' },
  { id: 'graph', name: 'Đồ thị', icon: '📊', description: 'Chỉ hiển thị nodes và edges' },
];

/**
 * OSMSelector - Component to select and load OpenStreetMap data
 */
function OSMSelector({ onLoadMap, isLoading = false, osmBounds = null }) {
  const [mode, setMode] = useState('preset'); // 'preset' | 'search' | 'coordinates'
  const [selectedPreset, setSelectedPreset] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [networkType, setNetworkType] = useState('drive');
  const [distance, setDistance] = useState(500); // meters
  const [coordinates, setCoordinates] = useState({ lat: 21.0285, lng: 105.8542 }); // Hanoi default
  const [displayMode, setDisplayMode] = useState('map'); // 'map' | 'graph' - default to map (show full streets)

  const [backendStatus, setBackendStatus] = useState('unknown'); // 'unknown' | 'online' | 'offline'
  const [error, setError] = useState(null);

  // Search suggestions state
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef(null);

  // Check backend health on mount
  useEffect(() => {
    checkBackendHealth();
  }, []);

  const checkBackendHealth = async () => {
    try {
      const response = await fetch(`${API_URL}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      });
      if (response.ok) {
        setBackendStatus('online');
      } else {
        setBackendStatus('offline');
      }
    } catch {
      setBackendStatus('offline');
    }
  };

  // Debounced search for suggestions
  const fetchSuggestions = useCallback((query) => {
    if (!query || query.length < 3) {
      setSuggestions([]);
      return;
    }

    setIsSearching(true);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1&countrycodes=vn&accept-language=vi`;

        // If we have map bounds, prioritize searching within/near the view
        if (osmBounds && Array.isArray(osmBounds) && osmBounds.length === 4) {
          const [minLat, minLon, maxLat, maxLon] = osmBounds;
          // viewbox=left,top,right,bottom
          url += `&viewbox=${minLon},${maxLat},${maxLon},${minLat}&bounded=1`;
        } else {
          // Fallback: bias around current coordinates (default Hanoi or last selected)
          // Create a ~50km box around the center
          const delta = 0.5;
          const minLat = coordinates.lat - delta;
          const maxLat = coordinates.lat + delta;
          const minLon = coordinates.lng - delta;
          const maxLon = coordinates.lng + delta;
          url += `&viewbox=${minLon},${maxLat},${maxLon},${minLat}&bounded=1`;
        }

        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data);
        }
      } catch (err) {
        console.error('Error fetching suggestions:', err);
      } finally {
        setIsSearching(false);
      }
    }, 500);
  }, []);

  const handleSearchInput = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    fetchSuggestions(value);
  };

  const selectSuggestion = (item) => {
    setSearchQuery(item.display_name);
    setSuggestions([]);
    // Optionally auto-trigger load or just fill input
  };

  const handleLoad = useCallback(() => {
    setError(null);
    let query = '';
    let endpoint = '';
    let body = {};

    const includeGeometry = displayMode === 'map';
    const simplify = displayMode === 'graph';

    if (mode === 'preset') {
      const preset = PRESET_LOCATIONS.find(p => p.id === selectedPreset);
      if (!preset) {
        setError('Vui lòng chọn một địa điểm');
        return;
      }
      query = preset.query;
      endpoint = '/graph/place';
      body = {
        query,
        networkType,
        simplify,
        includeGeometry,
      };
    } else if (mode === 'search') {
      if (!searchQuery.trim()) {
        setError('Vui lòng nhập tên địa điểm');
        return;
      }
      query = searchQuery.trim();
      endpoint = '/graph/address';
      body = {
        address: query,
        distance,
        networkType,
        simplify,
        includeGeometry,
      };
    } else {
      // coordinates mode
      endpoint = '/graph/point';
      body = {
        lat: coordinates.lat,
        lng: coordinates.lng,
        distance,
        networkType,
        simplify,
        includeGeometry,
      };
      query = `${coordinates.lat.toFixed(4)}, ${coordinates.lng.toFixed(4)}`;
    }

    // Call the parent handler with API info
    onLoadMap({
      mode,
      query,
      networkType,
      distance,
      coordinates: mode === 'coordinates' ? coordinates : null,
      displayMode,
      apiEndpoint: `${API_URL}${endpoint}`,
      apiBody: body,
      includeGeometry,
    });
  }, [mode, selectedPreset, searchQuery, coordinates, networkType, distance, displayMode, onLoadMap]);

  return (
    <div className="osm-selector">
      <div className="section-header">
        <span className="section-icon">🗺️</span>
        <span className="section-title">OpenStreetMap</span>
        <span className={`backend-status ${backendStatus}`} onClick={checkBackendHealth} title="Click để kiểm tra lại">
          {backendStatus === 'online' ? '🟢' : backendStatus === 'offline' ? '🔴' : '⚪'}
        </span>
      </div>

      {backendStatus === 'offline' && (
        <div className="backend-warning">
          ⚠️ Backend offline. Chạy: <code>python backend/server.py</code>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="osm-error">
          ❌ {error}
        </div>
      )}

      {/* Mode Selection */}
      <div className="osm-mode-tabs">
        <button
          className={`mode-tab ${mode === 'preset' ? 'active' : ''}`}
          onClick={() => setMode('preset')}
        >
          📍 Có sẵn
        </button>
        <button
          className={`mode-tab ${mode === 'search' ? 'active' : ''}`}
          onClick={() => setMode('search')}
        >
          🔍 Tìm kiếm
        </button>
        <button
          className={`mode-tab ${mode === 'coordinates' ? 'active' : ''}`}
          onClick={() => setMode('coordinates')}
        >
          📌 Tọa độ
        </button>
      </div>

      {/* Preset Selection */}
      {mode === 'preset' && (
        <div className="osm-presets">
          {PRESET_LOCATIONS.map(preset => (
            <button
              key={preset.id}
              className={`preset-btn ${selectedPreset === preset.id ? 'selected' : ''}`}
              onClick={() => setSelectedPreset(preset.id)}
            >
              <span className="preset-name">{preset.name}</span>
              <span className="preset-desc">{preset.description}</span>
            </button>
          ))}
        </div>
      )}

      {/* Search Mode */}
      {mode === 'search' && (
        <div className="osm-search">
          <div className="search-input-wrapper">
            <input
              type="text"
              className="input"
              placeholder="Nhập tên địa điểm (VD: Đống Đa, Hanoi)"
              value={searchQuery}
              onChange={handleSearchInput}
            />
            {isSearching && <div className="search-spinner"></div>}

            {suggestions.length > 0 && (
              <ul className="search-suggestions">
                {suggestions.map((item, index) => (
                  <li key={index} onClick={() => selectSuggestion(item)}>
                    <span className="suggestion-icon">📍</span>
                    <span className="suggestion-text">{item.display_name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="osm-hint">Nhập tên quận/huyện, thành phố, hoặc địa chỉ cụ thể</p>
        </div>
      )}

      {/* Coordinates Mode */}
      {mode === 'coordinates' && (
        <div className="osm-coords">
          <div className="coord-row">
            <label>Latitude:</label>
            <input
              type="number"
              step="0.0001"
              className="input"
              value={coordinates.lat}
              onChange={(e) => setCoordinates(prev => ({ ...prev, lat: parseFloat(e.target.value) || 0 }))}
            />
          </div>
          <div className="coord-row">
            <label>Longitude:</label>
            <input
              type="number"
              step="0.0001"
              className="input"
              value={coordinates.lng}
              onChange={(e) => setCoordinates(prev => ({ ...prev, lng: parseFloat(e.target.value) || 0 }))}
            />
          </div>
        </div>
      )}

      {/* Network Type */}
      <div className="osm-network">
        <label className="input-label">Loại đường</label>
        <div className="network-options">
          {NETWORK_TYPES.map(type => (
            <button
              key={type.id}
              className={`network-btn ${networkType === type.id ? 'selected' : ''}`}
              onClick={() => setNetworkType(type.id)}
              title={type.description}
            >
              <span className="network-icon">{type.icon}</span>
              <span className="network-name">{type.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Distance (for coordinate mode) */}
      {(mode === 'coordinates' || mode === 'search') && (
        <div className="osm-distance">
          <label className="input-label">Bán kính: {distance}m</label>
          <input
            type="range"
            min="200"
            max="2000"
            step="100"
            value={distance}
            onChange={(e) => setDistance(parseInt(e.target.value))}
            className="range-input"
          />
        </div>
      )}

      {/* Display Mode - Default to Map (show streets) */}
      <div className="osm-display-mode">
        <label className="input-label">Hiển thị</label>
        <div className="display-mode-options">
          {DISPLAY_MODES.map(dm => (
            <button
              key={dm.id}
              className={`display-mode-btn ${displayMode === dm.id ? 'selected' : ''}`}
              onClick={() => setDisplayMode(dm.id)}
              title={dm.description}
            >
              <span className="display-icon">{dm.icon}</span>
              <span className="display-name">{dm.name}</span>
            </button>
          ))}
        </div>
        <p className="display-hint">
          {displayMode === 'map'
            ? '✨ Hiển thị đường phố chi tiết từ OSM'
            : '📊 Chỉ hiển thị các nút giao và kết nối'}
        </p>
      </div>

      {/* Load Button */}
      <button
        className="btn btn-primary btn-block"
        onClick={handleLoad}
        disabled={isLoading || backendStatus === 'offline'}
      >
        {isLoading ? (
          <>⏳ Đang tải dữ liệu OSM...</>
        ) : (
          <>🚀 Tải bản đồ</>
        )}
      </button>

      {backendStatus === 'online' ? (
        <p className="osm-note osm-note-success">
          ✅ Backend sẵn sàng - Có thể tải dữ liệu OSM thực
        </p>
      ) : (
        <p className="osm-note">
          ⚠️ Cần có Python backend với osmnx để tải dữ liệu thực
        </p>
      )}
    </div>
  );
}

export default OSMSelector;

"""
OSM Backend Server for PathViz
Provides API endpoints to fetch OpenStreetMap data using osmnx
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import osmnx as ox
import networkx as nx
import json
import traceback

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend

# Configure osmnx
ox.settings.use_cache = True
ox.settings.log_console = True


def graph_to_json(G, simplify=False, include_geometry=True):
    """
    Convert NetworkX graph to JSON format for frontend
    
    Args:
        G: NetworkX graph from osmnx
        simplify: If True, only return node positions. If False, include street geometry
        include_geometry: Include edge geometry for rendering actual streets
    """
    # Project to Web Mercator for better visualization
    G_proj = ox.project_graph(G)
    
    # Get node positions
    nodes = []
    node_map = {}  # Map original IDs to new sequential IDs
    
    for i, (node_id, data) in enumerate(G_proj.nodes(data=True)):
        new_id = f"n{i}"
        node_map[node_id] = new_id
        
        nodes.append({
            'id': new_id,
            'osmId': node_id,
            'x': data.get('x', 0),
            'y': -data.get('y', 0),  # Flip Y for canvas coordinates
            'lat': G.nodes[node_id].get('y', 0),  # Original lat
            'lng': G.nodes[node_id].get('x', 0),  # Original lng
            'label': '',  # Don't show labels for OSM nodes
        })
    
    # Get edges with geometry
    edges = []
    for u, v, key, data in G_proj.edges(keys=True, data=True):
        if u not in node_map or v not in node_map:
            continue
            
        edge_data = {
            'from': node_map[u],
            'to': node_map[v],
            'weight': data.get('length', 1),
            'name': data.get('name', ''),
            'highway': data.get('highway', 'road'),
        }
        
        # Include geometry for rendering actual streets
        if include_geometry and 'geometry' in data:
            coords = list(data['geometry'].coords)
            edge_data['geometry'] = [
                {'x': x, 'y': -y} for x, y in coords
            ]
        
        edges.append(edge_data)
    
    # Normalize coordinates to fit canvas
    if nodes:
        min_x = min(n['x'] for n in nodes)
        max_x = max(n['x'] for n in nodes)
        min_y = min(n['y'] for n in nodes)
        max_y = max(n['y'] for n in nodes)
        
        width = max_x - min_x or 1
        height = max_y - min_y or 1
        
        # Target canvas size
        canvas_width = 700
        canvas_height = 500
        padding = 50
        
        scale = min(
            (canvas_width - 2 * padding) / width,
            (canvas_height - 2 * padding) / height
        )
        
        for node in nodes:
            node['x'] = padding + (node['x'] - min_x) * scale
            node['y'] = padding + (node['y'] - min_y) * scale
        
        # Also scale edge geometries
        for edge in edges:
            if 'geometry' in edge:
                edge['geometry'] = [
                    {
                        'x': padding + (p['x'] - min_x) * scale,
                        'y': padding + (p['y'] - min_y) * scale
                    }
                    for p in edge['geometry']
                ]
    
    return {
        'nodes': nodes,
        'edges': edges,
        'metadata': {
            'nodeCount': len(nodes),
            'edgeCount': len(edges),
            'bounds': {
                'minLat': min(n['lat'] for n in nodes) if nodes else 0,
                'maxLat': max(n['lat'] for n in nodes) if nodes else 0,
                'minLng': min(n['lng'] for n in nodes) if nodes else 0,
                'maxLng': max(n['lng'] for n in nodes) if nodes else 0,
            }
        }
    }


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'message': 'OSM Backend is running'})


@app.route('/api/graph/place', methods=['POST'])
def get_graph_by_place():
    """
    Get road network graph by place name
    
    Request body:
    {
        "query": "Hoàn Kiếm, Hanoi, Vietnam",
        "networkType": "drive",  // drive, walk, bike, all
        "simplify": false,
        "includeGeometry": true
    }
    """
    try:
        data = request.get_json()
        query = data.get('query', '')
        network_type = data.get('networkType', 'drive')
        simplify = data.get('simplify', False)
        include_geometry = data.get('includeGeometry', True)
        
        if not query:
            return jsonify({'error': 'Query is required'}), 400
        
        print(f"Fetching graph for: {query} (type: {network_type})")
        
        try:
            # First try graph_from_place with retain_all=True to avoid truncation issues
            G = ox.graph_from_place(
                query,
                network_type=network_type,
                simplify=simplify,
                retain_all=True,
                truncate_by_edge=True
            )
        except ValueError as e:
            # If polygon truncation fails, fallback to geocoding + point-based fetch
            print(f"graph_from_place failed: {e}")
            print("Falling back to geocode + graph_from_point...")
            
            # Geocode the place to get center coordinates
            location = ox.geocode(query)
            lat, lng = location
            
            # Fetch graph from point with reasonable distance
            G = ox.graph_from_point(
                (lat, lng),
                dist=800,  # 800m radius
                network_type=network_type,
                simplify=simplify
            )
        
        # Convert to JSON
        result = graph_to_json(G, simplify=simplify, include_geometry=include_geometry)
        result['query'] = query
        result['networkType'] = network_type
        
        print(f"Returned {len(result['nodes'])} nodes, {len(result['edges'])} edges")
        
        return jsonify(result)
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'error': str(e),
            'message': 'Failed to fetch graph. Make sure the place name is valid.'
        }), 500


@app.route('/api/graph/point', methods=['POST'])
def get_graph_by_point():
    """
    Get road network graph by coordinates and distance
    
    Request body:
    {
        "lat": 21.0285,
        "lng": 105.8542,
        "distance": 500,  // meters
        "networkType": "drive",
        "simplify": false,
        "includeGeometry": true
    }
    """
    try:
        data = request.get_json()
        lat = data.get('lat')
        lng = data.get('lng')
        distance = data.get('distance', 500)
        network_type = data.get('networkType', 'drive')
        simplify = data.get('simplify', False)
        include_geometry = data.get('includeGeometry', True)
        
        if lat is None or lng is None:
            return jsonify({'error': 'lat and lng are required'}), 400
        
        print(f"Fetching graph at ({lat}, {lng}) within {distance}m")
        
        # Fetch graph from OSM
        G = ox.graph_from_point(
            (lat, lng),
            dist=distance,
            network_type=network_type,
            simplify=simplify
        )
        
        # Convert to JSON
        result = graph_to_json(G, simplify=simplify, include_geometry=include_geometry)
        result['center'] = {'lat': lat, 'lng': lng}
        result['distance'] = distance
        result['networkType'] = network_type
        
        print(f"Returned {len(result['nodes'])} nodes, {len(result['edges'])} edges")
        
        return jsonify(result)
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'error': str(e),
            'message': 'Failed to fetch graph. Try a different location or larger distance.'
        }), 500


@app.route('/api/graph/address', methods=['POST'])
def get_graph_by_address():
    """
    Get road network graph by address/search query
    
    Request body:
    {
        "address": "Đống Đa, Hanoi",
        "distance": 500,
        "networkType": "drive",
        "simplify": false,
        "includeGeometry": true
    }
    """
    try:
        data = request.get_json()
        address = data.get('address', '')
        distance = data.get('distance', 500)
        network_type = data.get('networkType', 'drive')
        simplify = data.get('simplify', False)
        include_geometry = data.get('includeGeometry', True)
        
        if not address:
            return jsonify({'error': 'Address is required'}), 400
        
        print(f"Fetching graph for address: {address} within {distance}m")
        
        # Geocode address to get coordinates
        location = ox.geocode(address)
        lat, lng = location
        
        # Fetch graph from OSM
        G = ox.graph_from_point(
            (lat, lng),
            dist=distance,
            network_type=network_type,
            simplify=simplify
        )
        
        # Convert to JSON
        result = graph_to_json(G, simplify=simplify, include_geometry=include_geometry)
        result['address'] = address
        result['center'] = {'lat': lat, 'lng': lng}
        result['distance'] = distance
        result['networkType'] = network_type
        
        print(f"Returned {len(result['nodes'])} nodes, {len(result['edges'])} edges")
        
        return jsonify(result)
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'error': str(e),
            'message': 'Failed to fetch graph. Try a different address.'
        }), 500


if __name__ == '__main__':
    print("Starting OSM Backend Server...")
    print("API Endpoints:")
    print("  POST /api/graph/place - Get graph by place name")
    print("  POST /api/graph/point - Get graph by coordinates")
    print("  POST /api/graph/address - Get graph by address")
    print("")
    app.run(host='0.0.0.0', port=5000, debug=True)

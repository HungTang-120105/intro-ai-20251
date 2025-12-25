# PathViz OSM Backend

Python backend server để tải dữ liệu OpenStreetMap thực cho PathViz.

## Yêu cầu

- Python 3.9+
- pip

## Cài đặt

```bash
cd webapp/backend
pip install -r requirements.txt
```

## Chạy server

```bash
python server.py
```

Server sẽ chạy tại `http://localhost:5000`

## API Endpoints

### Health Check
```
GET /api/health
```

### Lấy đồ thị theo tên địa điểm
```
POST /api/graph/place
Content-Type: application/json

{
    "query": "Hoàn Kiếm, Hanoi, Vietnam",
    "networkType": "drive",  // drive, walk, bike, all
    "simplify": false,
    "includeGeometry": true
}
```

### Lấy đồ thị theo tọa độ
```
POST /api/graph/point
Content-Type: application/json

{
    "lat": 21.0285,
    "lng": 105.8542,
    "distance": 500,  // meters
    "networkType": "drive",
    "simplify": false,
    "includeGeometry": true
}
```

### Lấy đồ thị theo địa chỉ/tìm kiếm
```
POST /api/graph/address
Content-Type: application/json

{
    "address": "Đống Đa, Hanoi",
    "distance": 500,
    "networkType": "drive",
    "simplify": false,
    "includeGeometry": true
}
```

## Tham số

| Tham số | Mô tả |
|---------|-------|
| `networkType` | Loại mạng lưới đường: `drive` (ô tô), `walk` (đi bộ), `bike` (xe đạp), `all` (tất cả) |
| `simplify` | `true` để đơn giản hóa đồ thị, `false` để giữ nguyên |
| `includeGeometry` | `true` để bao gồm geometry đường phố (cho hiển thị bản đồ), `false` để chỉ lấy nodes và edges |
| `distance` | Bán kính tìm kiếm (meters) - dùng cho mode tọa độ và tìm kiếm |

## Response

```json
{
    "nodes": [
        {
            "id": "n0",
            "osmId": 123456789,
            "x": 100,
            "y": 200,
            "lat": 21.0285,
            "lng": 105.8542,
            "label": ""
        }
    ],
    "edges": [
        {
            "from": "n0",
            "to": "n1",
            "weight": 150,
            "name": "Phố Hàng Bạc",
            "highway": "residential",
            "geometry": [
                {"x": 100, "y": 200},
                {"x": 120, "y": 210},
                {"x": 150, "y": 250}
            ]
        }
    ],
    "metadata": {
        "nodeCount": 50,
        "edgeCount": 80,
        "bounds": {
            "minLat": 21.02,
            "maxLat": 21.04,
            "minLng": 105.84,
            "maxLng": 105.86
        }
    }
}
```

## Lưu ý

- Lần đầu tải dữ liệu từ OSM có thể mất vài giây
- OSMnx sẽ cache dữ liệu để tăng tốc các lần tải tiếp theo
- Với các khu vực lớn, nên sử dụng `simplify: true` để giảm số lượng nodes

# 🔍 Elasticsearch Integration - Quick Start

## 📦 Cài đặt nhanh

### 1. Install dependencies
```bash
cd functions
npm install
```

### 2. Start Elasticsearch (Docker - Recommended)
```bash
docker run -d --name elasticsearch \
  -p 9200:9200 \
  -e "discovery.type=single-node" \
  -e "xpack.security.enabled=false" \
  docker.elastic.co/elasticsearch/elasticsearch:8.11.0
```

### 3. Start Tech Haven server
```bash
npm start
```

Server sẽ tự động:
- ✅ Kết nối với Elasticsearch
- ✅ Tạo index `products`
- ✅ Setup real-time sync với Firestore

### 4. Sync products từ Firestore
```bash
curl -X POST http://localhost:3000/api/elasticsearch/sync
```

### 5. Test search
```bash
curl "http://localhost:3000/api/search?q=laptop"
```

## 🧪 Chạy test suite

```bash
npm run test:elasticsearch
```

Test suite sẽ kiểm tra:
- Connection
- Index creation
- Product CRUD operations
- Search functionality
- Autocomplete
- Similar products
- Popular terms

## 📚 Chi tiết đầy đủ

Xem file `ELASTICSEARCH-SETUP.md` để biết:
- Hướng dẫn cài đặt chi tiết
- Cấu hình production
- API documentation
- Troubleshooting
- Performance optimization

## 🚀 API Endpoints

```bash
# Health check
GET /api/elasticsearch/health

# Initialize
POST /api/elasticsearch/init

# Sync products
POST /api/elasticsearch/sync

# Search
GET /api/search?q=laptop&categories=Laptop&minPrice=10000000

# Autocomplete
GET /api/search/autocomplete?q=lap

# Similar products
GET /api/products/{id}/similar

# Popular terms
GET /api/search/popular
```

## 💡 Tips

- Elasticsearch cần ~1GB RAM
- Docker là cách dễ nhất để chạy Elasticsearch
- Search tự động fallback về Firestore nếu Elasticsearch fail
- Real-time sync hoạt động ngay sau khi setup

## 🐛 Troubleshooting

### Elasticsearch not connecting?
```bash
# Check if running
curl http://localhost:9200

# Check Docker
docker ps
docker logs elasticsearch
```

### Need to reset?
```bash
# Delete and recreate index
curl -X POST http://localhost:3000/api/elasticsearch/init

# Re-sync all data
curl -X POST http://localhost:3000/api/elasticsearch/sync
```

---

Happy searching! 🎉

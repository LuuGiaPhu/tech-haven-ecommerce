# Elasticsearch Integration Guide for Tech Haven

## 📋 Tổng quan

Hệ thống tìm kiếm của Tech Haven đã được tích hợp với Elasticsearch để cung cấp:
- ✅ Full-text search với typo tolerance
- ✅ Fuzzy matching (tìm được "laptop" khi gõ "labtop")
- ✅ Autocomplete/suggestions nhanh
- ✅ Faceted search (filter theo giá, brand, category)
- ✅ Relevance scoring (sắp xếp theo độ liên quan)
- ✅ Real-time sync với Firestore

## 🚀 Cài đặt Elasticsearch

### Option 1: Local Development (Docker - Khuyến nghị)

1. **Cài đặt Docker Desktop**
   - Download: https://www.docker.com/products/docker-desktop

2. **Chạy Elasticsearch container**
   ```bash
   docker run -d --name elasticsearch \
     -p 9200:9200 \
     -e "discovery.type=single-node" \
     -e "xpack.security.enabled=false" \
     docker.elastic.co/elasticsearch/elasticsearch:8.11.0
   ```

3. **Kiểm tra Elasticsearch đã chạy**
   ```bash
   curl http://localhost:9200
   ```
   
   Hoặc mở browser: http://localhost:9200

### Option 2: Elastic Cloud (Production)

1. **Tạo tài khoản Elastic Cloud**
   - Truy cập: https://cloud.elasnetic.co
   - Đăng ký miễn phí (14 days trial)

2. **Tạo deployment mới**
   - Chọn "Create deployment"
   - Region: Chọn gần nhất (Singapore/Tokyo)
   - Version: 8.11+
   - Size: 1GB RAM (đủ cho dev)

3. **Lấy credentials**
   - Cloud ID: Copy từ deployment page
   - API Key: Tạo trong "Management > API Keys"

4. **Cấu hình environment variables**
   ```bash
   # functions/.env (Local Development - Chưa hoạt động, cần debug)
   ELASTICSEARCH_NODE=https://my-elasticsearch-project-cc2314.es.us-central1.gcp.elastic.cloud:443
   ELASTICSEARCH_API_KEY=RVRsQWpKb0JHVy00Q1FWcF9GRkg6ZWtfNEJqa0RWemUtdWRmcGRzME9ZQQ==
   NODE_ENV=production
   
   # Firebase Secrets (Production - Đã cấu hình)
   # ELASTICSEARCH_NODE (set via: firebase functions:secrets:set)
   # ELASTICSEARCH_API_KEY (set via: firebase functions:secrets:set)
   
   # ⚠️ KNOWN ISSUE: Elastic Serverless đang bị ConnectionError
   # Web vẫn hoạt động bình thường với Firestore search (fallback)
   # Cần kiểm tra lại API key permissions hoặc endpoint format
   ```

### Option 3: Manual Installation (Windows/Mac)

1. **Download Elasticsearch**
   - https://www.elastic.co/downloads/elasticsearch

2. **Extract và chạy**
   ```bash
   # Windows
   cd elasticsearch-8.11.0
   bin\elasticsearch.bat

   # Mac/Linux
   cd elasticsearch-8.11.0
   bin/elasticsearch
   ```

3. **Elasticsearch sẽ chạy trên http://localhost:9200**

## 🔧 Cấu hình Tech Haven

### 1. Cài đặt dependencies

```bash
cd functions
npm install @elastic/elasticsearch
```

### 2. Cấu hình connection (đã tích hợp sẵn)

File: `functions/elasticsearch-config.js`

**Local Development:**
```javascript
{
  node: 'http://localhost:9200',
  auth: {
    username: 'elastic',
    password: 'changeme'
  }
}
```

**Production (Elastic Cloud):**
```javascript
{
  cloud: {
    id: process.env.ELASTICSEARCH_CLOUD_ID
  },
  auth: {
    apiKey: process.env.ELASTICSEARCH_API_KEY
  }
}
```

## 📦 Khởi tạo và Sync dữ liệu

### 1. Start server

```bash
cd functions
npm start
```

### 2. Initialize Elasticsearch index

**Cách 1: Tự động khi start server** (đã được cấu hình)
- Index sẽ tự động được tạo khi server start

**Cách 2: Manual qua API**
```bash
curl -X POST http://localhost:3000/api/elasticsearch/init
```

### 3. Sync tất cả products từ Firestore

```bash
curl -X POST http://localhost:3000/api/elasticsearch/sync
```

**Response:**
```json
{
  "success": true,
  "totalProducts": 150,
  "successCount": 150,
  "failedCount": 0
}
```

### 4. Kiểm tra health

```bash
curl http://localhost:3000/api/elasticsearch/health
```

**Response:**
```json
{
  "connected": true,
  "status": "green",
  "cluster_name": "docker-cluster",
  "number_of_nodes": 1
}
```

## 🔍 Sử dụng Search API

### 1. Basic Search

```javascript
// Search products
fetch('/api/search?q=laptop')
  .then(res => res.json())
  .then(data => console.log(data));
```

**Response:**
```json
{
  "success": true,
  "hits": [...],
  "total": 25,
  "took": 15,
  "maxScore": 8.5,
  "facets": {
    "categories": [...],
    "brands": [...],
    "priceRanges": [...]
  }
}
```

### 2. Advanced Search với Filters

```javascript
fetch('/api/search?q=gaming&categories=Laptop&minPrice=10000000&maxPrice=30000000&inStock=true&sortBy=price&sortOrder=asc')
```

**Parameters:**
- `q`: Search query
- `categories`: Filter by categories (array)
- `brands`: Filter by brands (array)
- `minPrice`: Minimum price
- `maxPrice`: Maximum price
- `inStock`: Only in-stock products (true/false)
- `sortBy`: Sort field (_score, price, name, createdAt, popularity)
- `sortOrder`: Sort direction (asc/desc)
- `from`: Pagination start (default: 0)
- `size`: Results per page (default: 20)

### 3. Autocomplete Suggestions

```javascript
fetch('/api/search/autocomplete?q=lap&limit=10')
  .then(res => res.json())
  .then(data => {
    // data.suggestions contains top 10 matches
    console.log(data.suggestions);
  });
```

### 4. Similar Products

```javascript
fetch('/api/products/PRODUCT_ID/similar?limit=6')
  .then(res => res.json())
  .then(data => {
    // data.products contains similar products
    console.log(data.products);
  });
```

### 5. Popular Search Terms

```javascript
fetch('/api/search/popular?limit=10')
  .then(res => res.json())
  .then(data => {
    console.log('Popular categories:', data.categories);
    console.log('Popular brands:', data.brands);
  });
```

## 🔄 Real-time Sync

Hệ thống tự động sync khi có thay đổi trong Firestore:

- ✅ **Product Added**: Tự động index vào Elasticsearch
- ✅ **Product Updated**: Tự động update trong Elasticsearch
- ✅ **Product Deleted**: Tự động remove khỏi Elasticsearch

**Setup trong code (đã tích hợp):**
```javascript
// functions/index.js
setupFirestoreListeners();
```

## 🎯 Features đã tích hợp

### 1. Vietnamese Language Support
```javascript
analyzer: {
  vietnamese_analyzer: {
    type: 'custom',
    tokenizer: 'standard',
    filter: ['lowercase', 'asciifolding']
  }
}
```

### 2. Autocomplete với Edge N-grams
```javascript
autocomplete_filter: {
  type: 'edge_ngram',
  min_gram: 2,
  max_gram: 20
}
```

### 3. Fuzzy Search (Typo Tolerance)
```javascript
multi_match: {
  query: query,
  fuzziness: 'AUTO',  // Tự động fix lỗi chính tả
  prefix_length: 2
}
```

### 4. Field Boosting (Ưu tiên kết quả)
```javascript
fields: [
  'name^3',           // Name quan trọng nhất
  'name.autocomplete^2',
  'brand^2',
  'category.text^1.5',
  'description',
  'searchText'
]
```

### 5. Faceted Search
- Categories aggregation
- Brands aggregation
- Price ranges
- In-stock count
- Average price

### 6. Search Highlighting
```javascript
highlight: {
  fields: {
    name: {},
    description: {}
  },
  pre_tags: ['<mark>'],
  post_tags: ['</mark>']
}
```

## 📊 Performance

### Elasticsearch vs Firestore

| Feature | Firestore | Elasticsearch |
|---------|-----------|---------------|
| Full-text search | ❌ Basic | ✅ Advanced |
| Fuzzy matching | ❌ No | ✅ Yes |
| Typo tolerance | ❌ No | ✅ Yes |
| Autocomplete | ⚠️ Slow | ✅ Fast |
| Faceted search | ⚠️ Complex | ✅ Built-in |
| Search speed (1000 products) | ~500ms | ~15ms |
| Relevance ranking | ❌ No | ✅ Yes |

## 🔧 Troubleshooting

### 1. Elasticsearch not connecting

**Check if Elasticsearch is running:**
```bash
curl http://localhost:9200
```

**Check Docker container:**
```bash
docker ps
docker logs elasticsearch
```

### 2. Index not created

**Manual create:**
```bash
curl -X POST http://localhost:3000/api/elasticsearch/init
```

**Check logs:**
```bash
# Server logs sẽ hiển thị lỗi cụ thể
```

### 3. Products not syncing

**Manual sync:**
```bash
curl -X POST http://localhost:3000/api/elasticsearch/sync
```

**Check Firestore listeners:**
- Xem console logs có message "🎧 Firestore listeners active"

### 4. Search returns empty

**Verify index has data:**
```bash
curl http://localhost:9200/products/_count
```

**Re-sync data:**
```bash
curl -X POST http://localhost:3000/api/elasticsearch/sync
```

## 🚀 Production Deployment

### 1. Use Elastic Cloud

- Tạo account tại https://cloud.elastic.co
- Deploy cluster với appropriate size
- Enable security features
- Setup API keys

### 2. Environment Variables

```bash
# Firebase Functions config
firebase functions:config:set \
  elasticsearch.cloud_id="your-cloud-id" \
  elasticsearch.api_key="your-api-key"
```

### 3. Deploy

```bash
cd functions
npm run deploy
```

### 4. Monitor

- Check Elasticsearch logs
- Monitor search latency
- Track sync status

## 📚 Resources

- **Elasticsearch Documentation**: https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html
- **Node.js Client**: https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/index.html
- **Elastic Cloud**: https://cloud.elastic.co

## 🎓 Next Steps

1. ✅ Install Elasticsearch (Docker recommended)
2. ✅ Start server: `npm start`
3. ✅ Initialize index: Auto or POST `/api/elasticsearch/init`
4. ✅ Sync products: POST `/api/elasticsearch/sync`
5. ✅ Test search: GET `/api/search?q=laptop`
6. ✅ Monitor real-time sync in console logs

## 💡 Tips

- Elasticsearch sử dụng ~1GB RAM minimum
- Index creation chỉ cần 1 lần
- Sync tự động sau khi setup
- Search API tự động fallback về Firestore nếu Elasticsearch fail
- Sử dụng Docker để dễ dàng start/stop Elasticsearch

---

**Created by: Tech Haven Development Team**  
**Last Updated: November 16, 2025**

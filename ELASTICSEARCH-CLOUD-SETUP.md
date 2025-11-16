# 🔧 Hướng dẫn cấu hình ElasticSearch Cloud cho Firebase

## Bước 1: Tạo Elastic Cloud Account (MIỄN PHÍ 14 ngày)

### 1.1 Đăng ký tài khoản
1. Truy cập: **https://cloud.elastic.co/registration**
2. Điền thông tin:
   - Email
   - Password
   - Chọn region: **GCP Asia Pacific (Taiwan)** hoặc **Asia Pacific (Singapore)** (gần với Firebase asia-east1)
3. Click **Start free trial**

### 1.2 Tạo Deployment
1. Sau khi đăng nhập, click **Create deployment**
2. Cấu hình:
   - **Name**: `tech-haven-search`
   - **Cloud provider**: Google Cloud (GCP)
   - **Region**: asia-east1 hoặc asia-southeast1
   - **Version**: 8.11.0 hoặc mới nhất
   - **Hardware profile**: 
     - **Development** (1GB RAM) - Miễn phí 14 ngày, sau đó ~$16/tháng
     - Hoặc **Trial** (4GB RAM) - Miễn phí 14 ngày
3. Click **Create deployment**

### 1.3 Lưu thông tin quan trọng
Sau khi deployment được tạo, **QUAN TRỌNG - LƯU NGAY**:

#### Cloud ID
```
Ví dụ: tech-haven-search:YXNpYS1lYXN0MS5nY3AuY2xvdWQuZXMuaW8kYWJjZGVmZ2g=
```
- Copy từ **Deployment > Manage > Cloud ID**

#### API Key (Tạo mới)
1. Click **Management** > **Dev Tools** > **Console**
2. Chạy lệnh:
```json
POST /_security/api_key
{
  "name": "tech-haven-firebase",
  "role_descriptors": {
    "tech_haven_writer": {
      "cluster": ["all"],
      "indices": [
        {
          "names": ["products"],
          "privileges": ["all"]
        }
      ]
    }
  }
}
```
3. Lưu **encoded** key từ response:
```json
{
  "id": "abc123",
  "name": "tech-haven-firebase",
  "api_key": "xyz789",
  "encoded": "YWJjMTIzOnh5ejc4OQ==" // ← LƯU CÁI NÀY
}
```

## Bước 2: Cấu hình Firebase Functions Secrets

### 2.1 Cài đặt Firebase CLI (nếu chưa có)
```powershell
npm install -g firebase-tools
firebase login
```

### 2.2 Set secrets trên Firebase
```powershell
# Di chuyển vào thư mục project
cd "D:\Lập trình Node js"

# Set Cloud ID
firebase functions:secrets:set ELASTICSEARCH_CLOUD_ID
# Khi được hỏi, paste Cloud ID của bạn (ví dụ: tech-haven-search:YXNpYS1lYXN...)

# Set API Key
firebase functions:secrets:set ELASTICSEARCH_API_KEY
# Khi được hỏi, paste encoded API key (ví dụ: YWJjMTIzOnh5ejc4OQ==)
```

### 2.3 Cấp quyền truy cập secrets cho functions
```powershell
firebase functions:secrets:access ELASTICSEARCH_CLOUD_ID
firebase functions:secrets:access ELASTICSEARCH_API_KEY
```

## Bước 3: Cập nhật code để sử dụng secrets

File `functions/elasticsearch-config.js` đã được cấu hình sẵn để đọc từ secrets:
```javascript
const config = {
  cloud: {
    id: process.env.ELASTICSEARCH_CLOUD_ID,
    apiKey: process.env.ELASTICSEARCH_API_KEY
  }
};
```

## Bước 4: Deploy lên Firebase

```powershell
# Deploy functions với secrets
firebase deploy --only functions

# Hoặc deploy toàn bộ
firebase deploy
```

## Bước 5: Khởi tạo và Sync dữ liệu

### 5.1 Khởi tạo index
Mở trình duyệt:
```
https://tech-haven-5368b.web.app/api/elasticsearch/init
```
Response thành công:
```json
{
  "success": true,
  "message": "Products index created successfully"
}
```

### 5.2 Sync toàn bộ sản phẩm từ Firestore
```
https://tech-haven-5368b.web.app/api/elasticsearch/sync
```
Response:
```json
{
  "success": true,
  "message": "Synced 150 products to Elasticsearch"
}
```

### 5.3 Kiểm tra health
```
https://tech-haven-5368b.web.app/api/elasticsearch/health
```
Response:
```json
{
  "status": "healthy",
  "cluster": "tech-haven-search",
  "version": "8.11.0"
}
```

## Bước 6: Test search

### Test tìm kiếm cơ bản
```
https://tech-haven-5368b.web.app/api/search?q=laptop
```

### Test autocomplete
```
https://tech-haven-5368b.web.app/api/search/autocomplete?q=lap
```

### Test sản phẩm tương tự
```
https://tech-haven-5368b.web.app/api/products/PRODUCT_ID/similar
```

## Troubleshooting

### Lỗi: "Connection refused"
- Kiểm tra Cloud ID và API Key đã đúng chưa
- Kiểm tra deployment còn active không tại https://cloud.elastic.co/deployments

### Lỗi: "Authentication failed"
- API Key có thể đã expire, tạo lại API key mới
- Đảm bảo dùng **encoded** key, không phải id + api_key riêng lẻ

### Lỗi: "Index not found"
- Chạy lại `/api/elasticsearch/init` để tạo index

### Kiểm tra logs
```powershell
# Xem logs của functions
firebase functions:log --only app

# Xem logs realtime
firebase functions:log --only app --follow
```

## Alternative: Sử dụng Local ElasticSearch (Development)

Nếu muốn test local trước khi deploy:

### Dùng Docker
```powershell
docker run -d --name elasticsearch -p 9200:9200 -e "discovery.type=single-node" -e "xpack.security.enabled=false" elasticsearch:8.11.0
```

### Cập nhật .env local
```env
# functions/.env
ELASTICSEARCH_NODE=http://localhost:9200
NODE_ENV=development
```

### Test local
```powershell
cd functions
npm run dev
# Mở http://localhost:5001/api/elasticsearch/health
```

## Chi phí ước tính

### Elastic Cloud
- **Free Trial**: 14 ngày miễn phí
- **Standard (1GB)**: ~$16/tháng (~400,000 VNĐ)
- **Standard (4GB)**: ~$95/tháng (~2,400,000 VNĐ)
- **Tip**: Dùng 1GB đủ cho ~10,000 sản phẩm

### Firebase Functions
- **Free tier**: 2 triệu invocations/tháng
- **Paid**: $0.40/triệu invocations
- Với ElasticSearch, mỗi search = 1 invocation

### Giảm chi phí
1. **Tắt ElasticSearch ngoài giờ cao điểm**:
   - Elastic Cloud cho phép pause deployment
   
2. **Dùng Firestore search cho traffic thấp**:
   ```javascript
   // elasticsearch-config.js
   const ELASTICSEARCH_ENABLED = process.env.NODE_ENV === 'production';
   ```

3. **Cache kết quả search**:
   - Sử dụng Firebase Hosting CDN
   - Cache popular searches

## Monitoring và Optimization

### Xem metrics trên Elastic Cloud
1. Truy cập https://cloud.elastic.co/deployments
2. Click vào deployment > **Performance**
3. Theo dõi:
   - Search latency
   - Document count
   - Storage usage

### Optimize index
```
https://tech-haven-5368b.web.app/api/elasticsearch/optimize
```

## Bảo mật

### Tốt nhất:
✅ Dùng Firebase Secrets (đã setup)
✅ API Key có quyền giới hạn (chỉ products index)
✅ HTTPS endpoints

### Tránh:
❌ Hardcode API key trong code
❌ Commit secrets vào git
❌ Dùng superuser API key

## Liên hệ hỗ trợ

- **Elastic Support**: https://www.elastic.co/support
- **Firebase Support**: https://firebase.google.com/support
- **Documentation**: 
  - Elastic Cloud: https://www.elastic.co/guide/en/cloud/current/
  - Firebase Functions: https://firebase.google.com/docs/functions

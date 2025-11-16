# 🚀 Firebase Production Deployment - ElasticSearch Setup

## Bước 1: Cấu hình ElasticSearch Cloud (Khuyến nghị)

### Tạo Elastic Cloud Account
1. Truy cập: https://cloud.elastic.co/registration
2. Tạo deployment mới (chọn region gần với Firebase Functions - asia-east1)
3. Lưu **Cloud ID** và **API Key**

### Deploy ElasticSearch Configuration
```powershell
# Set environment variables trên Firebase
firebase functions:secrets:set ELASTICSEARCH_CLOUD_ID
# Paste your Cloud ID khi được hỏi

firebase functions:secrets:set ELASTICSEARCH_API_KEY
# Paste your API Key khi được hỏi
```

## Bước 2: Deploy Firebase Functions

```powershell
# Deploy functions với environment variables
firebase deploy --only functions
```

## Bước 3: Khởi tạo ElasticSearch Index

Sau khi deploy, truy cập:
```
https://tech-haven-5368b.web.app/api/elasticsearch/init
```

## Bước 4: Sync dữ liệu từ Firestore

```
https://tech-haven-5368b.web.app/api/elasticsearch/sync
```

## Bước 5: Kiểm tra hoạt động

```
https://tech-haven-5368b.web.app/api/elasticsearch/health
https://tech-haven-5368b.web.app/api/search?q=laptop
```

## Alternative: Tắt ElasticSearch tạm thời

Nếu chưa muốn setup ElasticSearch ngay, web vẫn hoạt động bình thường với Firestore search:

```javascript
// functions/elasticsearch-config.js
const ELASTICSEARCH_ENABLED = false; // Đổi thành false
```

Search sẽ tự động fallback về Firestore.

## Monitoring

- **Firebase Console**: https://console.firebase.google.com
- **Elastic Cloud Console**: https://cloud.elastic.co/deployments
- **Logs**: `firebase functions:log --only app`

## Cost Estimation

- **Elastic Cloud**: ~$16/month (Standard tier, 1GB RAM)
- **Firebase Functions**: Pay-as-you-go (có free tier)
- **Alternative**: Tắt ElasticSearch, chỉ dùng Firestore (miễn phí trong free tier)

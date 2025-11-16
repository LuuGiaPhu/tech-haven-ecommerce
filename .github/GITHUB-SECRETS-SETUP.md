# 🔐 GitHub Secrets Setup Instructions

## ✅ Service Account Key đã được tạo!

File: `firebase-admin-github-actions-key.json`

---

## 📋 BƯỚC TIẾP THEO - Copy Service Account vào GitHub:

### **Bước 1: Copy nội dung file JSON**

File đã được tạo tại: `d:\Lập trình Node js\firebase-admin-github-actions-key.json`

Nội dung file này chứa credentials để GitHub Actions có thể deploy lên Firebase.

### **Bước 2: Thêm vào GitHub Repository Secrets**

1. **Truy cập GitHub repository của bạn**
   - URL: `https://github.com/[your-username]/[your-repo]/settings/secrets/actions`
   
2. **Click "New repository secret"**

3. **Thêm secret:**
   - **Name**: `FIREBASE_SERVICE_ACCOUNT_TECH_HAVEN_5368B`
   - **Value**: Copy toàn bộ nội dung file `firebase-admin-github-actions-key.json`
     ```json
     {
       "type": "service_account",
       "project_id": "tech-haven-5368b",
       "private_key_id": "...",
       "private_key": "-----BEGIN PRIVATE KEY-----\n...",
       "client_email": "firebase-admin@tech-haven-5368b.iam.gserviceaccount.com",
       ...
     }
     ```

4. **Click "Add secret"**

---

## 🔧 (Optional) Thêm Elasticsearch Secrets:

Nếu bạn sử dụng Elasticsearch, thêm 2 secrets nữa:

### **ELASTICSEARCH_NODE:**
- **Name**: `ELASTICSEARCH_NODE`
- **Value**: `https://my-elasticsearch-project-cc2314.es.us-central1.gcp.elastic.cloud:443`

### **ELASTICSEARCH_API_KEY:**
- **Name**: `ELASTICSEARCH_API_KEY`
- **Value**: `RXpsWGpKb0JHVy00Q1FWcERGR0E6MktzSW1CejVXcDV5eUJvazIyOVExdw==`

---

## 🚀 Test CI/CD:

Sau khi thêm secrets, test deployment:

```bash
git add .
git commit -m "feat: setup CI/CD with GitHub Actions"
git push origin main
```

Xem kết quả tại: `https://github.com/[your-repo]/actions`

---

## 🔒 Security Notes:

⚠️ **QUAN TRỌNG:**
- ❌ **KHÔNG** commit file `firebase-admin-github-actions-key.json` lên GitHub
- ✅ File này đã được thêm vào `.gitignore`
- ✅ Chỉ lưu trong GitHub Secrets (encrypted)
- ✅ Có thể xóa file local sau khi đã copy vào GitHub

---

## ✅ Checklist:

- [x] ✅ Firebase login thành công
- [x] ✅ Service account key đã được tạo
- [ ] ⏳ Copy service account vào GitHub Secrets
- [ ] ⏳ Test deployment với `git push`

**Next Step**: Thêm service account vào GitHub Secrets theo hướng dẫn trên!

# 🧪 HƯỚNG DẪN TEST TÍNH NĂNG TRỪ COIN KHI TRẢ HÀNG

## ✅ TRIGGER ĐÃ DEPLOY THÀNH CÔNG!
```
✅ onBillReturned trigger deployed to Firebase
✅ Location: us-central1
✅ Status: Active
✅ Logic: Deduct 10% of order amount (coins EARNED, not coins USED)
```

## 🎯 NGUYÊN LÝ HOẠT ĐỘNG

**Khi hoàn thành đơn hàng:**
- Hệ thống cộng **10% giá trị đơn hàng** vào coin
- VD: Đơn hàng 4,489,900 VND → Cộng 448,990 coin

**Khi trả hàng:**
- Hệ thống trừ **ĐÚNG SỐ COIN ĐÃ CỘNG** (10% giá trị đơn hàng)
- VD: Đơn hàng 4,489,900 VND → Trừ 448,990 coin
- **KHÔNG trừ `coinUsed`** (số coin khách dùng để thanh toán)

**Ví dụ cụ thể với bill mẫu:**
```javascript
{
  billId: "n5ZWrSzyZNZMvLDxrVb5",
  totalAmount: 4489900,      // Giá trị đơn hàng
  coinUsed: 100,             // Coin đã dùng để thanh toán
  status: "completed"
}

// Khi complete:
coinEarned = Math.floor(4489900 * 0.10) = 448,990 coin ✅

// Khi return:
coinDeducted = Math.floor(4489900 * 0.10) = 448,990 coin ✅
// KHÔNG phải 100 coin (coinUsed) ❌
```

---

## 🎯 TEST NHANH QUA FIREBASE CONSOLE (5 PHÚT)

### **Bước 1: Mở Firebase Console**
1. Vào: https://console.firebase.google.com/project/tech-haven-5368b/firestore
2. Đăng nhập với tài khoản Google của bạn

### **Bước 2: Tìm Đơn Hàng Test**
1. Click vào collection **`bills`**
2. Tìm một đơn hàng có:
   - ✅ `status: "completed"`
   - ✅ `totalAmount` > 0 (ví dụ: 4489900)
   - ✅ `userId` (note lại ID này)
3. Click vào document đó, copy `billId` (ví dụ: `n5ZWrSzyZNZMvLDxrVb5`)
4. **TÍNH TOÁN SỐ COIN SẼ BỊ TRỪ:**
   ```
   coinDeducted = Math.floor(totalAmount * 0.10)
   
   Ví dụ: totalAmount = 4,489,900 VND
   → coinDeducted = 448,990 coin
   ```

### **Bước 3: Kiểm Tra Coin Hiện Tại**
1. Vào collection **`users`**
2. Tìm user có `uid` = `userId` ở bước 2
3. Xem field **`coin`** hiện tại (ví dụ: `500000`)
4. **TÍNH TOÁN KẾT QUẢ MONG ĐỢI:**
   ```
   Coin hiện tại: 500,000
   Coin sẽ trừ: 448,990 (10% của 4,489,900)
   Coin sau khi trừ: 500,000 - 448,990 = 51,010
   ```
5. **Note lại số này để so sánh!**

### **Bước 4: THỰC HIỆN TRẢ HÀNG**
1. Quay lại document của bill ở bước 2
2. Click nút **"Edit"** (biểu tượng bút chì)
3. Tìm field **`status`**
4. Sửa giá trị từ `"completed"` → `"returned"`
5. (Tùy chọn) Thêm field mới:
   - Field name: `returnedAt`
   - Field type: `timestamp`
   - Value: Chọn **"Add server timestamp"**
6. Click **"Update"** để lưu

### **Bước 5: XEM KẾT QUẢ**

#### **5.1. Kiểm tra Logs (Realtime)**
1. Vào: https://console.firebase.google.com/project/tech-haven-5368b/functions/logs
2. Chờ 2-3 giây
3. Tìm log mới nhất của `onBillReturned`:
   ```
   ↩️ Bill n5ZWrSzyZNZMvLDxrVb5 returned! Auto-deducting coin...
   💰 This order earned 448,990 coins when completed (10% of 4,489,900 VND)
   💸 Coin deducted for user 6PIw3wlh6UVsoUiSut9nCJixMMz2: 500,000 → 51,010 (-448,990 coin)
   ```

#### **5.2. Xác Nhận Coin Đã Giảm**
1. Quay lại collection **`users`**
2. Tìm user đó
3. Xem field **`coin`**:
   - **Trước:** `500000`
   - **Sau:** `51010` ✅
   - **Chênh lệch:** `-448990` (đúng bằng 10% của totalAmount)

#### **5.3. Kiểm Tra Transaction Log**
1. Vào collection **`coin_transactions`**
2. Sắp xếp theo `timestamp` (mới nhất trên đầu)
3. Tìm document vừa tạo:
   ```javascript
   {
     userId: "6PIw3wlh6UVsoUiSut9nCJixMMz2",
     type: "deduct_return",
     amount: 448990,
     orderId: "n5ZWrSzyZNZMvLDxrVb5",
     balanceBefore: 500000,
     balanceAfter: 51010,
     timestamp: "2025-01-19 10:30:00",
     description: "Deducted 448,990 coins earned from returned order #n5ZWrSzyZNZMvLDxrVb5 (10% of 4,489,900 VND)"
   }
   ```

---

## 🧪 TEST TRƯỜNG HỢP ĐẶC BIỆT

### **Test 1: Coin Âm (User Không Đủ Coin)**
```
Điều kiện:
- User có: 100,000 coin
- Đơn hàng: totalAmount = 4,489,900 VND
- Coin sẽ trừ: 448,990 coin (10% của 4,489,900)

Kết quả mong đợi:
- Coin sau: -348,990 ✅ (ÂM)
- Log: "100,000 → -348,990 (-448,990 coin)"
```

**Các bước test:**
1. Tìm user có coin < 448,990
2. Hoặc tạm thời giảm coin của user xuống (edit field `coin`)
3. Thực hiện trả hàng như hướng dẫn trên
4. Xác nhận coin âm trong `users` collection

### **Test 2: Đơn Hàng Giá Trị Thấp**
```
Điều kiện:
- User có: 500,000 coin
- Đơn hàng: totalAmount = 100,000 VND
- Coin sẽ trừ: 10,000 coin (10% của 100,000)

Kết quả mong đợi:
- Coin còn: 490,000 ✅
- Log: "500,000 → 490,000 (-10,000 coin)"
```

### **Test 3: Trigger Không Chạy 2 Lần**
```
Điều kiện:
- Đơn hàng đã có status = "returned"
- Sửa lại status = "returned" (giữ nguyên)

Kết quả mong đợi:
- Trigger KHÔNG chạy
- Coin KHÔNG thay đổi
- Không có log mới
```

---

## 📊 CHECKLIST KẾT QUẢ

Sau khi test, kiểm tra:

- [ ] ✅ Trigger `onBillReturned` chạy thành công (có log)
- [ ] ✅ Coin của user giảm đúng số `coinUsed`
- [ ] ✅ Transaction log được tạo trong `coin_transactions`
- [ ] ✅ Field `coinDeducted` được thêm vào bill document
- [ ] ✅ Coin có thể âm nếu user không đủ
- [ ] ✅ Trigger không chạy nếu `coinUsed = 0`
- [ ] ✅ Trigger chỉ chạy 1 lần khi status thay đổi

---

## 🚨 TROUBLESHOOTING

### **Vấn đề 1: Trigger không chạy**
**Triệu chứng:** Không thấy log trong Functions → Logs

**Giải pháp:**
1. Kiểm tra status có thay đổi: `beforeData.status !== 'returned'`
2. Chờ 5-10 giây cho trigger kích hoạt
3. Refresh trang Logs
4. Kiểm tra trigger đã deploy: `firebase deploy --only functions:onBillReturned`

### **Vấn đề 2: Coin không giảm**
**Triệu chứng:** Có log nhưng coin không đổi

**Giải pháp:**
1. Kiểm tra `coinUsed` trong bill có > 0 không
2. Xem log có message: `"No coins were used..."`
3. Kiểm tra userId có khớp với user collection không
4. Refresh lại trang Firestore

### **Vấn đề 3: Lỗi Permission**
**Triệu chứng:** Log error: "Permission denied"

**Giải pháp:**
1. Trigger chạy với quyền admin, không cần permission
2. Nếu vẫn lỗi, check Firestore Rules
3. Hoặc deploy lại trigger

---

## 🎬 VIDEO DEMO (Text Version)

```
[00:00] Mở Firebase Console → Firestore
[00:10] Click collection "bills"
[00:15] Tìm bill có status="completed", coinUsed=100000
[00:25] Copy userId, vào collection "users"
[00:30] Xem user có coin=150000
[00:40] Quay lại bill, click Edit
[00:45] Sửa status thành "returned"
[00:50] Click Update
[00:55] Vào Functions → Logs
[01:00] Thấy log: "💸 Coin deducted: 150,000 → 50,000"
[01:10] Quay lại users, refresh
[01:15] Xác nhận coin=50000 ✅
[01:20] Vào coin_transactions
[01:25] Thấy transaction log mới ✅
[01:30] DONE! ✅
```

---

## 📞 LƯU Ý

1. **Trigger vs API:**
   - Trigger: Tự động chạy khi status thay đổi (AN TOÀN HỠN)
   - API: Chỉ chạy khi user bấm nút trên web
   - **Cả 2 đều trừ coin**, nhưng trigger đảm bảo không bỏ sót

2. **Deploy Production:**
   ```powershell
   firebase deploy --only functions:onBillReturned
   ```

3. **Monitor Logs:**
   - https://console.firebase.google.com/project/tech-haven-5368b/functions/logs
   - Xem realtime mỗi lần trigger chạy

4. **Audit Trail:**
   - Tất cả transaction đều log vào `coin_transactions`
   - Có thể truy vết lại lịch sử đầy đủ

---

## ✅ KẾT LUẬN

**Tính năng đã sẵn sàng sử dụng!**

- ✅ Trigger deployed to Firebase
- ✅ API endpoint updated
- ✅ Frontend enhanced with coin info
- ✅ Transaction logging enabled
- ✅ Negative balance supported

**Test ngay qua Firebase Console để xem kết quả!** 🚀

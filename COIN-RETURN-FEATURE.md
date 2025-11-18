# 💸 Tính Năng Trừ Coin Khi Trả Hàng

## 📋 Tổng Quan
Khi khách hàng trả hàng, hệ thống sẽ tự động **trừ lại số coin đã cộng** khi đơn hàng hoàn thành. 

**NGUYÊN LÝ:**
- Khi hoàn thành đơn hàng: Cộng **10% giá trị đơn hàng**
- Khi trả hàng: Trừ **10% giá trị đơn hàng** (ĐÚNG SỐ ĐÃ CỘNG)
- Số coin có thể **âm** nếu người dùng không đủ số dư

**VÍ DỤ:**
```
Đơn hàng: 4,489,900 VND

✅ Hoàn thành → Cộng: 448,990 coin (10%)
↩️ Trả hàng → Trừ: 448,990 coin (10%)

KHÔNG trừ coinUsed (coin khách dùng để thanh toán) ❌
```

## 🎯 Tính Năng Đã Thêm

### 1. **API Endpoint** (`/api/bills/:billId/return`)
- ✅ Tính coin đã cộng khi complete: `coinEarned = Math.floor(totalAmount * 0.10)`
- ✅ Trừ đúng số coin đã cộng (không phải `coinUsed`)
- ✅ Trừ coin từ tài khoản người dùng (có thể âm)
- ✅ Lưu transaction log vào `coin_transactions` collection
- ✅ Trả về thông tin chi tiết về việc trừ coin trong response

**Ví dụ Response:**
```json
{
  "success": true,
  "message": "Đã xử lý trả hàng thành công! Số lượng sản phẩm đã được hoàn về kho. Đã trừ 448,990 coin. Số dư coin mới: 51,010.",
  "billId": "n5ZWrSzyZNZMvLDxrVb5",
  "coinDeducted": 448990,
  "newCoinBalance": 51010,
  "previousCoinBalance": 500000
}
```

### 2. **Firebase Trigger** (`onBillReturned`)
- ✅ Tự động chạy khi status đơn hàng chuyển sang `"returned"`
- ✅ Không cần bấm nút trên web, có thể test trực tiếp qua Firebase Console
- ✅ Tự động trừ coin và log transaction

**Cách hoạt động:**
```javascript
// Trigger tự động chạy khi:
beforeData.status !== 'returned' && afterData.status === 'returned'

// Thực hiện:
1. Lấy totalAmount từ đơn hàng
2. Tính coinEarned = Math.floor(totalAmount * 0.10)
3. Lấy số dư coin hiện tại của user
4. Tính newCoinBalance = currentCoin - coinEarned (có thể âm)
5. Cập nhật coin cho user
6. Log transaction vào coin_transactions
```

### 3. **Frontend Enhancement** (`bill_detail.js`)
- ✅ Hiển thị thông báo chi tiết về việc trừ coin
- ✅ Cảnh báo khi số dư coin âm
- ✅ Hiển thị số dư trước và sau khi trừ

**Thông báo mẫu:**
```
✅ Đã xử lý trả hàng thành công! Số lượng sản phẩm đã được hoàn về kho. 
Đã trừ 448,990 coin. Số dư coin mới: 51,010.

💰 Thông tin coin:
• Coin đã trừ: 448,990 (10% của 4,489,900 VND)
• Số dư trước: 500,000
• Số dư sau: 51,010
```

## 🧪 Hướng Dẫn Test

### **Cách 1: Test Qua Firebase Console** (KHUYẾN NGHỊ)

1. **Mở Firebase Console:**
   - Vào https://console.firebase.google.com/
   - Chọn project `tech-haven-5368b`
   - Vào **Firestore Database**

2. **Tìm đơn hàng cần test:**
   - Vào collection `bills`
   - Chọn một đơn hàng có:
     - `status: "completed"`
     - `totalAmount: 4489900` (ví dụ)
   - Lưu ý `billId` và `userId`
   - **TÍNH TOÁN:** `coinDeducted = Math.floor(4489900 * 0.10) = 448,990`

3. **Kiểm tra coin hiện tại:**
   - Vào collection `users`
   - Tìm user có `userId` tương ứng
   - Xem field `coin` hiện tại (ví dụ: 500000)
   - **TÍNH KẾT QUẢ:** `newCoin = 500000 - 448990 = 51,010`

4. **Thực hiện trả hàng:**
   - Quay lại document của bill
   - Sửa field `status` từ `"completed"` → `"returned"`
   - Thêm field `returnedAt`: (chọn Server timestamp)
   - **Save**

5. **Xác nhận kết quả:**
   - Vào **Functions** → **Logs**
   - Xem log của trigger `onBillReturned`:
     ```
     ↩️ Bill n5ZWrSzyZNZMvLDxrVb5 returned! Auto-deducting coin...
     💰 This order earned 448,990 coins when completed (10% of 4,489,900 VND)
     💸 Coin deducted for user YYY: 500,000 → 51,010 (-448,990 coin)
     ```
   - Quay lại `users` collection
   - Xác nhận `coin` đã giảm: `500000` → `51010` ✅

6. **Kiểm tra transaction log:**
   - Vào collection `coin_transactions`
   - Tìm document mới nhất với:
     - `userId`: user vừa test
     - `type: "deduct_return"`
     - `amount`: 448990
     - `balanceBefore`: 500000
     - `balanceAfter`: 51010
     - `description`: "Deducted 448,990 coins earned from returned order #n5ZWrSzyZNZMvLDxrVb5 (10% of 4,489,900 VND)"

### **Cách 2: Test Qua Web**

1. **Đăng nhập tài khoản có đơn hàng completed:**
   - Vào https://tech-haven-5368b.web.app/
   - Đăng nhập

2. **Vào trang lịch sử đơn hàng:**
   - Click vào user icon → Bill Detail
   - Hoặc vào `/bill_detail`

3. **Tìm đơn hàng completed:**
   - Tìm đơn hàng có status "Hoàn Thành"
   - Đã quá 0-7 ngày kể từ khi nhận hàng

4. **Bấm nút trả hàng:**
   - Click vào đơn hàng để xem chi tiết
   - Bấm nút **"Trả Hàng (7 ngày)"**
   - Điền thông tin ngân hàng:
     - Số tài khoản: `1234567890`
     - Tên chủ tài khoản: `NGUYEN VAN A`
     - Ngân hàng: Chọn ngân hàng bất kỳ
     - Lý do: `Test coin deduction`
   - Bấm **"Xác Nhận Trả Hàng"**

5. **Kiểm tra thông báo:**
   - Sẽ xuất hiện alert với thông tin chi tiết:
     ```
     ✅ Đã xử lý trả hàng thành công!
     
     💰 Thông tin coin:
     • Coin đã sử dụng: 100,000
     • Số dư trước: 50,000
     • Số dư sau: -50,000
     
     ⚠️ Lưu ý: Số dư coin hiện tại âm...
     ```

6. **Kiểm tra số dư coin:**
   - Vào user profile
   - Xem số dư coin đã giảm ✅

## 📊 Database Collections

### **Collection: `coin_transactions`**
Mỗi lần trừ coin sẽ tạo 1 document:

```javascript
{
  userId: "abc123",
  type: "deduct_return",           // Loại: trừ coin do trả hàng
  amount: 448990,                   // Số coin đã trừ (10% giá trị đơn)
  orderId: "n5ZWrSzyZNZMvLDxrVb5", // ID đơn hàng
  balanceBefore: 500000,            // Số dư trước khi trừ
  balanceAfter: 51010,              // Số dư sau khi trừ (có thể âm)
  timestamp: Timestamp,
  description: "Deducted 448,990 coins earned from returned order #n5ZWrSzyZNZMvLDxrVb5 (10% of 4,489,900 VND)"
}
```

### **Collection: `users`**
Field `coin` sẽ được cập nhật:

```javascript
{
  uid: "abc123",
  email: "user@example.com",
  coin: 51010,  // Số dư sau khi trừ (có thể âm)
  // ... other fields
}
```

### **Collection: `bills`**
Field mới khi trả hàng:

```javascript
{
  billId: "n5ZWrSzyZNZMvLDxrVb5",
  status: "returned",
  totalAmount: 4489900,   // Giá trị đơn hàng
  coinUsed: 100,          // Coin khách dùng để thanh toán
  coinDeducted: 448990,   // Coin đã trừ = 10% totalAmount
  returnedAt: Timestamp,
  returnReason: "...",
  // ... other fields
}
```

## 🔧 Deploy Firebase Trigger

Để trigger hoạt động trên production, cần deploy:

```powershell
cd "d:\Lập trình Node js\functions"
firebase deploy --only functions:onBillReturned
```

**Hoặc deploy tất cả:**
```powershell
firebase deploy --only functions
```

## ⚠️ Lưu Ý Quan Trọng

1. **Coin có thể âm:**
   - Người dùng có 100k coin, đơn hàng 4.49M → trừ 449k coin → coin = -349k ✅
   - Không block việc trả hàng nếu không đủ coin

2. **Trừ đúng số coin đã cộng:**
   - Cộng khi complete: `Math.floor(totalAmount * 0.10)`
   - Trừ khi return: `Math.floor(totalAmount * 0.10)`
   - **KHÔNG dùng `coinUsed`** (số coin khách dùng để thanh toán)

3. **Transaction log:**
   - Mọi thay đổi coin đều được log vào `coin_transactions`
   - Có thể audit lại toàn bộ lịch sử

4. **Trigger vs API:**
   - API: Chạy khi user bấm nút trên web
   - Trigger: Chạy tự động khi status thay đổi trong Firebase
   - **Cả 2 đều thực hiện trừ coin**, nhưng trigger an toàn hơn

## 🎬 Test Scenario

### **Scenario 1: User đủ coin**
```
1. User có: 500,000 coin
2. Đơn hàng: 4,489,900 VND
3. Coin đã cộng khi complete: 448,990 coin
4. Trả hàng → Trừ: 448,990 coin
5. Coin còn: 51,010 ✅
```

### **Scenario 2: User không đủ coin**
```
1. User có: 100,000 coin
2. Đơn hàng: 4,489,900 VND
3. Coin đã cộng khi complete: 448,990 coin
4. Trả hàng → Trừ: 448,990 coin
5. Coin còn: -348,990 ✅ (ÂM)
6. Cảnh báo: "Số dư coin hiện tại âm..."
```

### **Scenario 3: Đơn hàng giá trị thấp**
```
1. User có: 500,000 coin
2. Đơn hàng: 100,000 VND
3. Coin đã cộng khi complete: 10,000 coin
4. Trả hàng → Trừ: 10,000 coin
5. Coin còn: 490,000 ✅
```

## 📝 Code Changes Summary

### **Files Modified:**
1. ✅ `functions/index.js` (Backend)
   - Updated `/api/bills/:billId/return` endpoint
   - Added `onBillReturned` Firebase trigger

2. ✅ `public/js/bill_detail.js` (Frontend)
   - Updated `returnOrder()` function
   - Enhanced success message with coin info

3. ✅ `functions/public/js/bill_detail.js` (Deployed)
   - Synced with public version

## 🚀 Next Steps

1. **Deploy trigger:**
   ```powershell
   firebase deploy --only functions:onBillReturned
   ```

2. **Test trực tiếp qua Firebase Console:**
   - Đơn giản hơn, không cần web
   - Xem logs realtime
   - Dễ debug

3. **Monitor logs:**
   - Firebase Console → Functions → Logs
   - Xem trigger có chạy thành công không

4. **Check coin_transactions:**
   - Xem lịch sử transaction
   - Audit toàn bộ thay đổi coin

---

## 🎯 Test Nhanh Qua Firebase Console

**5 bước đơn giản:**

1. Firestore → `bills` → Chọn bill có `status: "completed"` và `coinUsed > 0`
2. Note `userId` và `coinUsed` (ví dụ: 100000)
3. Firestore → `users` → Tìm user → Xem `coin` hiện tại (ví dụ: 50000)
4. Quay lại bill → Sửa `status` thành `"returned"` → Save
5. Functions → Logs → Xem log: `💸 Coin deducted: 50,000 → -50,000 (-100,000 coin)` ✅

**Xong! Coin đã được trừ tự động!** 🎉

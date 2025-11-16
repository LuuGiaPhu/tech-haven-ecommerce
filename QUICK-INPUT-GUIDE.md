# 📝 HƯỚNG DẪN SỬ DỤNG QUICK-INPUT

## 🎯 Mục Đích
Trang Quick-Input cho phép thêm hàng loạt sản phẩm vào database một cách nhanh chóng bằng cách nhập dữ liệu theo định dạng CSV (các trường cách nhau bởi dấu chấm phẩy `;`)

---

## 📋 ĐỊNH DẠNG CHO SẢN PHẨM CHÍNH (Main Product)

### Cấu Trúc:
```
Tên;Danh mục;Thương hiệu;Giá;Giá cũ;Tồn kho;Trạng thái;Mô tả;Specs;Features
```

### Chi Tiết Từng Trường:

| STT | Trường | Bắt buộc | Giá trị hợp lệ | Ví dụ |
|-----|--------|----------|----------------|-------|
| 1 | **Tên** | ✅ Có | Bất kỳ text | `ASUS ROG Strix G15` |
| 2 | **Danh mục** | ✅ Có | laptop, pc, gpu, cpu, ram, storage, motherboard, psu, case, keyboard, mouse, headset, monitor, speaker, webcam, other | `laptop` |
| 3 | **Thương hiệu** | ✅ Có | Bất kỳ text | `ASUS` |
| 4 | **Giá** | ✅ Có | Số nguyên dương | `25990000` |
| 5 | **Giá cũ** | ❌ Không | Số nguyên (để trống nếu không có) | `28990000` hoặc `` |
| 6 | **Tồn kho** | ✅ Có | Số nguyên >= 0 | `50` |
| 7 | **Trạng thái** | ✅ Có | in-stock, out-of-stock, pre-order | `in-stock` |
| 8 | **Mô tả** | ❌ Không | Bất kỳ text | `Laptop gaming cao cấp với RTX 3060` |
| 9 | **Specs** | ❌ Không | `key:value\|key:value` | `CPU:Intel i7\|RAM:16GB\|GPU:RTX 3060` |
| 10 | **Features** | ❌ Không | `title:desc:icon\|title:desc:icon` | `Gaming:High FPS Gaming:fas fa-gamepad` |

### Lưu Ý Specs & Features:
- **Specs**: Các thông số kỹ thuật, cách nhau bởi `|`, mỗi thông số có dạng `tên:giá_trị`
- **Features**: Các tính năng nổi bật, cách nhau bởi `|`, mỗi feature có dạng `tiêu_đề:mô_tả:icon`
- Icon sử dụng Font Awesome (VD: `fas fa-gamepad`, `fas fa-tv`, `fas fa-bolt`)

---

## 🔄 ĐỊNH DẠNG CHO SẢN PHẨM BIẾN THỂ (Variant Product)

### Cấu Trúc:
```
[VARIANT];SKU_Chính;Tên_biến_thể;Giá;Giá_cũ;Tồn_kho;Trạng_thái;Attributes
```

### Chi Tiết Từng Trường:

| STT | Trường | Bắt buộc | Giá trị hợp lệ | Ví dụ |
|-----|--------|----------|----------------|-------|
| 1 | **[VARIANT]** | ✅ Có | Phải là `[VARIANT]` | `[VARIANT]` |
| 2 | **SKU_Chính** | ✅ Có | SKU của sản phẩm chính HOẶC `[SKU_VỪA_TẠO]` | `ASU-AsusRogStrixG1-2891` hoặc `[SKU_VỪA_TẠO]` |
| 3 | **Tên biến thể** | ✅ Có | Bất kỳ text | `ASUS ROG Strix G15 - Màu Đen` |
| 4 | **Giá** | ✅ Có | Số nguyên dương | `24990000` |
| 5 | **Giá cũ** | ❌ Không | Số nguyên | `28990000` hoặc `` |
| 6 | **Tồn kho** | ✅ Có | Số nguyên >= 0 | `25` |
| 7 | **Trạng thái** | ✅ Có | in-stock, out-of-stock, pre-order | `in-stock` |
| 8 | **Attributes** | ✅ Có | `key:value\|key:value` | `color:Black\|size:15.6 inch` |

### Lưu Ý Quan Trọng:
- ⚠️ **Phải thêm sản phẩm chính TRƯỚC** rồi mới thêm biến thể
- 💡 **Sử dụng `[SKU_VỪA_TẠO]`** khi thêm biến thể ngay sau sản phẩm chính (không cần biết SKU trước)
- Biến thể sẽ **kế thừa** từ sản phẩm chính: category, brand, description, specifications, features, images
- SKU biến thể tự động tạo theo định dạng: `SKU_Chính-V1`, `SKU_Chính-V2`, ...
- Attributes dùng để phân biệt các biến thể (màu sắc, kích thước, RAM, ...)

---

## � TÍNH NĂNG ĐẶC BIỆT: [SKU_VỪA_TẠO]

### Công Dụng:
Khi thêm biến thể **NGAY SAU** sản phẩm chính, bạn có thể dùng `[SKU_VỪA_TẠO]` thay vì phải nhập SKU thực tế. Hệ thống sẽ tự động tham chiếu đến SKU của sản phẩm chính vừa được tạo ở dòng trước đó.

### Lợi Ích:
- ✅ **Không cần biết SKU trước**: SKU được tạo tự động, không cần đợi kết quả
- ✅ **Nhanh hơn**: Không cần copy-paste SKU giữa các dòng
- ✅ **Ít lỗi hơn**: Không lo gõ sai SKU
- ✅ **Dễ đọc hơn**: Code rõ ràng, dễ hiểu

### Ví Dụ So Sánh:

**❌ CÁCH CŨ** (phải biết SKU trước):
```
ASUS ROG Strix G15;laptop;ASUS;25990000;28990000;50;in-stock;Laptop gaming...
[VARIANT];ASU-AsusRogStrixG1-2891;ASUS ROG - Black;25990000;;25;in-stock;color:Black
[VARIANT];ASU-AsusRogStrixG1-2891;ASUS ROG - White;25990000;;25;in-stock;color:White
```
👆 Phải tự tạo hoặc đợi kết quả rồi copy SKU

**✅ CÁCH MỚI** (dùng [SKU_VỪA_TẠO]):
```
ASUS ROG Strix G15;laptop;ASUS;25990000;28990000;50;in-stock;Laptop gaming...
[VARIANT];[SKU_VỪA_TẠO];ASUS ROG - Black;25990000;;25;in-stock;color:Black
[VARIANT];[SKU_VỪA_TẠO];ASUS ROG - White;25990000;;25;in-stock;color:White
```
👆 Tự động lấy SKU của dòng trên!

### Quy Tắc Sử Dụng:
1. **Chỉ dùng cho biến thể** ngay sau sản phẩm chính
2. **Không thể dùng** nếu có sản phẩm chính khác ở giữa
3. **Phân biệt hoa thường**: Có thể viết `[SKU_VỪA_TẠO]` hoặc `[sku_vừa_tạo]` (đều được chấp nhận)

### Ví Dụ Đúng ✅:
```
Laptop A;laptop;ASUS;1000000;;10;in-stock;...
[VARIANT];[SKU_VỪA_TẠO];Laptop A - Black;1000000;;5;in-stock;color:Black
[VARIANT];[SKU_VỪA_TẠO];Laptop A - White;1000000;;5;in-stock;color:White
```

### Ví Dụ SAI ❌:
```
Laptop A;laptop;ASUS;1000000;;10;in-stock;...
Laptop B;laptop;MSI;2000000;;20;in-stock;...
[VARIANT];[SKU_VỪA_TẠO];Laptop A - Black;1000000;;5;in-stock;color:Black
```
👆 Lỗi! Có Laptop B ở giữa, nên `[SKU_VỪA_TẠO]` sẽ tham chiếu đến Laptop B, không phải Laptop A

### Giải Pháp Cho Trường Hợp Phức Tạp:
Nếu cần thêm nhiều sản phẩm chính trước khi thêm biến thể:

**Cách 1: Tách thành 2 lần thêm**
```
Lần 1: Thêm tất cả sản phẩm chính
Laptop A;laptop;ASUS;1000000;;10;in-stock;...
Laptop B;laptop;MSI;2000000;;20;in-stock;...

Lần 2: Kiểm tra SKU rồi thêm biến thể
[VARIANT];ASU-LaptopA-1234;Laptop A - Black;1000000;;5;in-stock;color:Black
[VARIANT];MSI-LaptopB-5678;Laptop B - Red;2000000;;10;in-stock;color:Red
```

**Cách 2: Gộp sản phẩm chính với biến thể ngay sau nó**
```
Laptop A;laptop;ASUS;1000000;;10;in-stock;...
[VARIANT];[SKU_VỪA_TẠO];Laptop A - Black;1000000;;5;in-stock;color:Black
[VARIANT];[SKU_VỪA_TẠO];Laptop A - White;1000000;;5;in-stock;color:White

Laptop B;laptop;MSI;2000000;;20;in-stock;...
[VARIANT];[SKU_VỪA_TẠO];Laptop B - Red;2000000;;10;in-stock;color:Red
[VARIANT];[SKU_VỪA_TẠO];Laptop B - Blue;2000000;;10;in-stock;color:Blue
```

---

## �📦 DỮ LIỆU MẪU - COPY VÀ PASTE TRỰC TIẾP

### Mẫu 1: Laptop Gaming với 2 biến thể màu (dùng [SKU_VỪA_TẠO])

```
ASUS ROG Strix G15 Gaming Laptop;laptop;ASUS;25990000;28990000;50;in-stock;Laptop gaming cao cấp với GPU RTX 3060, màn hình 144Hz, thiết kế RGB đẹp mắt;CPU:Intel Core i7-11800H|RAM:16GB DDR4 3200MHz|GPU:NVIDIA RTX 3060 6GB|Storage:512GB SSD NVMe|Display:15.6 inch FHD 144Hz|Battery:90Wh;Performance:High FPS Gaming:fas fa-gamepad|Display:144Hz Smooth:fas fa-tv|Cooling:Advanced Cooling System:fas fa-snowflake|RGB:Customizable RGB Lighting:fas fa-lightbulb
[VARIANT];[SKU_VỪA_TẠO];ASUS ROG Strix G15 - Eclipse Gray;25990000;28990000;25;in-stock;color:Eclipse Gray|size:15.6 inch
[VARIANT];[SKU_VỪA_TẠO];ASUS ROG Strix G15 - Original Black;25990000;28990000;25;in-stock;color:Original Black|size:15.6 inch
```

### Mẫu 2: Chuột Gaming với 3 biến thể DPI (dùng [SKU_VỪA_TẠO])

```
Logitech G Pro X Superlight;mouse;Logitech;3290000;3590000;100;in-stock;Chuột gaming siêu nhẹ chỉ 63g, sensor HERO 25K, pin 70 giờ;Sensor:HERO 25K|Weight:63g|Battery:70 hours|Connectivity:LIGHTSPEED Wireless|Buttons:5 programmable;Lightweight:Ultra-light 63g design:fas fa-feather|Wireless:LIGHTSPEED wireless:fas fa-wifi|Battery:70h battery life:fas fa-battery-full|Precision:HERO 25K sensor:fas fa-crosshairs
[VARIANT];[SKU_VỪA_TẠO];Logitech G Pro X Superlight - White (DPI 16000);3290000;3590000;30;in-stock;color:White|dpi:16000|weight:63g
[VARIANT];[SKU_VỪA_TẠO];Logitech G Pro X Superlight - Black (DPI 16000);3290000;3590000;35;in-stock;color:Black|dpi:16000|weight:63g
[VARIANT];[SKU_VỪA_TẠO];Logitech G Pro X Superlight - Pink (DPI 25600);3390000;3590000;35;in-stock;color:Pink|dpi:25600|weight:63g
```

### Mẫu 3: Màn Hình Gaming

```
MSI Optix MAG274QRF-QD;monitor;MSI;8990000;9990000;30;in-stock;Màn hình gaming 27 inch WQHD 165Hz với Quantum Dot, HDR 400;Screen Size:27 inch|Resolution:2560x1440 WQHD|Refresh Rate:165Hz|Response Time:1ms GTG|Panel:Rapid IPS|HDR:DisplayHDR 400|Color Gamut:97% DCI-P3;Speed:165Hz refresh rate:fas fa-tachometer-alt|Quality:Quantum Dot color:fas fa-palette|Response:1ms response time:fas fa-bolt|HDR:HDR 400 support:fas fa-sun
```

### Mẫu 4: Bàn Phím Cơ với biến thể Switch (dùng [SKU_VỪA_TẠO])

```
Keychron K2 V2 Wireless;keyboard;Keychron;1990000;2290000;60;in-stock;Bàn phím cơ 75% compact, kết nối Bluetooth & USB-C, hot-swap, RGB;Layout:75% Compact 84 keys|Connectivity:Bluetooth 5.1 + USB-C|Battery:4000mAh up to 240h|Backlight:RGB LED|Hot-swap:Yes;Wireless:Bluetooth 5.1:fas fa-bluetooth|Battery:240h battery:fas fa-battery-full|Compact:75% space-saving:fas fa-compress|RGB:RGB backlight:fas fa-lightbulb
[VARIANT];[SKU_VỪA_TẠO];Keychron K2 V2 - Gateron Blue Switch;1990000;2290000;20;in-stock;switch:Gateron Blue|type:Clicky|actuation:55g
[VARIANT];[SKU_VỪA_TẠO];Keychron K2 V2 - Gateron Brown Switch;1990000;2290000;25;in-stock;switch:Gateron Brown|type:Tactile|actuation:55g
[VARIANT];[SKU_VỪA_TẠO];Keychron K2 V2 - Gateron Red Switch;1990000;2290000;15;in-stock;switch:Gateron Red|type:Linear|actuation:45g
```

### Mẫu 5: SSD NVMe

```
Samsung 980 PRO NVMe SSD;storage;Samsung;2490000;2790000;80;in-stock;SSD NVMe Gen 4.0 tốc độ siêu cao 7000MB/s đọc;Capacity:1TB|Interface:PCIe 4.0 x4 NVMe|Read Speed:7000 MB/s|Write Speed:5000 MB/s|Form Factor:M.2 2280|TBW:600TB;Speed:7000MB/s read speed:fas fa-rocket|Gen4:PCIe 4.0 technology:fas fa-microchip|Endurance:600TB TBW:fas fa-shield-alt|Gaming:PS5 compatible:fas fa-gamepad
```

### Mẫu 6: CPU (không có biến thể)

```
Intel Core i7-12700K;cpu;Intel;9990000;10990000;45;in-stock;CPU Intel thế hệ 12 Alder Lake, 12 nhân 20 luồng, xung nhịp tối đa 5.0GHz;Cores:12 cores (8P+4E)|Threads:20 threads|Base Clock:3.6 GHz|Boost Clock:5.0 GHz|Cache:25MB Intel Smart Cache|TDP:125W|Socket:LGA1700;Performance:12 cores 20 threads:fas fa-microchip|Speed:Up to 5.0 GHz:fas fa-tachometer-alt|Gaming:Excellent gaming performance:fas fa-gamepad|OC:Unlocked for overclocking:fas fa-unlock
```

### Mẫu 7: GPU

```
ASUS ROG Strix GeForce RTX 3070 Ti;gpu;ASUS;15990000;17990000;20;in-stock;Card màn hình RTX 3070 Ti với 8GB GDDR6X, tản nhiệt 3 quạt mạnh mẽ;GPU:NVIDIA GeForce RTX 3070 Ti|VRAM:8GB GDDR6X|Memory Bus:256-bit|Boost Clock:1875 MHz|Outputs:3x DisplayPort 1.4a 2x HDMI 2.1|Power:320W TDP|Cooling:Axial-tech fans 3x;RTX:Ray Tracing & DLSS:fas fa-lightbulb|Performance:8GB GDDR6X memory:fas fa-memory|Cooling:Triple fan design:fas fa-fan|RGB:Aura Sync RGB:fas fa-palette
```

### Mẫu 8: RAM với biến thể tốc độ (dùng [SKU_VỪA_TẠO])

```
Corsair Vengeance RGB Pro;ram;Corsair;1890000;2190000;100;in-stock;RAM DDR4 RGB đẹp mắt, tản nhiệt nhôm cao cấp, XMP 2.0;Capacity:16GB (2x8GB)|Type:DDR4|Speed:3200MHz|CAS Latency:CL16|Voltage:1.35V|RGB:10-zone RGB;RGB:Dynamic RGB lighting:fas fa-lightbulb|Performance:High frequency:fas fa-tachometer-alt|Quality:Aluminum heatspreader:fas fa-shield-alt|XMP:XMP 2.0 support:fas fa-microchip
[VARIANT];[SKU_VỪA_TẠO];Corsair Vengeance RGB Pro 3200MHz CL16;1890000;2190000;50;in-stock;speed:3200MHz|latency:CL16|capacity:16GB
[VARIANT];[SKU_VỪA_TẠO];Corsair Vengeance RGB Pro 3600MHz CL18;2190000;2490000;30;in-stock;speed:3600MHz|latency:CL18|capacity:16GB
[VARIANT];[SKU_VỪA_TẠO];Corsair Vengeance RGB Pro 4000MHz CL19;2690000;2990000;20;in-stock;speed:4000MHz|latency:CL19|capacity:16GB
```

### Mẫu 9: Tai Nghe Gaming (dùng [SKU_VỪA_TẠO])

```
HyperX Cloud II Wireless;headset;HyperX;2890000;3190000;70;in-stock;Tai nghe gaming không dây với âm thanh 7.1 surround, pin 30 giờ;Connectivity:2.4GHz Wireless|Battery:30 hours|Audio:7.1 Virtual Surround|Drivers:53mm neodymium|Microphone:Detachable noise-cancelling|Weight:309g;Wireless:30h wireless battery:fas fa-wifi|Sound:7.1 surround sound:fas fa-volume-up|Comfort:Memory foam ear cushions:fas fa-headphones|Mic:Noise-cancelling microphone:fas fa-microphone
[VARIANT];[SKU_VỪA_TẠO];HyperX Cloud II Wireless - Black;2890000;3190000;35;in-stock;color:Black|battery:30 hours
[VARIANT];[SKU_VỪA_TẠO];HyperX Cloud II Wireless - Red;2890000;3190000;35;in-stock;color:Red|battery:30 hours
```

### Mẫu 10: Mainboard

```
ASUS ROG Strix B550-F Gaming WiFi;motherboard;ASUS;4990000;5490000;25;in-stock;Bo mạch chủ AMD B550 hỗ trợ Ryzen 5000, PCIe 4.0, WiFi 6;Chipset:AMD B550|Socket:AM4|Memory:4x DDR4 up to 128GB|PCIe:1x PCIe 4.0 x16 1x PCIe 3.0 x16|Storage:2x M.2 6x SATA|LAN:2.5Gb Ethernet|WiFi:WiFi 6 (802.11ax);Gaming:Optimized for gaming:fas fa-gamepad|WiFi:WiFi 6 AX200:fas fa-wifi|PCIe4:PCIe 4.0 ready:fas fa-microchip|RGB:Aura Sync RGB:fas fa-palette
```

---

## ✅ CÁCH SỬ DỤNG

### Bước 1: Copy dữ liệu mẫu
Chọn một hoặc nhiều mẫu ở trên, copy toàn bộ text (bao gồm cả sản phẩm chính và các biến thể)

### Bước 2: Truy cập trang Quick-Input
Mở trình duyệt và truy cập: `http://localhost:3000/quick-input`

### Bước 3: Paste vào textarea
Paste dữ liệu đã copy vào ô nhập liệu lớn

### Bước 4: Click "Thêm Sản Phẩm"
Hệ thống sẽ:
- ✅ Kiểm tra định dạng tất cả các dòng
- ✅ Hiển thị lỗi nếu có (không thêm sản phẩm nào vào database)
- ✅ Nếu hợp lệ, thêm lần lượt từng sản phẩm
- ✅ Hiển thị tiến độ và kết quả chi tiết

### Bước 5: Kiểm tra kết quả
- Xem kết quả chi tiết từng dòng (thành công/thất bại)
- SKU sẽ tự động được tạo cho sản phẩm chính
- SKU biến thể có dạng: `SKU_Chính-V1`, `-V2`, `-V3`...

---

## ⚠️ LƯU Ý QUAN TRỌNG

### Thứ Tự Thêm Sản Phẩm:
1. **LUÔN** thêm sản phẩm chính trước
2. Sau đó mới thêm các biến thể (sử dụng SKU của sản phẩm chính)
3. Nếu chưa biết SKU của sản phẩm chính, có thể:
   - Thêm sản phẩm chính trước
   - Kiểm tra SKU được tạo trong kết quả
   - Sau đó thêm các biến thể với SKU đó

### Xử Lý Lỗi:
- Hệ thống sẽ **kiểm tra TẤT CẢ** các dòng trước khi thêm
- Nếu có **BẤT KỲ** lỗi nào → Không thêm sản phẩm nào
- Sửa lỗi theo hướng dẫn → Click "Thêm Sản Phẩm" lại

### Mẹo Sử Dụng:
- Có thể để trống một số trường không bắt buộc (giá cũ, mô tả, specs, features)
- Sử dụng Excel/Google Sheets để chuẩn bị dữ liệu, sau đó copy sang
- Icon features lấy từ Font Awesome: https://fontawesome.com/icons
- Test với 1-2 sản phẩm trước khi thêm hàng loạt

---

## 🔍 KIỂM TRA DỮ LIỆU ĐÃ THÊM

Sau khi thêm thành công, kiểm tra:
1. **Firebase Console**: https://console.firebase.google.com
2. Vào **Firestore Database** → Collection `products`
3. Tìm sản phẩm theo SKU hoặc tên
4. Kiểm tra các trường: attributes, variant_attributes, parent_id_product (cho biến thể)

---

## 📞 HỖ TRỢ

Nếu gặp lỗi:
1. Kiểm tra kỹ định dạng (dấu chấm phẩy, dấu hai chấm, dấu pipe)
2. Đảm bảo danh mục và trạng thái đúng giá trị cho phép
3. Kiểm tra SKU sản phẩm chính có tồn tại khi thêm biến thể
4. Xem console log trong Developer Tools (F12) để biết thêm chi tiết lỗi

---

**Chúc bạn sử dụng Quick-Input hiệu quả! 🚀**

# Cannibal Query — Thiết kế Dashboard (Airtable Editorial Design System)

Sản phẩm và quy tắc dữ liệu ở `PRODUCT.md`. Đây là nguồn quyết định giao diện hiện hành, thay thế các bản thiết kế cũ trước đây.

---

## 1. Hướng trình bày & Triết lý thiết kế

Giao diện áp dụng chuẩn **Airtable Editorial System** nhẹ nhàng, tĩnh lặng và tập trung vào dữ liệu:
- **Loại bỏ hoàn toàn phong cách galaxy, neon hay mesh 3D gây nhiễu**: Không có gradient chói sáng, không có hiệu ứng phát quang neon khó chịu, loại bỏ wireframe 3D xoay trong header.
- **Nền tảng trắng & xám nhạt (Quiet Editorial Canvas)**: Bề mặt trang là nền canvas thanh lịch `#ffffff` kết hợp với các dải nền xám ngọc `#f8fafc` và viền hairline mảnh mai `#e2e8f0` / `#dddddd`. Các khối nội dung có khoảng thở rộng rãi như tạp chí in chuyên nghiệp.
- **Màu nhấn hành động tự nhiên (Near-Black Ink)**: Nút hành động chính (Primary CTA) sử dụng màu mực đen thẳm `#181d26` với chữ trắng và bo góc 12px (`rounded.lg`), mang lại cảm giác dứt khoát, chuyên nghiệp và đáng tin cậy.

---

## 2. Bảng màu hệ thống (Design Tokens)

### 2.1 Bề mặt & Khung viền (Surfaces & Borders)
- **Canvas / Page Background**: `--bg: #f8fafc` (xám dịu mắt, không lóa).
- **Surface / Card Background**: `--surface: #ffffff` (trắng tinh khiết cho thẻ và panel).
- **Surface Up / Soft**: `--surface-up: #f1f5f9` (xám sáng cho header bảng, vùng phụ trợ).
- **Surface Active**: `--surface-active: #e2e8f0` (trạng thái nhấn hoặc tab kích hoạt).
- **Input Background**: `--input: #ffffff`.
- **Hairline Border**: `--border: #e2e8f0` (viền mỏng 1px tinh tế).
- **Border Strong**: `--border-strong: #94a3b8` (viền nhấn cho trạng thái hover/focus).
- **Line / Dividers**: `--line: #edf2f7`.

### 2.2 Typography & Văn bản (Ink Hierarchy)
- **Display & Headings (Near-Black Ink)**: `--text: #181d26` (áp dụng cho H1, H2, giá trị KPI và nút CTA chính).
- **Body Text**: `#333840` (xám đậm dễ đọc, độ tương phản chuẩn WCAG AAA trên nền trắng).
- **Muted Text**: `--muted: #475569` (cho nhãn, chú thích, thông tin phụ).
- **Soft Text**: `--soft: #64748b` (cho placeholder, icon thụ động).
- **Text on Dark / CTA**: `#ffffff`.

### 2.3 Nhận diện chỉ số & Màu ngữ nghĩa (Semantic Signature Colors)
Các khối thẻ KPI và biểu đồ sử dụng màu mang sắc thái Airtable Editorial thực thụ, tuyệt đối không dùng neon:
- **Query Metric**: Xanh Link Blue `#1b61c9` (nền dịu `#eff6ff`, viền `#bfdbfe`).
- **Impression Metric**: Xanh chàm Royal Indigo `#6366f1` (nền dịu `#f5f3ff`, viền `#ddd6fe`).
- **An toàn / Cải thiện (Safe / Decrease)**: Xanh ngọc sẫm Forest Green `#047857` / `#15803d` (nền `#ecfdf5`, viền `#a7f3d0`).
- **Cảnh báo / Trung bình (Medium / Warning)**: Vàng mù tạt Mustard Amber `#b45309` (nền `#fffbeb`, viền `#fde68a`).
- **Nguy hiểm / Ăn thịt (Danger / Increase)**: Đỏ san hô Coral Red `#b91c1c` (nền `#fef2f2`, viền `#fecaca`).

---

## 3. Bảng màu 27 danh mục DMC3 (Phân biệt tối đa, hài hòa thị giác)

27 nhóm từ khóa danh mục thiết bị công nghệ được gán các mã màu riêng biệt phân bổ đều trên vòng tròn màu (Color Wheel), xen kẽ giữa các tone màu nóng và lạnh để đảm bảo **độ phân biệt tuyệt đối** trên biểu đồ donut tròn, bảng danh sách, bộ lọc chip và bảng dữ liệu:

| STT | Mã DMC3 | Nhãn hiển thị | Màu HEX | Sắc thái đặc trưng |
|---|---|---|---|---|
| 1 | `SAMSUNG` | SAMSUNG | `#1d4ed8` | Xanh dương đậm Samsung |
| 2 | `XIAOMI` | XIAOMI | `#f97316` | Cam thương hiệu Xiaomi |
| 3 | `IPHONE` | IPHONE | `#1e40af` | Xanh chàm sâu iPhone |
| 4 | `ANDROID` | ANDROID | `#15803d` | Xanh lá rừng Android |
| 5 | `OPPO` | OPPO | `#0d9488` | Xanh mòng két Teal OPPO |
| 6 | `IPAD` | IPAD | `#7c3aed` | Tím hoàng gia iPad |
| 7 | `LAPTOP` | LAPTOP | `#be123c` | Đỏ hồng Ruby Laptop |
| 8 | `REDMI` | REDMI | `#b45309` | Hổ phách đậm Redmi |
| 9 | `TABLET` | TABLET | `#0891b2` | Xanh lam ngọc Tablet |
| 10 | `MACBOOK` | MACBOOK | `#475569` | Xám kim loại Slate Macbook |
| 11 | `APPLE_WATCH` | APPLE WATCH | `#0284c7` | Xanh da trời Apple Watch |
| 12 | `TAI_NGHE` | TAI NGHE | `#c026d3` | Tím hoa cà Tai nghe |
| 13 | `VIVO` | VIVO | `#059669` | Xanh ngọc lục bảo Vivo |
| 14 | `PIN_DUPHONG` | PIN DỰ PHÒNG | `#e11d48` | Đỏ thắm Pin sạc |
| 15 | `CAMERA` | CAMERA | `#4f46e5` | Xanh Iris Camera |
| 16 | `LOA` | LOA | `#ca8a04` | Vàng đồng Loa âm thanh |
| 17 | `REALME` | REALME | `#047857` | Xanh rừng nhiệt đới Realme |
| 18 | `PHUKIEN` | PHỤ KIỆN | `#9333ea` | Tím Thạch anh Phụ kiện |
| 19 | `CU_CAP_SAC` | CỦ CÁP SẠC | `#d97706` | Cam sẫm Củ cáp sạc |
| 20 | `KÍNH_CUONGLUC`| KÍNH CƯỜNG LỰC | `#0e7490` | Xanh biển sâu Kính CL |
| 21 | `CHIP` | CHIP | `#4338ca` | Tím xanh vi xử lý |
| 22 | `BAN_PHIM` | BÀN PHÍM | `#0f766e` | Xanh thông Bàn phím |
| 23 | `OP_LUNG` | ỐP LƯNG | `#b91c1c` | Đỏ gạch Ốp lưng |
| 24 | `CHUOT` | CHUỘT | `#6366f1` | Chàm tím Chuột máy tính |
| 25 | `MAY_IN` | MÁY IN | `#6d28d9` | Tím mực Máy in |
| 26 | `MAN_HINH` | MÀN HÌNH | `#0369a1` | Xanh hiển thị Màn hình |
| 27 | `OTHER` | KHÁC | `#64748b` | Xám trung tính Nhóm khác |

---

## 4. Bảng màu nhóm thứ hạng Top SERP

Hệ thống phân tầng thứ hạng theo chuẩn chuyển đổi màu editorial rõ ràng:
- **Top 3**: `#1b61c9` (Link Blue — vị trí kim cương dẫn đầu SERP).
- **Top 5**: `#059669` (Emerald Mint — vị trí xuất sắc).
- **Top 10**: `#d97706` (Mustard Amber — vị trí trang 1).
- **Top 20**: `#dc2626` (Coral Red — ranh giới trang 2).
- **Top 50**: `#6366f1` (Royal Indigo — vị trí tiềm năng).
- **Top 100**: `#64748b` (Slate Gray — ngưỡng theo dõi).

---

## 5. Thang bo góc chuẩn bậc (Border Radius Scale)

Tuân theo hệ thống cấu trúc Airtable với phân cấp hình khối chặt chẽ:
- `rounded.xs` (4px): Thẻ nhãn phụ, chỉ số con, tag nhỏ.
- `rounded.sm` (6px): Input, ô tìm kiếm, menu item danh mục.
- `rounded.control` (8px): Nút bấm chức năng (utility buttons), trigger picker dropdown.
- `rounded.md` (10px): Popup menu, hộp thoại danh mục.
- `rounded.lg` (12px): Thẻ chỉ số tổng quan (highlight card, ratio card, comparison card, rank band, primary CTA).
- `rounded.xl` (14px): Khối panel chính lớn, modal dialog.
- `rounded.pill` (9999px): Trạng thái badge, chip phân loại mức độ (`.level-chip`), nút chuyển tab.

---

## 6. Bố cục, Biểu đồ & Tương tác

- **Header tinh gọn**: Nền trắng sáng `#ffffff`, viền chân `#e2e8f0`, brand mark mực đen `#181d26` với chữ trắng, các nút chuyển màn hình Tổng quan / So sánh / Thứ hạng hiển thị rõ ràng.
- **Biểu đồ ECharts**: Nền tooltip trắng viền xám hairline có bóng đổ dịu nhẹ (`box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1)`), chữ đen dễ đọc. Khi hover vào lát bánh donut, đường viền stroke chuyển sang trắng `#ffffff` nổi bật trên nền lát màu, các lát còn lại giảm opacity nhẹ.
- **Bảng dữ liệu (Data Tables)**: Dòng xen kẽ trắng `#ffffff` và xám cực nhẹ `#fafbfd`, hover dòng chuyển `#f1f5f9`. Bảng có thanh cuộn ngang độc lập, không làm tràn trang.
- **Hộp thoại chi tiết (Focus Dialogs)**: Backdrop mờ dịu `rgba(15, 23, 42, 0.45)` với `backdrop-filter: blur(4px)`. Không gian đọc URL rộng rãi, hiển thị rõ ràng URL chính (Leader), URL cạnh tranh (Runner) và các URL phụ đạt ngưỡng.

# UX parity — ux-rebuild

Baseline: `5d3bf0b03405eab0b4b9f1a03fdfa6ab9e054d3b`. Kế thừa 71 test đang đạt. Không push/deploy; không sửa backend hoặc Thứ hạng.

Trạng thái: **Kiểm kê xong** = đã đối chiếu code, chưa xác nhận sau chỉnh. **Đạt** = đã kiểm tra sau chỉnh. Các khác biệt so với danh sách yêu cầu được ghi rõ, không âm thầm thêm/bỏ.

| Mục | Mô tả | File/component hiện tại | Vị trí mới | Trạng thái |
|---|---|---|---|---|
| A1 | Mật khẩu workspace, khách không thấy dữ liệu | `dashboard.tsx` | Giữ cổng đăng nhập | Kiểm kê xong |
| A2 | Điều hướng Tổng quan / So sánh / Thứ hạng | `dashboard-header.tsx` | Giữ cả 3 tab hiện có; Thứ hạng không sửa | Kiểm kê xong |
| A3 | Ngày dd/mm/yyyy, quy tắc, CSV, import, đăng xuất | `dashboard-header.tsx, header-date-select.tsx` | Header chung | Kiểm kê xong |
| A4 | Three.js desktop lazy / reduced motion | `header-scene.tsx, header-scene-lifecycle.ts` | Giữ header | Kiểm kê xong |
| B1 | 4 thẻ toàn site; danh mục gốc, nhóm cao/thấp, impression | `overview-summary.tsx` | Đầu Tổng quan | Kiểm kê xong |
| B2 | Đồng hạng có sẵn trong overviewHighlights nhưng chưa ghi trên thẻ | `overview-summary.tsx` | Thêm nhãn đồng hạng, không đổi phép tính | Kiểm kê xong |
| B3 | Hai donut + chú giải cuộn + thông tin cố định | `overview-charts.tsx` | Khu phân tích cạnh sidebar | Kiểm kê xong |
| B4 | Hover/focus liên kết hai donut; click lọc DMC3 | `overview-charts.tsx, chart-interactions.ts` | Giữ nguyên | Kiểm kê xong |
| B5 | Hai tỷ lệ toàn site / thêm hai tỷ lệ DMC3 khi chọn | `cannibal-ratios.tsx` | Khu phân tích cạnh sidebar | Kiểm kê xong |
| B6 | Có cannibal + số lượng theo nhóm query | `query-table.tsx` | Toolbar bảng | Kiểm kê xong |
| B7 | Sidebar đủ DMC3 gốc, nhóm 0 và màu cố định, tìm nhóm | `category-sidebar.tsx, categories.ts` | Trái toàn khu phân tích | Kiểm kê xong |
| B8 | Tìm query chứa / khớp chính xác | `query-table.tsx` | Thanh lọc bảng | Kiểm kê xong |
| B9 | Nhóm query all/cannibal/none/review có điều kiện | `query-table.tsx` | Thanh lọc bảng | Kiểm kê xong |
| B10 | Mức độ OR, Tất cả, số lượng từng mức | `query-table.tsx` | Thanh lọc bảng | Kiểm kê xong |
| B11 | Sort impression/rank/gap; phân trang 25; Rank/Gap 1 chữ số | `query-table.tsx` | Giữ bảng | Kiểm kê xong |
| B12 | CSV UTF-8 theo bộ lọc hiện có | `dashboard.tsx exportCsv` | Giữ header | Kiểm kê xong |
| B13 | Mở URL qua dialog; hàng đang mở nổi bật; giữ lọc/trang | `query-table.tsx, focus-dialog.tsx` | Giữ dialog hiện có, không thêm luồng inline khác | Kiểm kê xong |
| B14 | Hướng xử lý hiện có: mức độ, sort, quy tắc; chưa có tính năng gợi ý riêng | `cannibal-rules.tsx, query-table.tsx` | Giữ nội dung hiện có, không tạo tính năng mới | Kiểm kê xong |
| B15 | Tỷ trọng SVG trên từng DMC3; URL xếp impression | `query-table.tsx QueryDetails` | Dialog chi tiết | Kiểm kê xong |
| B16 | TOP1 xanh / TOP2 đỏ / URL đủ ngưỡng vàng; nhãn tính cannibal | `query-table.tsx QueryDetails` | Giữ dialog | Kiểm kê xong |
| B17 | % so Top1, mốc20%, dấu — khi Top1=0 | `query-table.tsx, globals.css` | Giữ dialog | Kiểm kê xong |
| B18 | Escape, đóng ngoài, focus trap/return, scroll lock | `focus-dialog.tsx, use-dialog-motion.ts` | Giữ vòng đời dialog | Kiểm kê xong |
| B19 | Lỗi dòng / thiếu rank / URL rỗng | `query-table.tsx QueryDetails` | Giữ cảnh báo dialog | Kiểm kê xong |
| C1 | Hai ngày SelectMenu; ngày trước<ngày sau; bản mới nhất/ngày | `comparison-periods.tsx, comparison.ts` | Đầu So sánh | Kiểm kê xong |
| C2 | 6 thẻ DMC3 + đồng hạng + click chọn nhóm | `comparison-overview.tsx` | Sau bộ ngày | Kiểm kê xong |
| C3 | 4 nhận định, phạm vi DMC3, query mới có dữ liệu | `comparison-overview.tsx` | Sau 6 thẻ | Kiểm kê xong |
| C4 | Cột hai ngày Query/Impression + tỷ lệ và delta | `comparison-overview.tsx` | Khu biểu đồ | Kiểm kê xong |
| C5 | Sankey + danh sách số liệu thay thế | `comparison-overview.tsx` | Khu biểu đồ | Kiểm kê xong |
| C6 | Thanh phân kỳ đủ DMC3, đổi Query/Impression/chọn nhóm | `comparison-overview.tsx` | Khu biểu đồ | Kiểm kê xong |
| C7 | Sidebar đủ DMC3, tìm nhóm, số delta | `comparison.tsx` | Trái bảng chi tiết | Kiểm kê xong |
| C8 | Bảng gồm hợp query hai ngày, cả query chỉ có một ngày | `comparison.tsx` | Giữ hợp dữ liệu; không thu hẹp về giao | Kiểm kê xong |
| C9 | Tìm/sort/chuyển trạng thái/số đếm/phân trang | `comparison.tsx` | Toolbar bảng | Kiểm kê xong |
| C10 | CSV đúng cặp ngày và bộ lọc | `dashboard.tsx exportCsv` | Giữ header | Kiểm kê xong |
| C11 | Ghép URL cùng hàng; Top1/Top2 riêng từng ngày | `comparison-detail.tsx` | Dialog đối chiếu | Kiểm kê xong |
| C12 | 4 bằng chứng: impression20%, tỷ lệ phụ, rankTop1, gap | `comparison-evidence.tsx` | Giữ dialog đối chiếu | Kiểm kê xong |
| C13 | Đổi leader / lỗi dòng / thiếu rank / thiếu ngày / chưa có cơ sở% | `comparison-evidence.tsx, comparison-detail.tsx` | Giữ đầy đủ | Kiểm kê xong |
| C14 | Ghi chú gap/ranh giới theo dữ liệu hiện có | `comparison-evidence.tsx` | Giữ nguyên logic/câu giải thích | Kiểm kê xong |
| C15 | Lịch sử import từng lần không còn UI trong baseline (đã bỏ theo yêu cầu trước) | `comparison.tsx` | Giữ nguyên: không tự khôi phục tính năng đã bỏ; ngày vẫn truy cập qua bộ chọn | Kiểm kê xong |
| D1 | Dialog riêng; Query–URL khác bộ gốc Keywords+DMC3 | `dashboard.tsx Dialog, importer.tsx` | Dialog dùng chung hình thức | Kiểm kê xong |
| D2 | XLSX/CSV/TSV150MB; Worker; chọn sheet và định dạng số | `importer.tsx` | Giữ toàn bộ điều khiển | Kiểm kê xong |
| D3 | Ngày tự chọn, fingerprint trùng file/ngày; thay bản cũ/ngày | `importer.tsx` | Giữ nguyên xử lý/RPC | Kiểm kê xong |
| D4 | Gửi lô1000, retry chọn lại file khi mạng lỗi | `importer.tsx` | Giữ hiện trạng; không bổ sung cơ chế resume mới | Kiểm kê xong |
| D5 | Thống kê loại #, ngoài bộ gốc, dòng lỗi, trùng | `importer.tsx` | Giữ preview và thống kê | Kiểm kê xong |
| D6 | Chọn file → kiểm tra → nạp lô → hoàn tất | `importer.tsx, import-progress.tsx` | Làm rõ tiến trình hiện có | Kiểm kê xong |
| D7 | Hướng dẫn bộ gốc/file ngày + tải CSV mẫu | `importer.tsx` | Giữ hướng dẫn | Kiểm kê xong |
| E1 | Loading/skeleton, rỗng, lỗi và Thử lại | `dashboard.tsx, loading-rows.tsx, query-table.tsx` | Giữ trạng thái cạnh nội dung | Kiểm kê xong |
| E2 | data_issue / unknown / no_data / import dở dang | `query-table.tsx, comparison-detail.tsx, importer.tsx` | Giữ nhãn/cảnh báo | Kiểm kê xong |
| E3 | SelectMenu portal combobox/keyboard/Escape/position | `select-menu.tsx, use-popup-motion.ts` | Giữ tương tác | Kiểm kê xong |
| E4 | DMC3 search picker + không có kết quả | `search-picker.tsx` | Giữ menu | Kiểm kê xong |
| E5 | Label/focus/skip link/44px/tabular numbers | `dashboard-header.tsx, globals.css` | Chuẩn hóa nền | Kiểm kê xong |
| E6 | Responsive 390; kiểm tra overflow768/320 | `globals.css, theme.css` | Ưu tiên desktop; giữ truy cập trên mobile | Kiểm kê xong |
| F1 | GSAP reveal/press/hover, cập nhật scope, marker Flip | `dashboard-motion.ts, report-motion.ts, selection-motion.ts` | Giữ hook/thuộc tính khi bố trí lại | Kiểm kê xong |
| F2 | AnimatedNumber KPI, không countup bảng/tooltip | `animated-number.tsx` | Giữ quy tắc hiện có | Kiểm kê xong |
| F3 | Three lazy desktop, ECharts sở hữu chartmotion | `header-scene-lifecycle.ts, chart.tsx` | Không đổi | Kiểm kê xong |
| F4 | Một thuộc tính một chủ sở hữu; cleanup/reduced-motion | `metric-motion.ts, use-dialog-motion.ts, use-popup-motion.ts` | Giữ nguyên vòng đời | Kiểm kê xong |

## Audit ưu tiên

- P0: bảo toàn ba tab hiện có; query một ngày; bảo mật đăng nhập; không chạm engine/RPC/parser. Checklist có điểm khác baseline được giữ và giải thích.
- P1: Tổng quan bắt đầu bằng tỷ lệ và lặp chọn DMC3; sidebar chỉ gắn với bảng, làm phạm vi phân tích rời rạc. Đưa KPI trước và gom phân tích cùng sidebar.
- P1: bộ lọc nhóm/mức độ/tìm kiếm chia nhiều dải; thiếu tóm tắt và xóa riêng. Gom một vùng điều khiển, chip phản ánh đúng trạng thái.
- P1: nhiều lớp heading/cards cùng mức nhấn; bảng cần heading dính và nhãn số rõ. Chuẩn hóa token/cấu trúc.
- P2: nhãn đồng hạng trên KPI chưa dùng dữ liệu đã có; menu/import/login chưa chung nhịp khoảng cách.
- P2: sidebar mobile native select; giữ truy cập, chuẩn hóa qua bộ chọn có sẵn. Không thiết kế lại báo cáo Thứ hạng.

## Hướng thiết kế

Dark enterprise data product: giữ nền #0b0b0b / bề mặt #171717 / nâng #222222, chữ #f5f5f5 và #b3b3b3; Be Vietnam Pro500/600/700. Màu DMC3 chỉ nhận diện nhóm, màu mức độ theo token hiện có. KPI → khu phân tích có sidebar → bảng với một vùng điều khiển. Heading28/24/19, nội dung14–16; spacing4/8; không thêm trang trí hay hiệu ứng mới.

## Kiểm chứng

- [x] TypeScript của thay đổi phiên trước đạt trước khi lưu checkpoint.
- [x] Mốc (a): nền + khung — TypeScript, 71/71 test, production build đạt.
- [x] Mốc (b): Tổng quan + So sánh — TypeScript, 75/75 test, production build đạt; ảnh fixture1440/390 và overflow768/320.
- [ ] Mốc (c): dialog/import/login.
- [ ] Cuối: parity + tests + build + audit giao diện.
- [ ] Ảnh1440/390; overflow768/320. Chỉ dùng fixture trong tests, không kết nối dữ liệu thật.

Audit nền: dùng token có sẵn, không thêm font/thư viện; chip có nút thật, tên truy cập, vùng bấm44px; header ngày không bị co. Baseline headless fixture đã lưu local1440/390, overflow768/320 đạt.

Audit báo cáo: giữ nguyên hook chuyển động, biểu đồ dynamic, công thức và RPC. Bảng có vùng cuộn được focus + header dính; chip chỉ gọi callback lọc hiện có. Sau xem ảnh đã sửa chiều rộng donut trong lưới nhỏ và không thu nhỏ số ở vùng thông tin cố định.

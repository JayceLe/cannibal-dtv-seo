# UX parity — ux-rebuild

Baseline: `5d3bf0b03405eab0b4b9f1a03fdfa6ab9e054d3b`. Kế thừa 71 test đang đạt. Không push/deploy; không sửa backend hoặc Thứ hạng.

Trạng thái: **Đạt** = đã đối chiếu code/test/fixture sau chỉnh. **Giữ nguyên** = khác danh sách mẫu, giữ đúng baseline để tránh thêm/bỏ luồng. Kiểm chứng không bao gồm ghi dữ liệu thật.

| Mục | Mô tả | File/component hiện tại | Vị trí mới | Trạng thái |
|---|---|---|---|---|
| A1 | Mật khẩu workspace, khách không thấy dữ liệu | `dashboard.tsx` | Giữ cổng đăng nhập | Đạt |
| A2 | Điều hướng Tổng quan / So sánh / Thứ hạng | `dashboard-header.tsx` | Giữ cả 3 tab hiện có; Thứ hạng không sửa | Giữ nguyên (xem mô tả) |
| A3 | Ngày dd/mm/yyyy, quy tắc, CSV, import, đăng xuất | `dashboard-header.tsx, header-date-select.tsx` | Header chung | Đạt |
| A4 | Three.js desktop lazy / reduced motion | `header-scene.tsx, header-scene-lifecycle.ts` | Giữ header | Đạt |
| B1 | 4 thẻ toàn site; danh mục gốc, nhóm cao/thấp, impression | `overview-summary.tsx` | Đầu Tổng quan | Đạt |
| B2 | Đồng hạng có sẵn trong overviewHighlights nhưng chưa ghi trên thẻ | `overview-summary.tsx` | Thêm nhãn đồng hạng, không đổi phép tính | Đạt |
| B3 | Hai donut + chú giải cuộn + thông tin cố định | `overview-charts.tsx` | Khu phân tích cạnh sidebar | Đạt |
| B4 | Hover/focus liên kết hai donut; click lọc DMC3 | `overview-charts.tsx, chart-interactions.ts` | Giữ nguyên | Đạt |
| B5 | Hai tỷ lệ toàn site / thêm hai tỷ lệ DMC3 khi chọn | `cannibal-ratios.tsx` | Khu phân tích cạnh sidebar | Đạt |
| B6 | Có cannibal + số lượng theo nhóm query | `query-table.tsx` | Toolbar bảng | Đạt |
| B7 | Sidebar đủ DMC3 gốc, nhóm 0 và màu cố định, tìm nhóm | `category-sidebar.tsx, categories.ts` | Trái toàn khu phân tích | Đạt |
| B8 | Tìm query chứa / khớp chính xác | `query-table.tsx` | Thanh lọc bảng | Đạt |
| B9 | Nhóm query all/cannibal/none/review có điều kiện | `query-table.tsx` | Thanh lọc bảng | Đạt |
| B10 | Mức độ OR, Tất cả, số lượng từng mức | `query-table.tsx` | Thanh lọc bảng | Đạt |
| B11 | Sort impression/rank/gap; phân trang 25; Rank/Gap 1 chữ số | `query-table.tsx` | Giữ bảng | Đạt |
| B12 | CSV UTF-8 theo bộ lọc hiện có | `dashboard.tsx exportCsv` | Giữ header | Đạt |
| B13 | Mở URL qua dialog; hàng đang mở nổi bật; giữ lọc/trang | `query-table.tsx, focus-dialog.tsx` | Giữ dialog hiện có, không thêm luồng inline khác | Giữ nguyên (xem mô tả) |
| B14 | Hướng xử lý hiện có: mức độ, sort, quy tắc; chưa có tính năng gợi ý riêng | `cannibal-rules.tsx, query-table.tsx` | Giữ nội dung hiện có, không tạo tính năng mới | Giữ nguyên (xem mô tả) |
| B15 | Tỷ trọng SVG trên từng DMC3; URL xếp impression | `query-table.tsx QueryDetails` | Dialog chi tiết | Đạt |
| B16 | TOP1 xanh / TOP2 đỏ / URL đủ ngưỡng vàng; nhãn tính cannibal | `query-table.tsx QueryDetails` | Giữ dialog | Đạt |
| B17 | % so Top1, mốc20%, dấu — khi Top1=0 | `query-table.tsx, globals.css` | Giữ dialog | Đạt |
| B18 | Escape, đóng ngoài, focus trap/return, scroll lock | `focus-dialog.tsx, use-dialog-motion.ts` | Giữ vòng đời dialog | Đạt |
| B19 | Lỗi dòng / thiếu rank / URL rỗng | `query-table.tsx QueryDetails` | Giữ cảnh báo dialog | Đạt |
| C1 | Hai ngày SelectMenu; ngày trước<ngày sau; bản mới nhất/ngày | `comparison-periods.tsx, comparison.ts` | Đầu So sánh | Đạt |
| C2 | 6 thẻ DMC3 + đồng hạng + click chọn nhóm | `comparison-overview.tsx` | Sau bộ ngày | Đạt |
| C3 | 4 nhận định, phạm vi DMC3, query mới có dữ liệu | `comparison-overview.tsx` | Sau 6 thẻ | Đạt |
| C4 | Cột hai ngày Query/Impression + tỷ lệ và delta | `comparison-overview.tsx` | Khu biểu đồ | Đạt |
| C5 | Sankey + danh sách số liệu thay thế | `comparison-overview.tsx` | Khu biểu đồ | Đạt |
| C6 | Thanh phân kỳ đủ DMC3, đổi Query/Impression/chọn nhóm | `comparison-overview.tsx` | Khu biểu đồ | Đạt |
| C7 | Sidebar đủ DMC3, tìm nhóm, số delta | `comparison.tsx` | Trái bảng chi tiết | Đạt |
| C8 | Bảng gồm hợp query hai ngày, cả query chỉ có một ngày | `comparison.tsx` | Giữ hợp dữ liệu; không thu hẹp về giao | Đạt |
| C9 | Tìm/sort/chuyển trạng thái/số đếm/phân trang | `comparison.tsx` | Toolbar bảng | Đạt |
| C10 | CSV đúng cặp ngày và bộ lọc | `dashboard.tsx exportCsv` | Giữ header | Đạt |
| C11 | Ghép URL cùng hàng; Top1/Top2 riêng từng ngày | `comparison-detail.tsx` | Dialog đối chiếu | Đạt |
| C12 | 4 bằng chứng: impression20%, tỷ lệ phụ, rankTop1, gap | `comparison-evidence.tsx` | Giữ dialog đối chiếu | Đạt |
| C13 | Đổi leader / lỗi dòng / thiếu rank / thiếu ngày / chưa có cơ sở% | `comparison-evidence.tsx, comparison-detail.tsx` | Giữ đầy đủ | Đạt |
| C14 | Ghi chú gap/ranh giới theo dữ liệu hiện có | `comparison-evidence.tsx` | Giữ nguyên logic/câu giải thích | Đạt |
| C15 | Lịch sử import từng lần không còn UI trong baseline (đã bỏ theo yêu cầu trước) | `comparison.tsx` | Giữ nguyên: không tự khôi phục tính năng đã bỏ; ngày vẫn truy cập qua bộ chọn | Giữ nguyên (xem mô tả) |
| D1 | Dialog riêng; Query–URL khác bộ gốc Keywords+DMC3 | `dashboard.tsx Dialog, importer.tsx` | Dialog dùng chung hình thức | Đạt |
| D2 | XLSX/CSV/TSV150MB; Worker; chọn sheet và định dạng số | `importer.tsx` | Giữ toàn bộ điều khiển | Đạt |
| D3 | Ngày tự chọn, fingerprint trùng file/ngày; thay bản cũ/ngày | `importer.tsx` | Giữ nguyên xử lý/RPC | Đạt |
| D4 | Gửi lô1000, retry chọn lại file khi mạng lỗi | `importer.tsx` | Giữ hiện trạng; không bổ sung cơ chế resume mới | Giữ nguyên (xem mô tả) |
| D5 | Thống kê loại #, ngoài bộ gốc, dòng lỗi, trùng | `importer.tsx` | Giữ preview và thống kê | Đạt |
| D6 | Chọn file → kiểm tra → nạp lô → hoàn tất | `importer.tsx, import-progress.tsx` | Làm rõ tiến trình hiện có | Đạt |
| D7 | Hướng dẫn bộ gốc/file ngày + tải CSV mẫu | `importer.tsx` | Giữ hướng dẫn | Đạt |
| E1 | Loading/skeleton, rỗng, lỗi và Thử lại | `dashboard.tsx, loading-rows.tsx, query-table.tsx` | Giữ trạng thái cạnh nội dung | Đạt |
| E2 | data_issue / unknown / no_data / import dở dang | `query-table.tsx, comparison-detail.tsx, importer.tsx` | Giữ nhãn/cảnh báo | Đạt |
| E3 | SelectMenu portal combobox/keyboard/Escape/position | `select-menu.tsx, use-popup-motion.ts` | Giữ tương tác | Đạt |
| E4 | DMC3 search picker + không có kết quả | `search-picker.tsx` | Giữ menu | Đạt |
| E5 | Label/focus/skip link/44px/tabular numbers | `dashboard-header.tsx, globals.css` | Chuẩn hóa nền | Đạt |
| E6 | Responsive 390; kiểm tra overflow768/320 | `globals.css, theme.css` | Ưu tiên desktop; giữ truy cập trên mobile | Đạt |
| F1 | GSAP reveal/press/hover, cập nhật scope, marker Flip | `dashboard-motion.ts, report-motion.ts, selection-motion.ts` | Giữ hook/thuộc tính khi bố trí lại | Đạt |
| F2 | AnimatedNumber KPI, không countup bảng/tooltip | `animated-number.tsx` | Giữ quy tắc hiện có | Đạt |
| F3 | Three lazy desktop, ECharts sở hữu chartmotion | `header-scene-lifecycle.ts, chart.tsx` | Không đổi | Đạt |
| F4 | Một thuộc tính một chủ sở hữu; cleanup/reduced-motion | `metric-motion.ts, use-dialog-motion.ts, use-popup-motion.ts` | Giữ nguyên vòng đời | Đạt |

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
- [x] Mốc (c): dialog/import/login — TypeScript, 76/76 test, production build đạt; ảnh fixture1440/390 và overflow768/320.
- [x] Cuối: toàn bộ checklist đã đối chiếu; TypeScript, 77/77 test và production build đạt. Không giảm số test so với baseline71.
- [x] Ảnh1440/390; overflow768/320. Headless1 trang, dSF1, reduced-motion; chỉ fixture, chặn mạng ngoài. 32 kiểm tra viewport: không tràn ngang, không lỗi runtime.

Audit nền: dùng token có sẵn, không thêm font/thư viện; chip có nút thật, tên truy cập, vùng bấm44px; header ngày không bị co. Baseline headless fixture đã lưu local1440/390, overflow768/320 đạt.

Audit báo cáo: giữ nguyên hook chuyển động, biểu đồ dynamic, công thức và RPC. Bảng có vùng cuộn được focus + header dính; chip chỉ gọi callback lọc hiện có. Sau xem ảnh đã sửa chiều rộng donut trong lưới nhỏ và không thu nhỏ số ở vùng thông tin cố định.

Audit dialog/import: dùng lại FocusDialog, giảm code trùng; Escape/focus/scroll lock dùng hook đã test. Hướng dẫn import vốn bị ẩn dưới1120px nay vẫn hiển thị trong vùng cuộn. Không thay analyze/save/parser/auth. Import có bốn bước từ state hiện có và loại nguồn có aria-pressed.

## Audit cuối theo bốn skill

- ui-ux-pro-max: tra cứu bảng dày/biểu đồ; cuộn riêng, nhãn trực tiếp, màu và số nhất quán, giữ bảng số liệu thay thế Sankey.
- frontend-design: giữ dark enterprise và font tự lưu; KPI trước, một phạm vi DMC3, thống nhất nhịp4/8.
- vercel-react-best-practices: chỉ tách phần trình bày OverviewWorkspace/FilterSummary; chart/Sankey/Three vẫn tải động, hover nằm trong cụm donut. Không thêm request/dependency.
- web-design-guidelines: rà focus/label/combobox/độ dài nội dung, vùng bấm44px, tabular numbers, reduced-motion và màu nền trình duyệt. Sửa mục tiêu chạm của bộ đổi chỉ số/summary số liệu và focus vùng cuộn bảng.

Giữ nguyên việc trạng thái lọc nằm trong workspace, chưa đồng bộ URL; thêm deep-link sẽ vượt phạm vi không thêm tính năng. Không thay đổi ngưỡng, làm tròn hoặc lời giải thích nghiệp vụ. `signIn`, `exportCsv`, `analyze`, `save` đối chiếu nguyên vẹn với baseline. Không sửa engine, overview/comparison, parser, workers, Supabase hay file Thứ hạng. Phần bổ sung lib motion được ghi riêng trong plans/README.md.

Kiểm chứng trình duyệt: OR medium+danger, bỏ riêng chip, xóa tất cả, focus liên kết hai donut; Escape và trả focus về query; Escape menu; khách không thấy bảng; lỗi mật khẩu có thông báo. Đã xem ảnh1440/390, trọng tâm desktop. Không đánh giá WebGL/FPS bằng mắt vì bật reduced-motion theo yêu cầu; vòng đời đã có test. Không thử import ghi Supabase; parser và trạng thái import dùng test/fixture.

Tất cả ảnh và fixture bundle tạm được bỏ khỏi Git. Bundle trong public đã dọn trước build cuối. Server và Chrome headless được tắt sau từng lượt. README/DESIGN cập nhật bố cục, token và nguồn quy tắc hiện hành. Không push/deploy.

Phạm vi thay đổi: `globals.css`, `theme.css`, `layout.tsx`; tách `overview-workspace.tsx` và `filter-summary.tsx`; tổ chức lại `dashboard.tsx`, các component Tổng quan/So sánh, dùng chung `focus-dialog.tsx` cho import; thêm ngắt cụm số tùy chọn trong `animated-number.tsx`. Kiểm thử mới ở `tests/ux-parity.test.ts`, fixture ở `tests/ux-fixtures.ts`.

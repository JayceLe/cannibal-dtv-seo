# Cannibal Query — thiết kế dashboard

Sản phẩm và quy tắc dữ liệu ở `PRODUCT.md`. Đây là nguồn quyết định giao diện hiện hành, thay thế các ghi chú chỉnh sửa tích luỹ trước đây.

## Hướng trình bày

Giao diện phục vụ thao tác đọc báo cáo SEO mỗi tuần. Phân cấp bằng phạm vi, tiêu đề, nhóm nội dung và số liệu; mỗi màu có một vai trò. Dùng bề mặt than đen, typography rõ, biểu đồ mang màu dữ liệu và các cụm thao tác gọn.

Luồng Tổng quan: tỷ lệ theo phạm vi → bốn nhóm nổi bật → tỷ trọng DMC3 → danh sách query để xử lý. Luồng So sánh: hai ngày → biến động nhóm → insight theo phạm vi → ba biểu đồ → bảng query và đối chiếu URL. Giữ nguyên thứ tự/nội dung bên trong Thứ hạng.

## Token và chữ

- Nền `#0b0b0b`, panel `#171717`, điều khiển `#222222`, chữ `#f5f5f5`, chữ phụ `#b3b3b3`.
- Query `#75b5ff`, impression `#b69aff`, an toàn/cải thiện `#57d99b`, trung bình `#f2bd59`, nguy hiểm/tăng cannibal `#f7808e`. Xanh `#1ed760` cho hành động chính và dấu chọn.
- Màu DMC3 lấy cùng một nguồn `categories.ts`, đồng bộ giữa donut, chú giải và bộ lọc.
- Be Vietnam Pro duy nhất. Tiêu đề chính 28/700; tiêu đề khối 19–24/600–700; nhãn 14/600; giá trị 26–32/700; thông tin phụ 13–16/500–600. Số dùng tabular-nums.
- Bo panel10, thẻ8, điều khiển6, badge4. Menu và dialog có lớp nổi; không làm cả bảng nhấc lên khi hover.

## Bố cục

Lề trang 40px desktop / 24px tablet / 16px mobile. Khoảng cách nội bộ 8–12px, trong một cụm 16–24px, giữa phần chính 32–40px. Bốn thẻ tổng quan cùng hàng nhãn–giá trị–thông tin phụ; tên nhóm dài được xuống dòng. Thẻ biến động DMC3 dùng ba cột để tên nhóm và nhãn dễ đọc; hạ còn hai/một cột theo màn hình.

Khối tỷ lệ giữ bố cục vòng bên trái, số liệu bên phải. Vòng132px desktop /104px ở khối nhỏ. Hai chỉ số cùng lưới; nhóm được so với toàn site và trong chính nhóm. Thanh chọn DMC3 nằm cùng tiêu đề và xuống hàng trên mobile.

Bộ lọc DMC3 cố định bên trái khi đủ chỗ, chuyển thành bộ chọn phía trên khi hẹp. Bảng có toolbar, bộ lọc, vùng kết quả và phân trang rõ ràng. Chỉ bảng được cuộn ngang khi cần; nội dung trang không tràn viewport. Chi tiết query dùng dialog để tập trung đọc URL dài và đối chiếu hai ngày.

Thứ hạng giữ biểu đồ, bảng, bộ lọc và logic hiện tại; chỉ chuẩn hoá padding24px và khoảng cách24px để cùng hệ thống.

## Tương tác và khả năng tiếp cận

Header dùng một component chung và một bộ quy tắc responsive. Tab hỗ trợ phím mũi tên/Home/End, một tab-stop; có liên kết bỏ qua header đến nội dung. Điều khiển icon có tên truy cập được. Menu dùng portal, có focus, Escape và phím chọn.

Metric card dùng chung motion: nền sáng nhẹ, nhấn vào thông tin, nâng tối đa2px, không phóng to chữ. Panel cấu trúc đứng yên. GSAP chỉ reveal các phần được đánh dấu rõ, không tự animate lại mọi từ trong bảng. ECharts sở hữu motion của series. Hover DMC3 đồng bộ donut/chú giải, cuộn riêng chú giải. Reduced motion giữ trạng thái cuối và dọn tween/listener khi thay đổi preference hoặc unmount.

## Quyền sở hữu code

`globals.css`: cấu trúc, khoảng cách, responsive nội dung. `theme.css`: màu, bề mặt, trạng thái, header responsive. `rankings.css`: trình bày tab Thứ hạng. `design.ts`: màu biểu đồ. Không thêm lớp CSS ghi đè mới để sửa một cấu trúc đã có.


## Chuyển động

Tính cách: chính xác, điềm tĩnh, đáng tin. Không phóng chữ, không nảy, không lặp hiệu ứng trên số liệu bảng. `src/lib/motion-tokens.ts` là nguồn thời gian; CSS dùng token tương ứng. Không thêm thư viện.

| Hành động | Thời gian | Easing |
| --- | --- | --- |
| Nhấn bằng con trỏ | 120ms | power2.out |
| Hover / menu / đóng | 180ms | power2.out |
| Đổi phạm vi / cập nhật số KPI | 240ms | power2.out |
| Mở dialog | 280ms | power3.out |
| Xuất hiện / số KPI lần đầu | 480ms | power3.out |
| Stagger nhóm | 70ms, tổng delay ≤280ms | power3.out |

Header → tỷ lệ theo phạm vi → KPI → phân bố → danh sách. Nội dung ban đầu luôn có thể đọc; reveal chỉ bắt đầu khi phần tử vào viewport. GSAP sở hữu transform/opacity của thẻ và lớp spotlight riêng; CSS sở hữu màu nền, viền, focus và backdrop. SVG tỷ lệ giữ nguyên cung đúng số liệu, không đổi độ dày khi hover. Thanh URL scaleX theo tỷ lệ hiện có và có mốc 20%; số đứng yên. Tick hoàn tất import dùng stroke SVG một lần, không dùng cho dữ liệu.

Dấu chọn tab/DMC3 dùng Flip, không tạo hai chỉ báo. ScrollTrigger chỉ tải khi có phần so sánh cần reveal; không pin hay đổi cuộn. ECharts giữ quyền điều khiển series. Three giữ lazy-load desktop, pointer parallax có giới hạn và intro dưới một giây; không có RAF vô hạn.

Menu giữ mounted cho lượt đóng, đảo chiều từ trạng thái hiện tại; bàn phím mở/đóng ngay. Dialog giữ top layer, focus trap và scroll lock tới hết lượt đóng, rồi trả focus. Reduced motion thay đổi trực tiếp: kết thúc tween, hiện trạng thái cuối, bỏ WebGL. Unmount dọn observer, listener, tween và chỉ báo.

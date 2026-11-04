# Cập nhật giới hạn trên bản chính thức

Baseline: `307bb3b017e22bcf1587e79d9c11ce90c41b655e`. Đã đối chiếu metadata của domain production `cannibal-query.vercel.app` trước khi sửa. Bản redesign bị bỏ được giữ riêng trên nhánh `redesign`.

| Yêu cầu | Thực hiện | Kiểm chứng |
| --- | --- | --- |
| Giữ giao diện gốc, thu gọn ô | Giữ palette, font, hiệu ứng và chart gốc; giảm phần trống trong 4 KPI, tỷ lệ và donut | 4 KPI cùng cao 168px tại 1440px trên fixture có đồng hạng |
| DMC3 chỉ bám ở khu bảng | Đưa tỷ lệ và donut ra ngoài layout sidebar; sidebar bắt đầu ở bảng query | DOM thứ tự + kiểm tra vị trí bằng trình duyệt |
| Query dưới 20 impression cần URL 2 trên 60% Top 1 | Dùng chung điều kiện cho engine, impression phụ, URL eligibility, so sánh, giải thích và rule dialog | Đúng 60% không đạt; trên 60% đạt; tổng đúng 20 áp dụng ≥20% |
| Database đồng nhất | Migration mới cập nhật hàm impression phụ, trigger ghi snapshot, tính lại dữ liệu cũ; giữ RLS và nguồn URL | PostgreSQL cục bộ (PGlite), dữ liệu giả lập; kiểm tra INSERT/UPDATE và generated column |
| Biểu đồ 5 ngày, chọn nhiều Top | Thay website card; một cột/ngày = tổng các dải Top được chọn; theo DMC3 và khoảng ngày hiện có | 5 nhãn ngày desktop, chọn nhiều, reset Tất cả, chọn CAMERA; unit test tổng và phạm vi DMC3 |

Kiểm thử: 83/83 test đạt; TypeScript và production build đạt. Kiểm tra trực quan 1440px và 390px; kiểm tra tràn ngang 768px và 320px. Không có lỗi runtime trong các luồng kiểm tra. Trình duyệt dùng fixture, reduced motion, không WebGL, đóng sau khi kiểm tra. Đã giữ nút xem tất cả từ khóa, số từ khóa, số ngày, Top 100 và N/A trong footer của chart thay thế.

Bản mẫu và ảnh nằm trong thư mục `outputs` của workspace, dùng dữ liệu thử, không kết nối hoặc ghi database thật. Chưa deploy, chưa push và chưa áp dụng migration production. Khi phát hành phải cập nhật database và frontend cùng đợt để số liệu server, chi tiết và bộ lọc dùng cùng rule.


## Tinh chỉnh màu sau khi duyệt bố cục

- Giữ nguyên toàn bộ bố cục và logic; thay token màu ở CSS/`design.ts`, palette DMC3 và palette nhóm Top dùng chung.
- Nút chính xanh đậm/chữ trắng; màu nội dung rõ hơn, bỏ nhóm màu pastel nhạt; hover bớt pha trắng. Xanh/vàng/đỏ giữ đúng nghĩa cải thiện/trung bình/tăng cannibal.
- Kiểm tra màu: chữ trạng thái và nút chính đạt tương phản tối thiểu 4,5:1 kể cả hover; đủ 27 dấu màu DMC3 khác nhau, tương phản tối thiểu 4,05:1 trên nền panel.
- Xem trực quan Tổng quan, So sánh và Thứ hạng ở 1440px; kiểm tra đổi DMC3 và nhiều nhóm Top. Không có lỗi runtime hoặc thay đổi chiều cao 4 KPI (168px). 83/83 test và production build đạt. Không deploy hoặc ghi database thật.

# Tối ưu code và tải trang — 04/11/2026

Mốc trước sửa: `9579b3f` (bản production đã duyệt). Giữ nguyên giao diện, màu sắc, nội dung báo cáo, dữ liệu gốc, làm tròn và rule cannibal.

## Thay đổi

- Tải riêng Tổng quan, So sánh và hộp quy tắc khi cần; không kéo toàn bộ giao diện báo cáo vào màn đăng nhập.
- Chỉ gọi `seo_overview` khi ở Tổng quan và đã có ngày dữ liệu; không gọi trước khi chọn được import hoặc khi đổi bộ lọc ở tab khác.
- Bỏ Sankey và hàm vẽ cũ sau khi người dùng đã thay bằng biểu đồ cặp thanh. Danh sách số liệu chuyển trạng thái vẫn giữ nguyên.
- Biểu đồ không vẽ cấu hình rỗng trước dữ liệu, không resize lại khi kích thước không đổi. Giữ hiệu ứng, giảm chuyển động và dọn listener/observer khi đóng.
- Tính impression cannibal bằng hai lượt duyệt URL, không sao chép/sắp xếp danh sách. Vẫn loại đúng một Top 1, giữ ngưỡng theo tổng impression, không sửa mảng nguồn.
- Thu thập ngày và DMC3 trong báo cáo thứ hạng bằng Set trực tiếp, tránh tạo mảng trung gian cho toàn bộ ô ngày.
- Bỏ mã demo không có đường truy cập, tham số demo luôn false và CSS của các thành phần đã bị thay thế. Không bỏ kiểm tra file, ánh xạ, phiên đăng nhập hoặc lỗi import.

## Kết quả đo

Cùng máy, production build trước/sau; dung lượng tính từ file `.next`, không phải thời gian tải qua mạng.

| Chỉ số | Trước | Sau |
| --- | ---: | ---: |
| JavaScript tham chiếu ở trang đầu | 1.024.511 byte | 955.704 byte |
| Cùng tập tin, gzip | 309.080 byte | 289.955 byte |
| Chunk biểu đồ lớn nhất | 591.448 byte | 556.985 byte |
| Chunk biểu đồ, gzip | 200.464 byte | 189.191 byte |
| Tổng mọi chunk JS | 2.358.666 byte | 2.352.632 byte |
| Tổng gzip mọi chunk JS | 718.173 byte | 719.651 byte |

Chia bundle làm tổng gzip mọi chunk tăng khoảng 0,2%, đổi lại tải đầu giảm 6,2% gzip. Không đồng nghĩa toàn bộ website nhanh hơn cùng tỷ lệ.

Phép đo giả lập 10.000 bản ghi, mỗi bản ghi 30 URL: trung vị 9 lượt sau làm nóng, cộng impression giảm từ 8,29ms xuống khoảng 0,6ms. Chỉ là chi phí hàm tính trong môi trường đo, không phải thời gian phản hồi database.

## Kiểm chứng

- 86/86 test đạt; TypeScript và production build đạt.
- Đối chiếu cách cộng mới với snapshot sắp xếp, dữ liệu không đổi thứ tự và các ngưỡng cũ.
- Sửa một assertion cũ đếm 10 thẻ, nay đúng 4 thẻ theo giao diện đã duyệt; không thay kỳ vọng phân trang hay số liệu.
- Kiểm tra tương tác bằng fixture trên một trang headless: một lần gọi Tổng quan ban đầu; đổi CAMERA trong So sánh chỉ gọi `seo_comparison_overview`; mở được Thứ hạng; quay về Tổng quan vẫn giữ CAMERA. Không lỗi runtime.
- Không chụp ảnh hoặc QC lại toàn bộ mobile; không sửa SQL/RLS, không ghi database thật; không thêm dependency.

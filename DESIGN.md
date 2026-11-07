# Cannibal Query — SEO editorial ledger

Sản phẩm và cách tính nằm ở `PRODUCT.md`. Tài liệu này quyết định giao diện của bốn tab báo cáo.

## Mục đích

Người làm SEO cần đọc nhiều số liệu, so sánh ngày và lần theo query đến URL. Giao diện phải cho họ thấy phạm vi, trạng thái và bằng chứng ngay trong luồng làm việc. AIO là công cụ phân tích cùng hệ thống, không phải một trang quảng bá AI.

## Hệ thị giác

- **Nền và mực:** canvas giấy ấm `#f2efe8`, panel giấy sáng `#fffdf8`, mực `#202922`, header xanh rừng `#102f26`. Các mảng màu này tách vùng làm việc rõ mà không tạo độ chói.
- **Đường kẻ:** `#d7d3c9` cho bảng và ranh giới nhóm; `#d3cfc4` cho điều khiển; `#8f988c` khi hover. Bảng ngày và các ô so sánh có đường dọc để mắt theo đúng cột.
- **Màu hành động:** xanh rừng `#173e31`, hover `#225442`, focus `#1d6550`. Đồng đất `#995c31` chỉ đánh dấu trình tự và điểm nhấn; không dùng cho trạng thái lỗi.
- **Màu dữ liệu:** query xanh thép `#245b78`, impression nâu mực `#755d40`, an toàn `#176448`, cảnh báo `#986022`, nguy hiểm `#a23d36`, chưa đủ căn cứ `#626d63`. Trạng thái luôn kèm chữ, không chỉ dựa vào màu.
- **Chữ:** Be Vietnam Pro 500/600/700. H1 32–46px tùy trang, H2 22–28px, nội dung 14–16px. Số liệu căn thẳng và dùng tabular numerals. Nhãn dùng kiểu câu thông thường, không viết hoa có giãn chữ.
- **Hình khối:** panel chính bo 12px, điều khiển 6–8px. Panel phẳng với viền rõ, không chồng thẻ trang trí hoặc bóng phát sáng.

Các token dùng thật nằm ở `src/app/globals.css`. Màu ECharts nằm ở `src/lib/design.ts`; bảng màu DMC3 nằm ở `src/lib/categories.ts`. Không tự sao chép bảng màu DMC3 trong tài liệu này vì code là nguồn duy nhất.

## Bố cục từng tab

- **Tổng quan:** bốn thẻ tín hiệu đi trước; tỷ lệ và phân bổ theo DMC3 ở dưới; bộ lọc và bảng query giữ nguyên phạm vi dữ liệu. Tiêu đề khu vực có một đường kẻ dưới để dẫn mắt.
- **So sánh:** ngày và phạm vi đứng gần số liệu. Trạng thái tăng/giảm dùng màu ngữ nghĩa. Các biểu đồ và bảng URL tách rõ ngày bằng đường kẻ, dữ liệu thiếu không tô thành số không.
- **Thứ hạng:** bảng DMC3 hiển thị bốn ngày mới nhất, cuộn ngang cho ngày cũ. Top 1 và Top 2–3 là hai bộ lọc riêng, chọn nhiều thì cộng số key như hiện tại. Bảng Số lượng Top toàn chiều ngang, kẻ ô nhẹ theo ngày.
- **AIO:** đầu trang ngắn, tiếp theo là vùng nhập liệu hai cột có đường chia. API key và cấu hình là nhóm rõ trong cùng vùng, không lồng thêm thẻ trang trí. Tiến trình là ba bước có nhãn thật và một thanh tiến độ; không có 3D, neon hoặc query minh họa. Kết quả, bằng chứng đoạn văn và rank tracker nằm bên dưới theo trục đọc dọc.

## Luồng AIO và tính trung thực

- Mở lại tab AIO có mẫu nhập trống. Lần bấm **Chạy audit** luôn mở một job mới. Keyword/URL không được nạp sẵn từ audit trước. Query minh họa chỉ nằm ở placeholder chung, không xuất hiện như kết quả đang chạy.
- Bên trong một job, checkpoint phục vụ tiếp tục sau giới hạn thời gian của một request. Nó không được đọc bởi job mới. Không lưu API key vào checkpoint hoặc kết quả.
- Chỉ cho thấy query/door thực khi backend đã trả; trạng thái chờ dùng keyword người dùng vừa nhập và số trang thật. Lỗi nêu vấn đề và cách thử lại.
- Mỗi bảng điểm có đoạn đối chiếu, URL nguồn và nhãn trường hợp. Điểm số không thay thế bằng lời khẳng định không có bằng chứng.

## Chuyển động và tiếp cận

Chuyển động ngắn để nhận biết thay đổi trạng thái, dùng transform/opacity và không làm các số liệu dịch chỗ. Hỗ trợ reduced-motion. Hover, focus, disabled, loading, error và empty phải đọc được; focus hiện ngay. Mọi bảng dài cuộn trong vùng riêng, không làm trang tràn ngang. Màu chữ và điều khiển đạt tương phản cho đọc dữ liệu trên desktop; màn hình nhỏ xếp cột mà vẫn giữ thao tác chính.

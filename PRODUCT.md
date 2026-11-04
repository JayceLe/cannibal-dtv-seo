# Cannibal Query

Dashboard SEO nội bộ của Điện Thoại Vui, phục vụ đọc báo cáo hằng tuần, lọc DMC3 và xác định query có URL cạnh tranh để xử lý.

## Nội dung và thao tác

- Tổng quan: tỷ lệ query và impression cannibal trên toàn site / trong DMC3; bốn thẻ nhóm nổi bật; hai donut tỷ trọng DMC3; danh sách query, bộ lọc mức độ, tìm kiếm và chi tiết URL.
- So sánh: hai ngày dữ liệu, biến động DMC3, các insight, ba biểu đồ, bảng query của ít nhất một ngày, chi tiết URL hai ngày và bốn chỉ số giải thích thay đổi.
- Thứ hạng: import SpySERP, chọn thời gian và DMC3, phân bố thứ hạng, xu hướng, số lượng Top, danh sách biến động và chi tiết.
- Quy tắc, import và xuất CSV luôn có thể tìm thấy từ header phù hợp với báo cáo.

## Quy tắc dữ liệu đã chốt

Bộ keyword gốc cung cấp quan hệ DMC3 cho mọi lần import. Query–URL loại dòng chứa `#` rồi map với bộ gốc. Một ngày giữ dữ liệu import mới nhất. Top 1 / Top 2 được xếp theo impression. Query có tổng impression dưới 20 chỉ bị cannibal khi URL thứ hai trên 60% impression Top 1; từ 20 impression trở lên giữ ngưỡng ≥ 20%. Impression cannibal chỉ cộng URL phụ đạt ngưỡng tương ứng, không cộng Top 1. Làm tròn rank một chữ số trước khi tính gap và phân loại. So sánh gồm cả query chỉ có một ngày; thiếu dữ liệu không giả thành số 0.

SpySERP không dùng cột Main để phân nhóm. Giữ 20 keyword chưa map trong nhóm tương ứng để tổng khớp nguồn; `-2` là N/A. Các phần trăm và rank trong tab Thứ hạng trình bày một chữ số thập phân.

## Cam kết giao diện

Một font Be Vietnam Pro 500/600/700, nền tối than đen theo tinh thần Spotify, màu phân loại mang nghĩa cố định. Giữ đầy đủ nội dung hiện có. Thứ hạng chỉ được chuẩn hoá bố cục ngoài, không thiết kế lại báo cáo. Dashboard cần dễ đọc, dễ lọc và rõ trạng thái hơn; hiệu ứng phục vụ thao tác, không làm số liệu dịch chuyển hay biến mất.

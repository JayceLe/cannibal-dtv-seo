# Check Rank

- Tab Check Rank tách khỏi báo cáo thứ hạng SpySERP và bước rank của AIO. Mỗi dự án có tên, domain chính xác và phạm vi Top 10/30/100.
- Tối đa 35.000 từ khóa khác nhau trong một dự án. Có thể nhập từng dòng hoặc import XLSX, CSV, TSV, TXT; file được đọc trong Web Worker. Bảng hiển thị 100 dòng mỗi trang để không dựng 35.000 hàng trong DOM.
- Tra rank dùng cùng cầu nối SCheckPro với AIO, chỉ chạy khi người dùng bấm Cập nhật. Tên miền khớp chính xác, bỏ `www`, không xét slug. Kết quả Google không khớp truy vấn hoặc trang xác minh bị từ chối để tránh ghi sai rank.
- Mỗi kết quả hoàn tất được lưu riêng cùng rank hiện tại, rank cũ, tốt nhất, URL và lịch sử. Nút Dừng ngắt lượt hiện tại, Tiếp tục bắt đầu từ vị trí đã lưu. Khi Google giới hạn truy cập, dừng và giữ phần đã kiểm tra; không giả định 35.000 từ khóa có thể kiểm tra trong một phiên.
- Dự án và lịch sử nằm trong IndexedDB của trình duyệt, phân vùng theo tài khoản đăng nhập. Chúng không đồng bộ giữa thiết bị; xuất XLSX/CSV thường xuyên để sao lưu. Xóa dữ liệu trình duyệt cũng xóa dự án tại thiết bị đó.
- XLSX xuất trong Web Worker để giao diện không bị treo khi tạo file lớn. Lượt check hàng loạt là tuần tự vì giao thức sự kiện của tiện ích không gắn ID phản hồi với từng yêu cầu.

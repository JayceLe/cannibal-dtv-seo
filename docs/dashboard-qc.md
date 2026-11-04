# QC dashboard — 04/11/2026

## Phạm vi

Toàn bộ Tổng quan, So sánh, header, menu và chi tiết query. Thứ hạng chỉ chuẩn hoá padding/khoảng cách. Nội dung và quy tắc số liệu hiện có là tiêu chuẩn bảo toàn.

## Các lượt rà theo skill

| Skill | Phát hiện | Thay đổi |
| --- | --- | --- |
| Frontend Design | Tiêu đề và giá trị chưa phân cấp đồng nhất | Chuẩn hoá thang chữ, nhãn/giá trị/thông tin phụ, thứ tự heading |
| UI UX Pro Max | Sáu thẻ DMC3 chật, tên dài bị cắt, bộ lọc trên mobile nhỏ | Lưới ba cột, tên xuống dòng, chuẩn hoá cỡ chữ và breakpoint |
| Impeccable | Nhiều khối lồng và surface hover cùng nhấc lên | Cụm nội dung rõ, panel cấu trúc đứng yên, tập trung hiệu ứng vào dữ liệu/thao tác |
| Web Design Guidelines | Header thiếu skip link; icon/trạng thái điều hướng cần nhất quán | Skip link, tab keyboard, icon có nghĩa, ARIA và focus |
| Vercel Composition Patterns | Header trộn trong component quản lý dữ liệu | Tách DashboardHeader, giữ callback/state ở Dashboard |
| Vercel React Best Practices | JSON.stringify mỗi render chỉ để tạo dependency memo | Phụ thuộc trực tiếp vào mảng dữ liệu đã có, tiếp tục lazy-load chart/import |
| Dashboard Motion Design | Text tự reveal bên trong panel đã reveal tạo chuyển động kép | Một chủ sở hữu mỗi hiệu ứng, bỏ scan tự động chữ trong bảng |
| Ponytail | CSS lịch sử dư thừa, prop onOpen không còn người dùng | Xoá61 rule không dùng, gom ratio/header, bỏ prop thừa và định dạng mã đọc được |

## Kiểm thử

- Bộ kiểm thử dữ liệu, import, rank/gap, so sánh, biểu đồ, menu, dialog, motion.
- Thêm regression kiểm tra ba tab, keyboard, date scope và các action của header sau khi tách component.
- Kiểm tra TypeScript, production build, diff và detector thiết kế.
- QC trình duyệt: ghi kết quả thực tế khi hoàn tất, không thay hình ảnh bằng kiểm thử DOM mô phỏng.

Nguồn hướng dẫn Web Interface Guidelines: https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md

## Kết quả đã thực hiện

- 64/64 bài kiểm thử đạt; TypeScript và production build đạt.
- Detector thiết kế không báo lỗi trong các mục tiêu được rà.
- Đã xem bố cục Tổng quan và So sánh trên Chrome desktop. Đã xác nhận chọn DMC3 tên dài cập nhật cả tỷ lệ toàn site và trong nhóm; header/bộ lọc/chi tiết được kiểm tra bằng DOM và bộ test tương tác.
- Công cụ browser tiếp tục báo bị tắt dù người dùng đã bật lại; ảnh native có lúc không đồng bộ với cây truy cập. Chưa xác nhận hình ảnh mọi breakpoint và mọi trạng thái hover. Không coi kiểm thử SVG/DOM là kiểm tra hình ảnh trên thiết bị thật.
- Tab Thứ hạng: thay đổi chỉ ở khoảng cách/padding khối ngoài; file component và phép tính không đổi.
- Không ghi thử dữ liệu import lên database trong đợt chỉnh giao diện này.

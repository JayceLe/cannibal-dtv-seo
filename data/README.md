# Bản sao dữ liệu SEO

Thư mục `snapshots/2026-10-30` chứa bản xuất từ Supabase ngày 30/10/2026 dưới dạng JSON Lines nén gzip. `manifest.json` ghi số dòng và SHA-256 cho từng bảng. `seo_keywords` là bộ từ khóa gốc dùng chung; `seo_imports` và `seo_records` là dữ liệu đã map theo ngày. `seo_batches` là các lô import tạm tại thời điểm sao lưu.

Mã và cấu trúc database nằm trong `src/` và `supabase/migrations/`. Bản xuất không bao gồm tài khoản xác thực, mật khẩu hoặc khóa truy cập. Khi khôi phục sang Supabase khác cần tạo tài khoản workspace và gán `owner_id` của các bản ghi cho tài khoản đó; cột `cannibal_impressions` được database tự tính. Đây là bản sao tại thời điểm xuất, không tự cập nhật theo các lần import sau.

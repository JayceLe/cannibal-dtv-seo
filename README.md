# Cannibal Query

Dashboard SEO dùng Next.js, Supabase Postgres và Apache ECharts. Điều hướng phân tích có đúng hai tab: Tổng quan và So sánh. Giao diện doanh nghiệp tối: nền xanh navy trung tính, bốn thẻ tổng quan DMC3, hai biểu đồ phân bổ và cột chọn DMC3 bên trái khu phân tích. Mỗi DMC3 có một màu riêng, dùng nhất quán trên biểu đồ, chú giải và bộ chọn. Xanh lá / vàng / đỏ chỉ mức độ an toàn / trung bình / nguy hiểm. Top 1 và Top 2 được nhấn riêng trong chi tiết URL. Toàn bộ UI, số liệu và biểu đồ dùng một font Be Vietnam Pro, tải từ cùng website; không phụ thuộc Google Fonts hay Google Sheets.

## Chạy tại máy

Node.js 24. Chạy `npm ci`, sao chép `.env.example` thành `.env.local`, điền URL và publishable key Supabase. Chạy `npm run dev` hoặc `npm run build` rồi `npm start`.

## Bộ từ khóa gốc dùng chung

Bộ KW gốc là danh mục chuẩn dùng chung cho toàn bộ workspace và tất cả ngày import, không thuộc riêng một ngày. Mỗi file Query–URL mới phải đối chiếu với bộ gốc này để map từ khóa và lấy DMC3. Import dữ liệu theo ngày không thay thế, không bổ sung ngầm hoặc xóa bộ gốc. Chỉ cập nhật bộ gốc khi người dùng chủ động yêu cầu. Query không khớp bộ gốc không đưa vào dashboard; dữ liệu đã map được lưu theo ngày để so sánh lịch sử.

## Dữ liệu

- `seo_keywords`: danh sách gốc đã chuẩn hóa, một query có nhiều DMC3.
- `seo_imports`: từng lần import theo ngày dữ liệu do người dùng chọn, có fingerprint chống import trùng.
- `seo_batches`: dữ liệu tạm theo lô tối đa 1.000 cặp Query–URL; retry idempotent.
- `seo_records`: snapshot của các query đã map theo ngày, giữ nguyên DMC3 khi import.

File Excel/CSV được đọc và tổng hợp trong Web Worker. Trình import lấy bộ khóa gốc bằng RPC có RLS, loại URL chứa # trước, bỏ query không khớp và gộp từng cặp Query–URL. Chỉ các cặp đã map được gửi lên Postgres; hoàn tất phân tích trong một transaction. Server kiểm tra lại việc map và loại #; không tạo snapshot cho keyword chưa có dữ liệu. Chỉ snapshot `ready` hiển thị; lô tạm được dọn sau khi hoàn tất. Query ngoài bộ gốc được thống kê và không cộng vào KPI. Dòng URL chứa # được loại, không sửa file nguồn. Từ khóa được map giữ nguyên dấu, chuẩn NFC, chữ thường và khoảng trắng.

Danh sách gốc import theo chế độ thêm/cập nhật, không xóa query cũ. Nếu mạng gián đoạn giữa các lô, chọn lại cùng file để tiếp tục; bản gốc đang cập nhật có thể mới hoàn tất một phần nên hãy hoàn thành import gốc trước khi nạp tuần. Lịch sử đã lưu không đổi theo lần cập nhật gốc mới.

## Chỉ số

Chỉ query đã map với dữ liệu tuần được đưa vào dashboard, bộ lọc, số đếm, biểu đồ và CSV. Query gốc chưa có dữ liệu tuần không xuất hiện. Tỷ lệ cannibal = query đạt ngưỡng / query đã map trong phạm vi DMC3. Impression cannibal = tổng impression của các URL phụ đạt ≥ 20% impression Top 1. Loại Top 1 và mọi URL dưới ngưỡng. Tỷ lệ impression cannibal = impression cannibal / tổng impression đã map; mẫu số vẫn gồm các URL hợp lệ của query đã map. Cột sinh tự động `cannibal_impressions` lưu kết quả mỗi snapshot, dùng chung cho tổng quan, phân nhóm và so sánh. % tăng/giảm so với kỳ trước dùng chênh lệch / giá trị kỳ trước; khi kỳ trước bằng 0 hiển thị chưa có cơ sở %. DMC3 có thể giao nhau, không cộng các danh mục để suy ra số query duy nhất. Hiển thị đủ danh mục DMC3 trong bộ gốc, kể cả nhóm có 0 query đã map trong kỳ; không đưa query chưa map vào số liệu. Số bên cạnh mỗi DMC3 là query có cannibal. Hai biểu đồ tròn phân bổ query cannibal và impression cannibal dùng tổng theo nhóm làm mẫu số; query thuộc nhiều nhóm được tính ở từng nhóm để mỗi biểu đồ cộng thành 100%. Hai vòng DMC3 so với toàn site dùng query đã map toàn site và impression toàn site làm mẫu số. Thẻ Có cannibal dùng query đã map trong phạm vi đang chọn làm mẫu số. Không trình bày Click hoặc CTR; file tuần chỉ cần Query, URL, Impression, Position. Cột Click nếu có được bỏ qua.

Quy tắc gốc: ít nhất 2 URL, một URL cạnh tranh đạt 20% impression leader. Leader xếp theo impression. Dữ liệu cũ giữ nguyên kết quả đã tính; khi import mới không cần Click. Vị trí leader >3: danger. Leader ≤3: gap tuyệt đối <0.5 safe, 0.5–1 medium, >1 danger. Bình quân position theo impression; nếu một phần position thiếu thì position tổng là null. Dòng lỗi đã map làm trạng thái data_issue.

## Truy cập

Website dùng mật khẩu workspace, không yêu cầu nhập email, nhận OTP hay xác minh mail. Tài khoản nội bộ Supabase được cấp sẵn. Dữ liệu có RLS theo chủ tài khoản, publishable key không cấp quyền đọc dữ liệu riêng khi chưa đăng nhập. Mật khẩu được bàn giao riêng, không nằm trong mã nguồn hoặc Vercel environment. Có thể đổi mật khẩu trong Supabase Auth admin và tiếp tục nhập mật khẩu mới ở website.

Bản chính thức mở bằng mật khẩu workspace và chỉ đọc dữ liệu thật trong Supabase. Không hiển thị dữ liệu minh họa cho khách chưa mở workspace. Bộ dữ liệu giả chỉ giữ trong mã kiểm tra, không được nhập vào database sản xuất. Bộ từ khóa gốc và dữ liệu Query–URL đã được đối soát trước khi đưa vào vận hành.

## Triển khai

Vercel Framework: Next.js, Node 24, `npm ci`, `npm run build`. Đặt hai biến `NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Không đưa service-role key vào trình duyệt. Các SQL migration trong `supabase/migrations` đã được áp dụng cho dự án hiện tại; không chạy lại nguyên trạng ở database đã có schema này.

Chức năng: Tổng quan với bốn thẻ nhóm có cannibal / tỷ lệ cao nhất / tỷ lệ thấp nhất / impression cannibal lớn nhất, hai biểu đồ tròn DMC3, bộ chọn DMC3 cột trái và bảng query có hàng mở rộng URL; tìm kiếm chứa/khớp chính xác, lọc nhóm query và mức độ, sắp xếp, phân trang; So sánh hai kỳ; xuất CSV UTF-8 chống công thức; import XLSX/CSV/TSV trong cửa sổ riêng. Gợi ý ưu tiên hiện dựa trên quy tắc, chưa tích hợp lại báo cáo Gemini từ Apps Script. Có giới hạn 150 MB mỗi file; mọi lần import lưu trong lịch sử của tab So sánh. Chưa benchmark tải đồng thời hoặc dữ liệu hàng triệu dòng.

## Kiểm tra

`npm test` kiểm tra ngưỡng phân loại, thiếu rank, chuẩn hóa tiếng Việt, số theo locale và tổng hợp tỷ lệ. `npm run build` kiểm tra TypeScript và build sản xuất. Kiểm tra SQL thực đã chạy với bộ gốc 31.114 query và rollback toàn bộ dữ liệu thử. File XLSX thật đã được kiểm tra bằng hai bộ đọc Excel, tính toán độc lập và đối chiếu với snapshot cùng tổng quan trong Postgres.

Chi tiết query hiển thị tỷ trọng impression cannibal của query trên tổng impression từng DMC3, URL xếp theo impression, nhãn TOP 1/TOP 2, % impression so với Top 1 và ngưỡng cạnh tranh 20%. Khi impression Top 1 bằng 0, tỷ lệ hiển thị dấu —. So sánh trạng thái chỉ xét query có dữ liệu ở cả hai kỳ.

Bốn thẻ đầu trang luôn phản ánh toàn site. Nhóm có tỷ lệ cao/thấp nhất chỉ xét nhóm có query đã map; trường hợp đồng hạng được ghi rõ. Phần chi tiết khi chưa chọn DMC3 có hai tỷ lệ toàn site (query và impression). Khi chọn DMC3, thêm hai tỷ lệ trong chính nhóm; hàng đầu so cùng tử số với mẫu số toàn site. Mẫu số query gồm cả cannibal và không cannibal đã map. Tử số impression chỉ gồm URL phụ đạt ≥ 20% Top 1. Bộ lọc mức độ có số lượng, theo DMC3 + nhóm query + tìm kiếm và không phụ thuộc mức độ đang chọn; không còn nút Chưa phân loại.

Ngày dữ liệu được chọn tự do trong trình import, không buộc thứ Hai. Cột Postgres cũ `week_start` được giữ tên để tương thích nhưng chứa đúng ngày người dùng chọn; không tự đổi ngày. Cùng file/cùng ngày được chặn trùng; lịch sử giữ từng bản ghi để so sánh. File Keywords + DMC3 là bộ gốc, không được nhập nhầm thành số liệu Query–URL theo ngày.

Bộ đọc Excel/CSV và phần chuẩn hóa/map dữ liệu dùng chung `src/lib/import-parser.ts`. Giữ kiểu số gốc của Excel, tránh biến vị trí thập phân như 2.125 thành số phân cách hàng nghìn khi chọn locale Việt Nam. Click/CTR không tham gia tính toán. Thống kê loại bỏ gồm query không map được đã loại ở trình duyệt và phần loại bổ sung ở database; không lưu nội dung các query bị loại.

Bố cục chính bắt đầu bằng Tổng quan toàn site, không có khối giới thiệu lặp lại. Ngày dữ liệu ở header, chỉ hiển thị dd/mm/yyyy. Bốn thẻ giữ tiêu đề, bên dưới lần lượt là nhóm / giá trị / ghi chú; tổng số DMC3 có cannibal trình bày trên tổng DMC3 gốc. Màu tổng số là xanh dương, tỷ lệ cao nhất đỏ, thấp nhất xanh lá, impression tím. Các ô tỷ lệ dùng xanh dương cho query, tím cho impression với chữ sáng; phần trăm nằm riêng trong vòng tròn. Số dài được xuống dòng theo cụm để tránh tràn.


## Chuyển động GSAP và Three.js

GSAP 3.15 điều phối xuất hiện một lần khi vào màn hình (480ms, lệch nhịp tối đa 165ms), hover/focus (240ms), nhấn (120ms), cập nhật dữ liệu (320ms), mở/đóng chi tiết URL (380/260ms) và hộp import (340/200ms). Nội dung ban đầu luôn hiển thị; không đổi số liệu sang số đếm chạy. Mỗi thuộc tính có một chủ sở hữu; ECharts giữ phần chuyển động của series (480/320ms), CSS điều khiển màu, mũi tên và nét vòng tỷ lệ.

Three.js 0.186 tạo nét khối hình học ở nền header; chỉ tải khi header hiện trên desktop từ 768px. Render theo tween GSAP và tương tác chuột; không chạy một vòng RAF vô hạn. Khi cuộn khỏi header, ẩn tab, đổi chế độ giảm chuyển động hoặc unmount, scene/tween/observer được dọn. Thiết bị không có WebGL vẫn dùng header bình thường. Không đổi cách cuộn trang hoặc cuộn bảng.

`prefers-reduced-motion` được theo dõi trực tiếp: ngừng tween, khôi phục nội dung đầy đủ, bỏ scene WebGL và rút gọn chuyển trạng thái. Kiểm tra DOM mô phỏng trong `tests/motion.test.ts` bao gồm nhấn/thả ngoài nút, unmount/remount, đảo chiều mở/đóng nhanh, thay đổi tùy chọn chuyển động và hủy tải scene bất đồng bộ. Các kiểm tra này không thay cho việc xem chuyển động thực tế trên trình duyệt/thiết bị.


## Hover và liên kết chú giải

Các thẻ có trạng thái hover/focus chung: nền và viền sáng, nâng 2px; thẻ tổng số dùng article thay vì một nút disabled. Màu phân loại và nội dung số không thay đổi. Hàng DMC3, bộ lọc và URL có trạng thái riêng rõ ràng; focus của phần nằm trong vùng cuộn dùng outline phía trong.

Hai donut liên kết qua cùng tên DMC3. Hover lát cắt hoặc focus/rê vào dòng chú giải sẽ nhấn mạnh đúng nhóm ở cả hai biểu đồ bằng action highlight/downplay của ECharts, giảm độ nổi của các lát và dòng khác, rồi cuộn riêng chú giải để nhìn thấy dòng tương ứng. Click mới thay đổi bộ lọc. Thông tin nhóm, số lượng và % nằm ở vùng cố định bên dưới biểu đồ, không dùng tooltip nổi đè lên số giữa vòng. Cuộn chú giải có thể ngắt bằng wheel/touch và tuân theo chế độ giảm chuyển động.


## Hiện số và chữ đồng bộ

Các số thống kê dùng AnimatedNumber: đếm từ 0 lần đầu xuất hiện trong viewport, hoặc chuyển từ giá trị đang trình bày đến giá trị mới trong 720ms (power2.out). Số thật luôn là nguồn tính toán; con số từng frame chỉ là trình bày. Khoảng trống theo độ rộng giá trị cuối giữ bố cục ổn định, aria-label cung cấp giá trị cuối và chế độ giảm chuyển động hiện trực tiếp. Giá trị hover của donut hiện tức thì để không nhầm nhóm. Chữ và heading hiện mềm trong 580ms; lệch nhóm tối đa165ms. Hủy tween và observer khi unmount hoặc đổi dữ liệu. Kiểm tra thêm số0, số âm, số thập phân, thay đổi nhanh và giảm chuyển động.


Chi tiết query hiện mở bằng dialog riêng, làm tối nền và giữ trạng thái lọc/phân trang khi đóng. Top1 dùng xanh, Top2 đỏ, URL tiếp theo đủ ngưỡng dùng vàng; chữ mô tả vẫn cho biết có được tính cannibal hay không. Bảng và chi tiết không chạy count-up. Kiểm tra bổ sung modal close/Escape/scroll lock, SVG tỷ trọng và ranh giới URL≥20%.


Gap rank trong bảng, chi tiết và CSV lấy chênh lệch tuyệt đối giữa rank gốc của Top1/Top2 theo impression. Chỉ làm tròn lúc hiển thị, thống nhất một chữ số thập phân cho Rank/Gap; không lấy hai rank đã làm tròn để tính. Ví dụ3.33121424030515−2.65379494007989=0.67741930022526, hiển thị0,7; không suy ra0,6 từ hai nhãn3,3và2,7. Quy tắc phân loại vẫn dùng số gốc.


Bộ lọc mức độ hỗ trợ chọn đồng thời safe/medium/danger theo phép OR. Bấm lại một mức để bỏ chọn; Tất cả xóa toàn bộ lựa chọn. RPC seo_overview giữ chữ ký cũ, p_status chấp nhận chuỗi phân cách dấu phẩy; điều kiện lọc chạy trước phân trang. Số đếm mức độ không bị ảnh hưởng bởi mức đã chọn. CSV dùng cùng quy tắc OR. Migration multi_level_filters đã áp dụng, không thay dữ liệu hay quyền RLS. Kiểm tra dữ liệu19/10: medium93 + danger386 =479 query.

## Giao diện so sánh

Migration `20261030010000_comparison_workspace.sql` bổ sung RPC `seo_comparison_overview` theo quyền RLS hiện có. Bảng gồm tất cả query chung hai ngày, tìm kiếm, lọc mới bị/hết cannibal, An toàn→Trung bình, Trung bình→Nguy hiểm và đổi mức độ; sắp xếp theo impression/biến động trước phân trang. Tổng quan kỳ và số lượng chuyển trạng thái tính độc lập với bộ lọc chuyển trạng thái. Sidebar giữ đủ danh mục DMC3, kể cả nhóm không đổi.

Chi tiết tải hai record song song khi mở, ghép cùng URL trên một hàng và xếp Top 1/Top 2 riêng từng ngày; không tải toàn bộ URL trong danh sách. CSV ở tab So sánh xuất đúng hai ngày và bộ lọc hiện tại. Bộ chọn ngày chỉ nhận ngày trước < ngày sau, tự xử lý xung đột và dùng bản import mới nhất nếu một ngày có nhiều bản.

Kiểm tra: 45 test tự động; 12 trường hợp RPC đối chiếu mô hình độc lập, kiểm tra ngày trùng/đảo chiều và cô lập quyền chủ sở hữu trong transaction đã rollback. Đã kiểm tra thêm 11 trường hợp API trên dữ liệu thật ngày 12/10 và 19/10/2026: 8.692 query chung, cannibal 581→592, impression cannibal 24.850→25.887. Đã xem trực tiếp trên trình duyệt, chọn DMC3 và chuyển Query/Impression trên desktop và điện thoại.

## Báo cáo so sánh và biểu đồ

Migration `20261030014202_comparison_report.sql` mở rộng RPC hiện tại theo cách tương thích ngược, giữ security invoker và quyền RLS. Mỗi DMC3 có tổng query, impression cannibal hai ngày và chênh lệch. Trường `report` cung cấp chuyển trạng thái độc lập với tìm kiếm/bộ lọc bảng, luồng đổi mức độ và tổng site riêng từng ngày. Không lưu thêm bản sao dữ liệu import.

Giao diện có sáu thẻ biến động nhóm, bốn nhận định, biểu đồ cột hai ngày, Sankey chuyển mức độ và thanh phân kỳ DMC3. Hai biểu đồ có bộ chuyển Query/Impression; chọn nhóm cập nhật báo cáo và bảng. Không cộng các nhóm chồng lặp để tính tỷ trọng site. Sankey chỉ thể hiện query đổi trạng thái, có danh sách số liệu thay thế; nhóm không có dữ liệu không tham gia xếp hạng. Đổi phạm vi không làm mất đủ danh mục DMC3.

Đã qua45 test tự động, gồm SVG320–1440px, dữ liệu rỗng/zero/số lớn, phạm vi báo cáo độc lập bảng, đồng hạng và thay đổi phần trăm rất nhỏ. Đối chiếu11 trường hợp API thật và12 trường hợp transaction rollback. Đã kiểm tra trực tiếp trên trình duyệt ở1440/390/320px, chọn DMC3, chuyển chỉ số, mở số liệu Sankey và không tràn ngang trên điện thoại. Báo cáo dùng Be Vietnam Pro500/600/700.

## Bộ chọn và giải thích chuyển trạng thái

SelectMenu thay các select ngày/sắp xếp bằng combobox có portal, tránh clipping trong bảng; hỗ trợ bàn phím, focus, đóng ngoài, cuộn và thích ứng viewport. Header ngày và ô sắp xếp được giữ gọn, đủ chỗ cho nhãn. Không sửa dữ liệu import hay quy tắc phân loại.

`comparison-evidence.ts` tính bốn thuộc tính từ URL gốc: impression URL phụ đạt20%, tỷ lệ URL phụ cao nhất so với Top1, rankTop1 theo impression và chênh lệch rank của Top1/Top2. Trạng thái được giải thích theo các ngưỡng hiện có, không suy ra cannibal chỉ từ tổng impression tăng. Trường hợp gap làm tròn có thể che ranh giới, ghi chú nêu rõ ngưỡng số gốc vừa vượt. Dữ liệu lỗi/thiếu rank và đổi URL dẫn đầu có thông báo riêng. Giữ bảng URL và cách ghép hai ngày.

50 test tự động đã đạt, gồm ngưỡng20% bao gồm điểm bằng20%, gap0,5/1, ưu tiên rankTop1>3, dữ liệu thiếu/lỗi, Top1 thay đổi, portal không bị panel cắt, chọn bàn phím và focus sau khi đóng menu. Đã kiểm tra UI thực trên desktop/điện thoại và query “thay pin iphone15 pro max” ngày12/10→19/10: An toàn→Trung bình do gap gốc tăng qua0,5.
# Tinh chỉnh màu và bề mặt

Tham khảo Spotify đã được nhập bằng `npx getdesign@latest add spotify`, lưu trong `spotify/DESIGN.md`. Giao diện dùng nền than đen nhiều lớp, thẻ và điều khiển bo góc nhỏ nhất quán. Màu dành cho số liệu, trạng thái và danh mục; hành động chính dùng xanh chức năng. Be Vietnam Pro, bố cục, hiệu ứng và logic được giữ nguyên.

Token CSS nằm trong `globals.css`, các quy tắc bề mặt trong `theme.css`, màu biểu đồ dùng `src/lib/design.ts` và danh mục dùng `src/lib/categories.ts`. Chữ và màu trạng thái đạt tương phản tối thiểu4,5:1 trên bề mặt tiêu chuẩn. `npm test`:50 bài đạt; `npm run build`:đạt.


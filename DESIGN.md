# Cannibal Query — giao diện và khoảng cách

## Bảng màu hiện hành — tham khảo Spotify

Đã nhập `npx getdesign@latest add spotify` vào `spotify/DESIGN.md`. Áp dụng có chọn lọc nền than đen, phân lớp bề mặt và bo góc; yêu cầu người dùng được ưu tiên hơn mẫu. Giữ nguyên Be Vietnam Pro, cỡ chữ, trọng lượng, khoảng cách, bố cục, thao tác và thời lượng chuyển động đã duyệt. Không sao chép font, nhãn viết hoa, logo, cấu trúc media hay bo tròn mọi thứ của Spotify.

Nền trang #0b0b0b, panel #171717, bề mặt điều khiển #222222, chữ chính #f5f5f5, chữ phụ #b3b3b3. Xanh #1ed760 chỉ dành cho hành động chính và dấu chọn chức năng; các tab điều hướng dùng nền trắng/chữ tối khi chọn. Query xanh #75b5ff, impression tím #b69aff. An toàn/cải thiện #57d99b, Trung bình #f2bd59, Nguy hiểm/tăng cannibal #f7808e; nền trạng thái dùng tint tối tiết chế. DMC3 giữ nguyên tên, thứ tự và quan hệ màu, điều chỉnh độ bão hòa/độ sáng để phân biệt rõ trên nền than đen; màu luôn đồng bộ giữa biểu đồ và danh sách.

Bo góc panel10px, thẻ8px, điều khiển6px, badge4px, menu8px. Phân lớp bằng sắc độ, viền trung tính và shadow chỉ cho menu/dialog/hover; không phủ màu trạng thái lên toàn bộ bảng. `globals.css` giữ cấu trúc, `theme.css` quản lý màu/bề mặt/bo góc, `src/lib/design.ts` quản lý token tương ứng cho biểu đồ. Phần hướng dẫn màu cũ bên dưới được thay thế bởi mục này.

Đã kiểm tra tương phản: chữ chính16,44:1, chữ phụ tối thiểu6,61:1 trong các bề mặt chuẩn, màu trạng thái6,27:1 trở lên; dấu màu DMC3 tối thiểu5,53:1 trên panel. Kiểm tra50 bài hiện có và production build đều đạt. Logic dữ liệu/import/bộ từ khóa gốc không thay đổi.

Giao diện phục vụ thao tác đọc số liệu SEO, lọc DMC3 và mở query để kiểm tra các URL cạnh tranh. Ưu tiên đọc nhanh, nhận biết phạm vi và thao tác ổn định.

## Nội dung đã chốt

- Giao diện tối, một font Be Vietnam Pro, trọng lượng 500/600/700.
- Hai tab Tổng quan / So sánh; ngày ở header dạng dd/mm/yyyy.
- Bốn thẻ tổng quan, ba nhóm nội dung mỗi thẻ. Thẻ đầu: tiêu đề / số nhóm / trên tổng số DMC3. Các thẻ còn lại: tiêu đề / tên nhóm / giá trị.
- Hai biểu đồ tỷ trọng DMC3. Bộ lọc ở trái, phân tích và bảng query ở phải.
- Khi chọn DMC3, tỷ lệ query và impression được so với toàn site và trong chính nhóm đó.
- Không hiển thị Click, không thêm ghi chú vào thẻ tổng quan.

Hai thẻ xếp hạng nhóm dùng query cannibal DMC3 / tổng query cannibal toàn site; không dùng tổng query đã map của nhóm làm mẫu số.

## Nhịp không gian

Dùng bậc 4px: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64. Khoảng cách có vai trò khác nhau:

- 8–12px: nhãn và dữ liệu cùng một thông tin.
- 16px: các điều khiển cùng nhóm.
- 24px: giữa các thẻ hoặc phần liên quan.
- 32px: giữa biểu đồ, tỷ lệ, bộ lọc và kết quả.
- 48–56px: phân tách Tổng quan và Phân tích chi tiết.
- Lề trang 40px desktop, 24px tablet, 16px điện thoại; padding khối chính 24–28px.

Các phần chính dùng nền và khoảng trắng để phân nhóm; không thêm khung lồng khung hoặc sọc trang trí. Giữ màu phân loại và danh mục đã được chốt. Thẻ tổng quan gọn; bảng dữ liệu có hàng thoáng nhưng vẫn cuộn trong vùng riêng khi cần.

## Responsive

Thẻ tổng quan chuyển 4→2 cột trước khi tên nhóm bị ép. Vòng tròn và chú giải của biểu đồ phản ứng theo bề rộng khối. Cột DMC3 giữ ở trái khi đủ chỗ; khi hẹp đổi thành selector phía trên dữ liệu. Header giữ cùng thứ tự DOM và thứ tự nhìn thấy. Số liệu dài được xuống dòng theo cụm; tên nhóm có title đầy đủ nếu cần rút gọn trong thẻ.

## Tham khảo

Áp dụng nguyên tắc grouping, rhythm và density từ https://github.com/pbakaus/impeccable/tree/main/skill/reference/layout.md và hướng dẫn Operate. Việc kiểm tra ảnh thực tế còn phụ thuộc quyền điều khiển trình duyệt.


## Chuyển động

Chuyển động giải thích thao tác: khối xuất hiện khi cuộn tới, hover nâng nhẹ tối đa 3px, nhấn thu 2%, cập nhật dữ liệu đổi độ đậm mềm, chi tiết URL mở/đóng theo chiều cao thực. Thời lượng thao tác lặp 120–320ms, khối/chi tiết 260–480ms, lệch nhịp tối đa 165ms. Nội dung luôn có thể đọc trước khi JavaScript chạy. Giữ số liệu thực, bố cục và kiểu chữ đã chốt.

Header có hình khối Three.js chỉ mang tính trang trí. Không chạy nền vô hạn, không vẽ lên số liệu, không thêm parallax vào bảng. Chế độ giảm chuyển động bỏ toàn bộ dịch chuyển/scene và để trạng thái cuối dùng được ngay.


## Trạng thái hover/focus

Các thẻ cùng ngôn ngữ nền sáng, viền rõ và nâng 2px; không dùng nút disabled cho thẻ tổng số mang tính thông tin. Các nút nằm trong danh sách cuộn không dịch chuyển lên xuống để tránh bị cắt. Tập trung bàn phím có độ rõ tương đương hover, outline ở trong khi nằm trong vùng cuộn.

DMC3 được nhấn đồng thời trong hai donut và hai chú giải. Lát khác có opacity 0.22; chữ các dòng khác dùng màu dịu #94a6bf, vẫn giữ tương phản đọc được. Chỉ cuộn vùng chú giải, không cuộn trang. Thông tin hover chiếm vùng cố định dưới donut, không đặt tooltip lên số giữa vòng. Chữ và số không bị làm mờ bởi hover hoặc thay đổi vị trí khi nội dung chi tiết đổi.


## Khối tỷ lệ độc lập

Tỷ lệ cannibal được tách khỏi cột query thành section ngang toàn trang, nằm giữa tổng quan và danh sách query. Header có tiêu đề, mô tả phạm vi ngắn và bộ chọn DMC3. Toàn site có một hàng hai vòng Query/Impression. Chọn DMC3 có hai hàng cùng lưới cột: nhóm so với toàn site, và trong chính nhóm. Phần trăm nằm trong vòng, tử số đậm, mẫu số nhẹ, nhãn mẫu số chỉ rõ phạm vi. Màu xanh/tím tiếp tục biểu thị Query/Impression. Bộ chọn phạm vi và sidebar dùng chung state; chọn nhóm trên tổng quan cuộn tới section tỷ lệ. Mobile xếp từng cặp xuống một cột và đưa selector xuống dưới tiêu đề.


## Tinh chỉnh khối tỷ lệ

Bỏ đoạn giải thích, ghi chú mẫu số và chữ “đã map” trong khối. Query/Impression giữ màu xanh/tím, vòng108px với nét7px, track tối và phần trăm trắng đậm. Tử số30px, mẫu số21px, nhãn nhỏ13px. Hàng Trong DMC3 tách bằng đường phân nhóm và tên DMC3; số lượng nhỏ vẫn dùng giá trị chính xác, không phóng đại độ dài cung.

Bộ chọn DMC3 có nhãn ngắn, mặc định Tất cả; popup dùng Be Vietnam Pro từ cùng site, kích thước cố định và danh sách có tìm kiếm. Nút giữ một dòng với title đầy đủ; tên trong danh sách được wrap. Hỗ trợ mũi tên, Home/End, Enter, Escape, Tab và đóng khi bấm ngoài. Chọn không làm nhảy vị trí trang.


## Vòng tỷ lệ lớn

Giữ bố cục vòng bên trái, phần trăm trong vòng và thông tin bên phải. Chart desktop144px; mobile112px. Không chuyển phần trăm ra ngoài hoặc thay đổi thứ tự nội dung.


## Chi tiết từ khóa nổi

Bấm query mở native dialog tối đa1280px, backdrop tối và blur3px để tập trung nội dung; khóa cuộn nền, Escape/nút đóng/bấm ngoài đóng cửa sổ. Header chỉ giữ query và trạng thái. Bỏ heading URL cạnh tranh, số URL, ghi chú công thức và dòng đếm URL đạt ngưỡng. Tỷ trọng cannibal / impression DMC3 dùng SVG donut96px, không đếm số. Bảng URL có lưới chung URL / Rank / Impression / So với Top1, ba cột số căn giữa; mobile đổi sang card gồm URL và hàng ba số. Top1 xanh, Top2 đỏ; các URL khác đạt ngưỡng cannibal≥20% Top1 màu vàng, các URL dưới ngưỡng trung tính. Nhãn Top2 không tự khẳng định URL đạt ngưỡng. Màu ở đây theo thứ tự URL, không thay quy tắc phân loại query.


Khối Tỷ lệ cannibal được đưa lên đầu nội dung tab Tổng quan, ngay dưới header; tiếp theo là Tổng quan toàn site và Query/URL. Các bộ chọn DMC3 tiếp tục đồng bộ.

## So sánh hai ngày

Thanh chọn ngày gọn ở đầu: Ngày trước / Ngày sau, tìm kiếm và bàn phím giống bộ chọn DMC3. Mỗi ngày chỉ có một lựa chọn đại diện cho bản import mới nhất; không cho so cùng ngày hoặc đảo thứ tự. Chọn một ngày tự điều chỉnh ngày còn lại nếu cần. Khi thiếu ngày, hiện hướng dẫn import ngày khác.

DMC3 tăng/giảm ở trái; phạm vi, bốn thẻ biến động và bảng query ở phải. Tăng cannibal dùng đỏ, giảm dùng xanh, không đổi trung tính. Tỷ lệ query tính trên toàn bộ query có dữ liệu từng ngày; chênh lệch tỷ lệ là điểm phần trăm. Bộ lọc chuyển trạng thái có số lượng và tìm kiếm, chạy trước phân trang 25 hàng. Cả query không đổi cũng được đối chiếu, chỉ xét query xuất hiện trong cả hai ngày.

Mở query trong dialog cùng Tổng quan. Hai cột ngày dùng cùng lưới URL/Impression/Rank; cùng URL luôn nằm chung một hàng, kể cả đổi thứ tự Top 1/Top 2. Xếp hạng URL được tính riêng mỗi ngày. Top 1 xanh, Top 2 đỏ, URL khác đủ ngưỡng vàng; thiếu URL ở một ngày hiện dấu —. Mobile xếp hai ngày liên tiếp trong cùng nhóm URL. Số trong bảng/chi tiết không chạy đếm; thẻ thống kê và chuyển động section giữ cùng GSAP, nhịp và chế độ giảm chuyển động của Tổng quan.

## Báo cáo trực quan giữa hai ngày

Trước danh sách query là sáu thẻ DMC3: cải thiện, tăng cannibal, không đổi, giảm nhiều nhất, tăng nhiều nhất và còn cannibal. Chỉ tính nhóm có dữ liệu ở ít nhất một ngày, có ghi đồng hạng. Desktop đủ rộng dùng sáu cột, tablet ba cột, điện thoại hai cột. Bốn nhận định theo phạm vi được chọn thể hiện query mới bị, query đã hết, biến động impression lớn nhất và tỷ trọng impression cannibal trên toàn site.

Ba biểu đồ dùng ECharts SVG: cột so sánh hai ngày với nút Query/Impression; Sankey chỉ cho query đổi mức độ; thanh phân kỳ theo DMC3 với nút Query/Impression. Tăng cannibal dùng đỏ, giảm dùng xanh, không đổi trung tính; các nút Sankey giữ màu phân loại. Biểu đồ thanh giữ đủ nhóm trong vùng cuộn, có danh sách số liệu hỗ trợ bàn phím và hiển thị đầy đủ tên nhóm. Chọn nhóm liên kết bộ lọc báo cáo và bảng. Trục cột bắt đầu từ0; trục biến động đối xứng qua0, không phóng đại thay đổi nhỏ.

Các thống kê báo cáo chỉ đổi theo hai ngày/DMC3; tìm kiếm, phân trang và lọc chuyển trạng thái của bảng không thay số liệu tổng quan. Query mới bị gồm query chuyển sang cannibal trong tập chung và query mới có dữ liệu đang cannibal; query giảm gồm đã hết cannibal và query không còn dữ liệu (ghi rõ riêng). Bảng xét hợp của các query có dữ liệu ở ít nhất một ngày; biểu đồ đổi mức độ chỉ xét tập chung. Số tổng kỳ gồm toàn bộ query có dữ liệu của từng ngày. Tỷ trọng toàn site dùng mẫu số riêng mỗi ngày, không cộng các DMC3 có thể trùng query. Thay đổi nhỏ hơn0,01 điểm phần trăm được ghi rõ thay vì hiển thị dấu cộng/trừ với số0.

Hover dùng nền sáng hơn, viền rõ, nâng nhẹ2px, không phóng to chữ. Thẻ nhóm lớn nhất và insight có hành động lọc; thẻ thống kê thuần chỉ cung cấp thông tin. Các series giữ thời lượng480/320ms; GSAP chỉ điều khiển wrapper, tôn trọng giảm chuyển động. Đã xem trực tiếp ở1440/390/320px và kiểm tra không tràn ngang trên điện thoại.

## Menu ngày, sắp xếp và giải thích query

Ngày ở header, hai ngày so sánh và sắp xếp dùng SelectMenu, không dùng popup select của hệ điều hành. Menu đặc có font Be Vietnam Pro, nằm dưới hoặc trên nút theo khoảng trống viewport, có dấu chọn ở cột riêng. Portal vào body tránh bị bảng cắt; giới hạn theo mép màn hình, cuộn riêng danh sách. Focus ở combobox, mũi tên/Home/End di chuyển lựa chọn, Enter chọn, Escape/Tab/bấm ngoài đóng. Animation180ms và bỏ chuyển động khi người dùng yêu cầu. Menu sắp xếp đủ rộng để hiện tên lựa chọn.

Chi tiết so sánh giữ một timeline hai ngày và trạng thái, tổng impression query dưới mỗi ngày. Bốn ô giải thích thay cho hai khối số liệu lặp: impression cannibal, tỷ lệ URL phụ cao nhất/Top1, rank Top1 và gap rank. Mỗi ô có trước→sau, thay đổi và ghi chú ngưỡng. Chưa đạt20% thì rank/gap lớn cũng không tự tạo cannibal; khi đã đạt ngưỡng, rankTop1>3 ưu tiên Nguy hiểm, còn lại xét gap<0,5 /0,5–1/>1. Ghi chú chỉ rõ gap gốc vượt ngưỡng, thiếu rank, dữ liệu lỗi và Top1 đổi URL. Không chạy count-up trong chi tiết. Desktop bốn cột, tablet hai cột, điện thoại một cột; URL hai ngày vẫn căn cùng hàng như trước.

## Thẻ thông tin theo chiều biến động

Bổ sung nền màu rõ hơn theo yêu cầu mới: đỏ trầm #3b232b khi tăng, xanh rừng #183b2d khi giảm, xám khi không đổi hoặc thiếu dữ liệu. Bốn thẻ tổng quan dùng nền xanh dương/đỏ/xanh lá/tím theo vai trò. Bỏ viền màu thường trực của thẻ số liệu; hover có viền trắng mờ. Chi tiết so sánh dùng data-trend từ delta gốc, không suy diễn chiều thay đổi từ số đã làm tròn. Nhãn tăng/giảm và số trước→sau vẫn hiện, không chỉ dựa vào màu. Giữ nguyên phân loại, số liệu, bố cục và chuyển động.

## Đối soát tổng cannibal

Thẻ Mới bị cộng hai phần: chuyển trạng thái trong tập chung + mới có dữ liệu đang cannibal. Bấm thẻ và xuất CSV dùng cùng tập dữ liệu. Thẻ giảm ghi rõ query đã hết và query không còn dữ liệu nếu có. Không hiển thị phương trình cộng trừ dưới biểu đồ. Query thiếu một ngày có badge Chưa có dữ liệu, số và URL hiện —, không giả định đã đo bằng0. Ngày12→19/10:thẻ Mới bị hiển thị19, gồm16 chuyển trạng thái +3 mới có dữ liệu.

Bảng so sánh gắn nhãn Mới có dữ liệu ngày sau cho các query thiếu ngày trước; cột thiếu hiển thị Chưa có dữ liệu. Delta impression và CSV để trống/— khi thiếu một ngày. Bấm lại tab So sánh hoặc quay lại cửa sổ sẽ tải lại kết quả.

## Đồng bộ motion cho thẻ chỉ số — 30/10/2026

`data-metric-surface` dùng chung cho 4 thẻ tổng quan, 6 thẻ biến động DMC3, 4 insight so sánh và các ô tỷ lệ. Giữ nguyên font, kích thước, bố cục, màu trạng thái và số liệu. Lớp sáng nhẹ theo con trỏ dùng màu vai trò, viền/đường nhấn hiện trong 320–420ms; nâng tối đa3px, không phóng to nội dung. Chỉ thẻ có hành động mới phản hồi nhấn; thẻ thông tin không mang vai trò nút. Bàn phím có viền focus rõ.

GSAP điều khiển lớp sáng và nội dung xuất hiện: nhãn→giá trị→thông tin phụ, mỗi bước lệch55ms, thời lượng540ms. Vòng tỷ lệ vẽ đúng cung dữ liệu trong820ms khi xuất hiện lần đầu, hover chỉ tăng nhẹ độ dày/độ rõ của cung và đổi màu số giữa theo loại chỉ số. Không chạy lại đếm số khi hover. Bề mặt dùng CSS translate, nội dung dùng GSAP transform để tránh hai hiệu ứng cùng điều khiển một thuộc tính. Không thêm thư viện hoặc vòng render WebGL cho các thẻ.

Hiệu ứng chỉ theo con trỏ trên thiết bị hover/fine pointer, không cản cuộn chạm. Khi đổi sang reduced motion, hủy tween/observer/lớp sáng và giữ đủ thông tin tĩnh. Dọn sự kiện/tween khi unmount, hỗ trợ thẻ thêm/xóa do đổi tab. Kiểm tra tương tác bằng DOM mô phỏng, không coi đây là bằng chứng đã kiểm tra hình ảnh trình duyệt.


## Quy tắc rank hiện hành — làm tròn trước khi tính

Yêu cầu30/10 thay thế quy tắc dùng số gốc trước đây: làm tròn rank mỗi URL đến1 chữ số thập phân, sau đó mới lấy chênh lệch tuyệt đối Top1/Top2, phân loại và so sánh hai ngày. Rank2,3 và2,3 cho gap0,0; so sánh2,3→2,3 ghi“Không đổi”và màu trung tính. Phân loại dùng rank đã làm tròn: Top1>3 ưu tiên Nguy hiểm, gap<0,5 An toàn,0,5–1 Trung bình,>1 Nguy hiểm. Giữ nguyên ngưỡng impression, URL chính theo impression, tổng query và bộ keyword gốc. URL JSON giữ rank gốc để đối chiếu; cột rank/gap/trạng thái và phần trình bày dùng quy tắc mới. Hàm hoàn tất import áp dụng cho file sau này; tính lại dữ liệu đã có trong cùng migration.

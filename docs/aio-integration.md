# Tích hợp AIO Content Audit

## Tối ưu xử lý 06/11/2026

- Vẫn dùng một lần Gemini để sinh fan-out và embedding cho query/đoạn cần so sánh; SERP chỉ gọi cho từ khóa gốc. Mỗi audit sinh fan-out riêng, không đọc/ghi cache dùng lại giữa các audit.
- Bỏ query trùng bằng code trước khi embedding. Prompt buộc các nhánh giữ đúng chủ đề và không tự bịa giá, sản phẩm hay đối thủ.
- Giữ Gemini sinh fan-out và tạo embedding ngữ nghĩa. Code xử lý tải/đọc trang, chuẩn hóa dấu và từ tương đương, kiểm tra model sản phẩm, gom door có cùng ý định, lọc bằng chứng và tính centering/gap theo notebook.
- Tách nội dung thành đoạn khoảng 420 ký tự và quét toàn bộ trang. Mỗi door giữ tối đa hai ứng viên phù hợp; chỉ các đoạn này được gửi embedding, không nhúng các đoạn lấy mẫu ngẫu nhiên. Query giá cần có giá hoặc miễn phí; query thời gian cần có mốc thời gian cụ thể. Thiếu đoạn trả lời thì không suy ra điểm/gap.
- Với query đơn giản có một đoạn khớp rõ hơn, bỏ ứng viên thứ hai trước khi embedding. Query nhiều vế và hai ứng viên có độ khớp gần nhau vẫn giữ cả hai. Bộ lọc này chạy bằng code, không gọi Gemini.
- Điểm cosine chỉ sắp xếp bằng chứng. Các door bị gắn “cần cải thiện” được Gemini kiểm tra ở **một lượt gọi gộp cuối audit**, với query và đoạn trích đã chọn. Kết quả chỉ được nhận nếu có trích dẫn nguyên văn từ cả hai phía; dữ kiện số hoặc phạm vi sản phẩm mâu thuẫn không được coi là tương đương. Nếu model/quota lỗi hoặc chứng cứ thiếu, kết luận hạ về “chưa đủ căn cứ” và gap để trống. Không suy ra toàn trang thiếu nội dung chỉ từ một đoạn.
- Giữ trang đã tải và bước đã hoàn tất trong checkpoint của chính audit để tiếp tục. Không có cache dùng chung giữa các audit. Đoạn trùng nguyên văn trong cùng audit dùng lại đúng vector đã có; từng batch embedding thành công được lưu ngay vào checkpoint để lỗi quota ở batch sau không gọi lại batch trước.
- Embedding kiểm tra đủ vector, kích thước và giá trị hợp lệ. Báo nguyên nhân Gemini (key/model/quota); tối đa hai lượt thử lại lỗi tạm thời theo thời gian Google yêu cầu. Lỗi key, model hoặc quota ngày không thử lại vòng lặp. Không chờ cố định theo giới hạn 90 vector/phút tự đặt.

Tab **AIO** đưa `aio_dtv.ipynb` vào Cannibal Query bằng giao diện React. Bỏ Gradio, Colab secrets, các ô cài package và lệnh `launch`; không viết lại công thức sang JavaScript. Phần tính toán vẫn là Python/NumPy.

## Phạm vi và cách sử dụng

1. Mở workspace bằng mật khẩu đang dùng, chọn tab AIO.
2. Nhập từ khóa mục tiêu và URL. Dán Gemini API key và SERP API key, hoặc nhập từng key từ file TXT/JSON (`api_key` hoặc `key`). DataForSEO dùng chuỗi `login:password` như notebook.
3. Cấu hình mặc định giữ nguyên notebook: 15 query, 10 đối thủ, ngưỡng gom door 0,85, thị trường VN/vi, chunk 1.800 ký tự và overlap 200. Model sinh query/embedding, thị trường, citation bổ sung và provider đều có thể chỉnh.
4. Chạy audit; xem điểm, gap, thứ tự trong field, spread, verdict, biến thể đã gom và các đoạn nội dung đối chiếu. Đối thủ hiển thị khi có điểm cao hơn trang mục tiêu, tối đa 3 (mặc định 2).
5. Điền rank Google và URL cho từng door, hoặc tải mẫu XLSX rồi import lại. Giữ đủ door; ô không có rank phải để trống cả rank và URL. Xuất bảng đang nhập và xem hàng đợi hành động.

API key chỉ nằm trong bộ nhớ tab và request HTTPS gửi đến backend, không nằm trong checkpoint, log đã lưu, localStorage hoặc sessionStorage. SessionStorage chỉ giữ ID audit để phục hồi khi tải lại trang trong cùng phiên. Đổi tab không dừng audit. Đăng xuất hoặc đổi tài khoản hủy trạng thái giao diện; lần mở tiếp cần nhập lại key.

## Cấu trúc

| Thành phần | Vai trò |
| --- | --- |
| `src/components/aio-workspace.tsx` | Thiết lập, 2 key, tiến trình và tiếp tục audit |
| `aio-results.tsx` | Bảng door và đối chiếu đoạn nội dung |
| `aio-rank-tracker.tsx` | Bảng nhập rank, XLSX, hàng đợi hành động |
| `src/lib/aio.ts`, `aio-client.ts` | Kiểu dữ liệu và client lấy JWT hiện tại |
| `api/aio.py` | Function Python xác thực workspace trước mọi thao tác |
| `aio_engine/notebook.py` | 27 hàm lấy nguyên thân hàm từ notebook |
| `aio_engine/runtime.py` | Chia nhỏ I/O, lưu checkpoint, phát lại audit bằng vector đã lấy |
| `aio_engine/security.py` | Kiểm tra URL công khai và ghim IP từng lần chuyển hướng |
| `aio_engine/storage.py` | Truy cập Supabase bằng JWT của người dùng, tuân theo RLS |

Không có Python, NumPy hoặc embedding vector trong bundle trình duyệt. Tab AIO được tải bằng `next/dynamic`. Các tab hiện có và quy tắc cannibal không thay đổi.

## Giữ nguyên logic

- Fan-out từ **keyword**, không từ nội dung trang. Temperature 0,7 và cấu hình prompt nguyên bản.
- Cosine float32, clustering greedy theo vector seed; ngưỡng gom door nguyên bản.
- Citation thủ công + AIO + organic theo thứ tự gốc, deduplicate và giới hạn số đối thủ. Trang không đọc được giữ hành vi skip; trang mục tiêu không đọc được thì dừng.
- Dùng mean vector chung để centering; chấm điểm so với **đối thủ dẫn đầu**, không so trung bình field.
- Field size <3: LOW CONFIDENCE. Spread <0,03: PARITY. Gap/spread ≤−0,15: AHEAD; <0,15: PARITY; <0,50: BEHIND close; còn lại: BEHIND clear. Gap/score/spread giữ 4 số thập phân, z giữ 2 trong hàm gốc.
- Batch tối đa 20 input, chỉ dùng lại vector của cùng model và đoạn trùng nguyên văn trong chính audit. Lỗi embedding không được biến thành vector rỗng rồi chấm điểm tiếp.
- Mã rank dùng chuẩn NFC, casefold và khoảng trắng, kiểm tra đầy đủ door + metadata + chữ ký audit. URL giữ nguyên phân biệt chữ hoa trong path/query; bỏ scheme, www, fragment, slash cuối khi đối chiếu như notebook.
- Giữ đủ 6 nhóm hành động và hai nhánh “URL unknown”. P(k) = 1 − 0,91^(k+1); giá trị thêm một door là P(k+1) − P(k), không phải xác suất đo từ Google.
- Giữ cả các chi tiết đã có trong notebook: mọi rank nguyên dương được chấp nhận, kể cả >100; k đếm các rank khác rỗng. Giao diện ghi “Door có rank” để không gọi sai thành Top 100. Cách lọc embedding rỗng và ánh xạ chỉ số đoạn cũng giữ nguyên, không tự thay thuật toán.

Test AST đối chiếu **27 thân hàm** với notebook nguồn. SHA-256 file nguồn ghi tại `docs/aio-source.sha256`. Các thay đổi chỉ ở orchestration, xác thực, lưu trữ và giao diện.

## API và checkpoint

POST `/api/aio`, header `Authorization: Bearer <workspace JWT>`, cùng origin.

| action | Đầu vào bổ sung | Kết quả |
| --- | --- | --- |
| start | config, credentials | ID + trạng thái mới |
| step | id, credentials | Tiến trình sau một bước |
| status / result | id | Checkpoint / kết quả hoàn tất |
| ranks | id, rows | Input đã chuẩn hóa + hàng đợi + P(k) |
| template / export_ranks | id, rows nếu export | XLSX có metadata audit ẩn |
| import_ranks | id, name, file base64 | Kiểm tra XLSX và phân tích rank |

`fanout → pages → score → done`. Query fan-out được lưu trước khi lấy SERP. Các trang được tải trước với tối đa 5 kết nối song song và lưu checkpoint trước khi embedding. Mỗi request embedding một trang theo thứ tự gốc, với batch tối đa 20 input và retry có giới hạn. Khi chấm, mỗi đoạn luôn đi cùng vector của nó. AIO chọn đoạn theo query đại diện bằng cosine sau centering, mức trùng từ và các dấu hiệu ý định như chi phí, bảo hành hoặc thời gian. Gap bằng điểm đoạn đối thủ tốt nhất trừ điểm đoạn trang mục tiêu. Nếu một phía thiếu đoạn phù hợp thì không có gap. Các kết quả đã lưu giữ nguyên phiên bản cũ. Nội dung đã tải được tái sử dụng khi tiếp tục sau lỗi quota hoặc hết thời gian. Lock RPC có lease 330 giây để tránh hai thao tác step đồng thời. Hết ngân sách xử lý sẽ báo tiếp tục, giữ stage hiện tại và vector đã hoàn tất. Một request đang chạy không bị hủy giữa lúc lưu checkpoint khi bấm Tạm dừng.

Không hứa exactly-once cho API tính phí: nếu response đã tới nhưng lưu checkpoint thất bại hoặc function bị kill đột ngột, bước đang dở có thể gọi lại provider. Các bước trước đã lưu vẫn được dùng lại. Không chạy nền độc lập khi tab đã đóng; cần mở lại phiên và tiếp tục.

## Quyền và giới hạn

- Xác thực JWT bằng Supabase Auth trên server; dùng publishable key hiện có, **không service-role key**.
- Table `seo_aio_runs` và bucket private `seo-aio` tách khỏi dữ liệu cannibal/thứ hạng. Policy chỉ cho chủ tài khoản truy cập; đường dẫn artifact bắt đầu bằng user ID.
- URL phải HTTP(S), không kèm tài khoản, không localhost/private/link-local. Kiểm tra toàn bộ IP DNS, ghim IP cho kết nối và kiểm tra từng redirect, cả URL nhúng trong Jina fallback. Không chuyển API key sang website được crawl.
- HTTP body tối đa 3 MB; XLSX upload 2 MB, sau giải nén tối đa 32 MB và 128 entries; nội dung một trang tối đa 12 MB.
- API key được che trong log/checkpoint và phản hồi lỗi; không ghi request body trong access log của function. Không render HTML lấy từ website.
- Artifact của audit được giữ để tiếp tục và đối chiếu. Chưa tự xóa audit cũ; cần định thời hạn lưu nếu khối lượng tăng. Không xóa dữ liệu SEO đang có.

## Thiết lập khi triển khai

**Migration AIO đã áp dụng và tab đã triển khai trên website chính ngày 05/11/2026.** Chỉ migration mới `20261105000002_aio_workspace.sql` được chuẩn bị; không chạy lại toàn bộ lịch sử migrations.

1. Áp dụng migration AIO mới cho đúng project khi triển khai, kiểm tra RLS bằng tài khoản workspace hiện hành.
2. Vercel giữ Framework Next.js / Node 24. Python function nằm tại `api/aio.py`, Python 3.12 theo `.python-version`, dependency từ `requirements.txt`.
3. `vercel.json` khai báo 300 giây và include `aio_engine/**`; loại fixture, data, docs và bundle Next khỏi function Python. Python dependency cài ở môi trường kiểm tra chiếm khoảng 164 MB; chưa đo bundle Vercel thực tế.
4. Hai biến môi trường hiện có `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` phải có cho function. Không thêm Gemini/SERP key vào biến public.
5. Kiểm tra một audit thật trên bản preview bằng key nhập trong UI, kiểm tra dừng/tiếp tục và XLSX, rồi mới promote production khi người dùng yêu cầu.

`npm start` chỉ chạy Next.js, không tự phục vụ function Python ở `/api/aio`; local UI được kiểm tra bằng fixture. Vercel preview là bước cần thiết để xác nhận runtime Python + Next.js + Supabase thực sự nối với nhau.

## Kiểm tra

Frontend: `npm test`, `npx tsc --noEmit`, `npm run build`. Backend: Python 3.12, virtualenv, `pip install -r requirements.txt`, sau đó `npm run test:aio`. Muốn đối chiếu AST với notebook nguồn, đặt biến `AIO_SOURCE_NOTEBOOK` trỏ đến file gốc trước khi chạy test Python.

Đã qua 15 test Python: parity hàm/score, ngưỡng, 6 hành động, XLSX roundtrip, formula literal, metadata/door sai, rank/URL, cache, checkpoint, deadline, auth, URL SSRF, đường dẫn owner và cấu hình sai. Đã qua 93 test Node, bao gồm AIO render, toàn bộ regression cannibal/thứ hạng và 4 tab bàn phím.

Trình duyệt headless với fixture: 1440 và 390, không lỗi JS; không tràn ngang ở 1440/768/390/320. Đã thử chạy audit, lỗi quota và tiếp tục, chọn door, đối chiếu đoạn, sửa rank, phân tích và import XLSX/key. Không có key trong sessionStorage. Không gửi request trả phí hoặc dữ liệu thử vào Supabase thật. Build sản xuất Next.js và kiểm tra TypeScript đều đạt. Python function đã build trên Vercel. Đã kiểm tra authenticated Storage thiếu object, ghi/đọc và xóa dữ liệu thử. Chưa gọi Gemini/SERP thật.

## Bản sửa lưu trữ và bố cục 05/11/2026

Storage object chưa tồn tại trả HTTP 400 với statusCode 404/NoSuchKey: xử lý thành cache miss chỉ cho GET, giữ lỗi ghi và request không hợp lệ. Cấu hình audit luôn hiển thị ở cột riêng; nội dung/API ở bên trái, tiến trình ba bước bên dưới.

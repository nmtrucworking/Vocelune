# Backend, database và vận hành

## Quyết định triển khai

Backend nằm trong `apps/backend`, gồm các module Identity, Vocabulary, Study, Tests, Transfer, Integrations và Analytics. PostgreSQL là nguồn dữ liệu chính; Redis/BullMQ chỉ đánh thức worker. Jobs, checkpoint import và email outbox được lưu bền vững trong DB, nên Redis mất dữ liệu không làm mất yêu cầu đã xác nhận.

Chọn Prisma 6.19.0 và pin `ts-fsrs` 5.4.2. Gói này thực thi **FSRS-6**, không phải FSRS-7. Learning steps `1m,10m`, relearning `10m`, fuzz tắt; adapter lưu đúng learning step thực tế. Mỗi lần thay retention tạo cấu hình bất biến mới; không sửa ngược lịch sử hay hàng loạt due dates.

Schema tập trung trong `apps/backend/prisma/schema.prisma`. Các nhóm bảng:

| Nhóm | Bảng / mô hình |
|---|---|
| Tài khoản | User, UserSettings, AuthSession, PasswordResetToken, EmailOutbox |
| Nội dung | Lexeme, VocabItem (một nghĩa), Deck, DeckItem, tags[] |
| Học | Card, SchedulerConfig, StudySession, Reveal, ReviewLog, StudyAttempt |
| Kiểm tra | TestDefinition, TestAttempt, TestQuestion (snapshot + answer) |
| Nhập / media | ImportJob (row checkpoints JSONB), MediaAsset, VocabMedia |
| Kiểm toán | AuditLog, ProviderUsage |

`DeckItem` hỗ trợ một nghĩa nằm trong nhiều bộ từ. Tags là mảng PostgreSQL có GIN index. Mỗi card có một template và lịch riêng. Nội dung xóa mềm vẫn giữ events; xóa tài khoản mới cascade dữ liệu thuộc tài khoản. Review events chỉ cho phép chuyển `voidedAt` một lần; DB trigger chặn thay rating/snapshot. Scheduler configs không cho sửa.

Migrations bổ sung CHECK constraints, active-deck-name unique index, due index và triggers kiểm tra chủ sở hữu các liên kết. Các ghi nhạy cảm khóa hàng User trong transaction để tuần tự hóa thao tác của một tài khoản, gồm cả kiểm tra idempotency khi event chưa tồn tại. Đây là lựa chọn đơn giản cho modular monolith; khi tải lớn cần đo lock contention trước khi chuyển sang locking chi tiết theo card.

## Khởi chạy

```bash
npm install
npm run setup
npm run dev
```

`setup` không ghi đè `.env` có sẵn. Thông số mặc định local:

| Dịch vụ | Địa chỉ |
|---|---|
| Frontend | http://localhost:3000 |
| API / OpenAPI | http://localhost:4000/api/v1, http://localhost:4000/api/docs |
| PostgreSQL | localhost:55432, DB/user vocelune |
| Redis | localhost:56379 |
| SMTP thử nghiệm / inbox | localhost:1025, http://localhost:8025 |

Đăng ký trên UI; không có tài khoản/password mặc định. `npm run db:seed` chỉ chạy khi đã chủ động đặt `SEED_EMAIL` và `SEED_PASSWORD` trong `.env`; seed không tạo review, điểm hoặc nội dung từ điển giả.

LocalStorage cũ không bị xóa hoặc tự tải lên tài khoản. Backend mới bắt đầu với kho riêng rỗng; có thể nhập nội dung sở hữu qua CSV/XLSX. Web hiện tải snapshot thư viện để dùng lại các màn hình có sẵn; endpoint `/vocabulary` hỗ trợ cursor cho client cần tải dần. Bootstrap giới hạn 10.000 review logs và 100 test reports; tổng hợp server không lấy các giới hạn này làm mẫu số retention.

## Authentication và API conventions

- Opaque random session token lưu SHA-256 trong DB; cookie HttpOnly, SameSite=Lax. Production dùng Secure và tên `__Host-…`.
- Cookie CSRF riêng đọc được từ browser; mỗi mutation gửi `X-CSRF-Token`. Token được so với hash trong session. `Origin` nếu có phải trùng `APP_ORIGIN`.
- Email được chuẩn hóa và unique; mật khẩu 12–128 ký tự, scrypt với salt ngẫu nhiên.
- Reset token một lần, hết hạn 30 phút; sau reset thu hồi tất cả sessions. Email outbox chứa payload AES-256-GCM và xóa payload sau khi gửi/hết hạn, không lưu link reset dạng plaintext.
- `Idempotency-Key` bắt buộc cho review và tạo import. Retry cùng key/payload trả cùng kết quả; đổi payload trả 409.
- Tài nguyên của tài khoản khác trả 404. Admin operations yêu cầu role admin và ghi audit.
- Errors: `{ "error": { "code", "message", "details"?, "requestId" } }`. Thời gian API là ISO-8601 UTC; timestamps DB là timestamptz.
- Mutation validation dùng Zod strict, không cho mass assignment `userId`, role, due date hoặc điểm thi.
- Logs chỉ chứa request ID, route template, method, status, duration; không chứa body/cookie/vendor text/reset token.

Swagger có schemas cho các mutations chính tại `/api/docs`; JSON tại `/api/openapi.json`.

## Các luồng API

### Identity và profile

`POST /auth/register` nhận `{email,password,displayName}`; `POST /auth/login` nhận `{email,password}`. Cả hai đặt cookies. `POST /auth/logout` revoke session hiện tại.

`GET /me`, `GET /me/settings`, `PATCH /me` hoặc `/me/settings` đọc/sửa profile/settings. Hỗ trợ timezone IANA, dayStartHour 0–23, dialect, retention 0.85–0.95, newCardsPerDay 0–1000, sound/autoPronounce, theme và language. `DELETE /me` cần `{password,confirmation:"DELETE"}`.

`POST /auth/password/forgot` nhận `{email}` và luôn trả thông báo chung khi dịch vụ email đã cấu hình; `POST /auth/password/reset` nhận `{token,password}`. Khóa `EMAIL_ENCRYPTION_KEY` phải là 32 bytes dạng 64 ký tự hex và được giữ ổn định giữa API/worker.

### Vocabulary và decks

- `GET /vocabulary?search=&deckId=&cefr=&partOfSpeech=&tag=&limit=50&cursor=` trả `{items,nextCursor,total}`.
- `POST /vocabulary` nhận `word`, `partOfSpeech`, `meaningVi`, `deckId`; tùy chọn definitionEn, exampleEn/Vi, phonetic, dialect, cefr, tags, notes, templates và deckIds.
- CEFR tự nhập là manual/unknown. IPA trống được giữ trống. Không nhận claim `verified_3000` từ browser.
- `GET/PATCH/DELETE /vocabulary/:id`; PATCH chỉ thay các trường được gửi.
- `POST /vocabulary/:id/cards` nhận `{template}`: en_vi, vi_en, audio_word, definition_en. Template định nghĩa cần definitionEn.
- `GET/POST /decks`, `PATCH/DELETE /decks/:id`. Không xóa bộ cuối cùng; từ không còn bộ nào được chuyển vào bộ còn lại.
- `POST /vocabulary/duplicate-preview` nhận `{word,partOfSpeech}`. Trùng được xác định thêm theo nghĩa, không chỉ spelling.
- `POST /vocabulary/merge` nhận `{sourceId,targetId}`; cùng lexeme/POS, có audit. Thẻ trùng template được archive, log vẫn gắn với card cũ.

### Study / FSRS

1. `GET /study/queue`: learning/relearning due → review due → new theo hạn mức ngày học. Loại suspended/buried/deleted; không tự grade backlog.
2. `POST /study/sessions` với `{mode:"flashcard"}`.
3. `POST /study/sessions/:id/reveal` với `{cardId}` trả revealId, cardVersion và previews. Reveal hết hạn sau 5 phút, phiên tối đa 12 giờ.
4. `POST /cards/:id/reviews`, header `Idempotency-Key`, body:

```json
{
  "sessionId": "uuid",
  "revealId": "uuid",
  "expectedCardVersion": 1,
  "rating": 3,
  "responseTimeMs": 4500
}
```

Server kiểm tra ownership, due, limit, phiên và reveal; cập nhật scheduler + log trong cùng transaction. Thời gian hoạt động tính tối đa 120 giây/event. Client không gửi due/state/score.

`POST /reviews/:id/undo` chỉ trong 30 giây và khi card version chưa đổi; tăng version thay vì quay version về số cũ, đánh dấu event voided, khôi phục side effects bury nếu chưa bị ghi tiếp. Undo lặp trả thành công mà không tạo thay đổi thêm.

`PATCH /cards/:id` nhận `{expectedCardVersion,suspended? ,reset?}`; reset giữ events và có audit.

`POST /practice/sessions` và `POST /practice/sessions/:id/answers` tách khỏi review logs, không sửa SRS. Answer nhận `{vocabId,answer,durationMs}`.

### Tests

`POST /tests/preview` hoặc `/tests`:

```json
{
  "title": "Ôn từ đã học",
  "deckIds": [],
  "cefr": [],
  "partOfSpeech": [],
  "tags": [],
  "size": 10,
  "mode": "mixed",
  "direction": "en_vi",
  "durationSeconds": 300
}
```

Size 5–100; mode typed/mcq/listening/mixed. Trắc nghiệm cần ít nhất 3 nghĩa nhiễu khác nhau cùng POS; không tự nới bộ lọc hoặc bịa distractor khi thiếu dữ liệu. Typed trong UI dùng VI→EN.

`POST /tests/:id/attempts` tạo snapshot với seed server. Khi đang làm, API không trả correctAnswer/explanation. `PUT /test-attempts/:id/answers/:questionId` nhận `{answer,clientSequence?}` (sequence tăng dần; bỏ qua request cũ đến trễ) để autosave. `POST /test-attempts/:id/submit` có thể nhận `{answers:{"questionUuid":"answer"}}`; chỉ ghi bổ sung trước deadline. Khi quá hạn, chấm câu đã lưu trước đó. Worker hoặc lần đọc tiếp theo finalize timeout. Submit lặp giữ nguyên kết quả.

`GET /test-attempts` có cursor; `GET /test-attempts/:id/report` hỗ trợ resume/report. Rubric `exact-nfc-v1`: NFC, trim, case-insensitive; không tự xóa dấu hoặc suy luận alias.

Ghi vào SRS cần `POST /test-attempts/:id/apply-srs` với `{confirmation:true,ratings:[{questionId,rating,expectedCardVersion}]}`. Chỉ câu gắn đúng một card tương ứng; mỗi answer được áp dụng một lần. Không tự suy rating từ trắc nghiệm đúng/sai. Events có source=test_opt_in và được loại khỏi retention SRS study mặc định.

### Import / export

- `GET /imports/template?format=csv|xlsx`: mẫu có 3 dòng synthetic `example_only=true`.
- `POST /imports/upload`: multipart `file`, `deckId`, `policy=skip|merge|create_new`, tùy chọn `mapping` JSON ánh xạ header gốc → tên field camelCase. Header snake_case thông dụng được map tự động.
- Hoặc `POST /imports` với `{deckId,policy,rows:[...]}` cho JSON đã parse. Cần Idempotency-Key.
- `GET /imports`: 50 jobs gần nhất. `GET /imports/:id`, `POST /imports/:id/preview` đọc preview/checkpoints; `GET /imports/:id/errors.csv` tải lỗi.
- `POST /imports/:id/commit` xác nhận. Có Redis: worker xử lý nền; không Redis: xử lý trực tiếp. Mỗi chunk tối đa 50 dòng được commit cùng checkpoint, tránh tạo lặp khi retry. Job failed có thể commit lại sau khi sửa nguyên nhân; dòng đã xong không chạy lại.
- Duplicate là word + POS + normalized sense; merge chỉ cập nhật annotations của đúng nghĩa. Preview được recheck dưới lock lúc commit.
- CSV/XLSX tối đa 10 MB, 5.000 dòng, 40 cột. CSV hỗ trợ quote/newline, kiểm tra header trùng. XLSX kiểm tra central directory và giới hạn giải nén trước ExcelJS, từ chối macros/external links/formulas/embedded objects. Upload không chạy enrichment hàng loạt.
- `POST /exports` với `{format:"csv"|"xlsx"|"json"}` trả download trực tiếp, authenticated/no-store. JSON gồm hồ sơ, vocab/decks, card states, review history và test history. CSV/XLSX chứa vocab. CSV neutralize formula injection kể cả prefix whitespace. Vendor fields không có quyền xuất được redacted, kể cả trong test snapshots.

API trả file trực tiếp thay vì ghi export tạm vào R2: không có link công khai hoặc orphan export object cần dọn.

### Dictionary / licensing

`GET /dictionary/providers/status`, `POST /dictionary/lookup` với `{word,partOfSpeech,dialect}`. Credentials chỉ ở server, timeout 8 giây, không cache vendor response. Không có credentials: candidates rỗng + warning, manual entry tiếp tục hoạt động. Không có nguồn CEFR được cấp quyền: unknown/not_verified.

Mặc định LIVE_ONLY: không lưu definition/example/audio vào DB, Redis, R2 hoặc logs. UI dùng kết quả tra cứu để tham khảo, không tự đổ văn bản vendor vào form sẽ lưu.

Chỉ bật PERSIST_LICENSED sau khi có hợp đồng phù hợp: đặt `OXFORD_PERSISTENCE_APPROVED=true` và `OXFORD_PERSIST_FIELDS=definitionEn,exampleEn,phonetic` theo đúng trường được phép. `POST /dictionary/vocabulary` nhận query, providerEntryRef, providerSenseRef, meaningVi do user biên soạn, deckId, tags và notes. Server lookup lại và chỉ lưu các trường được cho phép, kèm provenance; browser không tự xác nhận quyền. Quyền lưu không đồng nghĩa quyền xuất; vendor fields bị loại khỏi export. Adapter cần contract test với sandbox/plan Oxford thực tế trước khi bật production; không có credential trong repo để xác nhận truy cập live.

### R2 / media

`POST /media/upload-intents` nhận `{purpose:"flashcard"|"avatar",mime,sizeBytes}`. Tối đa 5 MB, JPEG/PNG/WebP, 100 tài sản/account. Trả signed PUT 5 phút; bucket private, CORS phải cho phép origin web và PUT/GET/HEAD.

Sau PUT, gọi `POST /media/:id/complete`: kiểm HEAD size/MIME/ETag và magic bytes, copy có điều kiện ETag sang key ready khác. URL upload cũ không thể ghi đè tài sản ready. Chỉ ready mới `POST /media/:id/attach` với `{vocabId}`. `GET /media/:id/access` trả signed GET 120 giây sau ownership check.

Policy hiện tại kiểm MIME/size/signature; **chưa có antivirus hoặc decode/re-encode ảnh**. Nếu triển khai yêu cầu malware scanning, cần bổ sung scanner và giữ asset quarantine đến khi scan xong. Worker dọn pending hết hạn và object keys của tài khoản đã xóa. Adapter được kiểm tra bằng S3 mock; cần thử presigned/CORS với bucket R2 thực tế trước production.

## Analytics

`GET /analytics/overview`, `/analytics/reviews`, `/analytics/tests`. Heatmap/streak theo timezone IANA và dayStartHour; đổi timezone dùng chính sách recompute toàn bộ lịch sử trong timezone profile hiện tại, thể hiện trong metadata.

Observed retention = Good/Easy / số event có beforeState=review, source=srs_study, voidedAt=null, trong cửa sổ 365 ngày. N=0 trả null. Learning và test opt-in không bị gộp vào tỷ lệ này. Dự báo dùng forgetting_curve của chính engine FSRS, lấy trung bình trên các card có lịch sử; không phải xác suất đã đo. Forecast là phân bố lịch hiện tại, không mô phỏng hành vi tương lai.

## Worker và deployment

`npm run worker` chạy BullMQ heartbeat mỗi 5 giây, quét trạng thái DB: import checkpoints, SMTP outbox, timeout tests, pending media và tokens hết hạn. Email claims là atomic, có lease và retry tối đa 5 lần. SMTP có thể giao trùng nếu worker chết sau khi SMTP đã nhận nhưng trước DB acknowledgement; reset tokens vẫn một lần và có hạn.

```bash
npm run build
npm run db:migrate
npm run start:backend
# Terminal khác:
npm run worker --workspace=@vocelune/backend
npm run start --workspace=@vocelune/frontend
```

Production có thể chạy worker đã build bằng `npm run worker:production --workspace=@vocelune/backend`.

Dockerfiles: `infra/Dockerfile.backend` và `infra/Dockerfile.frontend`; build context là root repo. Frontend image cần build arg `API_PROXY_TARGET` trỏ API nội bộ. `APP_ORIGIN` production bắt buộc HTTPS; TLS/reverse proxy ở hạ tầng. Không public PostgreSQL/Redis; local Compose chỉ bind loopback. Migrations chạy một lần trong release job trước API/worker, không chạy reset/drop ở production.

Backup: dùng pg_dump/managed PITR cho PostgreSQL; restore vào DB riêng và thử migrations/flows trước khi chuyển lưu lượng. Redis có thể tái tạo jobs từ DB. Chọn retention/backup policy và kiểm tra restore thực tế trước release production. R2 secret, Oxford secret, SMTP secret và EMAIL_ENCRYPTION_KEY nằm trong secret manager; không commit `.env`.

## Kiểm thử và giới hạn xác nhận

`npm test` tạo database ngẫu nhiên từ DATABASE_URL/TEST_DATABASE_URL, migrate, chạy HTTP integration + scheduler/timezone tests rồi DROP đúng database vừa tạo. Không truncate DB dev. Bao phủ authorization/CSRF, ownership, nhiều nghĩa, concurrency/idempotency, reveal/undo, limits/config versions, server scoring/deadlines, import retry/CSV/XLSX, export, password reset/revoke/delete và R2 signature/key transition với mock.

`npm run typecheck`, `npm run build`, `npm audit --omit=dev` dùng trong CI. Các override transitive trong root package.json vá dependencies của Prisma, ExcelJS, Nest và Next; giữ regression checks khi cập nhật.

Chưa xác nhận bằng credential thật: Oxford, R2, SMTP production. Chưa chạy load test, penetration test độc lập, backup/restore drill, HA hoặc telemetry collector ngoài hệ thống. OAuth, notification opt-in/reminders, Google Sheets sync, tối ưu FSRS theo user và offline/PWA thuộc P1/P2 trong SRS.

Kiểm tra worker local khi API/worker/Mailpit đang chạy: `npm run smoke:worker`. Script tạo fixture ngẫu nhiên, chờ import và SMTP hoàn tất rồi xóa đúng tài khoản fixture; chỉ cho phép SMTP localhost.

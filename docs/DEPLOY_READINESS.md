# Kiểm tra sẵn sàng deploy — 29/10/2026

**Kết luận: chưa sẵn sàng đưa lên production theo cấu hình triển khai hiện tại.** Mã nguồn build và kiểm thử thành công, nhưng cấu hình Render và Cloudflare còn lỗi làm API không khởi động hoặc frontend không gọi được API.

Phạm vi: working tree hiện tại, dựa trên commit `9033480`, gồm cả thay đổi chưa commit và file chưa được Git theo dõi. Đây là kiểm tra tại máy local; chưa xác minh cấu hình thực tế trong Render, Cloudflare, Supabase hoặc nhà cung cấp SMTP/R2. Không triển khai và không sửa mã ứng dụng trong lần kiểm tra này.

## Kết quả thực thi

Môi trường local: Node.js `26.9.0`, npm `12.2.0`; PostgreSQL 16, Redis 7 và Mailpit đang chạy qua Docker. CI và Dockerfile dùng Node 24, nên kết quả local chưa thay thế một lần chạy CI trên Node 24.

| Kiểm tra | Kết quả | Giới hạn / bằng chứng |
| --- | --- | --- |
| `npm ci --dry-run --ignore-scripts` | Đạt | Lockfile được npm chấp nhận; chưa phải cài mới toàn bộ từ môi trường sạch. |
| `npm run typecheck` | Đạt | Backend và frontend. |
| `npm test` | Đạt, 38/38 | Tạo DB test ngẫu nhiên, áp dụng đủ 5 migrations, kiểm thử API và xóa DB. |
| `npm run build` | Đạt | TypeScript backend và Next.js standalone frontend. |
| `npm run build:pages` | Đạt | Sinh được static export; build thành công không xác nhận proxy Cloudflare hợp lệ. |
| `npm audit --omit=dev --json` | Đạt | 0 lỗ hổng được registry báo cáo tại thời điểm kiểm tra. |
| `npm run smoke:worker` | Đạt | API/worker local đang chạy: import hoàn tất, email outbox được giải mã và gửi qua SMTP local; tài khoản fixture được xóa. |
| Standalone runtime trên cổng 4311 | Đạt một phần | `/`, `/dashboard`, `/api/v1/health/ready` trả 200; logo/favicon trả 404; `/app` trả redirect có Location rỗng. |
| `git diff --check` | Đạt | Không phát hiện lỗi whitespace trong diff. |

## Những việc cần sửa trước production

### 1. P1 — Khóa mã hóa do Render sinh khiến backend không khởi động

- Vị trí: `render.yaml:22`, `apps/backend/src/common/config.ts:14`.
- Blueprint dùng `generateValue: true` cho `EMAIL_ENCRYPTION_KEY`. Render sinh chuỗi base64 256-bit, còn schema backend bắt buộc đúng 64 ký tự hex.
- Đã tái hiện bằng cách nạp module config đã build với một khóa base64: schema trả `CONFIG_REJECTED` tại `EMAIL_ENCRYPTION_KEY`, trước khi kết nối DB.
- Sửa: yêu cầu nhập secret hex qua `sync: false` hoặc cơ chế secret tương đương; tạo bằng `openssl rand -hex 32`. API và worker phải dùng chung khóa, lưu khóa bền vững để đọc được email outbox đang tồn tại.
- Nguồn nền tảng: [Render — Generating random secrets](https://render.com/docs/blueprint-spec#generating-random-secrets).

### 2. P1 — Frontend trên Render nhận proxy target không hợp lệ

- Vị trí: `render.yaml:57`, `apps/frontend/next.config.mjs:33`.
- `fromService.property: host` chỉ cung cấp hostname private. Next.js nối thẳng giá trị đó thành destination, tạo chuỗi dạng `vocelune-api-internal/api/v1/:path*`, thiếu `http://` và cổng `10000`.
- Đã nạp config với hostname mẫu và xác nhận destination không parse được bằng `new URL()`.
- Sửa: truyền URL đầy đủ, ví dụ `http://<internal-host>:10000`, hoặc lấy `hostport` rồi thêm giao thức trong build/config. Render không nội suy biến trực tiếp trong YAML.
- Nguồn nền tảng: [Render — Referencing service properties](https://render.com/docs/blueprint-spec#referencing-service-properties), [Variable interpolation](https://render.com/docs/blueprint-spec#variable-interpolation).

### 3. P1 — Cloudflare không hỗ trợ proxy API bằng rule hiện tại

- Vị trí: `apps/frontend/public/_redirects:2`, `scripts/build-pages.mjs:14`, `apps/frontend/scripts/build-pages.mjs:14`, `apps/frontend/wrangler.json`.
- Rule `/api/v1/* https://vocelune-api.onrender.com/api/v1/:splat 200` yêu cầu proxy sang domain ngoài. Cloudflare Pages và Workers Static Assets chỉ hỗ trợ proxy trong `_redirects` tới URL tương đối trên cùng site.
- Frontend gọi `/api/v1` cùng origin, nên static export vẫn build được nhưng cấu hình này không cung cấp đường API cần thiết. Wrangler hiện chỉ có assets, chưa có Worker xử lý proxy.
- Sửa: thêm Pages Function hoặc Worker fetch handler cho `/api/v1/*`, chuyển tiếp method/body/query/cookie/Origin và giữ nguyên các header `Set-Cookie`; hoặc chọn frontend Next.js server với reverse proxy hợp lệ. Kiểm thử đăng nhập, CSRF và upload trên domain staging.
- Nguồn nền tảng: [Cloudflare Pages — Proxying](https://developers.cloudflare.com/pages/configuration/redirects/#proxying), [Workers Static Assets — Proxying](https://developers.cloudflare.com/workers/static-assets/redirects/#proxying).

### 4. P1 — Blueprint chưa triển khai worker và SMTP cho các luồng nền

- Vị trí: `render.yaml`, `apps/backend/src/worker.ts:13`, `apps/backend/src/transfer/transfer.service.ts:121`, `apps/backend/src/identity/identity.service.ts:68`.
- Blueprint chỉ có API, frontend và Redis. Khi `REDIS_URL` được cấu hình, import được đưa vào trạng thái chờ worker; không có worker thì import không hoàn tất. Worker còn xử lý email, hết hạn bài thi và dọn dữ liệu.
- Blueprint cũng không khai báo SMTP. Nếu chỉ dùng biến trong file này, quên mật khẩu trả 503 `EMAIL_NOT_CONFIGURED`.
- Sửa: thêm background worker, build backend và Prisma client, chạy `npm run worker:production --workspace=@vocelune/backend`; chia sẻ `DATABASE_URL`, `REDIS_URL`, `APP_ORIGIN`, khóa mã hóa, SMTP và R2 theo nhu cầu. Cấu hình `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` hợp lệ rồi chạy smoke trên staging.

### 5. P1 cho mô hình hai domain — Biến môi trường SSO chưa nằm trong Blueprint

- Vị trí: `render.yaml`, `apps/backend/src/common/config.ts:10`, `apps/backend/src/identity/security.ts`, `apps/frontend/src/components/layout/AppShell.tsx:21`, `apps/frontend/src/lib/urls.ts:1`.
- Mã hiện chuyển workspace sang `workspace.vocelune.nguyenminhtruc.site`, nhưng Blueprint chưa khai báo `ALLOWED_ORIGINS`, `COOKIE_DOMAIN`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_WORKSPACE_URL`.
- Nếu `APP_ORIGIN` là domain marketing như tài liệu gợi ý và thiếu allowed origin cho workspace, các mutation gửi từ workspace bị 403. Thiếu cookie domain thì phiên không được chia sẻ giữa hai host. Khi dùng domain khác, frontend có thể chuyển người dùng tới domain mặc định đã hardcode.
- Sửa: cấu hình hai URL frontend tại build time, allowlist cả hai origin, cấu hình cookie domain cha phù hợp và xác nhận SSO qua cả hai host trên HTTPS. Tác động này phụ thuộc domain và biến thực tế đã nhập thủ công ngoài Blueprint.

### 6. P2 — Docker frontend thiếu thư mục public

- Vị trí: `infra/Dockerfile.frontend:14`.
- Runtime chỉ copy `.next/standalone` và `.next/static`. Thư mục `public` không nằm trong standalone output đã sinh.
- Đã khởi động standalone output: `/brand/logo.png` và `/favicon.ico` đều 404. Đây là smoke tương đương phần server/public của image; chưa build và chạy Docker image đầy đủ.
- Sửa: copy thêm `/app/apps/frontend/public` sang `/app/apps/frontend/public` của runtime image; smoke lại logo, favicon và ảnh từ điển.

### 7. P2 — Redirect `/app` trả Location rỗng

- Vị trí: `apps/frontend/next.config.mjs:18`.
- Rule wildcard `/app/:path*` được đặt trước rule `/app`. Trong standalone runtime đã kiểm tra, GET `/app` trả 308 với `Location: ""`; GET `/app/dashboard` trả 308 tới `/dashboard` đúng như mong đợi.
- Sửa: ưu tiên rule `/app` cụ thể trước wildcard và kiểm thử cả hai URL. Static export cũng chưa có rule riêng cho `/app` trong `_redirects`.

## Các điểm vận hành còn cần xác minh

- **Health check:** Render đang dùng `/health/live`, còn `/health/ready` mới truy vấn DB. Chưa có readiness cho Redis hoặc trạng thái worker. Cần xác định chính sách chuyển traffic khi DB/worker lỗi.
- **Rate limit sau proxy:** Backend chưa cấu hình `trust proxy`; tracker dùng `req.ip` cho request chưa đăng nhập. Cần kiểm tra IP thực tế qua chuỗi Render/Cloudflare, tránh nhiều người dùng bị gom vào hạn mức đăng nhập chung. Throttler hiện dùng storage mặc định, không có Redis storage được cấu hình; hạn mức không được chia sẻ giữa các replica.
- **SEO:** Cả hai build cảnh báo thiếu `metadataBase`; Next.js dùng `http://localhost:3000` để dựng URL ảnh Open Graph. Cần đặt base URL production.
- **Build reproducibility:** Static build cảnh báo hai lockfile ở root và frontend; Node trong manifest chỉ có cận dưới, chưa pin major cho native hosting. Chạy lại trên Node 24 như CI và chọn một lockfile chuẩn cho workspace.
- **Phạm vi release:** Có nhiều thay đổi chưa commit và file chưa tracked, gồm `apps/frontend/src/lib/urls.ts` được import bởi frontend và bộ logo/favicon. Deploy từ Git sẽ không có các file này cho tới khi chúng được đưa vào commit phù hợp.
- **Dịch vụ thật:** Chưa xác minh SMTP production, quyền/CORS bucket R2, chứng chỉ/DNS hai domain, kết nối Supabase, quyền migrate, giới hạn tài nguyên hoặc thông số trong dashboard hosting.
- **Khôi phục:** Chưa chạy backup/restore drill, rollback migration, load test hoặc kiểm tra cảnh báo khi worker dừng. CI hiện chưa chạy static export hay smoke qua cấu hình hosting thực tế.

## Điều kiện để chấp nhận release

1. Sửa các P1 của phương án hosting được chọn; xác định rõ Cloudflare Pages, Worker hay Next.js server.
2. Commit đủ mã và assets, chạy CI xanh trên Node 24 từ checkout sạch.
3. Deploy staging, kiểm tra `/api/v1/health/ready`, đăng ký/đăng nhập/đăng xuất, CSRF, SSO hai domain nếu dùng, import nền, email reset mật khẩu và media nếu bật.
4. Xác nhận backup và quy trình khôi phục; kiểm tra giám sát API/worker trước khi chuyển traffic production.

Build cuối cùng của lần kiểm tra là static export (`npm run build:pages`); thư mục build không được theo dõi trong Git. Khi chạy local bằng `next start` hoặc đóng gói standalone, cần chạy lại build thông thường cho chế độ tương ứng.

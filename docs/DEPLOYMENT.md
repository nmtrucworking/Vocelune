# Hướng dẫn Triển khai Vocelune (Render, Supabase, Cloudflare & R2)

Tài liệu này hướng dẫn chi tiết quy trình triển khai toàn bộ hệ thống Vocelune từ mã nguồn lên môi trường Production với chi phí tối ưu và tính sẵn sàng cao.

---

## 1. Tổng quan Kiến trúc

```
                      ┌───────────────────────────────────────────────┐
                      │              Cloudflare Edge                  │
                      │  - Tên miền riêng + HTTPS / WAF               │
                      │  - R2 Storage: Lưu trữ Media riêng tư         │
                      └──────────────┬───────────────────┬────────────┘
                                     │                   │
                        (Frontend)   ▼                   ▼  (Storage Presigned URLs)
        ┌────────────────────────────────────┐         ┌─────────────────────────┐
        │  Cloudflare Pages / Render Web     │         │   Cloudflare R2 Bucket  │
        │     Next.js 15 App (Standalone)    │         │   `vocelune-private`    │
        └─────────────────┬──────────────────┘         └─────────────────────────┘
                          │ /api/v1/* (Proxy / Rewrite)
                          ▼
        ┌────────────────────────────────────────────────────────────┐
        │                   Render Web Service                       │
        │         `vocelune-api` (NestJS / Node.js 24)               │
        │                                                            │
        │  * Auto-Migrate:                                           │
        │    - Pre-deploy: `npm run db:migrate`                      │
        │    - Startup: `npm run start:backend:prod`                 │
        └──────────────┬──────────────────────────┬──────────────────┘
                       │                          │
                       ▼                          ▼
        ┌────────────────────────────┐ ┌─────────────────────────────┐
        │      Supabase Postgres     │ │        Render Redis         │
        │  Connection Pooler (IPv4)  │ │      (Cache & Throttler)    │
        │  aws-0-[region].pooler...  │ └─────────────────────────────┘
        └────────────────────────────┘
```

---

## 2. Bước 1: Cấu hình Cơ sở dữ liệu trên Supabase

Vocelune sử dụng Prisma ORM kết nối với PostgreSQL trên Supabase.

1. Đăng nhập [Supabase Dashboard](https://supabase.com/dashboard) và tạo project mới (khuyến nghị chọn Region `Singapore - ap-southeast-1`).
2. Vào **Project Settings** ➔ **Database** ➔ **Connection string**:
   * Chọn tab **Connection Pooling**
   * Mode: **Session** (Port `5432`)
   * Copy chuỗi kết nối URI có dạng:
     ```text
     postgresql://postgres.[PROJECT_REF]:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?schema=public
     ```
   > [!IMPORTANT]
   > Phải sử dụng **Session Mode (port 5432)** của Connection Pooler để hỗ trợ IPv4 và tương thích với Prisma schema migration locks.

---

## 3. Bước 2: Khởi tạo Cloudflare R2 Storage (Lưu trữ ảnh & media)

1. Đăng nhập [Cloudflare Dashboard](https://dash.cloudflare.com/) ➔ chọn **R2 Object Storage**.
2. Bấm **Create bucket**:
   * Tên Bucket: `vocelune-private`
   * Location: Auto hoặc chọn WNAM/APAC.
3. Cấu hình **CORS** cho Bucket `vocelune-private`:
   * Vào tab **Settings** của bucket `vocelune-private` ➔ cuộn xuống **CORS Policy** ➔ bấm **Add CORS Policy**:
   ```json
   [
     {
       "AllowedOrigins": [
         "https://*.onrender.com",
         "https://*.pages.dev",
         "https://yourdomain.com",
         "http://localhost:3000"
       ],
       "AllowedMethods": ["GET", "PUT", "HEAD"],
       "AllowedHeaders": ["*"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
4. Tạo **R2 API Token**:
   * Quay lại trang chính của R2 ➔ chọn **Manage R2 API Tokens** ➔ **Create API Token**.
   * Permissions: **Object Read & Write**.
   * Chỉ định cấp quyền cho bucket `vocelune-private`.
   * Ghi lại các giá trị:
     * **Account ID**: Để cấu hình `R2_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
     * **Access Key ID**: `R2_ACCESS_KEY_ID`
     * **Secret Access Key**: `R2_SECRET_ACCESS_KEY`
     * **Bucket Name**: `R2_BUCKET=vocelune-private`

---

## 4. Bước 3: Triển khai Backend API lên Render (Tự động Migrate DB)

Dự án đã có sẵn tệp cấu hình **[render.yaml](file:///Users/nguyenminhtruc-mac/Developer/Projects/active/Vocelune/render.yaml)** trong kho mã nguồn.

### Cách 1: Triển khai tự động bằng Blueprint (Khuyên dùng)
1. Truy cập [Render Dashboard](https://dashboard.render.com/) ➔ chọn **New +** ➔ **Blueprint**.
2. Chọn repo `nmtrucworking/Vocelune`.
3. Render sẽ tự động đọc tệp `render.yaml` và liệt kê các service:
   * `vocelune-api`: Web service API
   * `vocelune-redis`: Redis cache & rate limiter
   * `vocelune-frontend`: Web service Frontend (tùy chọn nếu host luôn trên Render)
4. Điền các biến môi trường được yêu cầu (xem bảng bên dưới).
5. Bấm **Apply**. Quá trình build và tự động chạy migration sẽ diễn ra ngay lập tức.

### Cơ chế Tự động Migrate của Render:
* Trong `render.yaml`, lệnh `preDeployCommand: npm run db:migrate` sẽ tự động thực thi `prisma migrate deploy` trước khi container mới mở cổng nhận lưu lượng người dùng.
* Nếu migration gặp lỗi, phiên bản đang chạy sẽ được giữ nguyên an toàn (Zero Downtime).
* Ngoài ra lệnh khởi động `npm run start:backend:prod` cũng tích hợp sẵn `prisma migrate deploy && node dist/main.js` để bảo đảm schema luôn cập nhật dù chạy dưới bất kỳ môi trường nào (kể cả Docker).

### Bảng biến môi trường cho Backend (`vocelune-api`):

| Tên biến | Giá trị mẫu / Hướng dẫn |
| :--- | :--- |
| `NODE_ENV` | `production` |
| `PORT` | `10000` |
| `DATABASE_URL` | `postgresql://postgres.[REF]:[PASS]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?schema=public` |
| `APP_ORIGIN` | `https://vocelune-frontend.onrender.com` (hoặc domain Cloudflare Pages của bạn) |
| `REDIS_URL` | Lấy từ `vocelune-redis` hoặc Upstash Redis URL |
| `SESSION_DAYS` | `30` |
| `EMAIL_ENCRYPTION_KEY` | Tạo chuỗi ngẫu nhiên 64 ký tự hex (`openssl rand -hex 32`) |
| `DICTIONARY_LICENSE_MODE` | `LIVE_ONLY` |
| `R2_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `R2_ACCESS_KEY_ID` | Access Key ID của Cloudflare R2 |
| `R2_SECRET_ACCESS_KEY` | Secret Access Key của Cloudflare R2 |
| `R2_BUCKET` | `vocelune-private` |

---

## 5. Bước 4: Triển khai Frontend

### Tùy chọn A: Triển khai trên Cloudflare Pages / Workers (Khuyên dùng)

Dự án Vocelune được tối ưu hóa theo mô hình **Next.js Static HTML Export** với proxy đảo ngược `_redirects` cho API.

1. Đăng nhập Cloudflare Dashboard ➔ **Workers & Pages** ➔ chọn project `vocelune`.
2. Vào **Settings** ➔ **Builds & deployments**:
   * **Framework preset**: `None` hoặc `Next.js (Static HTML Export)`
   * **Root directory**: `apps/frontend` (hoặc để trống)
   * **Build command**: `npm run build:pages`
   * **Build output directory**: `out` (nếu Root directory là `apps/frontend`) hoặc `apps/frontend/out` (nếu Root directory để trống).
   * **Deploy command**: 
     * Nếu dùng **Cloudflare Pages**: Hãy **xóa trống** (không điền gì).
     * Nếu dùng **Cloudflare Workers (Builds)** có `npx wrangler deploy`: Dự án đã cấu hình sẵn [`apps/frontend/wrangler.json`](file:///Users/nguyenminhtruc-mac/Developer/Projects/active/Vocelune/apps/frontend/wrangler.json) với `assets: { directory: "./out" }` và `build: { command: "" }` để ngăn chặn Cloudflare tự gọi nhầm `opennextjs-cloudflare`.
3. Biến môi trường (Environment Variables):
   * `NODE_VERSION`: `22`
   * `API_PROXY_TARGET`: URL backend Render (ví dụ `https://vocelune-api.onrender.com`).
4. Bấm **Save** và bấm **Retry build**.

### Tùy chọn B: Triển khai Frontend trên Render

Nếu dùng `render.yaml`, Render đã tự động cấu hình service `vocelune-frontend`:
* **Build Command**: `npm ci && npm run build:frontend`
* **Start Command**: `npm run start --workspace=@vocelune/frontend`
* **API_PROXY_TARGET**: Tự động trỏ sang `vocelune-api` qua mạng nội bộ Render.

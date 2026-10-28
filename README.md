# Vocelune

Nền tảng học từ vựng tiếng Anh: active recall, lập lịch FSRS, kho từ theo từng nghĩa và bài kiểm tra độc lập.

## Chạy trên máy

Yêu cầu Node.js >=22.19 (khuyến nghị Node 24 LTS), npm và Docker Desktop đang chạy.

```bash
npm install
npm run setup
npm run dev
```

`setup` tạo `apps/backend/.env` nếu chưa tồn tại, sinh khóa mã hóa email ngẫu nhiên, chạy PostgreSQL/Redis/Mailpit và áp dụng migrations. Không ghi đè cấu hình đã có và không tạo tài khoản mặc định.

- Web: [localhost:3000](http://localhost:3000/app/dashboard) — đăng ký tài khoản tại giao diện.
- API: [localhost:4000/api/v1](http://localhost:4000/api/v1/health/ready).
- Swagger: [localhost:4000/api/docs](http://localhost:4000/api/docs).
- Email thử nghiệm: [localhost:8025](http://localhost:8025).
- PostgreSQL: `localhost:55432`; Redis: `localhost:56379`. Dữ liệu tồn tại trong Docker volumes.

`npm run dev` chạy web, API và worker. Có thể chạy riêng bằng `dev:frontend`, `dev:backend`, `worker`. Web proxy `/api/v1` sang API, giữ cookie cùng origin.

## Kiểm tra và build

```bash
npm run typecheck
npm test
npm run build
npm audit --omit=dev
```

Tests tạo database PostgreSQL có tên ngẫu nhiên, áp dụng toàn bộ migrations, kiểm tra API thật rồi xóa database đó. Tài khoản DB dùng cho tests cần quyền `CREATE DATABASE`. Có thể đặt `TEST_DATABASE_URL` riêng; không chạy tests với credential production.

## Các phần đã triển khai

- NestJS modular monolith, Prisma, PostgreSQL: migrations, indexes, constraints, kiểm tra tenant bằng service và DB triggers.
- Đăng ký/đăng nhập, opaque session HttpOnly, CSRF, giới hạn request, đổi mật khẩu qua email, thu hồi phiên, xuất/xóa tài khoản.
- CRUD bộ từ và nghĩa từ, nhiều chiều thẻ, tìm kiếm/phân trang, tags, kiểm tra/hợp nhất trùng và soft delete giữ lịch sử.
- **Quản lý nhóm chủ đề (Topic Groups) & Kho cộng đồng (Public Decks)**: Gom nhóm bộ từ theo chuyên đề (IELTS, Giao tiếp, Công sở, v.v.), chia sẻ công khai lên cộng đồng, xem trước và 1-click clone bộ từ kèm tự động khởi tạo lịch ôn FSRS. Tối ưu hiệu năng cao và 0 chi phí token AI thông qua in-memory caching và indexed queries.
- Due queue, giới hạn thẻ mới theo ngày học, reveal, FSRS server-side, transaction chống ghi lặp/xung đột, undo 30 giây, suspend/reset, cấu hình scheduler có phiên bản.
- Bài kiểm tra: bộ lọc, snapshot, trắc nghiệm/nhập đáp án/nghe, autosave, resume, timeout, chấm trên server. Ghi SRS cần tự đánh giá rõ ràng từng câu.
- CSV/XLSX: mẫu, upload, preview từng dòng, import có checkpoint/retry; export CSV/XLSX/JSON. Worker BullMQ xử lý import và email bằng trạng thái bền vững trong PostgreSQL.
- Dashboard/analytics theo IANA timezone và giờ bắt đầu ngày; retention có mẫu số, no-data rõ ràng; dự báo dùng chính engine FSRS.
- Adapter Oxford và R2 có kiểm tra cấu hình. Khi chưa có credentials, nhập thủ công vẫn hoạt động; không sinh nghĩa/IPA/CEFR giả.

**Scheduler thực tế:** `ts-fsrs` **5.4.2 / FSRS-6**, pin phiên bản và tham số. Nhãn FSRS-7 của bản frontend cũ đã được sửa. Nâng model cần migration và regression tests riêng.

Xem [hướng dẫn backend, API và vận hành](docs/backend.md) và [SRS](docs/SRS_English_Vocabulary_Learning_Platform_v1.0.md).

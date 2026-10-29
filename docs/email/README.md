# Vocelune — Email Template Kit v1.0

Bộ 5 email template responsive, theo branding Vocelune (primary `#5949E8`, ink `#17213B`, canvas `#F7F8FC`) và tagline **Mỗi từ, một nhịp nhớ.**

## Mở preview

Mở `Vocelune_Email_Preview.html` (file HTML độc lập) hoặc `preview/index.html` (cần giữ các file HTML trong cùng thư mục) bằng trình duyệt, lựa chọn từng email. Dữ liệu trong preview **chỉ là ví dụ**; email đặt lại mật khẩu chứa token giả (`DEMO-DO-NOT-USE`). Các nút trỏ đến đường dẫn sản phẩm dựa trên code hiện tại (`/library`, `/study`, `/analytics`, `/profile`, `/reset-password`).

## 5 templates

| Key | Công dụng | Nguồn dữ liệu | Trạng thái sản phẩm |
|---|---|---|---|
| `welcome` | Email chào mừng sau khi người dùng đăng ký | displayName | **Mới**, cần thêm event sau đăng ký |
| `study-reminder` | Nhắc số thẻ đến hạn + thẻ mới có thể học | Card, UserSettings | Có luồng gửi plain text hiện tại |
| `daily-summary` | Báo cáo lượt ôn, Good/Easy, số từ đã ôn | ReviewLog, VocabItem | Có luồng gửi plain text hiện tại |
| `weekly-digest` | Báo cáo hoạt động 7 ngày | ReviewLog | **Mới**, cần thêm opt-in trước khi gửi |
| `password-reset` | Liên kết thay mật khẩu có hạn | PasswordResetToken | Có luồng gửi plain text hiện tại |

`goodEasyCount/reviewCount` phải được đặt nhãn **tỷ lệ đánh giá Good / Easy**, không phải Accuracy, retention thực tế hay xác suất nhớ.

## Dùng trực tiếp trong NestJS

Copy `src/vocelune-email.ts` vào `apps/backend/src/email/` (hoặc vị trí tùy chỉnh). Module TypeScript dùng **0 runtime dependencies**, không cần React Email.

```ts
import { studyReminderEmail } from './email/vocelune-email';
import { sendEmailDirect } from './common/mailer';

const email = studyReminderEmail({
  displayName: user.displayName,
  appOrigin: config.APP_ORIGIN,
  dateLabel: '30/10/2026',
  dueCards: 12,
  newCardsAvailable: 5,
});

await sendEmailDirect({
  to: user.email,
  subject: email.subject,
  html: email.html,
  text: email.text,
});
```

**Production quan trọng:** Ví dụ trên chỉ minh họa API render. Hệ thống thật **không nên** gọi gửi trực tiếp từ API và đồng thời lưu outbox. Với Vocelune, hãy tạo 1 bản ghi `EmailOutbox` qua transaction, để worker là nơi duy nhất gửi qua Resend/SMTP; cập nhật schema lưu cả nội dung HTML đã mã hóa hoặc payload template có cấu trúc phù hợp. Worker hiện tại chỉ dùng `text` nên không thể triển khai HTML chỉ bằng việc thêm `html` vào service.

## Lưu ý bảo mật & vận hành

1. `escapeHtml()` escape tên và nội dung do user tạo; `safeUrl()` chỉ chấp nhận HTTPS hoặc `http://localhost` khi dev. Không cho phép URL có user/password.
2. Không ghi vào log token khôi phục mật khẩu hoặc nội dung email. Liên kết reset chỉ dùng một lần và có thời hạn được backend xác minh. Không gửi token trong mẫu email test môi trường production.
3. Không gửi email báo cáo tuần trước khi có opt-in. Với reminder và daily summary, tôn trọng `emailReminderStudy` và `emailDailySummary` trong `UserSettings`. Cần thiết kế unsubscribe/đổi tùy chọn 1-click nếu sau này phát triển email marketing.
4. Dữ liệu `dueCards` cần lọc suspended/deleted/buried và chỉ tính thẻ đến hạn theo quy tắc queue thực tế. `addedWords` không được suy ra từ `take: 10` (kết quả giới hạn).
5. `EmailOutbox` nên có `eventKey UNIQUE`, `templateKey`, `templateVersion`, `providerMessageId`, `nextAttemptAt`, `html` (được mã hóa) và trạng thái đủ chi tiết; ưu tiên retry có backoff.
6. Kiểm tra SPF/DKIM/DMARC, domain sender đã xác minh, bounce, Gmail/Outlook/Apple Mail và chế độ dark mode. Template sử dụng bảng HTML + inline style; media queries là tăng cường không bắt buộc.
7. Không sử dụng khẳng định “não bộ tăng liên kết nơ-ron gấp 3 lần khi học 06:00”: chưa có bằng chứng hỗ trợ trong nguồn của dự án.

## Tệp nguồn

- `src/vocelune-email.ts`: typed renderers cho cả 5 email, sinh `subject`, `html`, `text`.
- `preview/*.html`: mẫu giao diện dựng sẵn (chỉ demo).
- `preview/*.txt`: plain-text fallback tương ứng.
- `preview/index.html`: trang xem trước tất cả mẫu.
- `Vocelune_Email_Preview.html`: gallery self-contained, không phụ thuộc các file HTML ngoài.
- `examples/render-examples.cjs`: tạo lại preview từ bản JS đã biên dịch (`node examples/render-examples.cjs`).

## Build (tùy chọn)

Mã nguồn TypeScript tương thích project hiện tại. Để biên dịch độc lập khi có `tsc` trên máy:

```bash
tsc -p tsconfig.json
```

Không cần thư viện thiết kế email bên ngoài.

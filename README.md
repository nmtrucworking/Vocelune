# Vocelune — Monorepo Workspace

> **"Mỗi từ, một nhịp nhớ."** — *A rhythm for every word.*  
> Nền tảng học từ vựng tiếng Anh chủ động dựa trên mô hình truy hồi **Active Recall** và thuật toán lặp lại ngắt quãng **FSRS-7 (Free Spaced Repetition Scheduler)**.

---

## 📁 Cấu trúc Monorepo

```text
Vocelune/
├── apps/
│   ├── frontend/             # Ứng dụng Next.js App Router (TypeScript, Tailwind, FSRS-7)
│   │   ├── src/
│   │   │   ├── app/          # Routes: /, /app/dashboard, /app/study, /app/library, etc.
│   │   │   ├── components/   # UI components (Study, Tests, Library, Analytics, Layout)
│   │   │   ├── context/      # VoceluneContext & LocalStorage Persistence
│   │   │   └── lib/          # Advanced Audio Engine, FSRS-7 Adapter, Confetti, Seeds
│   │   ├── tailwind.config.ts
│   │   └── package.json
│   └── backend/              # Không gian dành cho Backend API (NestJS / PostgreSQL)
├── package.json              # Root npm workspace
└── vocelune.design-tokens.json
```

---

## 🌟 Nâng cấp Voice & Animations (Mới)

1. **Advanced Audio Engine (Cải thiện giọng đọc vượt bậc):**
   - **Real Human Studio Audio:** Tự động lấy âm thanh thu âm từ studio người bản xứ chuẩn (cả US và UK) qua Public Dictionary Audio API và lưu cache tức thì.
   - **Enhanced Neural Speech Synthesis Fallback:** Lọc và kích hoạt các giọng đọc chất lượng cao (`Google US/UK English`, `Apple Samantha/Daniel Enhanced`, `Microsoft Natural`), loại bỏ hoàn toàn giọng robot cổ điển.
   - **Animated Sound Equalizer:** Nút phát âm tích hợp hiệu ứng sóng âm thanh chuyển động (3 cột sóng nhấp nháy khi đang phát).

2. **Hệ thống Animations sống động:**
   - **3D Card Flip Animation:** Hiệu ứng lật thẻ 3D mượt mà (chuẩn 220ms theo Brand Guidelines Section 6.4).
   - **Floating Recall Orbit Logo:** Biểu tượng Orbit lơ lửng và 2 điểm sáng tri thức nhấp nháy phát quang (`animate-float-orbit` & `animate-glow-pulse`).
   - **Confetti Celebration:** Bắn pháo hoa rực rỡ khi hoàn thành lượt ôn tập hoặc đạt điểm cao trong bài kiểm tra.
   - **Micro-interactions:** Hiệu ứng spring-scale trên 4 nút đánh giá FSRS (Again, Hard, Good, Easy) và các nút thao tác.

---

## 🚀 Khởi chạy dự án

Từ thư mục gốc dự án:

```bash
# Cài đặt phụ thuộc cho toàn bộ workspace
npm install

# Khởi chạy Frontend
npm run dev
# hoặc
npm run dev:frontend

# Build ứng dụng Frontend
npm run build
```
Mở trình duyệt tại **`http://localhost:3000`** để trải nghiệm.

# Vocelune — English Vocabulary Learning Platform

> **"Mỗi từ, một nhịp nhớ."** — *A rhythm for every word.*  
> Nền tảng học từ vựng tiếng Anh chủ động dựa trên mô hình truy hồi **Active Recall** và thuật toán lặp lại ngắt quãng **FSRS-7 (Free Spaced Repetition Scheduler)**.

---

## 🌟 Tổng quan tính năng Frontend

Dự án được xây dựng bám sát tài liệu đặc tả **EVLP-SRS-001** và bộ nhận diện thương hiệu **Vocelune Brand Guidelines**:

1. **Bộ nhận diện thương hiệu Vocelune:**
   - Logo biểu tượng **"Recall Orbit"**: Thẻ từ bo góc tại tâm với đường quỹ đạo hai điểm sáng tri thức và chữ `V` âm bản tinh tế.
   - Bảng màu Design Tokens: `brand.primary` (`#5949E8`), `brand.ink` (`#17213B`), `brand.canvas` (`#F7F8FC`), `brand.mint` (`#D8F7F1`), v.v.
   - Hệ thống font chữ: `Be Vietnam Pro` (hỗ trợ tiếng Việt hoàn hảo) + `IBM Plex Mono` cho số liệu.

2. **Học truy hồi chủ động (Active Recall Gate & FSRS-7 Engine):**
   - **Active Recall Gate:** Mặt sau chỉ hiển thị khi người dùng chủ động nhấn *Xem đáp án* (`Space`).
   - **4 mức đánh giá FSRS chuẩn:** `Again (1)`, `Hard (2)`, `Good (3)`, `Easy (4)` kèm xem trước khoảng thời gian chu kỳ (`< 1m`, `10m`, `1d`, `4d`).
   - **Đa dạng chế độ học:** *Flashcard*, *Gõ từ (Typed recall)*, *Trắc nghiệm (MCQ 4 lựa chọn)*, và *Luyện nghe (Listening)*.
   - **Phát âm bản ngữ:** Tích hợp Web Speech Synthesis API hỗ trợ cả chất giọng Mỹ (`en-US`) và Anh (`en-GB`).
   - **Hoàn tác an toàn (Undo):** Hỗ trợ undo lượt vừa ôn tức thì (`Z`).

3. **Thư viện từ vựng (Library & Quick Add):**
   - Quản lý từ vựng, từ loại (POS), nghĩa tiếng Việt, định nghĩa tiếng Anh, ví dụ ngữ cảnh, phiên âm IPA.
   - Phân cấp theo khung tham chiếu châu Âu **CEFR (A1, A2, B1, B2, C1, C2, unknown)**.
   - **Quick Add Modal:** Tra từ nhanh với tính năng **Multi-Sense Preview** (chọn đúng sense theo ngữ cảnh, không đoán bừa).

4. **Hệ thống Kiểm tra độc lập (Test & Exam Engine):**
   - **Test Builder linh hoạt:** Lọc theo bộ từ, cấp độ CEFR, số lượng câu (5 - 30 câu), hình thức thi và thời gian làm bài.
   - **Độc lập với SRS:** Điểm thi không làm xáo trộn chu kỳ FSRS theo mặc định; có tùy chọn opt-in chủ động lưu vào lịch ôn.
   - Chấm điểm chi tiết, giải thích đáp án và lưu lại lịch sử bài làm.

5. **Phân tích tiến độ & Dự báo (Analytics & Forecast):**
   - Tỷ lệ nhớ thực tế (Observed recall accuracy) vs Mục tiêu thuật toán (Desired retention).
   - Ma trận chuỗi ngày học (Activity Heatmap) 6 tuần.
   - Dự báo tải ôn tập 7 ngày tới (FSRS Due Forecast).
   - Báo cáo các từ dễ quên nhất (Weak words / High lapses).

6. **Nhập & Xuất dữ liệu (Import / Export):**
   - Tải file mẫu CSV chuẩn UTF-8.
   - Kéo thả file CSV, xem trước dữ liệu, kiểm tra trùng lặp và phân loại lỗi.
   - Xuất dữ liệu kho từ vựng ra định dạng CSV và JSON có khử mã độc công thức bảng tính (anti-CSV injection).

7. **Hồ sơ & Cài đặt (Profile & Settings):**
   - Điều chỉnh FSRS Desired Retention (80% - 95%) kèm giải thích sự đánh đổi khối lượng bài ôn.
   - Giới hạn số thẻ mới mỗi ngày.
   - Chọn ngữ điệu bản ngữ US/UK và bật/tắt tự động phát âm.

---

## 🚀 Khởi chạy dự án

### Yêu cầu môi trường
- Node.js >= 18.x

### Cài đặt và chạy môi trường phát triển
```bash
# Cài đặt thư viện phụ thuộc
npm install

# Khởi chạy dev server
npm run dev

# Mở trình duyệt tại http://localhost:3000
```

### Build cho môi trường production
```bash
# Biên dịch tĩnh và tối ưu hóa
npm run build

# Chạy server production
npm start
```

---

## 📁 Cấu trúc thư mục

```text
src/
├── app/                      # Next.js App Router
│   ├── layout.tsx            # Global Root Layout & Font loader
│   ├── page.tsx              # Landing Page giới thiệu sản phẩm
│   ├── globals.css           # Tailwind CSS & CSS Tokens
│   └── app/                  # Route chính của ứng dụng
│       ├── layout.tsx        # AppShell Shell Wrapper
│       ├── dashboard/        # Tổng quan & KPI ngày học
│       ├── study/            # Phòng học Active Recall & FSRS-7
│       ├── library/          # Quản lý kho từ vựng & bộ lọc CEFR
│       ├── tests/            # Test builder & chấm điểm bài thi
│       ├── analytics/        # Phân tích chu kỳ nhớ & Heatmap
│       ├── import/           # Nhập CSV & sao lưu dữ liệu
│       └── profile/          # Cài đặt FSRS retention & giọng đọc
├── components/
│   ├── layout/               # Logo, Navbar, Sidebar, AppShell
│   ├── study/                # StudyConsole, Flashcard, Audio, Controls
│   ├── library/              # QuickAddModal, WordDetailModal, FilterBar
│   ├── tests/                # TestModule (Builder, Runner, Results)
│   ├── analytics/            # AnalyticsView, Forecast, Heatmap
│   ├── import/               # ImportExportModule
│   └── profile/              # ProfileSettingsView
├── context/
│   └── VoceluneContext.tsx   # Quản lý state toàn cục & LocalStorage
├── lib/
│   ├── fsrs-engine.ts        # FSRS-7 Adapter tính toán chu kỳ ôn tập
│   ├── seed-data.ts          # Dữ liệu từ vựng mẫu (Oxford 3000, IELTS, Business)
│   ├── speech.ts             # Web Speech Synthesis API phát âm bản ngữ
│   └── utils.ts              # Format ngày tháng, Tailwind merge
└── types/
    └── index.ts              # Domain types (VocabItem, Card, FSRS, Test, v.v.)
```

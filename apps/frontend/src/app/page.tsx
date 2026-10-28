'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Brain,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Volume2,
  Calendar,
  BarChart3,
  ShieldCheck,
  Layers,
  BookOpen,
  GraduationCap,
  Briefcase,
  Code2,
  HelpCircle,
  ChevronDown,
  Check,
  X,
  Clock,
  Compass,
  Repeat,
  Zap,
} from 'lucide-react';
import { Logo } from '@/components/layout/Logo';
import { speakWord } from '@/lib/speech';
import { AudioButton } from '@/components/common/AudioButton';
import { PublicNavbar } from '@/components/public/PublicNavbar';
import { PublicFooter } from '@/components/public/PublicFooter';

interface DemoWord {
  id: string;
  word: string;
  phonetic: string;
  partOfSpeech: string;
  cefr: string;
  meaningVi: string;
  definitionEn: string;
  exampleEn: string;
  exampleVi: string;
}

const DEMO_WORDS: DemoWord[] = [
  {
    id: 'resilient',
    word: 'resilient',
    phonetic: '/rɪˈzɪl.jənt/',
    partOfSpeech: 'adjective',
    cefr: 'C1',
    meaningVi: 'Kiên cường, có khả năng phục hồi nhanh sau khó khăn',
    definitionEn: 'Able to be happy, successful, etc. again after something difficult happens.',
    exampleEn: 'Local businesses have proven remarkably resilient in the face of economic hardship.',
    exampleVi: 'Các doanh nghiệp địa phương đã chứng minh sự kiên cường đáng nể khi đối mặt với khủng hoảng.',
  },
  {
    id: 'ephemeral',
    word: 'ephemeral',
    phonetic: '/ɪˈfem.ər.əl/',
    partOfSpeech: 'adjective',
    cefr: 'C2',
    meaningVi: 'Phù du, chóng tàn, chỉ tồn tại trong thời gian ngắn',
    definitionEn: 'Lasting for only a short time; transitory.',
    exampleEn: 'Fame in the digital era can be strikingly ephemeral.',
    exampleVi: 'Sự nổi tiếng trong kỷ nguyên số có thể chóng tàn một cách đáng kinh ngạc.',
  },
  {
    id: 'pragmatic',
    word: 'pragmatic',
    phonetic: '/præɡˈmæt.ɪk/',
    partOfSpeech: 'adjective',
    cefr: 'C1',
    meaningVi: 'Thực tế, thực dụng, giải quyết vấn đề dựa trên điều kiện thực tế',
    definitionEn: 'Solving problems in a sensible way that suits the conditions that really exist.',
    exampleEn: 'We need a pragmatic approach rather than endless ideological debates.',
    exampleVi: 'Chúng ta cần một hướng tiếp cận thực tế hơn là những cuộc tranh luận lý thuyết vô tận.',
  },
  {
    id: 'meticulous',
    word: 'meticulous',
    phonetic: '/məˈtɪk.jə.ləs/',
    partOfSpeech: 'adjective',
    cefr: 'C1',
    meaningVi: 'Tỉ mỉ, cẩn trọng, chú ý đến từng chi tiết nhỏ nhất',
    definitionEn: 'Very careful and with great attention to every detail.',
    exampleEn: 'The scientist kept meticulous notes throughout the clinical trials.',
    exampleVi: 'Nhà khoa học đã ghi chép cực kỳ tỉ mỉ trong suốt quá trình thử nghiệm lâm sàng.',
  },
];

export default function LandingPage() {
  const [selectedWordIndex, setSelectedWordIndex] = useState(0);
  const [demoRevealed, setDemoRevealed] = useState(false);
  const [fsrsFeedback, setFsrsFeedback] = useState<string | null>(null);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const currentWord = DEMO_WORDS[selectedWordIndex];

  const handleGradeChoice = (ratingLabel: string, nextInterval: string, deltaStability: string) => {
    setFsrsFeedback(
      `Đã ghi nhận [${ratingLabel}]: Thuật toán FSRS-6 lên lịch ôn tiếp theo sau ${nextInterval}. Độ ổn định S tăng +${deltaStability}.`
    );

    setTimeout(() => {
      // Advance to next word
      setFsrsFeedback(null);
      setDemoRevealed(false);
      setSelectedWordIndex((prev) => (prev + 1) % DEMO_WORDS.length);
    }, 1800);
  };

  const faqItems = [
    {
      q: 'Vocelune khác gì so với các ứng dụng học từ vựng truyền thống?',
      a: 'Khác biệt lớn nhất nằm ở phương pháp và đạo đức sản phẩm. Vocelune không ép bạn làm trắc nghiệm 4 đáp án (vốn tạo ra ảo tưởng nhận biết do đọc lại thụ động), mà áp dụng "Active Recall Gate" — buộc bạn phải nỗ lực tự gợi nhớ nghĩa trước khi lật thẻ. Đồng thời, lịch ôn tập được tính toán bằng thuật toán FSRS-6 thích ứng từng cá nhân, thay vì các khoảng thời gian lặp cố định.',
    },
    {
      q: 'Thuật toán FSRS-6 là gì và tại sao lại tốt hơn thuật toán SM-2 của Anki cũ?',
      a: 'SM-2 là thuật toán ra đời từ năm 1987 và dựa trên các hệ số nhân thô sơ. FSRS (Free Spaced Repetition Scheduler) là mô hình khoa học hiện đại mô phỏng trí nhớ dựa trên 3 biến số thực nghiệm: Stability (độ bền vững của ký ức), Difficulty (độ khó của thẻ), và Retrievability (xác suất nhớ lại tại thời điểm hiện tại). Nghiên cứu cho thấy FSRS giúp giảm 20–30% số lượt ôn tập thừa so với SM-2 mà vẫn đạt mục tiêu lưu giữ 90% vốn từ.',
    },
    {
      q: 'Tôi có thể mang dữ liệu từ Anki hoặc Excel vào Vocelune không?',
      a: 'Hoàn toàn được! Vocelune tôn trọng 100% quyền tự chủ dữ liệu (Data Sovereignty). Bạn có thể nhập file CSV, Excel, JSON hoặc bộ thẻ Anki (.apkg). Ngược lại, bạn cũng có thể xuất toàn bộ dữ liệu từ vựng cùng lịch sử ôn tập bất kỳ lúc nào mà không có bất kỳ rào cản nào.',
    },
    {
      q: 'Nguồn từ điển và âm thanh phát âm được lấy từ đâu?',
      a: 'Vocelune tích hợp trực tiếp với từ điển Oxford Learner\'s Dictionaries API, Free Dictionary API và cộng đồng Wiktionary, tự động phân loại chuẩn CEFR (A1-C2), phiên âm IPA chuẩn quốc tế và ví dụ câu ngữ cảnh. Tính năng âm thanh hỗ trợ cả hai giọng bản xứ Anh-Mỹ (en-US) và Anh-Anh (en-GB).',
    },
    {
      q: 'Hệ thống bài kiểm tra (Tests) có làm xáo trộn lịch ôn tập SRS không?',
      a: 'Không. Đây là nguyên tắc cốt lõi theo tiêu chuẩn EVLP-SRS-001 của Vocelune: Các bài kiểm tra khách quan (Trắc nghiệm, Điền từ, Luyện nghe) được tách biệt hoàn toàn khỏi thuật toán lập lịch SRS. Điểm số bài thi được dùng để bạn đánh giá khả năng phản xạ mà không làm sai lệch các thông số Stability/Difficulty của thẻ học.',
    },
    {
      q: 'Nền tảng có miễn phí không? Dữ liệu của tôi có bị bán cho bên thứ ba không?',
      a: 'Vocelune hoàn toàn miễn phí cho các tính năng học tập cốt lõi. Chúng tôi cam kết không chèn quảng cáo gây xao nhãng, không bán dữ liệu cá nhân của người học và không áp dụng các chiêu trò níu chân mang tính gây nghiện ảo.',
    },
  ];

  return (
    <div className="min-h-screen bg-brand-canvas text-brand-ink flex flex-col selection:bg-brand-primarySoft selection:text-brand-primary">
      {/* Top Sticky Header */}
      <PublicNavbar />

      {/* Hero Section */}
      <section className="relative px-4 sm:px-6 lg:px-8 pt-12 pb-16 md:pt-20 md:pb-24 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Hero Content (7 cols) */}
        <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-primarySoft text-brand-primary text-xs font-semibold border border-brand-primary/10">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Mỗi từ, một nhịp nhớ • Chuẩn thuật toán FSRS-6</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-brand-ink leading-[1.12]">
            Học từ mới.{' '}
            <span className="text-brand-primary underline decoration-brand-mint decoration-4 underline-offset-6">
              Ôn đúng lúc.
            </span>
            <br />
            Ghi nhớ bằng dữ liệu.
          </h1>

          <p className="text-base sm:text-lg text-text-secondary max-w-2xl mx-auto lg:mx-0 leading-relaxed">
            Thêm từ vựng, luyện truy hồi chủ động (Active Recall), để lịch ôn thích ứng FSRS giúp bạn theo dõi hành trình ghi nhớ bằng dữ liệu thực nghiệm thay vì học vẹt thụ động.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5">
            <Link
              href="/register"
              className="w-full sm:w-auto px-7 py-3.5 bg-brand-primary hover:bg-brand-primaryHover text-white font-bold text-sm rounded-control shadow-elevated transition-all flex items-center justify-center gap-2 group active:scale-95"
            >
              <span>Bắt đầu học miễn phí</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>

            <Link
              href="/explore"
              className="w-full sm:w-auto px-6 py-3.5 bg-surface-base hover:bg-slate-50 text-brand-ink font-semibold text-sm rounded-control border border-slate-200 transition-colors flex items-center justify-center gap-2 shadow-xs"
            >
              <BookOpen className="w-4 h-4 text-brand-primary" />
              <span>Khám phá kho từ vựng mẫu</span>
            </Link>
          </div>

          {/* Trust badges */}
          <div className="pt-4 flex flex-wrap items-center justify-center lg:justify-start gap-y-2 gap-x-6 text-xs text-text-secondary">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Cổng Active Recall chống học vẹt</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Mục tiêu lưu giữ 90% vốn từ</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Tự do xuất nhập CSV/Anki</span>
            </div>
          </div>
        </div>

        {/* Right Hero Demo Card (5 cols) */}
        <div className="lg:col-span-5 flex justify-center">
          <div className="w-full max-w-md bg-surface-base border border-slate-200/90 rounded-card shadow-elevated p-6 sm:p-7 space-y-5 relative overflow-hidden">
            {/* Header pill switcher */}
            <div className="space-y-2 pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                  Thử tương tác thẻ mẫu
                </span>
                <span className="text-[10px] text-brand-primary font-semibold">
                  Thẻ {selectedWordIndex + 1}/{DEMO_WORDS.length}
                </span>
              </div>

              {/* Sample word selector tabs */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                {DEMO_WORDS.map((w, idx) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => {
                      setSelectedWordIndex(idx);
                      setDemoRevealed(false);
                      setFsrsFeedback(null);
                    }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-all shrink-0 ${
                      selectedWordIndex === idx
                        ? 'bg-brand-primary text-white font-bold shadow-xs'
                        : 'bg-slate-100 text-text-secondary hover:text-brand-ink'
                    }`}
                  >
                    {w.word}
                  </button>
                ))}
              </div>
            </div>

            {/* Card Metadata Top */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-brand-primarySoft text-brand-primary font-bold text-[10px]">
                  CEFR {currentWord.cefr}
                </span>
                <span className="text-text-secondary italic text-[11px]">
                  ({currentWord.partOfSpeech})
                </span>
              </div>

              <AudioButton
                text={currentWord.word}
                dialect="en-us"
                size="sm"
                showLabel
              />
            </div>

            {/* Word Display */}
            <div className="py-2 text-center space-y-1">
              <h3 className="text-3xl font-extrabold text-brand-ink font-mono tracking-tight">
                {currentWord.word}
              </h3>
              <p className="text-xs font-mono text-slate-400">{currentWord.phonetic}</p>
            </div>

            {/* Active Recall Gate / Answer Reveal */}
            {demoRevealed ? (
              <div className="space-y-4 pt-2 border-t border-slate-100 text-left animate-in fade-in duration-200">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-primary">
                    Nghĩa tiếng Việt
                  </span>
                  <p className="text-base font-bold text-brand-ink">
                    {currentWord.meaningVi}
                  </p>
                </div>

                <div className="p-3 rounded-control bg-slate-50 border border-slate-100 text-xs space-y-1">
                  <p className="italic text-brand-ink">
                    &ldquo;{currentWord.exampleEn}&rdquo;
                  </p>
                  <p className="text-text-secondary text-[11px]">
                    {currentWord.exampleVi}
                  </p>
                </div>

                {/* 4 FSRS choices */}
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-text-secondary mb-1.5 flex items-center justify-between">
                    <span>Đánh giá độ nhớ (FSRS-6):</span>
                    <span className="text-[9px] font-normal normal-case">Dự đoán khoảng cách ôn</span>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleGradeChoice('Again', '1 phút', '0.1')}
                      className="p-2 rounded-control bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-center transition-colors"
                    >
                      <div className="text-[10px] font-bold">Again</div>
                      <div className="text-[9px] text-rose-500">1 phút</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleGradeChoice('Hard', '12 giờ', '0.8')}
                      className="p-2 rounded-control bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 text-center transition-colors"
                    >
                      <div className="text-[10px] font-bold">Hard</div>
                      <div className="text-[9px] text-amber-500">12 giờ</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleGradeChoice('Good', '2 ngày', '1.8')}
                      className="p-2 rounded-control bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-center transition-colors"
                    >
                      <div className="text-[10px] font-bold">Good</div>
                      <div className="text-[9px] text-blue-500">2 ngày</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleGradeChoice('Easy', '5 ngày', '3.5')}
                      className="p-2 rounded-control bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-center transition-colors"
                    >
                      <div className="text-[10px] font-bold">Easy</div>
                      <div className="text-[9px] text-emerald-500">5 ngày</div>
                    </button>
                  </div>
                </div>

                {/* Live simulation feedback banner */}
                {fsrsFeedback && (
                  <div className="p-2.5 rounded-control bg-brand-primarySoft border border-brand-primary/20 text-brand-primary text-[11px] font-medium animate-in fade-in duration-150">
                    {fsrsFeedback}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDemoRevealed(true)}
                  className="w-full py-3.5 bg-brand-primary text-white font-bold text-xs rounded-control hover:bg-brand-primaryHover shadow-sm transition-all duration-150 active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  <Brain className="w-4 h-4" />
                  <span>Nhấn để lật thẻ (Active Recall Gate)</span>
                </button>

                <p className="text-[11px] text-center text-text-secondary italic">
                  * Tự kiểm tra xem bạn có nhớ nghĩa trước khi nhấn mở đáp án
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Methodology Section (#methodology) */}
      <section id="methodology" className="px-4 sm:px-6 lg:px-8 py-20 bg-surface-base border-y border-slate-200/80 scroll-mt-20">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-primarySoft text-brand-primary text-xs font-semibold">
              <Brain className="w-3.5 h-3.5" />
              <span>Khoa học nhận thức & Trí nhớ dài hạn</span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-extrabold text-brand-ink tracking-tight">
              Tại sao Vocelune đem lại hiệu quả bền vững?
            </h2>

            <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
              Sự kết hợp giữa cơ chế Active Recall cưỡng chế gợi nhớ và thuật toán lặp lại ngắt quãng hiện đại FSRS-6 giúp loại bỏ hoàn toàn việc học vẹt đối phó.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="p-7 rounded-card border border-slate-200/90 bg-brand-canvas/60 space-y-4 hover:shadow-card transition-all">
              <div className="w-12 h-12 rounded-control bg-brand-primarySoft text-brand-primary flex items-center justify-center font-bold">
                <Brain className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-lg text-brand-ink">
                Active Recall Gate
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Đọc lại bài hoặc làm trắc nghiệm nhìn đáp án có sẵn tạo ra <strong>ảo tưởng thông thạo (Fluency Illusion)</strong>. Vocelune thiết kế cổng chặn: bạn bắt buộc phải nỗ lực gợi nhớ ký ức trước khi lật mặt sau, kích thích các nơ-ron thần kinh liên kết bền chặt hơn.
              </p>
              <div className="pt-2 text-[11px] font-semibold text-brand-primary flex items-center gap-1">
                <span>Không tạo đáp án gợi ý thụ động</span>
                <ArrowRight className="w-3 h-3" />
              </div>
            </div>

            {/* Feature 2 */}
            <div className="p-7 rounded-card border border-slate-200/90 bg-brand-canvas/60 space-y-4 hover:shadow-card transition-all">
              <div className="w-12 h-12 rounded-control bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <Calendar className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-lg text-brand-ink">
                Thuật toán FSRS-6 thích ứng
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Khắc phục nhược điểm của thuật toán SM-2 cổ điển (1987). FSRS tính toán riêng biệt <strong>Độ ổn định (S)</strong>, <strong>Độ khó (D)</strong> và <strong>Khả năng gợi nhớ (R)</strong> cho từng thẻ từ, giảm tới 30% số lượt ôn tập thừa mà vẫn đạt mục tiêu 90% retention rate.
              </p>
              <div className="pt-2 text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                <span>Tiết kiệm 20–30% thời gian ôn mỗi ngày</span>
                <ArrowRight className="w-3 h-3" />
              </div>
            </div>

            {/* Feature 3 */}
            <div className="p-7 rounded-card border border-slate-200/90 bg-brand-canvas/60 space-y-4 hover:shadow-card transition-all">
              <div className="w-12 h-12 rounded-control bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-lg text-brand-ink">
                Bằng chứng dữ liệu minh bạch
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Theo tiêu chuẩn EVLP-SRS-001, Vocelune <strong>tách biệt hoàn toàn bài kiểm tra (Tests) và lịch ôn tập (SRS)</strong>. Lịch sử truy hồi, đường cong quên lãng Ebbinghaus và tỷ lệ duy trì thực tế đều được trực quan hóa minh bạch, không dùng điểm số ảo.
              </p>
              <div className="pt-2 text-[11px] font-semibold text-amber-600 flex items-center gap-1">
                <span>Xem đường cong quên lãng cá nhân hóa</span>
                <ArrowRight className="w-3 h-3" />
              </div>
            </div>
          </div>

          {/* FSRS Scientific Formula Box */}
          <div className="p-6 sm:p-8 rounded-card bg-brand-ink text-white space-y-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-mono uppercase tracking-wider text-brand-mint">
                  Mô hình toán học FSRS-6
                </span>
                <h4 className="text-xl font-bold text-white mt-1">
                  Xác suất gợi nhớ Retrievability: R(t, S) = (1 + Factor × t / S)⁻⁰·⁵
                </h4>
              </div>

              <div className="text-xs text-slate-300 max-w-sm">
                Khi xác suất ghi nhớ giảm xuống ngưỡng mục tiêu (mặc định 90%), hệ thống sẽ tự động đưa từ đó vào danh sách cần ôn của ngày hôm đó.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Features Grid (#features) */}
      <section id="features" className="px-4 sm:px-6 lg:px-8 py-20 max-w-7xl mx-auto w-full space-y-16 scroll-mt-20">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-primarySoft text-brand-primary text-xs font-semibold">
            <Zap className="w-3.5 h-3.5" />
            <span>Hệ sinh thái công cụ toàn diện</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold text-brand-ink tracking-tight">
            Thiết kế tối ưu cho trải nghiệm học từ vựng sâu
          </h2>

          <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
            Không chỉ là những tấm thẻ flashcard thông thường, Vocelune tích hợp đầy đủ công cụ từ điển, phát âm bản xứ, bài thi đánh giá và quản lý chuyên nghiệp.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1: Multi-Dictionary */}
          <div className="p-6 rounded-card bg-surface-base border border-slate-200/90 shadow-card hover:shadow-elevated transition-all space-y-3">
            <div className="w-10 h-10 rounded-control bg-indigo-50 text-brand-primary flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <h3 className="font-extrabold text-base text-brand-ink">
              Tra cứu đa từ điển tự động
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Tích hợp sẵn Oxford Learner&apos;s Dictionaries API, Free Dictionary và Wiktionary. Tự động điền phiên âm IPA chuẩn, phân loại từ vựng và cấp độ CEFR chỉ với 1 click.
            </p>
          </div>

          {/* Card 2: Audio Engine */}
          <div className="p-6 rounded-card bg-surface-base border border-slate-200/90 shadow-card hover:shadow-elevated transition-all space-y-3">
            <div className="w-10 h-10 rounded-control bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Volume2 className="w-5 h-5" />
            </div>
            <h3 className="font-extrabold text-base text-brand-ink">
              Âm thanh chuẩn bản xứ Anh - Mỹ
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Lựa chọn linh hoạt giữa chất giọng Anh-Mỹ (en-US) và Anh-Anh (en-GB). Nghe phát âm chuẩn xác từng từ và câu ví dụ để hoàn thiện khả năng nghe phản xạ.
            </p>
          </div>

          {/* Card 3: Topic Groups & Public Hub */}
          <div className="p-6 rounded-card bg-surface-base border border-slate-200/90 shadow-card hover:shadow-elevated transition-all space-y-3">
            <div className="w-10 h-10 rounded-control bg-amber-50 text-amber-600 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="font-extrabold text-base text-brand-ink">
              Nhóm chủ đề & Kho từ vựng công khai
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Tổ chức bộ từ theo các nhóm chủ đề lớn (IELTS, Business, Oxford 3000, IT Tech). Dễ dàng sao chép (Fork) các bộ từ chuẩn chất lượng cao về tài khoản cá nhân.
            </p>
          </div>

          {/* Card 4: Objective Tests */}
          <div className="p-6 rounded-card bg-surface-base border border-slate-200/90 shadow-card hover:shadow-elevated transition-all space-y-3">
            <div className="w-10 h-10 rounded-control bg-rose-50 text-rose-600 flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
            <h3 className="font-extrabold text-base text-brand-ink">
              Kiểm tra đa dạng & Khách quan
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Luyện tập với bài thi trắc nghiệm 4 lựa chọn, điền từ vào câu ngữ cảnh (Spaced Cloze) và bài thi nghe chép chính tả mà không làm xáo trộn thuật toán SRS.
            </p>
          </div>

          {/* Card 5: Analytics */}
          <div className="p-6 rounded-card bg-surface-base border border-slate-200/90 shadow-card hover:shadow-elevated transition-all space-y-3">
            <div className="w-10 h-10 rounded-control bg-purple-50 text-purple-600 flex items-center justify-center">
              <BarChart3 className="w-5 h-5" />
            </div>
            <h3 className="font-extrabold text-base text-brand-ink">
              Phân tích tiến độ & Quên lãng
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Theo dõi biểu đồ dự báo số thẻ đến hạn trong 30 ngày tới, độ ổn định trung bình, bản đồ nhiệt (Activity Heatmap) và danh sách các từ khó hay quên (Leeches).
            </p>
          </div>

          {/* Card 6: Data Sovereignty */}
          <div className="p-6 rounded-card bg-surface-base border border-slate-200/90 shadow-card hover:shadow-elevated transition-all space-y-3">
            <div className="w-10 h-10 rounded-control bg-blue-50 text-blue-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-extrabold text-base text-brand-ink">
              Tự do dữ liệu & Không quảng cáo
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Dữ liệu thuộc về bạn. Xuất/nhập file Excel, CSV, JSON và gói Anki (.apkg) bất kỳ lúc nào. Không chèn quảng cáo, không ép buộc nạp tiền để mở tính năng.
            </p>
          </div>
        </div>
      </section>

      {/* Featured Public Decks Showcase Section */}
      <section className="px-4 sm:px-6 lg:px-8 py-20 bg-brand-canvas border-t border-slate-200/80">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-primarySoft text-brand-primary text-xs font-semibold">
                <BookOpen className="w-3.5 h-3.5" />
                <span>Kho học liệu sẵn sàng</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-brand-ink">
                Bộ từ vựng nổi bật dành cho bạn
              </h2>
              <p className="text-xs sm:text-sm text-text-secondary">
                Không cần tạo thẻ từ đầu. Lưu các bộ từ vựng tuyển chọn và bắt đầu học ngay hôm nay.
              </p>
            </div>

            <Link
              href="/explore"
              className="inline-flex items-center gap-2 text-xs font-bold text-brand-primary hover:text-brand-primaryHover group transition-colors"
            >
              <span>Xem toàn bộ kho từ vựng công khai</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Curated Deck 1 */}
            <div className="bg-surface-base rounded-card border border-slate-200/90 shadow-card p-6 flex flex-col justify-between space-y-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-control bg-brand-primary text-white flex items-center justify-center font-bold">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-brand-primarySoft text-brand-primary">
                    CEFR A1-B2
                  </span>
                </div>

                <h3 className="font-extrabold text-lg text-brand-ink">
                  Oxford 3000™ Core
                </h3>

                <p className="text-xs text-text-secondary leading-relaxed">
                  3.000 từ vựng cốt lõi thiết yếu nhất của tiếng Anh. Chiếm tới 85% nội dung trong các cuộc hội thoại, báo chí và sách thông thường.
                </p>

                <div className="pt-1 flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-[11px] font-mono">abandon</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-[11px] font-mono">adequate</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-[11px] font-mono">clarify</span>
                </div>
              </div>

              <Link
                href="/explore"
                className="w-full py-2.5 px-3 bg-brand-canvas hover:bg-slate-100 text-brand-ink font-semibold text-xs rounded-control border border-slate-200 transition-colors text-center"
              >
                Xem chi tiết từ vựng →
              </Link>
            </div>

            {/* Curated Deck 2 */}
            <div className="bg-surface-base rounded-card border border-slate-200/90 shadow-card p-6 flex flex-col justify-between space-y-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-control bg-emerald-600 text-white flex items-center justify-center font-bold">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                    IELTS 7.0+
                  </span>
                </div>

                <h3 className="font-extrabold text-lg text-brand-ink">
                  IELTS Academic High-Frequency
                </h3>

                <p className="text-xs text-text-secondary leading-relaxed">
                  Tuyển tập từ vựng học thuật xuất hiện thường xuyên trong bài thi IELTS Reading và Writing Task 2 giúp tối ưu tiêu chí Lexical Resource.
                </p>

                <div className="pt-1 flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-[11px] font-mono">resilient</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-[11px] font-mono">meticulous</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-[11px] font-mono">pragmatic</span>
                </div>
              </div>

              <Link
                href="/explore"
                className="w-full py-2.5 px-3 bg-brand-canvas hover:bg-slate-100 text-brand-ink font-semibold text-xs rounded-control border border-slate-200 transition-colors text-center"
              >
                Xem chi tiết từ vựng →
              </Link>
            </div>

            {/* Curated Deck 3 */}
            <div className="bg-surface-base rounded-card border border-slate-200/90 shadow-card p-6 flex flex-col justify-between space-y-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-control bg-amber-600 text-white flex items-center justify-center font-bold">
                    <Briefcase className="w-5 h-5" />
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700">
                    Business English
                  </span>
                </div>

                <h3 className="font-extrabold text-lg text-brand-ink">
                  Business Communication
                </h3>

                <p className="text-xs text-text-secondary leading-relaxed">
                  Từ vựng giao tiếp chuyên nghiệp, đàm phán thương mại, thuyết trình và viết email công sở trong môi trường tập đoàn đa quốc gia.
                </p>

                <div className="pt-1 flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-[11px] font-mono">synergy</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-[11px] font-mono">leverage</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-[11px] font-mono">benchmark</span>
                </div>
              </div>

              <Link
                href="/explore"
                className="w-full py-2.5 px-3 bg-brand-canvas hover:bg-slate-100 text-brand-ink font-semibold text-xs rounded-control border border-slate-200 transition-colors text-center"
              >
                Xem chi tiết từ vựng →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Table Section (#comparison) */}
      <section id="comparison" className="px-4 sm:px-6 lg:px-8 py-20 bg-surface-base border-y border-slate-200/80 scroll-mt-20">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-primarySoft text-brand-primary text-xs font-semibold">
              <Compass className="w-3.5 h-3.5" />
              <span>So sánh khách quan</span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-extrabold text-brand-ink tracking-tight">
              Vocelune khác gì so với các nền tảng khác?
            </h2>

            <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
              So sánh chi tiết về thuật toán, tính năng học tập và sự tôn trọng quyền tự chủ của người học.
            </p>
          </div>

          {/* Responsive Comparison Table */}
          <div className="overflow-x-auto rounded-card border border-slate-200 shadow-xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-brand-ink">
                  <th className="p-4 sm:p-5 font-bold text-xs uppercase tracking-wider w-2/5">
                    Tiêu chí đánh giá
                  </th>
                  <th className="p-4 sm:p-5 font-extrabold text-sm text-brand-primary bg-brand-primarySoft/50 w-1/5">
                    Vocelune
                  </th>
                  <th className="p-4 sm:p-5 font-semibold text-xs text-text-secondary w-1/5">
                    Anki cổ điển
                  </th>
                  <th className="p-4 sm:p-5 font-semibold text-xs text-text-secondary w-1/5">
                    Quizlet / Flashcard thường
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="p-4 sm:p-5">
                    <div className="font-bold text-brand-ink">Thuật toán lặp lại ngắt quãng</div>
                    <div className="text-[11px] text-text-secondary">Tối ưu hóa thời điểm ôn tập khoa học</div>
                  </td>
                  <td className="p-4 sm:p-5 bg-brand-primarySoft/30 font-bold text-brand-primary">
                    <div className="flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>FSRS-6 hiện đại</span>
                    </div>
                  </td>
                  <td className="p-4 sm:p-5 text-text-secondary">SM-2 (thập niên 1980)</td>
                  <td className="p-4 sm:p-5 text-rose-600">Khoảng cách cố định / Không có</td>
                </tr>

                <tr>
                  <td className="p-4 sm:p-5">
                    <div className="font-bold text-brand-ink">Cổng Active Recall Gate</div>
                    <div className="text-[11px] text-text-secondary">Chống đọc vẹt và ảo tưởng nhận biết</div>
                  </td>
                  <td className="p-4 sm:p-5 bg-brand-primarySoft/30 font-bold text-brand-primary">
                    <div className="flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>Bắt buộc gợi nhớ</span>
                    </div>
                  </td>
                  <td className="p-4 sm:p-5 text-text-secondary">Có hỗ trợ</td>
                  <td className="p-4 sm:p-5 text-rose-600">Trắc nghiệm nhìn thấy trước đáp án</td>
                </tr>

                <tr>
                  <td className="p-4 sm:p-5">
                    <div className="font-bold text-brand-ink">Tra cứu từ điển Oxford & CEFR</div>
                    <div className="text-[11px] text-text-secondary">Tự động điền phiên âm IPA, nghĩa, ví dụ</div>
                  </td>
                  <td className="p-4 sm:p-5 bg-brand-primarySoft/30 font-bold text-brand-primary">
                    <div className="flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>Tích hợp sẵn tự động</span>
                    </div>
                  </td>
                  <td className="p-4 sm:p-5 text-text-secondary">Phải cài addon phức tạp</td>
                  <td className="p-4 sm:p-5 text-text-secondary">Chỉ dịch máy sơ sài</td>
                </tr>

                <tr>
                  <td className="p-4 sm:p-5">
                    <div className="font-bold text-brand-ink">Kiểm tra độc lập không hỏng SRS</div>
                    <div className="text-[11px] text-text-secondary">Tách biệt bài thi và tiến độ lặp lại</div>
                  </td>
                  <td className="p-4 sm:p-5 bg-brand-primarySoft/30 font-bold text-brand-primary">
                    <div className="flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>Chuẩn EVLP-SRS-001</span>
                    </div>
                  </td>
                  <td className="p-4 sm:p-5 text-rose-600">Không có module test riêng</td>
                  <td className="p-4 sm:p-5 text-text-secondary">Có test nhưng không có SRS</td>
                </tr>

                <tr>
                  <td className="p-4 sm:p-5">
                    <div className="font-bold text-brand-ink">Quyền tự chủ & Xuất nhập dữ liệu</div>
                    <div className="text-[11px] text-text-secondary">Nhập xuất Anki, CSV, Excel, JSON</div>
                  </td>
                  <td className="p-4 sm:p-5 bg-brand-primarySoft/30 font-bold text-brand-primary">
                    <div className="flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>100% tự do dữ liệu</span>
                    </div>
                  </td>
                  <td className="p-4 sm:p-5 text-text-secondary">Có hỗ trợ xuất nhập</td>
                  <td className="p-4 sm:p-5 text-rose-600">Bị khóa dữ liệu trong hệ thống</td>
                </tr>

                <tr>
                  <td className="p-4 sm:p-5">
                    <div className="font-bold text-brand-ink">Giao diện & Trải nghiệm tập trung</div>
                    <div className="text-[11px] text-text-secondary">Không quảng cáo xao nhãng</div>
                  </td>
                  <td className="p-4 sm:p-5 bg-brand-primarySoft/30 font-bold text-brand-primary">
                    <div className="flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>Hiện đại, không quảng cáo</span>
                    </div>
                  </td>
                  <td className="p-4 sm:p-5 text-text-secondary">Giao diện cũ, phức tạp</td>
                  <td className="p-4 sm:p-5 text-rose-600">Quảng cáo dày đặc, ép nâng cấp</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ Section (#faq) */}
      <section id="faq" className="px-4 sm:px-6 lg:px-8 py-20 max-w-4xl mx-auto w-full space-y-12 scroll-mt-20">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-primarySoft text-brand-primary text-xs font-semibold">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Giải đáp thắc mắc</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold text-brand-ink tracking-tight">
            Câu hỏi thường gặp
          </h2>

          <p className="text-sm text-text-secondary">
            Mọi thông tin bạn cần biết về phương pháp học và cơ chế hoạt động của Vocelune.
          </p>
        </div>

        {/* Accordion list */}
        <div className="space-y-3">
          {faqItems.map((item, index) => {
            const isOpen = openFaqIndex === index;

            return (
              <div
                key={index}
                className="bg-surface-base border border-slate-200/90 rounded-control overflow-hidden transition-all shadow-xs"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                  className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-bold text-sm text-brand-ink hover:text-brand-primary transition-colors"
                >
                  <span>{item.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-brand-primary' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-4 sm:px-5 pb-5 text-xs text-text-secondary leading-relaxed border-t border-slate-100 pt-3 animate-in fade-in duration-150">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Final Call to Action Banner */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 bg-gradient-to-br from-brand-primary to-indigo-900 text-white selection:bg-brand-mint selection:text-brand-ink">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-semibold backdrop-blur-xs">
            <Sparkles className="w-3.5 h-3.5 text-brand-mint" />
            <span>Bắt đầu hôm nay • Nhìn thấy tiến bộ rõ rệt sau 30 ngày</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
            Xây dựng vốn từ vựng vững chắc với nhịp ôn khoa học.
          </h2>

          <p className="text-sm sm:text-base text-slate-200 max-w-xl mx-auto leading-relaxed">
            Tham gia cùng hàng nghìn người học tiếng Anh nghiêm túc. Miễn phí trọn đời cho các tính năng học tập cá nhân.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/register"
              className="w-full sm:w-auto px-8 py-3.5 bg-white hover:bg-slate-100 text-brand-primary font-bold text-sm rounded-control shadow-elevated transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <span>Tạo tài khoản học ngay</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/explore"
              className="w-full sm:w-auto px-7 py-3.5 bg-white/10 hover:bg-white/20 text-white font-semibold text-sm rounded-control border border-white/20 transition-colors flex items-center justify-center"
            >
              Khám phá bộ từ trước
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <PublicFooter />
    </div>
  );
}

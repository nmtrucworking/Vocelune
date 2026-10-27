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
  CheckSquare,
  Layers,
  Flame,
} from 'lucide-react';
import { Logo } from '@/components/layout/Logo';
import { speakWord } from '@/lib/speech';

export default function LandingPage() {
  const [demoRevealed, setDemoRevealed] = useState(false);

  return (
    <div className="min-h-screen bg-brand-canvas text-brand-ink flex flex-col selection:bg-brand-primarySoft selection:text-brand-primary">
      {/* Top Navbar */}
      <header className="h-18 px-6 md:px-12 flex items-center justify-between border-b border-slate-200/60 bg-surface-base/80 backdrop-blur-md sticky top-0 z-30">
        <Logo size="md" showTagline />

        <div className="flex items-center gap-3">
          <Link
            href="/app/dashboard"
            className="text-xs font-semibold text-text-secondary hover:text-brand-ink px-3 py-2 transition-colors hidden sm:inline"
          >
            Đăng nhập
          </Link>
          <Link
            href="/app/dashboard"
            className="px-4 py-2 bg-brand-primary hover:bg-brand-primaryHover text-white rounded-control font-semibold text-xs shadow-sm transition-all duration-150 flex items-center gap-1.5"
          >
            <span>Bắt đầu học</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="px-6 md:px-12 py-16 md:py-24 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Hero Content (7 cols) */}
        <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-primarySoft text-brand-primary text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>A rhythm for every word • Chuẩn thuật toán FSRS-7</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-brand-ink leading-[1.12]">
            Học từ mới.{' '}
            <span className="text-brand-primary underline decoration-brand-mint decoration-4 underline-offset-6">
              Ôn đúng lúc.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-text-secondary max-w-2xl mx-auto lg:mx-0 leading-relaxed">
            Thêm từ vựng, luyện truy hồi chủ động (Active Recall), để lịch ôn thích ứng FSRS giúp bạn theo dõi hành trình ghi nhớ bằng dữ liệu thực nghiệm.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3">
            <Link
              href="/app/dashboard"
              className="w-full sm:w-auto px-7 py-3.5 bg-brand-primary hover:bg-brand-primaryHover text-white font-bold text-sm rounded-control shadow-elevated transition-all flex items-center justify-center gap-2 group active:scale-95"
            >
              <span>Vào học ngay miễn phí</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>

            <Link
              href="/app/library"
              className="w-full sm:w-auto px-6 py-3.5 bg-surface-base hover:bg-slate-50 text-brand-ink font-semibold text-sm rounded-control border border-slate-200 transition-colors flex items-center justify-center"
            >
              Khám phá thư viện từ vựng
            </Link>
          </div>

          <div className="pt-4 flex items-center justify-center lg:justify-start gap-6 text-xs text-text-secondary">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Không học vẹt thụ động</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Cá nhân hóa theo từng thẻ</span>
            </div>
          </div>
        </div>

        {/* Right Hero Demo Card (5 cols) */}
        <div className="lg:col-span-5 flex justify-center">
          <div className="w-full max-w-md bg-surface-base border border-slate-200/90 rounded-card shadow-elevated p-6 md:p-8 space-y-6 relative overflow-hidden">
            {/* Top card badge */}
            <div className="flex items-center justify-between text-xs pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-brand-primarySoft text-brand-primary font-bold text-[10px]">
                  CEFR C1
                </span>
                <span className="text-text-secondary italic">(adjective)</span>
              </div>

              <button
                type="button"
                onClick={() => speakWord('resilient', 'en-us')}
                className="p-1.5 rounded-md text-brand-primary hover:bg-brand-primarySoft transition-colors flex items-center gap-1 text-xs font-semibold"
                title="Nghe phát âm"
              >
                <Volume2 className="w-4 h-4" />
                <span>US</span>
              </button>
            </div>

            {/* Word Display */}
            <div className="py-4 text-center space-y-1">
              <h3 className="text-3xl font-extrabold text-brand-ink">resilient</h3>
              <p className="text-xs font-mono text-slate-400">/rɪˈzɪl.jənt/</p>
            </div>

            {/* Answer Gate */}
            {demoRevealed ? (
              <div className="space-y-4 pt-3 border-t border-slate-100 text-left animate-in fade-in duration-200">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-primary">
                    Nghĩa tiếng Việt
                  </span>
                  <p className="text-base font-bold text-brand-ink">
                    Kiên cường, phục hồi nhanh sau khó khăn
                  </p>
                </div>

                <div className="p-3 rounded-control bg-slate-50 border border-slate-100 text-xs">
                  <p className="italic text-brand-ink">
                    &ldquo;Local businesses have proven remarkably resilient.&rdquo;
                  </p>
                </div>

                {/* 4 FSRS choices */}
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  <div className="p-2 rounded bg-rose-50 text-rose-700 text-center text-[10px] font-bold">
                    Again (1m)
                  </div>
                  <div className="p-2 rounded bg-amber-50 text-amber-700 text-center text-[10px] font-bold">
                    Hard (6m)
                  </div>
                  <div className="p-2 rounded bg-blue-50 text-blue-700 text-center text-[10px] font-bold">
                    Good (1d)
                  </div>
                  <div className="p-2 rounded bg-emerald-50 text-emerald-700 text-center text-[10px] font-bold">
                    Easy (4d)
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setDemoRevealed(true)}
                className="w-full py-3 bg-brand-primary text-white font-bold text-xs rounded-control hover:bg-brand-primaryHover shadow-sm transition-all"
              >
                Nhấn để lật thẻ (Active Recall)
              </button>
            )}

            <div className="pt-2 text-center">
              <span className="text-[11px] text-text-secondary">
                * Thử trải nghiệm phương pháp học của Vocelune ngay trên thẻ mẫu
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Core Principles Section */}
      <section className="px-6 md:px-12 py-16 bg-surface-base border-y border-slate-200/80">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-brand-ink">
              Tại sao Vocelune đem lại hiệu quả bền vững?
            </h2>
            <p className="text-xs sm:text-sm text-text-secondary">
              Kết hợp hoàn hảo giữa tâm lý học nhận thức và thuật toán trí nhớ tối tân.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="p-6 rounded-card border border-slate-200/80 bg-brand-canvas/60 space-y-3">
              <div className="w-10 h-10 rounded-control bg-brand-primarySoft text-brand-primary flex items-center justify-center">
                <Brain className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-brand-ink">
                Active Recall Gate
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Buộc não bộ phải tự tìm đường gợi nhớ thông tin trước khi lật đáp án. Không tạo ảo tưởng ghi nhớ do đọc lại thụ động.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-card border border-slate-200/80 bg-brand-canvas/60 space-y-3">
              <div className="w-10 h-10 rounded-control bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-brand-ink">
                Thuật toán FSRS-7 thích ứng
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Mô hình Free Spaced Repetition Scheduler tính toán độ ổn định (S) và độ khó (D) cho từng thẻ đơn lẻ, tối ưu thời gian ôn tập.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-card border border-slate-200/80 bg-brand-canvas/60 space-y-3">
              <div className="w-10 h-10 rounded-control bg-amber-50 text-amber-600 flex items-center justify-center">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-brand-ink">
                Bằng chứng dữ liệu minh bạch
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Tách biệt hoàn toàn giữa bài kiểm tra (Tests) và lịch ôn tập (SRS). Mọi chỉ số tiến bộ đều dựa trên lịch sử truy hồi có thể kiểm chứng.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto px-6 md:px-12 py-8 bg-brand-ink text-white">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white tracking-wide">Vocelune</span>
            <span>—</span>
            <span>Mỗi từ, một nhịp nhớ.</span>
          </div>

          <div>
            English Vocabulary Learning Platform • EVLP-SRS-001 Compliant
          </div>
        </div>
      </footer>
    </div>
  );
}

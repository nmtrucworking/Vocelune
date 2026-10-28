'use client';

import React from 'react';
import Link from 'next/link';
import { Logo } from '@/components/layout/Logo';
import { Sparkles, ShieldCheck, Database, BookOpen, ExternalLink, Heart } from 'lucide-react';

export function PublicFooter() {
  return (
    <footer className="bg-brand-ink text-white border-t border-slate-800 selection:bg-brand-primarySoft selection:text-brand-primary">
      {/* Upper footer */}
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          {/* Brand Info (2 cols) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="inline-block bg-white/5 p-2 rounded-xl border border-white/10">
              <Logo size="md" showTagline href="/" className="brightness-110" />
            </div>

            <p className="text-xs text-slate-300 leading-relaxed max-w-sm">
              Không học vẹt thụ động. Vocelune phối hợp khoa học nhận thức Active Recall và thuật toán lặp lại ngắt quãng FSRS-6, giúp người học làm chủ vốn từ tiếng Anh bền vững theo dữ liệu thực nghiệm.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-brand-mint font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                FSRS-6 Adaptive Engine
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-slate-300">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                EVLP-SRS-001 Compliant
              </span>
            </div>
          </div>

          {/* Col 1: Khám phá & Học tập */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Khám phá & Học tập
            </h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>
                <Link href="/explore" className="hover:text-white transition-colors">
                  Kho từ vựng công khai
                </Link>
              </li>
              <li>
                <Link href="/#methodology" className="hover:text-white transition-colors">
                  Phương pháp Active Recall
                </Link>
              </li>
              <li>
                <Link href="/#features" className="hover:text-white transition-colors">
                  Hệ sinh thái tính năng
                </Link>
              </li>
              <li>
                <Link href="/#comparison" className="hover:text-white transition-colors">
                  So sánh với Anki / Quizlet
                </Link>
              </li>
              <li>
                <Link href="/app/dashboard" className="hover:text-white transition-colors">
                  Bàn học cá nhân
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 2: Khoa học & Thuật toán */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Khoa học & Thuật toán
            </h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>
                <a
                  href="https://github.com/open-spaced-repetition/fsrs4anki"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors inline-flex items-center gap-1"
                >
                  <span>Mô hình FSRS-6</span>
                  <ExternalLink className="w-3 h-3 text-slate-500" />
                </a>
              </li>
              <li>
                <span className="text-slate-300">Độ ổn định & Độ khó (S/D)</span>
              </li>
              <li>
                <span className="text-slate-300">Đường cong quên lãng Ebbinghaus</span>
              </li>
              <li>
                <span className="text-slate-300">Tách biệt bài test & thẻ SRS</span>
              </li>
              <li>
                <span className="text-slate-300">Mục tiêu ghi nhớ 90%</span>
              </li>
            </ul>
          </div>

          {/* Col 3: Nguồn dữ liệu & Bản quyền */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Từ điển & Tích hợp
            </h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>
                <span className="text-slate-300">Oxford Learner&apos;s Dictionaries</span>
              </li>
              <li>
                <span className="text-slate-300">Free Dictionary API</span>
              </li>
              <li>
                <span className="text-slate-300">Wiktionary Community</span>
              </li>
              <li>
                <span className="text-slate-300">Khung năng lực CEFR (A1-C2)</span>
              </li>
              <li>
                <span className="text-slate-300">Xuất nhập định dạng Anki & CSV</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Attribution & Legal disclaimer bar */}
      <div className="border-t border-white/10 bg-black/20">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-6 flex flex-col md:flex-row items-center justify-between gap-4 text-[11px] text-slate-400">
          <div className="flex items-center gap-2 text-center md:text-left">
            <span>© 2026 Vocelune. All rights reserved.</span>
            <span className="hidden sm:inline">•</span>
            <span className="hidden sm:inline">Mỗi từ, một nhịp nhớ. (A rhythm for every word)</span>
          </div>

          <div className="flex items-center gap-4 text-center md:text-right">
            <span>Dữ liệu từ điển thuộc bản quyền của nguồn phát hành tương ứng</span>
            <span>•</span>
            <span className="text-emerald-400 font-medium">Bảo toàn quyền tự chủ dữ liệu</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

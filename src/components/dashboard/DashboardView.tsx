'use client';

import React from 'react';
import Link from 'next/link';
import {
  Brain,
  Sparkles,
  Flame,
  CheckCircle,
  TrendingUp,
  ArrowRight,
  BookOpen,
  Volume2,
  Plus,
  Play,
  Calendar,
} from 'lucide-react';
import { useVocelune } from '@/context/VoceluneContext';
import { speakWord } from '@/lib/speech';

interface DashboardViewProps {
  onOpenQuickAdd: () => void;
}

export function DashboardView({ onOpenQuickAdd }: DashboardViewProps) {
  const {
    dueCards,
    newCards,
    vocabItems,
    decks,
    streak,
    observedRetention,
    todayReviewsCount,
    settings,
  } = useVocelune();

  const dueCount = dueCards.length;

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Top Hero Banner */}
      <div className="bg-gradient-to-r from-brand-ink to-[#253258] text-white rounded-card p-6 md:p-8 shadow-elevated relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        {/* Subtle decorative orbit */}
        <div className="absolute right-[-40px] top-[-40px] w-72 h-72 rounded-full border border-white/10 pointer-events-none" />
        <div className="absolute right-12 bottom-[-80px] w-96 h-96 rounded-full border border-white/5 pointer-events-none" />

        <div className="space-y-2 relative z-10 max-w-xl">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-xs text-[11px] font-medium text-brand-mint">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Mỗi từ, một nhịp nhớ.</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Chào {settings.displayName}, hôm nay bạn có{' '}
            <span className="text-brand-primarySoft underline decoration-brand-primary">
              {dueCount} thẻ
            </span>{' '}
            đến hạn.
          </h2>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Thuật toán FSRS đã tính toán thời điểm vàng để bạn củng cố các từ này trước khi rơi vào vùng lãng quên.
          </p>
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          {dueCount > 0 ? (
            <Link
              href="/app/study"
              className="px-6 py-3 bg-brand-primary hover:bg-brand-primaryHover text-white rounded-control font-bold text-xs sm:text-sm shadow-md transition-all duration-150 flex items-center justify-center gap-2 group text-center active:scale-95"
            >
              <span>Ôn tập ngay ({dueCount} thẻ)</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          ) : (
            <Link
              href="/app/study"
              className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-control font-semibold text-xs sm:text-sm transition-all duration-150 text-center"
            >
              Luyện tập tự do
            </Link>
          )}

          <button
            onClick={onOpenQuickAdd}
            className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-control font-semibold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm từ</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-surface-base p-5 rounded-card border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-text-secondary font-medium">
            <span>Cần ôn hôm nay</span>
            <Brain className="w-4 h-4 text-brand-primary" />
          </div>
          <div className="flex items-baseline gap-1.5 pt-1">
            <span className="text-3xl font-extrabold text-brand-ink">{dueCount}</span>
            <span className="text-xs text-text-secondary">thẻ FSRS</span>
          </div>
          <p className="text-[11px] text-text-secondary">
            Đã hoàn thành hôm nay: <strong>{todayReviewsCount}</strong>
          </p>
        </div>

        {/* KPI 2 */}
        <div className="bg-surface-base p-5 rounded-card border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-text-secondary font-medium">
            <span>Chuỗi ngày học</span>
            <Flame className="w-4 h-4 text-amber-500 fill-amber-500" />
          </div>
          <div className="flex items-baseline gap-1.5 pt-1">
            <span className="text-3xl font-extrabold text-brand-ink">{streak}</span>
            <span className="text-xs text-text-secondary">ngày</span>
          </div>
          <p className="text-[11px] text-amber-800 font-medium">
            Đang giữ lửa phong độ
          </p>
        </div>

        {/* KPI 3 */}
        <div className="bg-surface-base p-5 rounded-card border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-text-secondary font-medium">
            <span>Tỷ lệ nhớ thực tế</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-1.5 pt-1">
            <span className="text-3xl font-extrabold text-brand-ink">
              {observedRetention}%
            </span>
          </div>
          <p className="text-[11px] text-emerald-700 font-medium">
            Duy trì sát mức 90%
          </p>
        </div>

        {/* KPI 4 */}
        <div className="bg-surface-base p-5 rounded-card border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-text-secondary font-medium">
            <span>Kho từ vựng</span>
            <BookOpen className="w-4 h-4 text-brand-primary" />
          </div>
          <div className="flex items-baseline gap-1.5 pt-1">
            <span className="text-3xl font-extrabold text-brand-ink">
              {vocabItems.length}
            </span>
            <span className="text-xs text-text-secondary">từ đã lưu</span>
          </div>
          <p className="text-[11px] text-text-secondary">
            {decks.length} bộ từ đang hoạt động
          </p>
        </div>
      </div>

      {/* Main Content 2-Column Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Decks Overview (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-brand-ink">Các bộ từ của bạn</h3>
              <p className="text-xs text-text-secondary">
                Tổ chức vốn từ theo chủ đề, tiêu chuẩn Oxford và mục tiêu thi
              </p>
            </div>
            <Link
              href="/app/library"
              className="text-xs font-semibold text-brand-primary hover:underline flex items-center gap-1"
            >
              <span>Xem tất cả</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {decks.map((deck) => {
              const deckWordCount = vocabItems.filter((v) => v.deckId === deck.id).length;
              return (
                <div
                  key={deck.id}
                  className="bg-surface-base p-5 rounded-card border border-slate-200/80 shadow-xs hover:border-brand-primary/40 hover:shadow-card transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div
                      className="w-9 h-9 rounded-control flex items-center justify-center font-bold text-white text-xs shadow-xs"
                      style={{ backgroundColor: deck.color || '#5949E8' }}
                    >
                      <BookOpen className="w-4 h-4" />
                    </div>

                    <h4 className="font-bold text-sm text-brand-ink leading-snug">
                      {deck.name}
                    </h4>

                    <p className="text-[11px] text-text-secondary line-clamp-2 leading-relaxed">
                      {deck.description}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="font-semibold text-brand-ink font-mono">
                      {deckWordCount} từ
                    </span>
                    <Link
                      href="/app/study"
                      className="text-brand-primary hover:text-brand-primaryHover font-bold text-xs"
                    >
                      Học bộ này &rarr;
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Study Recommendation banner */}
          <div className="p-5 rounded-card bg-brand-primarySoft/50 border border-brand-primary/20 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-bold text-brand-primary uppercase tracking-wider">
                Bài kiểm tra nhanh
              </span>
              <h4 className="text-sm font-semibold text-brand-ink">
                Muốn thử thách bản thân với 10 câu trắc nghiệm ngẫu nhiên?
              </h4>
              <p className="text-xs text-text-secondary">
                Đánh giá mức độ ghi nhớ mà không ảnh hưởng tới chu kỳ FSRS định kỳ.
              </p>
            </div>

            <Link
              href="/app/tests"
              className="px-4 py-2.5 bg-brand-primary text-white rounded-control text-xs font-semibold hover:bg-brand-primaryHover shadow-xs transition-colors shrink-0 flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Thi ngay</span>
            </Link>
          </div>
        </div>

        {/* Right Column: Recently Added & Quick Sound Test (1 col) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-brand-ink">Từ mới cập nhật</h3>
            <span className="text-xs text-text-secondary font-mono">5 từ mới nhất</span>
          </div>

          <div className="bg-surface-base border border-slate-200/80 rounded-card p-4 space-y-3 shadow-xs">
            {vocabItems.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-control hover:bg-slate-50 transition-colors flex items-center justify-between border border-transparent hover:border-slate-100"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-brand-ink">{item.word}</span>
                    <span className="text-[10px] italic text-text-secondary">
                      ({item.partOfSpeech})
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-slate-100 text-[9px] font-bold">
                      {item.cefr}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-secondary line-clamp-1">
                    {item.meaningVi}
                  </p>
                </div>

                <button
                  onClick={() =>
                    speakWord(item.word, item.dialect || settings.englishDialect)
                  }
                  className="p-1.5 text-slate-400 hover:text-brand-primary rounded-lg transition-colors"
                  title="Nghe phát âm"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>
            ))}

            <Link
              href="/app/library"
              className="block text-center py-2 text-xs font-semibold text-brand-primary hover:bg-brand-primarySoft rounded-control transition-colors"
            >
              Mở toàn bộ thư viện &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

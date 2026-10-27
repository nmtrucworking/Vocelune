'use client';

import React from 'react';
import {
  TrendingUp,
  Brain,
  Calendar,
  AlertTriangle,
  Flame,
  CheckCircle,
  BarChart2,
  Sparkles,
} from 'lucide-react';
import { useVocelune } from '@/context/VoceluneContext';

export function AnalyticsView() {
  const {
    vocabItems,
    cards,
    reviewLogs,
    streak,
    observedRetention,
    weakWords,
    activityHeatmap,
    settings,
  } = useVocelune();

  const totalReviews = reviewLogs.filter((l) => !l.voidedAt).length;
  const masteredCount = cards.filter((c) => c.stability >= 21).length;

  // Next 7 days due forecast simulation
  const next7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const dueCount = cards.filter((c) => {
      const cardDue = c.dueAt.split('T')[0];
      return cardDue === dateStr;
    }).length;

    return {
      date: d.toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric' }),
      count: dueCount,
    };
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-bold text-brand-ink">Tiến độ & Phân tích ghi nhớ</h2>
        <p className="text-xs text-text-secondary mt-1">
          Theo dõi dữ liệu thực nghiệm (observed recall) và dự báo hồi quy từ mô hình FSRS.
        </p>
      </div>

      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-surface-base p-5 rounded-card border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-text-secondary font-medium">
            <span>Tỷ lệ nhớ thực nghiệm</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2 pt-1">
            <span className="text-2xl font-extrabold text-brand-ink">
              {observedRetention}%
            </span>
            <span className="text-[11px] text-text-secondary font-mono">
              (N={totalReviews})
            </span>
          </div>
          <p className="text-[11px] text-emerald-700 font-medium">
            Mục tiêu FSRS: {(settings.desiredRetention * 100).toFixed(0)}%
          </p>
        </div>

        {/* KPI 2 */}
        <div className="bg-surface-base p-5 rounded-card border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-text-secondary font-medium">
            <span>Chuỗi ngày học</span>
            <Flame className="w-4 h-4 text-amber-500 fill-amber-500" />
          </div>
          <div className="flex items-baseline gap-2 pt-1">
            <span className="text-2xl font-extrabold text-brand-ink">{streak}</span>
            <span className="text-xs text-text-secondary">ngày liên tục</span>
          </div>
          <p className="text-[11px] text-amber-800 font-medium">
            Không gián đoạn nhịp nhớ
          </p>
        </div>

        {/* KPI 3 */}
        <div className="bg-surface-base p-5 rounded-card border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-text-secondary font-medium">
            <span>Tổng lượt ôn tập</span>
            <Brain className="w-4 h-4 text-brand-primary" />
          </div>
          <div className="flex items-baseline gap-2 pt-1">
            <span className="text-2xl font-extrabold text-brand-ink">
              {totalReviews}
            </span>
            <span className="text-xs text-text-secondary">lượt đánh giá</span>
          </div>
          <p className="text-[11px] text-brand-primary font-medium">
            Dữ liệu log bất biến
          </p>
        </div>

        {/* KPI 4 */}
        <div className="bg-surface-base p-5 rounded-card border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-text-secondary font-medium">
            <span>Từ đã thuần thục</span>
            <CheckCircle className="w-4 h-4 text-teal-600" />
          </div>
          <div className="flex items-baseline gap-2 pt-1">
            <span className="text-2xl font-extrabold text-brand-ink">
              {masteredCount}
            </span>
            <span className="text-xs text-text-secondary">/ {vocabItems.length} từ</span>
          </div>
          <p className="text-[11px] text-teal-700 font-medium">
            Độ ổn định S &ge; 21 ngày
          </p>
        </div>
      </div>

      {/* Forecast & Activity Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Activity Heatmap */}
        <div className="bg-surface-base p-6 rounded-card border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-brand-ink flex items-center gap-2">
              <Calendar className="w-4 h-4 text-brand-primary" />
              <span>Ma trận hoạt động (6 tuần qua)</span>
            </h3>
            <span className="text-[11px] text-text-secondary font-mono">
              {activityHeatmap.reduce((acc, curr) => acc + curr.count, 0)} lượt
            </span>
          </div>

          {/* Grid of days */}
          <div className="grid grid-cols-7 gap-1.5 pt-2">
            {activityHeatmap.map((day, idx) => {
              const intensity =
                day.count === 0
                  ? 'bg-slate-100'
                  : day.count <= 2
                  ? 'bg-brand-primarySoft text-brand-primary'
                  : day.count <= 5
                  ? 'bg-brand-primary/60 text-white'
                  : 'bg-brand-primary text-white';

              return (
                <div
                  key={idx}
                  title={`${day.date}: ${day.count} lượt ôn (${day.successCount} đạt)`}
                  className={`h-8 rounded-lg ${intensity} flex items-center justify-center text-[10px] font-mono font-medium transition-transform hover:scale-105 cursor-pointer`}
                >
                  {day.count > 0 ? day.count : ''}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[11px] text-text-secondary pt-2 border-t">
            <span>Ít hơn</span>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-slate-100" />
              <div className="w-3 h-3 rounded bg-brand-primarySoft" />
              <div className="w-3 h-3 rounded bg-brand-primary/60" />
              <div className="w-3 h-3 rounded bg-brand-primary" />
            </div>
            <span>Nhiều hơn</span>
          </div>
        </div>

        {/* 7-Day Due Forecast */}
        <div className="bg-surface-base p-6 rounded-card border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-brand-ink flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-brand-primary" />
              <span>Dự báo tải ôn tập (7 ngày tới)</span>
            </h3>
            <span className="text-[11px] text-text-secondary font-mono">FSRS Forecast</span>
          </div>

          <div className="space-y-2.5 pt-2">
            {next7Days.map((d, idx) => {
              const maxCount = Math.max(...next7Days.map((item) => item.count), 5);
              const barWidth = `${Math.min(100, Math.max(10, (d.count / maxCount) * 100))}%`;

              return (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-brand-ink">{d.date}</span>
                    <span className="font-mono font-bold text-text-secondary">
                      {d.count} thẻ
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-primary rounded-full transition-all duration-300"
                      style={{ width: barWidth }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-slate-400 italic pt-1">
            * Dự báo dựa trên trạng thái trí nhớ hiện tại; số lượng có thể thay đổi sau mỗi lần ôn tập thực tế.
          </p>
        </div>
      </div>

      {/* Weak Words Section (Lapses) */}
      <div className="bg-surface-base p-6 rounded-card border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-brand-ink">
              Từ vựng cần củng cố (Lapses cao)
            </h3>
          </div>
          <span className="text-xs text-text-secondary">
            Từ dễ quên trong quá trình ôn tập
          </span>
        </div>

        {weakWords.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
            {weakWords.map(({ vocab, lapses, reps }) => (
              <div
                key={vocab.id}
                className="p-3 rounded-control border border-amber-200/60 bg-amber-50/40 space-y-1 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-brand-ink text-sm">
                    {vocab.word}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                    {lapses} lần quên
                  </span>
                </div>
                <p className="text-text-secondary line-clamp-1">{vocab.meaningVi}</p>
                <p className="text-[11px] text-slate-400 font-mono">
                  Tổng lượt ôn: {reps}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 text-center text-xs text-text-secondary bg-slate-50 rounded-control">
            Chưa có từ nào bị quên lặp lại. Tiếp tục duy trì nhịp học đều đặn!
          </div>
        )}
      </div>
    </div>
  );
}

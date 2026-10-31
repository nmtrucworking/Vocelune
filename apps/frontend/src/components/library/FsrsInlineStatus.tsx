'use client';

import React from 'react';
import { Card, ReviewLog } from '@/types';

interface FsrsInlineStatusProps {
  card?: Card;
  logs?: ReviewLog[];
}

export function FsrsInlineStatus({ card, logs = [] }: FsrsInlineStatusProps) {
  if (!card) {
    return <span className="text-slate-400 font-mono text-xs">—</span>;
  }

  // 1. Suspended state
  if (card.suspended) {
    return (
      <div
        className="flex flex-col gap-0.5 py-0.5 cursor-help"
        title="Thẻ đã tạm dừng ôn tập trong thuật toán FSRS"
      >
        <div className="flex items-center gap-1.5">
          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-300">
            TẠM DỪNG
          </span>
          <span className="text-[10px] text-slate-400 font-medium">Đã ẩn</span>
        </div>
        <span className="text-[9px] text-slate-400 font-mono">Không lên lịch</span>
      </div>
    );
  }

  // 2. New state (Chưa học)
  if (card.state === 'new') {
    return (
      <div
        className="flex flex-col gap-0.5 py-0.5 group/fsrs cursor-help"
        title={`FSRS Trạng thái: TỪ MỚI (Chưa học)\nĐộ khó khởi tạo (D): ${(card.difficulty || 5).toFixed(1)}/10\nĐộ ổn định (S): 0 ngày\nChưa có lượt ôn tập nào`}
      >
        <div className="flex items-center gap-1.5">
          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-brand-primarySoft text-brand-primary border border-brand-primary/20">
            NEW
          </span>
          <span className="text-[10px] text-slate-500 font-medium">Chưa học</span>
        </div>
        <span className="text-[9px] text-slate-400 font-mono">D:{(card.difficulty || 5).toFixed(1)} • 0 lượt</span>
      </div>
    );
  }

  // 3. Learned card: Calculate Retrievability (R) and Stability (S)
  const stability = card.stability || 0.1;
  const elapsedDays = card.lastReviewedAt
    ? Math.max(0, (Date.now() - new Date(card.lastReviewedAt).getTime()) / 86400000)
    : 0;

  // FSRS-6 forgetting curve: R = (1 + 19/81 * t / S)^(-0.5)
  const factor = 19 / 81;
  const retrievability = Math.min(
    100,
    Math.max(
      1,
      Math.round(
        Math.pow(1 + factor * (elapsedDays / Math.max(0.1, stability)), -0.5) * 100
      )
    )
  );

  // Determine state badge color & label
  const stateConfig: Record<string, { label: string; color: string }> = {
    review: { label: 'REVIEW', color: 'bg-emerald-50 text-emerald-700 border-emerald-200/80' },
    learning: { label: 'LEARN', color: 'bg-amber-50 text-amber-700 border-amber-200/80' },
    relearning: { label: 'RELEARN', color: 'bg-rose-50 text-rose-700 border-rose-200/80' },
  };
  const currentConfig = stateConfig[card.state] || {
    label: card.state.toUpperCase(),
    color: 'bg-slate-50 text-slate-700 border-slate-200',
  };

  // Retention color
  const retColor =
    retrievability >= 85
      ? 'text-emerald-700 font-bold'
      : retrievability >= 70
      ? 'text-amber-700 font-bold'
      : 'text-rose-700 font-bold';

  const strokeColor =
    retrievability >= 85 ? '#059669' : retrievability >= 70 ? '#D97706' : '#DC2626';

  const formatStability = (s: number) => {
    if (s < 1) return `${Math.max(1, Math.round(s * 24))}h`;
    if (s < 30) return `${s.toFixed(1)}d`;
    if (s < 365) return `${(s / 30).toFixed(1)}m`;
    return `${(s / 365).toFixed(1)}y`;
  };

  // Real review history sparkline based on actual logs
  const sortedLogs = [...logs]
    .filter((l) => l.rating >= 1 && l.rating <= 4)
    .sort((a, b) => new Date(a.reviewedAt).getTime() - new Date(b.reviewedAt).getTime());

  const recentLogs = sortedLogs.slice(-6);

  // Sparkline coordinates
  const width = 42;
  let sparklineContent: React.ReactNode = null;

  if (recentLogs.length >= 2) {
    // Generate real progression polyline from actual rating history:
    // rating 1 (Again) -> y=12, rating 2 (Hard) -> y=9, rating 3 (Good) -> y=5.5, rating 4 (Easy) -> y=2
    const ratingToY = (r: number) => {
      if (r === 4) return 2;
      if (r === 3) return 5.5;
      if (r === 2) return 9;
      return 12.5;
    };
    const points = recentLogs.map((log, idx) => {
      const x = Math.round(2 + (idx / (recentLogs.length - 1)) * (width - 4));
      const y = ratingToY(log.rating);
      return { x, y, rating: log.rating };
    });

    const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');
    const ratingColors: Record<number, string> = {
      1: '#EF4444', // Red for Again
      2: '#F59E0B', // Amber for Hard
      3: '#3B82F6', // Blue for Good
      4: '#10B981', // Green for Easy
    };

    sparklineContent = (
      <svg className="w-11 h-3.5 overflow-visible shrink-0" viewBox="0 0 44 16">
        <polyline
          fill="none"
          stroke="#94A3B8"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={polylinePoints}
        />
        {points.map((p, idx) => (
          <circle
            key={idx}
            cx={p.x}
            cy={p.y}
            r={idx === points.length - 1 ? 2.5 : 1.5}
            fill={ratingColors[p.rating] || strokeColor}
          />
        ))}
      </svg>
    );
  } else {
    // Single review or decay curve from actual retrievability
    const endY = Math.min(13, Math.max(3, 3 + ((100 - retrievability) / 100) * 9.5));
    const pathData = `M 2,3 Q 22,${(3 + endY) / 2} ${width},${endY.toFixed(1)}`;
    const areaData = `M 2,3 Q 22,${(3 + endY) / 2} ${width},${endY.toFixed(1)} L ${width},15 L 2,15 Z`;

    sparklineContent = (
      <svg className="w-11 h-3.5 overflow-visible shrink-0" viewBox="0 0 44 16">
        <defs>
          <linearGradient id={`grad-${card.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={areaData} fill={`url(#grad-${card.id})`} />
        <path d={pathData} fill="none" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" />
        <circle cx={width} cy={endY} r="2" fill={strokeColor} />
      </svg>
    );
  }

  const ratingNames: Record<number, string> = { 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy' };
  const historyText =
    recentLogs.length > 0
      ? `\nLịch sử ôn (${recentLogs.length} lần gần nhất): ` +
        recentLogs.map((l) => ratingNames[l.rating] || `${l.rating}`).join(' → ')
      : '';

  return (
    <div
      className="flex flex-col gap-0.5 py-0.5 group/fsrs cursor-help"
      title={`FSRS Trạng thái: ${card.state.toUpperCase()} (${currentConfig.label})\nKhả năng nhớ lại (R): ${retrievability}%\nĐộ vững trí nhớ (S): ${card.stability.toFixed(2)} ngày\nĐộ khó (D): ${(card.difficulty || 5).toFixed(1)}/10\nTổng số lần ôn: ${card.reps} lượt (${card.lapses} lần quên)\nLần ôn gần nhất: ${card.lastReviewedAt ? new Date(card.lastReviewedAt).toLocaleString('vi-VN') : 'Mới'}\nHạn ôn tiếp theo: ${new Date(card.dueAt).toLocaleString('vi-VN')}${historyText}`}
    >
      {/* Top: State Badge + Retention % */}
      <div className="flex items-center gap-1.5">
        <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold uppercase tracking-wider border ${currentConfig.color}`}>
          {currentConfig.label}
        </span>
        <span className={`text-[10px] font-mono ${retColor}`}>
          R:{retrievability}%
        </span>
      </div>

      {/* Bottom: Sparkline + Stability text + Reps count */}
      <div className="flex items-center gap-1.5">
        {sparklineContent}

        <span className="text-[9px] font-mono text-slate-500 font-semibold shrink-0">
          S:{formatStability(stability)}
        </span>
        <span className="text-[9px] text-slate-400 font-mono shrink-0">
          • {card.reps}x
        </span>
      </div>
    </div>
  );
}

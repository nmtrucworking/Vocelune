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

  if (card.state === 'new') {
    return (
      <div className="flex items-center gap-1.5 py-0.5">
        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-brand-primarySoft text-brand-primary border border-brand-primary/20">
          NEW
        </span>
        <span className="text-[10px] text-slate-400 font-medium">Chưa học</span>
      </div>
    );
  }

  // Learned card: Calculate Retrievability (R) and Stability (S)
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

  // Determine state badge color
  const stateColor =
    card.state === 'review'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
      : card.state === 'learning'
      ? 'bg-amber-50 text-amber-700 border-amber-200/80'
      : 'bg-rose-50 text-rose-700 border-rose-200/80';

  // Retention color
  const retColor =
    retrievability >= 85
      ? 'text-emerald-700 fill-emerald-500 stroke-emerald-600'
      : retrievability >= 70
      ? 'text-amber-700 fill-amber-500 stroke-amber-600'
      : 'text-rose-700 fill-rose-500 stroke-rose-600';

  // Mini Sparkline SVG: Data curve representing forgetting curve decay
  const endY = Math.min(14, Math.max(3, 3 + ((100 - retrievability) / 100) * 10));
  const pathData = `M 1,3 Q 22,${(3 + endY) / 2 - 1} 42,${endY.toFixed(1)}`;
  const areaData = `M 1,3 Q 22,${(3 + endY) / 2 - 1} 42,${endY.toFixed(1)} L 42,15 L 1,15 Z`;

  const formatStability = (s: number) => {
    if (s < 1) return `${Math.round(s * 24)}h`;
    if (s < 30) return `${s.toFixed(1)}d`;
    if (s < 365) return `${(s / 30).toFixed(1)}m`;
    return `${(s / 365).toFixed(1)}y`;
  };

  const strokeColor =
    retrievability >= 85 ? '#059669' : retrievability >= 70 ? '#D97706' : '#DC2626';

  return (
    <div
      className="flex flex-col gap-1 py-0.5 group/fsrs cursor-help"
      title={`FSRS Trạng thái: ${card.state.toUpperCase()}\nKhả năng nhớ lại (R): ${retrievability}%\nĐộ vững trí nhớ (S): ${card.stability.toFixed(2)} ngày\nĐộ khó (D): ${(card.difficulty || 5).toFixed(1)}/10\nLần ôn gần nhất: ${card.lastReviewedAt ? new Date(card.lastReviewedAt).toLocaleDateString('vi-VN') : 'Mới'}`}
    >
      {/* Top: State Badge + Retention % */}
      <div className="flex items-center gap-1.5">
        <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold uppercase tracking-wider border ${stateColor}`}>
          {card.state}
        </span>
        <span className={`text-[10px] font-bold font-mono ${retColor.split(' ')[0]}`}>
          {retrievability}%
        </span>
      </div>

      {/* Bottom: Inline Sparkline + Stability text */}
      <div className="flex items-center gap-1.5">
        <svg className="w-11 h-3.5 overflow-visible shrink-0" viewBox="0 0 44 16">
          <defs>
            <linearGradient id={`grad-${card.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor={strokeColor}
                stopOpacity="0.25"
              />
              <stop
                offset="100%"
                stopColor={strokeColor}
                stopOpacity="0.0"
              />
            </linearGradient>
          </defs>
          {/* Subtle area fill */}
          <path d={areaData} fill={`url(#grad-${card.id})`} />
          {/* Target curve stroke */}
          <path
            d={pathData}
            fill="none"
            stroke={strokeColor}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          {/* Current memory point */}
          <circle cx="42" cy={endY} r="2" fill={strokeColor} />
        </svg>

        <span className="text-[9px] font-mono text-slate-400 font-semibold shrink-0">
          S:{formatStability(stability)}
        </span>
      </div>
    </div>
  );
}

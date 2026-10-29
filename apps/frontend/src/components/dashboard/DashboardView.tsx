'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { motion, type Variants } from 'framer-motion';
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
  Globe,
  BarChart2,
  PieChart as PieIcon,
  Activity,
  Layers,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { useVocelune } from '@/context/VoceluneContext';
import { speakWord } from '@/lib/speech';
import { AudioButton } from '../common/AudioButton';

interface DashboardViewProps {
  onOpenQuickAdd: () => void;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: 'easeOut' },
  },
};

export function DashboardView({ onOpenQuickAdd }: DashboardViewProps) {
  const {
    analytics,
    dueCards,
    newCards,
    cards,
    vocabItems,
    decks,
    streak,
    observedRetention,
    todayReviewsCount,
    activityHeatmap,
    settings,
  } = useVocelune();

  const [isMounted, setIsMounted] = useState(false);
  const [chartView, setChartView] = useState<'forecast' | 'activity'>('forecast');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const dueCount = dueCards.length;

  // 1. Forecast data for upcoming 7 days
  const forecastData = useMemo(() => {
    if (analytics?.forecastData && analytics.forecastData.length > 0) {
      return analytics.forecastData.slice(0, 7);
    }
    const days: { day: string; cards: number }[] = [];
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      const dayStr = i === 0 ? 'Hôm nay' : i === 1 ? 'Ngày mai' : `+${i}d`;
      const dateStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const dateEnd = dateStart + 24 * 60 * 60 * 1000;
      const count = cards.filter((c) => {
        const due = new Date(c.dueAt).getTime();
        return i === 0 ? due <= dateEnd : due >= dateStart && due < dateEnd;
      }).length;
      days.push({ day: dayStr, cards: count });
    }
    return days;
  }, [analytics?.forecastData, cards]);

  // 2. Memory State Distribution (Donut Chart)
  const stateDistributionData = useMemo(() => {
    const counts = {
      new: cards.filter((c) => c.state === 'new').length,
      learning: cards.filter((c) => c.state === 'learning' || c.state === 'relearning').length,
      review: cards.filter((c) => c.state === 'review').length,
    };
    const total = counts.new + counts.learning + counts.review;

    return [
      {
        name: 'Đang ôn (Review)',
        value: counts.review,
        color: '#10B981',
        pct: total > 0 ? Math.round((counts.review / total) * 100) : 0,
      },
      {
        name: 'Đang học (Learning)',
        value: counts.learning,
        color: '#F59E0B',
        pct: total > 0 ? Math.round((counts.learning / total) * 100) : 0,
      },
      {
        name: 'Thẻ mới (New)',
        value: counts.new,
        color: '#5949E8',
        pct: total > 0 ? Math.round((counts.new / total) * 100) : 0,
      },
    ];
  }, [cards]);

  // 3. Recent 7-Day Activity Trend
  const recentActivityData = useMemo(() => {
    if (activityHeatmap && activityHeatmap.length > 0) {
      return activityHeatmap.slice(-7).map((item) => {
        const parts = item.date.split('-');
        const label = parts.length === 3 ? `${parts[2]}/${parts[1]}` : item.date;
        return {
          date: label,
          reviews: item.count,
          success: item.successCount,
        };
      });
    }
    const res = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const label = `${d.getDate()}/${d.getMonth() + 1}`;
      res.push({ date: label, reviews: i === 0 ? todayReviewsCount : 0, success: 0 });
    }
    return res;
  }, [activityHeatmap, todayReviewsCount]);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-8 max-w-6xl mx-auto"
    >
      {/* Top Hero Banner */}
      <motion.div
        variants={itemVariants}
        className="bg-gradient-to-r from-brand-ink to-[#253258] text-white rounded-card p-6 md:p-8 shadow-elevated relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
      >
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
              href="/study"
              className="px-6 py-3 bg-brand-primary hover:bg-brand-primaryHover text-white rounded-control font-bold text-xs sm:text-sm shadow-md transition-all duration-150 flex items-center justify-center gap-2 group text-center active:scale-95"
            >
              <span>Ôn tập ngay ({dueCount} thẻ)</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          ) : (
            <Link
              href="/study"
              className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-control font-semibold text-xs sm:text-sm transition-all duration-150 text-center"
            >
              Luyện tập tự do
            </Link>
          )}

          <button
            onClick={onOpenQuickAdd}
            className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-control font-semibold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm từ</span>
          </button>
        </div>
      </motion.div>

      {/* KPI Overview Grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <motion.div
          whileHover={{ y: -3 }}
          className="bg-surface-base p-5 rounded-card border border-slate-200/80 shadow-xs space-y-1 transition-all"
        >
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
        </motion.div>

        {/* KPI 2 */}
        <motion.div
          whileHover={{ y: -3 }}
          className="bg-surface-base p-5 rounded-card border border-slate-200/80 shadow-xs space-y-1 transition-all"
        >
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
        </motion.div>

        {/* KPI 3 */}
        <motion.div
          whileHover={{ y: -3 }}
          className="bg-surface-base p-5 rounded-card border border-slate-200/80 shadow-xs space-y-1 transition-all"
        >
          <div className="flex items-center justify-between text-xs text-text-secondary font-medium">
            <span>Tỷ lệ nhớ thực tế</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-1.5 pt-1">
            <span className="text-3xl font-extrabold text-brand-ink">
              {observedRetention === null ? 'Chưa có dữ liệu' : `${observedRetention}%`}
            </span>
          </div>
          <p className="text-[11px] text-emerald-700 font-medium">
            Chỉ tính lượt ôn ở trạng thái Review
          </p>
        </motion.div>

        {/* KPI 4 */}
        <motion.div
          whileHover={{ y: -3 }}
          className="bg-surface-base p-5 rounded-card border border-slate-200/80 shadow-xs space-y-1 transition-all"
        >
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
        </motion.div>
      </motion.div>

      {/* Interactive Statistics & Charts Section */}
      <motion.div variants={itemVariants} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-brand-ink flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-brand-primary" />
              <span>Thống kê phân tích & Dự báo FSRS</span>
            </h3>
            <p className="text-xs text-text-secondary">
              Mô hình hóa tải ôn tập thích ứng và cơ cấu trí nhớ dài hạn theo chu kỳ lặp lại ngắt quãng.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/analytics"
              className="text-xs font-semibold text-brand-primary hover:underline flex items-center gap-1"
            >
              <span>Xem báo cáo chi tiết</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart 1: Forecast / Activity Area Chart (2 cols) */}
          <div className="lg:col-span-2 bg-surface-base p-5 rounded-card border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setChartView('forecast')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    chartView === 'forecast'
                      ? 'bg-brand-primary text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Dự báo tải ôn (7 ngày tới)
                </button>
                <button
                  type="button"
                  onClick={() => setChartView('activity')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    chartView === 'activity'
                      ? 'bg-brand-primary text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Lượt ôn tập 7 ngày qua
                </button>
              </div>

              <span className="text-[11px] font-mono font-medium text-text-secondary hidden sm:inline">
                {chartView === 'forecast' ? 'FSRS Retention Engine' : 'Nhịp học hàng ngày'}
              </span>
            </div>

            <div className="h-64 w-full">
              {isMounted ? (
                chartView === 'forecast' ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={forecastData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="forecastFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#5949E8" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#5949E8" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 11, fill: '#64748B' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#64748B' }}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0F172A',
                          color: '#fff',
                          borderRadius: '8px',
                          border: 'none',
                          fontSize: '12px',
                        }}
                        formatter={(val: any) => [
                          `${val ?? 0} thẻ đến hạn`,
                          'Khối lượng ôn tập',
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="cards"
                        stroke="#5949E8"
                        strokeWidth={2.5}
                        fill="url(#forecastFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={recentActivityData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: '#64748B' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#64748B' }}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0F172A',
                          color: '#fff',
                          borderRadius: '8px',
                          border: 'none',
                          fontSize: '12px',
                        }}
                        formatter={(val: any) => [
                          `${val ?? 0} lượt hoàn thành`,
                          'Đã ôn tập',
                        ]}
                      />
                      <Bar dataKey="reviews" fill="#10B981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                  Đang tải biểu đồ...
                </div>
              )}
            </div>
          </div>

          {/* Chart 2: Memory State Donut Distribution (1 col) */}
          <div className="bg-surface-base p-5 rounded-card border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h4 className="font-bold text-xs text-brand-ink flex items-center gap-1.5">
                  <PieIcon className="w-3.5 h-3.5 text-brand-primary" />
                  <span>Cơ cấu trí nhớ FSRS</span>
                </h4>
                <span className="text-[10px] text-text-secondary font-mono">
                  {cards.length} thẻ
                </span>
              </div>
              <p className="text-[11px] text-text-secondary mt-1">
                Phân bố thẻ mới, giai đoạn học lặp và củng cố dài hạn.
              </p>
            </div>

            <div className="h-44 relative flex items-center justify-center">
              {isMounted && cards.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stateDistributionData}
                        innerRadius={48}
                        outerRadius={68}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {stateDistributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0F172A',
                          color: '#fff',
                          borderRadius: '8px',
                          border: 'none',
                          fontSize: '11px',
                        }}
                        formatter={(val: any) => [
                          `${val ?? 0} thẻ`,
                          'Số lượng',
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center percentage / label */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xl font-extrabold text-brand-ink">
                      {cards.length}
                    </span>
                    <span className="text-[9px] uppercase tracking-wider text-text-secondary font-bold">
                      Tổng thẻ
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-xs text-slate-400 text-center">Chưa có dữ liệu thẻ</div>
              )}
            </div>

            {/* Custom Legend */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
              {stateDistributionData.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-slate-600 font-medium text-[11px]">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-[11px]">
                    <span className="font-bold text-brand-ink">{item.value}</span>
                    <span className="text-text-secondary">({item.pct}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main Content 2-Column Split */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
              href="/library"
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
                <motion.div
                  key={deck.id}
                  whileHover={{ y: -3 }}
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
                      href="/study"
                      className="text-brand-primary hover:text-brand-primaryHover font-bold text-xs"
                    >
                      Học bộ này &rarr;
                    </Link>
                  </div>
                </motion.div>
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
              href="/tests"
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

                <AudioButton
                  text={item.word}
                  dialect={item.dialect || settings.englishDialect}
                  size="sm"
                />
              </div>
            ))}

            <Link
              href="/library"
              className="block text-center py-2 text-xs font-semibold text-brand-primary hover:bg-brand-primarySoft rounded-control transition-colors"
            >
              Mở toàn bộ thư viện &rarr;
            </Link>
          </div>

          {/* Topic Groups & Community Quick Card */}
          <div className="bg-gradient-to-br from-brand-canvas/60 to-white border border-slate-200/80 rounded-card p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-600" />
                <h4 className="font-bold text-xs text-brand-ink">Chủ đề & Cộng đồng</h4>
              </div>
              <Link
                href="/library"
                className="text-[10px] text-emerald-700 font-bold bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 transition-colors"
              >
                Khám phá
              </Link>
            </div>
            <p className="text-[11px] text-text-secondary leading-relaxed">
              Tổ chức từ vựng theo nhóm và lưu các bộ từ công khai từ cộng đồng với 1 chạm.
            </p>
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              {Array.from(new Set(decks.map((d) => d.topicGroup || 'Chung')))
                .slice(0, 4)
                .map((group) => (
                  <Link
                    key={group}
                    href="/library"
                    className="px-2 py-1 rounded bg-white border border-slate-200 text-[10px] font-medium text-slate-700 hover:border-brand-primary hover:text-brand-primary transition-colors"
                  >
                    {group}
                  </Link>
                ))}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

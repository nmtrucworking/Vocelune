'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  Brain,
  Calendar,
  AlertTriangle,
  Flame,
  CheckCircle,
  BarChart2,
  Sparkles,
  PieChart as PieIcon,
  Activity,
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

export function AnalyticsView() {
  const {
    analytics,
    vocabItems,
    cards,
    reviewLogs,
    streak,
    observedRetention,
    retentionSampleSize,
    weakWords,
    activityHeatmap,
    settings,
  } = useVocelune();

  const totalReviews = reviewLogs.filter((l) => !l.voidedAt).length;
  const masteredCount = new Set(cards.filter(c => c.state === 'review' && c.stability >= 30).map(c => c.vocabItemId)).size;

  const averageStability = analytics?.averageStability ?? 0;
  const forgettingCurveData = analytics?.forgettingCurveData ?? [];
  const forecastData = analytics?.forecastData ?? [];

  // 3. Card state distribution (Pie Chart)
  const stateDistributionData = useMemo(() => {
    const counts = {
      new: cards.filter((c) => c.state === 'new').length,
      learning: cards.filter((c) => c.state === 'learning' || c.state === 'relearning').length,
      review: cards.filter((c) => c.state === 'review').length,
    };

    return [
      { name: 'Đang ôn (Review)', value: counts.review, color: '#10B981' },
      { name: 'Đang học (Learning)', value: counts.learning, color: '#F59E0B' },
      { name: 'Thẻ mới (New)', value: counts.new, color: '#5949E8' },
    ];
  }, [cards]);

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      {/* Page Header */}
      <div>
        <h2 className="text-lg font-bold text-brand-ink">
          Tiến độ & Phân tích thuật toán FSRS
        </h2>
        <p className="text-xs text-text-secondary mt-0.5">
          Quan sát trực quan đường cong lãng quên (Retrievability Decay), tải ôn tập thích ứng và phân bố trạng thái thẻ.
        </p>
      </div>

      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* KPI 1 */}
        <motion.div
          whileHover={{ y: -2 }}
          className="bg-surface-base p-3.5 sm:p-4 rounded-card border border-slate-200/80 shadow-2xs space-y-1"
        >
          <div className="flex items-center justify-between text-xs text-text-secondary font-medium">
            <span>Tỷ lệ nhớ thực nghiệm</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-1.5 pt-0.5">
            <span className="text-2xl font-bold text-brand-ink">
              {observedRetention === null ? 'Chưa có dữ liệu' : `${observedRetention}%`}
            </span>
            <span className="text-[10px] text-text-secondary font-mono">
              (N={retentionSampleSize})
            </span>
          </div>
          <p className="text-[10px] text-emerald-700 font-semibold">
            Mục tiêu FSRS: {(settings.desiredRetention * 100).toFixed(0)}%
          </p>
        </motion.div>

        {/* KPI 2 */}
        <motion.div
          whileHover={{ y: -2 }}
          className="bg-surface-base p-3.5 sm:p-4 rounded-card border border-slate-200/80 shadow-2xs space-y-1"
        >
          <div className="flex items-center justify-between text-xs text-text-secondary font-medium">
            <span>Chuỗi ngày học</span>
            <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
          </div>
          <div className="flex items-baseline gap-1.5 pt-0.5">
            <span className="text-2xl font-bold text-brand-ink">{streak}</span>
            <span className="text-xs text-text-secondary">ngày liên tục</span>
          </div>
          <p className="text-[10px] text-amber-800 font-semibold">
            Giữ nhịp nhớ đều đặn
          </p>
        </motion.div>

        {/* KPI 3 */}
        <motion.div
          whileHover={{ y: -2 }}
          className="bg-surface-base p-3.5 sm:p-4 rounded-card border border-slate-200/80 shadow-2xs space-y-1"
        >
          <div className="flex items-center justify-between text-xs text-text-secondary font-medium">
            <span>Độ ổn định trung bình</span>
            <Activity className="w-3.5 h-3.5 text-brand-primary" />
          </div>
          <div className="flex items-baseline gap-1.5 pt-0.5">
            <span className="text-2xl font-bold text-brand-ink">
              {averageStability.toFixed(1)}
            </span>
            <span className="text-xs text-text-secondary">ngày (S)</span>
          </div>
          <p className="text-[10px] text-brand-primary font-semibold">
            Chỉ số Stability FSRS-6
          </p>
        </motion.div>

        {/* KPI 4 */}
        <motion.div
          whileHover={{ y: -2 }}
          className="bg-surface-base p-3.5 sm:p-4 rounded-card border border-slate-200/80 shadow-2xs space-y-1"
        >
          <div className="flex items-center justify-between text-xs text-text-secondary font-medium">
            <span>Từ đã thuần thục</span>
            <CheckCircle className="w-3.5 h-3.5 text-teal-600" />
          </div>
          <div className="flex items-baseline gap-1.5 pt-0.5">
            <span className="text-2xl font-bold text-brand-ink">
              {masteredCount}
            </span>
            <span className="text-xs text-text-secondary">/ {vocabItems.length} từ</span>
          </div>
          <p className="text-[10px] text-teal-700 font-semibold">
            Thẻ Review có độ ổn định ≥ 30 ngày
          </p>
        </motion.div>
      </div>

      {/* Main Charts Row: Forgetting Curve & Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart 1: Animated Forgetting Curve (2 cols) */}
        <div className="lg:col-span-2 bg-surface-base p-4 sm:p-5 rounded-card border border-slate-200/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-brand-ink flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5 text-brand-primary" />
                <span>Đường cong lãng quên thích ứng (FSRS Retrievability Curve)</span>
              </h3>
              <p className="text-[11px] text-text-secondary">
                Mô phỏng xác suất truy hồi thành công theo thời gian $R(t)$ với độ ổn định trung bình ({averageStability.toFixed(1)}d)
              </p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-brand-primarySoft text-brand-primary">
              Dự báo FSRS-6
            </span>
          </div>

          {forgettingCurveData.length === 0 && <p className="text-xs text-slate-500">Chưa có lượt ôn để tính dự báo. Đây là xác suất mô hình, không phải tỷ lệ nhớ đã đo.</p>}
          <div className="h-52 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={forgettingCurveData}>
                <defs>
                  <linearGradient id="retrievabilityGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#5949E8" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#5949E8" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" />
                <YAxis
                  domain={[30, 100]}
                  unit="%"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  stroke="#cbd5e1"
                />
                <Tooltip
                  content={({ active, payload }: any) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-brand-ink text-white p-2.5 rounded-lg text-xs shadow-lg space-y-1">
                          <p className="font-bold">{payload[0]?.payload?.day}</p>
                          <p className="text-brand-mint font-semibold">
                            Khả năng truy hồi: {payload[0]?.value}%
                          </p>
                          <p className="text-[10px] text-slate-300">
                            Mục tiêu: {(settings.desiredRetention * 100).toFixed(0)}%
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="retrievability"
                  stroke="#5949E8"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#retrievabilityGradient)"
                  isAnimationActive={true}
                  animationDuration={1200}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: State Distribution Donut Chart (1 col) */}
        <div className="bg-surface-base p-4 sm:p-5 rounded-card border border-slate-200/80 shadow-2xs space-y-3 flex flex-col justify-between">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold text-brand-ink flex items-center gap-1.5">
              <PieIcon className="w-3.5 h-3.5 text-emerald-600" />
              <span>Phân bố trạng thái kho từ</span>
            </h3>
            <p className="text-[11px] text-text-secondary">
              Tổng số {cards.length} thẻ theo chu kỳ FSRS
            </p>
          </div>

          <div className="h-44 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stateDistributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={65}
                  paddingAngle={3}
                  dataKey="value"
                  isAnimationActive={true}
                  animationDuration={1000}
                >
                  {stateDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any, name: any) => [`${val} thẻ`, name]}
                  contentStyle={{
                    backgroundColor: '#17213B',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '11px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="space-y-1.5 border-t pt-2.5 text-xs">
            {stateDistributionData.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="font-medium text-brand-ink text-[11px]">{item.name}</span>
                </div>
                <span className="font-mono font-bold text-text-secondary text-[11px]">
                  {item.value} ({cards.length > 0 ? Math.round((item.value / cards.length) * 100) : 0}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: 7-Day Due Forecast (Animated BarChart) & Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Forecast BarChart */}
        <div className="bg-surface-base p-4 sm:p-5 rounded-card border border-slate-200/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-brand-ink flex items-center gap-1.5">
              <BarChart2 className="w-3.5 h-3.5 text-brand-primary" />
              <span>Dự báo lịch ôn 7 ngày tới (FSRS Due Load)</span>
            </h3>
            <span className="text-[10px] text-text-secondary font-mono">Thẻ đến hạn</span>
          </div>

          <div className="h-52 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={forecastData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" />
                <Tooltip
                  content={({ active, payload }: any) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-brand-ink text-white p-2.5 rounded-lg text-xs shadow-lg space-y-1">
                          <p className="font-bold">{data.day}</p>
                          <p className="text-brand-mint font-semibold">
                            Tổng cần học: {data.cards} thẻ
                          </p>
                          {data.reviewCards !== undefined && (
                            <div className="text-[11px] text-slate-300 space-y-0.5 border-t border-slate-700 pt-1">
                              <p>• Thẻ ôn tập: {data.reviewCards} thẻ</p>
                              <p>• Thẻ mới dự kiến: {data.newCards} thẻ</p>
                            </div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="cards"
                  fill="#5949E8"
                  radius={[5, 5, 0, 0]}
                  isAnimationActive={true}
                  animationDuration={1000}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Heatmap Activity Matrix */}
        <div className="bg-surface-base p-4 sm:p-5 rounded-card border border-slate-200/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-brand-ink flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-brand-primary" />
              <span>Ma trận hoạt động (6 tuần qua)</span>
            </h3>
            <span className="text-[11px] text-text-secondary font-mono">
              {activityHeatmap.reduce((acc, curr) => acc + curr.count, 0)} lượt ôn
            </span>
          </div>

          {/* Grid of days */}
          <div className="grid grid-cols-7 gap-1.5 pt-2">
            {activityHeatmap.map((day, idx) => {
              const intensity =
                day.count === 0
                  ? 'bg-slate-100 hover:bg-slate-200'
                  : day.count <= 2
                  ? 'bg-brand-primarySoft text-brand-primary hover:bg-brand-primary/30'
                  : day.count <= 5
                  ? 'bg-brand-primary/60 text-white'
                  : 'bg-brand-primary text-white';

              return (
                <motion.div
                  key={idx}
                  whileHover={{ scale: 1.15 }}
                  title={`${day.date}: ${day.count} lượt ôn (${day.successCount} đạt)`}
                  className={`h-9 rounded-lg ${intensity} flex items-center justify-center text-[10px] font-mono font-bold transition-all cursor-pointer shadow-2xs`}
                >
                  {day.count > 0 ? day.count : ''}
                </motion.div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[11px] text-text-secondary pt-3 border-t">
            <span>Ít hơn</span>
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded bg-slate-100" />
              <div className="w-3.5 h-3.5 rounded bg-brand-primarySoft" />
              <div className="w-3.5 h-3.5 rounded bg-brand-primary/60" />
              <div className="w-3.5 h-3.5 rounded bg-brand-primary" />
            </div>
            <span>Nhiều hơn</span>
          </div>
        </div>
      </div>

      {/* Weak Words Section (Lapses) */}
      <div className="bg-surface-base p-6 rounded-card border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h3 className="text-base font-bold text-brand-ink">
              Từ vựng cần củng cố (Tần suất quên cao)
            </h3>
          </div>
          <span className="text-xs text-text-secondary">
            Cần tăng cường truy hồi trong phiên học kế tiếp
          </span>
        </div>

        {weakWords.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
            {weakWords.map(({ vocab, lapses, reps }) => (
              <motion.div
                key={vocab.id}
                whileHover={{ scale: 1.02 }}
                className="p-3.5 rounded-control border border-amber-200/60 bg-amber-50/40 space-y-1.5 text-xs shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-brand-ink text-sm">
                    {vocab.word}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                    {lapses} lần quên
                  </span>
                </div>
                <p className="text-text-secondary font-medium line-clamp-1">{vocab.meaningVi}</p>
                <p className="text-[11px] text-slate-400 font-mono">
                  Tổng số lượt ôn: {reps}
                </p>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-text-secondary bg-slate-50 rounded-control">
            Chưa có từ nào bị lapse. Hãy duy trì nhịp học mỗi ngày!
          </div>
        )}
      </div>
    </div>
  );
}

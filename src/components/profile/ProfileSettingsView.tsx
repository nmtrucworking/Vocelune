'use client';

import React, { useState } from 'react';
import {
  User,
  Settings,
  Brain,
  Volume2,
  Globe,
  RotateCcw,
  Check,
  AlertCircle,
} from 'lucide-react';
import { useVocelune } from '@/context/VoceluneContext';
import { Dialect } from '@/types';
import { speakWord } from '@/lib/speech';

export function ProfileSettingsView() {
  const { settings, updateSettings, resetAllData } = useVocelune();

  const [displayName, setDisplayName] = useState(settings.displayName);
  const [dialect, setDialect] = useState<Dialect>(settings.englishDialect);
  const [retention, setRetention] = useState<number>(settings.desiredRetention);
  const [newCardsLimit, setNewCardsLimit] = useState<number>(settings.newCardsPerDay);
  const [autoPronounce, setAutoPronounce] = useState(settings.autoPronounce);
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      displayName: displayName.trim() || 'Người học',
      englishDialect: dialect,
      desiredRetention: Number(retention),
      newCardsPerDay: Number(newCardsLimit),
      autoPronounce,
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleResetData = () => {
    if (
      confirm(
        'Bạn có chắc chắn muốn đặt lại toàn bộ dữ liệu về trạng thái ban đầu? Tất cả từ đã thêm mới và lịch sử ôn sẽ được khởi tạo lại.'
      )
    ) {
      resetAllData();
      alert('Đã khôi phục dữ liệu ban đầu thành công.');
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-brand-ink">Hồ sơ & Cài đặt hệ thống</h2>
        <p className="text-xs text-text-secondary mt-1">
          Tùy chỉnh thông số thuật toán FSRS, ngữ điệu phát âm và các tùy chọn học tập.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* User Profile Card */}
        <div className="bg-surface-base border border-slate-200/90 rounded-card shadow-card p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <User className="w-4 h-4 text-brand-primary" />
            <h3 className="text-sm font-semibold text-brand-ink">Thông tin cá nhân</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-brand-ink">Tên hiển thị</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border rounded-control bg-surface-subtle focus:outline-none focus:border-brand-primary font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-brand-ink">Múi giờ</label>
              <input
                type="text"
                disabled
                value={settings.timezone}
                className="w-full px-3.5 py-2 text-xs border rounded-control bg-slate-100 text-slate-500 font-mono"
              />
            </div>
          </div>
        </div>

        {/* FSRS Settings Card */}
        <div className="bg-surface-base border border-slate-200/90 rounded-card shadow-card p-6 space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Brain className="w-4 h-4 text-brand-primary" />
            <h3 className="text-sm font-semibold text-brand-ink">
              Cấu hình thuật toán FSRS-7 (Spaced Repetition)
            </h3>
          </div>

          {/* Desired Retention Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-brand-ink">
                Mục tiêu độ duy trì trí nhớ (Desired Retention)
              </label>
              <span className="text-sm font-bold text-brand-primary font-mono">
                {(retention * 100).toFixed(0)}%
              </span>
            </div>

            <input
              type="range"
              min="0.80"
              max="0.95"
              step="0.01"
              value={retention}
              onChange={(e) => setRetention(Number(e.target.value))}
              className="w-full accent-brand-primary cursor-pointer"
            />

            <div className="flex items-center justify-between text-[11px] text-text-secondary">
              <span>80% (Ít lượt ôn)</span>
              <span>90% (Khuyến nghị chuẩn)</span>
              <span>95% (Khối lượng ôn dày đặc)</span>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 p-2.5 rounded-control border border-slate-100">
              * Tăng retention lên 95% giúp nhớ lâu hơn nhưng làm tăng gấp đôi số thẻ cần ôn mỗi ngày. Ngưỡng 90% là điểm cân bằng tối ưu giữa nỗ lực và hiệu quả.
            </p>
          </div>

          {/* Daily New Cards Limit */}
          <div className="space-y-1.5 pt-2">
            <label className="text-xs font-semibold text-brand-ink">
              Giới hạn thẻ mới mỗi ngày (New cards / day)
            </label>
            <select
              value={newCardsLimit}
              onChange={(e) => setNewCardsLimit(Number(e.target.value))}
              className="w-full px-3.5 py-2 text-xs border rounded-control bg-surface-subtle font-medium"
            >
              <option value={10}>10 thẻ / ngày (Nhẹ nhàng)</option>
              <option value={20}>20 thẻ / ngày (Khuyến nghị tiêu chuẩn)</option>
              <option value={30}>30 thẻ / ngày (Cường độ cao)</option>
              <option value={50}>50 thẻ / ngày (Ôn thi cấp tốc)</option>
            </select>
          </div>
        </div>

        {/* Audio & Dialect Settings Card */}
        <div className="bg-surface-base border border-slate-200/90 rounded-card shadow-card p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Volume2 className="w-4 h-4 text-brand-primary" />
            <h3 className="text-sm font-semibold text-brand-ink">
              Ngữ điệu & Âm thanh phát âm
            </h3>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-brand-ink">
                Chất giọng mặc định (Dialect)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setDialect('en-us');
                    speakWord('Vocelune American Accent', 'en-us');
                  }}
                  className={`p-3 rounded-control border text-left text-xs transition-all ${
                    dialect === 'en-us'
                      ? 'border-brand-primary bg-brand-primarySoft/50 text-brand-primary font-bold ring-1 ring-brand-primary/20'
                      : 'border-slate-200 hover:bg-slate-50 text-text-secondary'
                  }`}
                >
                  <span className="block font-semibold">Anh - Mỹ (US)</span>
                  <span className="text-[11px] font-normal text-text-secondary">
                    Phổ biến trong TOEFL, giao tiếp quốc tế
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDialect('en-gb');
                    speakWord('Vocelune British Accent', 'en-gb');
                  }}
                  className={`p-3 rounded-control border text-left text-xs transition-all ${
                    dialect === 'en-gb'
                      ? 'border-brand-primary bg-brand-primarySoft/50 text-brand-primary font-bold ring-1 ring-brand-primary/20'
                      : 'border-slate-200 hover:bg-slate-50 text-text-secondary'
                  }`}
                >
                  <span className="block font-semibold">Anh - Anh (UK)</span>
                  <span className="text-[11px] font-normal text-text-secondary">
                    Chuẩn Oxford 3000, IELTS
                  </span>
                </button>
              </div>
            </div>

            {/* Auto pronounce toggle */}
            <div className="flex items-center justify-between pt-2">
              <div>
                <span className="text-xs font-semibold text-brand-ink block">
                  Tự động phát âm khi lật thẻ
                </span>
                <span className="text-[11px] text-text-secondary">
                  Tự động đọc to từ tiếng Anh ngay khi nhấn &ldquo;Xem đáp án&rdquo;
                </span>
              </div>
              <input
                type="checkbox"
                checked={autoPronounce}
                onChange={(e) => setAutoPronounce(e.target.checked)}
                className="w-4 h-4 accent-brand-primary cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Submit & Reset Bar */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={handleResetData}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-control transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Khôi phục dữ liệu ban đầu</span>
          </button>

          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-2.5 bg-brand-primary hover:bg-brand-primaryHover text-white rounded-control font-semibold text-xs shadow-sm transition-all"
          >
            {isSaved ? (
              <>
                <Check className="w-4 h-4" />
                <span>Đã lưu thành công!</span>
              </>
            ) : (
              <span>Lưu cài đặt</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

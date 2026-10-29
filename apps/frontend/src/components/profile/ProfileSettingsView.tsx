'use client';

import React, { useRef, useState } from 'react';
import {
  User,
  Settings,
  Brain,
  Volume2,
  Globe,
  RotateCcw,
  Check,
  AlertCircle,
  Camera,
  Trash2,
  Loader2,
  Mail,
  Clock,
  Send,
  Bell,
  VolumeX,
  Sparkles,
} from 'lucide-react';
import { useVocelune } from '@/context/VoceluneContext';
import { useNotification } from '@/context/NotificationContext';
import { Dialect } from '@/types';
import { DictionaryProvider, useDictionaryProviders } from '@/lib/dictionary';
import { DictionarySourceSelect } from '../dictionary/DictionarySourceSelect';
import { speakWord } from '@/lib/speech';
import { ImageCropModal } from '../common/ImageCropModal';
import { api } from '@/lib/api';

export function ProfileSettingsView() {
  const { user, settings, updateSettings, uploadAvatar, removeAvatar, logout } = useVocelune();
  const { notify, soundEnabled, toggleSound, browserPushSupported, browserPushPermission, requestBrowserPermission } = useNotification();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarSuccess, setAvatarSuccess] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [isCropOpen, setIsCropOpen] = useState(false);

  const { providers, error: dictionaryError } = useDictionaryProviders();
  const [dictionaryProvider, setDictionaryProvider] = useState<DictionaryProvider>(settings.dictionaryProvider || 'free_dictionary');
  const [dictionaryFallbackEnabled, setDictionaryFallbackEnabled] = useState(settings.dictionaryFallbackEnabled || false);
  const [displayName, setDisplayName] = useState(settings.displayName);
  const [dialect, setDialect] = useState<Dialect>(settings.englishDialect);
  const [retention, setRetention] = useState<number>(settings.desiredRetention);
  const [newCardsLimit, setNewCardsLimit] = useState<number>(settings.newCardsPerDay);
  const [autoPronounce, setAutoPronounce] = useState(settings.autoPronounce);
  const [timezone, setTimezone] = useState(settings.timezone);
  const [dayStartHour, setDayStartHour] = useState(settings.dayStartHour);
  const [emailReminderStudy, setEmailReminderStudy] = useState(settings.emailReminderStudy ?? true);
  const [emailDailySummary, setEmailDailySummary] = useState(settings.emailDailySummary ?? true);
  const [isTestingReminder, setIsTestingReminder] = useState(false);
  const [isTestingSummary, setIsTestingSummary] = useState(false);
  const [testNotificationMsg, setTestNotificationMsg] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  const handleTestReminder = async () => {
    setIsTestingReminder(true);
    try {
      const res = await api<{ ok: boolean; subject: string }>('/notifications/test-reminder', { method: 'POST' });
      notify.success('Đã xếp hàng email nhắc nhở!', `Tiêu đề: "${res.subject}"`);
    } catch (err: any) {
      notify.error('Không thể gửi email thử', err?.message || 'Lỗi kết nối máy chủ.');
    } finally {
      setIsTestingReminder(false);
    }
  };

  const handleTestSummary = async () => {
    setIsTestingSummary(true);
    try {
      const res = await api<{ ok: boolean; subject: string }>('/notifications/test-summary', { method: 'POST' });
      notify.success('Đã xếp hàng email tổng kết!', `Tiêu đề: "${res.subject}"`);
    } catch (err: any) {
      notify.error('Không thể gửi email thử', err?.message || 'Lỗi kết nối máy chủ.');
    } finally {
      setIsTestingSummary(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setAvatarError('Chỉ hỗ trợ định dạng PNG, JPEG hoặc WebP.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCropSrc(reader.result as string);
      setIsCropOpen(true);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCropComplete = async (dataUrl: string) => {
    setAvatarError(null);
    setAvatarSuccess(null);
    setIsUploadingAvatar(true);
    try {
      await uploadAvatar(dataUrl);
      setAvatarSuccess('Cập nhật ảnh đại diện thành công!');
      setTimeout(() => setAvatarSuccess(null), 3000);
    } catch (err: any) {
      setAvatarError(err?.message || 'Không thể tải ảnh đại diện lên.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setAvatarError(null);
    setAvatarSuccess(null);
    setIsUploadingAvatar(true);
    try {
      await removeAvatar();
      setAvatarSuccess('Đã gỡ ảnh đại diện.');
      setTimeout(() => setAvatarSuccess(null), 3000);
    } catch (err: any) {
      setAvatarError(err?.message || 'Không thể gỡ ảnh đại diện.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await updateSettings({
      displayName: displayName.trim() || 'Người học',
      englishDialect: dialect,
      desiredRetention: Number(retention),
      newCardsPerDay: Number(newCardsLimit),
      autoPronounce, timezone, dayStartHour, dictionaryProvider, dictionaryFallbackEnabled,
      emailReminderStudy, emailDailySummary,
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500); } catch { setIsSaved(false); }
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
        <div className="bg-surface-base border border-slate-200/90 rounded-card shadow-card p-6 space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <User className="w-4 h-4 text-brand-primary" />
            <h3 className="text-sm font-semibold text-brand-ink">Thông tin cá nhân</h3>
          </div>

          {/* Avatar Section */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 p-4 rounded-xl bg-slate-50/70 border border-slate-100">
            <div className="relative group shrink-0">
              <div className="w-20 h-20 rounded-full overflow-hidden ring-4 ring-white shadow-md bg-gradient-to-tr from-brand-primary to-indigo-600 flex items-center justify-center text-white text-2xl font-bold">
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={settings.displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{displayName ? displayName.charAt(0).toUpperCase() : 'U'}</span>
                )}
              </div>
              {isUploadingAvatar && (
                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center text-white">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              )}
            </div>

            <div className="flex-1 text-center sm:text-left space-y-2">
              <div>
                <h4 className="text-xs font-semibold text-brand-ink">Ảnh đại diện</h4>
                <p className="text-[11px] text-text-secondary mt-0.5">
                  Định dạng PNG, JPEG hoặc WebP (tối đa 5MB). Lưu trữ trực tiếp trên Cloudflare R2.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleAvatarChange}
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={isUploadingAvatar}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-control bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors disabled:opacity-50 shadow-xs"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{user?.avatarUrl ? 'Đổi ảnh' : 'Tải ảnh lên'}</span>
                </button>

                {user?.avatarUrl && (
                  <button
                    type="button"
                    disabled={isUploadingAvatar}
                    onClick={handleRemoveAvatar}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-control bg-white border border-slate-200 text-slate-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50/50 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Gỡ ảnh</span>
                  </button>
                )}
              </div>

              {avatarSuccess && (
                <p className="text-[11px] text-emerald-600 flex items-center justify-center sm:justify-start gap-1 font-medium">
                  <Check className="w-3 h-3" /> {avatarSuccess}
                </p>
              )}
              {avatarError && (
                <p className="text-[11px] text-red-600 flex items-center justify-center sm:justify-start gap-1 font-medium">
                  <AlertCircle className="w-3 h-3" /> {avatarError}
                </p>
              )}
            </div>
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
                value={timezone}
                onChange={e => setTimezone(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border rounded-control bg-slate-100 text-slate-500 font-mono"
              />
            </div>
          </div>
        </div>

        <section className="bg-surface-base border rounded-card shadow-card p-6 space-y-4">
          <h3 className="text-sm font-semibold">Từ điển mặc định</h3>
          <DictionarySourceSelect id="profile-dictionary" value={dictionaryProvider} providers={providers} onChange={setDictionaryProvider} />
          <p className="text-xs text-text-secondary">Nguồn này được dùng mặc định khi thêm từ. Bạn có thể đổi riêng cho mỗi lần tra cứu.</p>
          <label className="flex gap-2 items-start text-xs"><input type="checkbox" checked={dictionaryFallbackEnabled} onChange={e => setDictionaryFallbackEnabled(e.target.checked)} />Cho phép thử nhiều nguồn dự phòng khi nguồn chọn thủ công lỗi hoặc không tìm thấy từ. Chế độ Tự động luôn có dự phòng.</label>
          {dictionaryError && <p className="text-xs text-amber-800">{dictionaryError}</p>}
          <ul className="text-xs space-y-1 text-text-secondary">{providers.map(provider => <li key={provider.id}>{provider.name}: {provider.configured ? 'Sẵn sàng' : 'Chưa cấu hình'}{provider.configured && !provider.persistenceSupported ? ' · Chỉ xem tham khảo' : ''}</li>)}</ul>
        </section>
        {/* FSRS Settings Card */}
        <div className="bg-surface-base border border-slate-200/90 rounded-card shadow-card p-6 space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Brain className="w-4 h-4 text-brand-primary" />
            <h3 className="text-sm font-semibold text-brand-ink">
              Cấu hình thuật toán FSRS-6 (Spaced Repetition)
            </h3>
          </div>

          <label className="block text-xs font-semibold">Giờ bắt đầu ngày học (0–23)<input type="number" min={0} max={23} value={dayStartHour} onChange={e => setDayStartHour(Number(e.target.value))} className="block border rounded-lg p-2 mt-2" /></label>
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
              * Tăng mục tiêu có thể tăng khối lượng ôn. Cấu hình mới áp dụng cho lượt ôn tiếp theo; lịch sử và thời điểm đến hạn hiện tại được giữ lại.
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

        {/* Email Notifications & Scheduled Reminders */}
        <div className="bg-surface-base border border-slate-200/90 rounded-card shadow-card p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-brand-primary" />
              <h3 className="text-sm font-semibold text-brand-ink">Thông báo & Nhắc nhở lịch học qua Email</h3>
            </div>
            <span className="text-[11px] font-semibold text-brand-primary bg-brand-primarySoft px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <Clock className="w-3 h-3" /> Tự động 06:00 AM & 11:59 PM
            </span>
          </div>

          <div className="space-y-4">
            {/* 06:00 AM Reminder */}
            <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-brand-ink">⏰ Nhắc nhở lịch học mỗi sáng (06:00 AM)</span>
                    <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">Múi giờ: {timezone}</span>
                  </div>
                  <p className="text-[11px] text-text-secondary leading-relaxed">
                    Tự động gửi email vào lúc 06:00 sáng thông báo số lượng từ cần ôn tập ngắt quãng (FSRS) và mục tiêu từ mới trong ngày.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={emailReminderStudy}
                  onChange={(e) => setEmailReminderStudy(e.target.checked)}
                  className="w-4 h-4 accent-brand-primary cursor-pointer mt-1"
                />
              </div>
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  disabled={isTestingReminder}
                  onClick={handleTestReminder}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-control bg-white border border-slate-200 text-slate-700 hover:text-brand-primary hover:border-brand-primary/50 transition-colors disabled:opacity-50"
                >
                  {isTestingReminder ? <Loader2 className="w-3 h-3 animate-spin text-brand-primary" /> : <Send className="w-3 h-3" />}
                  <span>Gửi thử email 06:00 AM</span>
                </button>
              </div>
            </div>

            {/* 11:59 PM Summary */}
            <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-brand-ink">🌙 Tổng kết kiến thức mỗi tối (11:59 PM)</span>
                    <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded">Múi giờ: {timezone}</span>
                  </div>
                  <p className="text-[11px] text-text-secondary leading-relaxed">
                    Tự động gửi email vào lúc 11:59 tối tổng kết danh sách các từ vựng đã ôn luyện, tỷ lệ phản xạ chính xác và tiến độ củng cố trí nhớ dài hạn.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={emailDailySummary}
                  onChange={(e) => setEmailDailySummary(e.target.checked)}
                  className="w-4 h-4 accent-brand-primary cursor-pointer mt-1"
                />
              </div>
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  disabled={isTestingSummary}
                  onClick={handleTestSummary}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-control bg-white border border-slate-200 text-slate-700 hover:text-brand-primary hover:border-brand-primary/50 transition-colors disabled:opacity-50"
                >
                  {isTestingSummary ? <Loader2 className="w-3 h-3 animate-spin text-brand-primary" /> : <Send className="w-3 h-3" />}
                  <span>Gửi thử email 11:59 PM</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* In-App & Browser Push Notification Settings Card */}
        <div className="bg-surface-base border border-slate-200/90 rounded-card shadow-card p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-brand-primary" />
              <h3 className="text-sm font-semibold text-brand-ink">Thông báo đẩy & Âm thanh trực quan</h3>
            </div>
            <span className="text-[11px] font-semibold text-brand-primary bg-brand-primarySoft px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Web Audio & Push
            </span>
          </div>

          <div className="space-y-4">
            {/* Audio Feedback Toggle */}
            <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-brand-ink">🔔 Hiệu ứng âm thanh thông báo (Visual Audio Chime)</span>
                  <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${soundEnabled ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                    {soundEnabled ? 'Đang bật' : 'Đã tắt'}
                  </span>
                </div>
                <p className="text-[11px] text-text-secondary leading-relaxed">
                  Phát âm thanh tổng hợp đa tầng (Web Audio API) khi tạo thẻ, tạo topic, cập nhật dữ liệu, hoàn thành import hoặc gặp lỗi.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => notify.success('Âm thanh thử nghiệm', 'Đây là chuông âm thanh trực quan thông báo thành công.')}
                  className="px-2.5 py-1 text-[11px] font-medium border border-slate-200 bg-white rounded-control hover:bg-slate-50 text-slate-700"
                >
                  Nghe thử
                </button>
                <button
                  type="button"
                  onClick={toggleSound}
                  className={`px-3 py-1 text-xs font-semibold rounded-control transition-colors ${soundEnabled ? 'bg-brand-primary text-white' : 'bg-slate-200 text-slate-700'}`}
                >
                  {soundEnabled ? 'Bật' : 'Tắt'}
                </button>
              </div>
            </div>

            {/* Browser Push Notification Permission */}
            <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-brand-ink">🌐 Thông báo đẩy trình duyệt (Browser Push Notification)</span>
                  <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${browserPushPermission === 'granted' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                    {browserPushPermission === 'granted' ? 'Đã cấp quyền' : browserPushPermission === 'denied' ? 'Bị chặn bởi trình duyệt' : 'Chưa kích hoạt'}
                  </span>
                </div>
                <p className="text-[11px] text-text-secondary leading-relaxed">
                  Hiển thị thông báo đẩy ở góc màn hình hệ điều hành ngay cả khi bạn đang duyệt tab khác trong lúc xử lý import hoặc ôn tập.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    notify.info('Vocelune Push Notification', 'Thông báo đẩy của bạn đang hoạt động bình thường!', { browserPush: true });
                  }}
                  className="px-2.5 py-1 text-[11px] font-medium border border-slate-200 bg-white rounded-control hover:bg-slate-50 text-slate-700"
                >
                  Gửi thử
                </button>
                {browserPushSupported && browserPushPermission !== 'granted' && (
                  <button
                    type="button"
                    onClick={() => void requestBrowserPermission()}
                    className="px-3 py-1 text-xs font-semibold rounded-control bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                  >
                    Bật thông báo
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Submit & Reset Bar */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => void logout().catch(() => {})}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-control transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Đăng xuất</span>
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

      <ImageCropModal
        isOpen={isCropOpen}
        imageSrc={cropSrc}
        onClose={() => setIsCropOpen(false)}
        onComplete={handleCropComplete}
        initialAspectRatio={1}
        title="Cắt ảnh đại diện"
      />
    </div>
  );
}

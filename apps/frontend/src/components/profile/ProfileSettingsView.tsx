'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  User,
  Brain,
  Volume2,
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
  Sparkles,
  ShieldCheck,
  Lock,
  KeyRound,
  Laptop,
  Database,
  LayoutDashboard,
  Users,
  Library,
  Activity,
  ScrollText,
  ExternalLink,
} from 'lucide-react';
import { useVocelune } from '@/context/VoceluneContext';
import { useNotification } from '@/context/NotificationContext';
import { Dialect } from '@/types';
import { DictionaryProvider, useDictionaryProviders } from '@/lib/dictionary';
import { DictionarySourceSelect } from '../dictionary/DictionarySourceSelect';
import { speakWord } from '@/lib/speech';
import { ImageCropModal } from '../common/ImageCropModal';
import { api, post } from '@/lib/api';

type SessionItem = {
  id: string;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
};

function SecurityAndSessionsSection() {
  const { notify } = useNotification();
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [revoking, setRevoking] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPwd, setChangingPwd] = useState(false);

  const loadSessions = async () => {
    setLoadingSessions(true);
    try {
      const res = await api<{ items: SessionItem[] }>('/me/sessions');
      setSessions(res.items || []);
    } catch {
      // ignore
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    void loadSessions();
  }, []);

  const handleRevokeOthers = async () => {
    setRevoking(true);
    try {
      const res = await post<{ ok: boolean; revokedCount: number }>('/me/sessions/revoke-others');
      notify.success('Đã thu hồi phiên khác', `Đã đăng xuất ${res.revokedCount} phiên truy cập khác.`);
      await loadSessions();
    } catch (e: any) {
      notify.error('Không thể thu hồi phiên', e?.message || 'Lỗi máy chủ.');
    } finally {
      setRevoking(false);
    }
  };

  const handleRevokeOne = async (sessionId: string) => {
    try {
      await api(`/me/sessions/${sessionId}`, { method: 'DELETE' });
      notify.info('Đã thu hồi phiên đăng nhập', 'Phiên truy cập đã bị vô hiệu hóa.');
      setSessions(prev => prev.filter(s => s.id !== sessionId));
    } catch (e: any) {
      notify.error('Lỗi thu hồi phiên', e?.message || 'Không thể thu hồi phiên.');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 12) {
      notify.error('Mật khẩu chưa đủ mạnh', 'Mật khẩu mới phải có ít nhất 12 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      notify.error('Mật khẩu không khớp', 'Mật khẩu xác nhận không trùng khớp.');
      return;
    }
    setChangingPwd(true);
    try {
      await post('/me/password', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      notify.success('Đã đổi mật khẩu thành công!', 'Các phiên đăng nhập trên thiết bị khác đã được thu hồi để bảo mật.');
      await loadSessions();
    } catch (e: any) {
      notify.error('Đổi mật khẩu thất bại', e?.message || 'Mật khẩu hiện tại không đúng.');
    } finally {
      setChangingPwd(false);
    }
  };

  return (
    <div className="bg-surface-base border border-slate-200/90 rounded-card shadow-card p-4 sm:p-5 space-y-5">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-brand-primary" />
          <h3 className="text-xs font-bold text-brand-ink uppercase tracking-wider">
            Bảo mật Tài khoản & Quản lý Phiên đăng nhập
          </h3>
        </div>
        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
          Bảo vệ CSRF & Session
        </span>
      </div>

      {/* Password Change Form */}
      <form onSubmit={handleChangePassword} className="space-y-3 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/70">
        <div className="flex items-center gap-1.5 text-xs font-bold text-brand-ink">
          <KeyRound className="w-3.5 h-3.5 text-brand-primary" />
          <span>Đổi mật khẩu xác thực</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div>
            <label className="block text-[11px] font-medium text-text-secondary mb-1">Mật khẩu hiện tại</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-control bg-white focus:outline-none focus:border-brand-primary"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-text-secondary mb-1">Mật khẩu mới (&ge;12 ký tự)</label>
            <input
              type="password"
              required
              minLength={12}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-control bg-white focus:outline-none focus:border-brand-primary"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-text-secondary mb-1">Nhập lại mật khẩu mới</label>
            <input
              type="password"
              required
              minLength={12}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-control bg-white focus:outline-none focus:border-brand-primary"
            />
          </div>
        </div>
        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-text-secondary">
            Đổi mật khẩu sẽ tự động thu hồi các phiên đăng nhập trên thiết bị khác.
          </span>
          <button
            type="submit"
            disabled={changingPwd || !currentPassword || newPassword.length < 12}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-control bg-brand-primary text-white hover:bg-brand-primaryHover disabled:opacity-50 transition-colors"
          >
            {changingPwd && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Cập nhật mật khẩu</span>
          </button>
        </div>
      </form>

      {/* Active Sessions */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-brand-ink">
            <Laptop className="w-3.5 h-3.5 text-brand-primary" />
            <span>Phiên đăng nhập đang hoạt động ({sessions.length})</span>
          </div>
          {sessions.length > 1 && (
            <button
              type="button"
              disabled={revoking}
              onClick={handleRevokeOthers}
              className="px-2.5 py-1 text-[11px] font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-colors disabled:opacity-50"
            >
              Thu hồi {sessions.length - 1} phiên khác
            </button>
          )}
        </div>

        {loadingSessions ? (
          <p className="text-xs text-text-secondary py-2">Đang kiểm tra phiên đăng nhập...</p>
        ) : (
          <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl overflow-hidden bg-white">
            {sessions.map(s => (
              <div key={s.id} className="flex items-center justify-between px-3 py-2 text-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 font-semibold text-brand-ink">
                    <span className="font-mono text-[11px]">Phiên #{s.id.slice(0, 8)}</span>
                    {s.isCurrent && (
                      <span className="px-1.5 py-0.2 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                        Thiết bị hiện tại
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-text-secondary">
                    Khởi tạo: {new Date(s.createdAt).toLocaleString('vi-VN')} · Hết hạn: {new Date(s.expiresAt).toLocaleDateString('vi-VN')}
                  </div>
                </div>
                {!s.isCurrent && (
                  <button
                    type="button"
                    onClick={() => void handleRevokeOne(s.id)}
                    className="px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-md"
                  >
                    Thu hồi
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ProfileSettingsView() {
  const { user, settings, updateSettings, uploadAvatar, removeAvatar, logout } = useVocelune();
  const { notify, soundEnabled, toggleSound, browserPushSupported, browserPushPermission, requestBrowserPermission } = useNotification();
  const isAdmin = user?.role === 'admin';

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
  const [isSaved, setIsSaved] = useState(false);

  const handleTestReminder = async () => {
    setIsTestingReminder(true);
    try {
      const res = await api<{ ok: boolean; subject: string; message?: string }>('/notifications/test-reminder', { method: 'POST' });
      notify.success('Đã gửi email nhắc nhở!', res.message || `Tiêu đề: "${res.subject}"`);
    } catch (err: any) {
      notify.error('Không thể gửi email thử', err?.message || 'Lỗi kết nối máy chủ.');
    } finally {
      setIsTestingReminder(false);
    }
  };

  const handleTestSummary = async () => {
    setIsTestingSummary(true);
    try {
      const res = await api<{ ok: boolean; subject: string; message?: string }>('/notifications/test-summary', { method: 'POST' });
      notify.success('Đã gửi email tổng kết!', res.message || `Tiêu đề: "${res.subject}"`);
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
    try {
      if (isAdmin) {
        await updateSettings({
          displayName: displayName.trim() || 'Quản trị viên',
          timezone,
          dictionaryProvider,
          dictionaryFallbackEnabled,
          englishDialect: dialect,
          emailReminderStudy: false,
          emailDailySummary: false,
        });
      } else {
        await updateSettings({
          displayName: displayName.trim() || 'Người học',
          englishDialect: dialect,
          desiredRetention: Number(retention),
          newCardsPerDay: Number(newCardsLimit),
          autoPronounce,
          timezone,
          dayStartHour,
          dictionaryProvider,
          dictionaryFallbackEnabled,
          emailReminderStudy,
          emailDailySummary,
        });
      }
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    } catch {
      setIsSaved(false);
    }
  };

  // ============================================================================
  // DEDICATED ADMIN PROFILE VIEW (No learner FSRS clutter, focused on Website Admin)
  // ============================================================================
  if (isAdmin) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        {/* Admin Profile Header Banner */}
        <div className="bg-gradient-to-r from-indigo-950 via-indigo-900 to-brand-primary rounded-card p-5 text-white shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 text-indigo-100 text-[11px] font-bold uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
              <span>Tài khoản Quản trị Hệ thống (Root Admin)</span>
            </div>
            <h2 className="text-lg font-extrabold tracking-tight">
              Hồ sơ Quản trị viên & Cấu hình Vận hành
            </h2>
            <p className="text-xs text-indigo-100/90 max-w-xl">
              Tài khoản quản trị được tách biệt khỏi hồ sơ học viên FSRS để tập trung hoàn toàn vào quản trị người dùng, kiểm duyệt bộ từ công khai, điều phối API từ điển và bảo mật hệ thống.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Link
              href="/admin?tab=overview"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-control bg-white text-brand-ink hover:bg-indigo-50 text-xs font-bold shadow-xs transition-colors"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-brand-primary" />
              <span>Bảng điều khiển Quản trị</span>
            </Link>
            <Link
              href="/admin?tab=dictionary"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-control bg-indigo-800/80 hover:bg-indigo-800 text-white border border-indigo-400/30 text-xs font-semibold transition-colors"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Quản lý API Từ điển</span>
            </Link>
          </div>
        </div>

        {/* Quick Jump Cards to Admin Console Modules */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
          {[
            { href: '/admin?tab=overview', label: 'Tổng quan', desc: 'KPIs & Thống kê', icon: LayoutDashboard },
            { href: '/admin?tab=users', label: 'Người dùng', desc: 'Phân quyền & Khóa', icon: Users },
            { href: '/admin?tab=decks', label: 'Bộ từ chuẩn', desc: 'Kiểm duyệt & Seed', icon: Library },
            { href: '/admin?tab=dictionary', label: 'API Từ điển', desc: 'Quota & Playground', icon: Database },
            { href: '/admin?tab=operations', label: 'Vận hành', desc: 'Import & Outbox', icon: Activity },
            { href: '/admin?tab=audit', label: 'Nhật ký', desc: 'Audit Logs', icon: ScrollText },
          ].map(card => {
            const Icon = card.icon;
            return (
              <Link
                key={card.href}
                href={card.href}
                className="bg-surface-base border border-slate-200/80 hover:border-brand-primary/50 rounded-xl p-3 transition-all group shadow-2xs hover:shadow-xs"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="p-1.5 rounded-lg bg-brand-primarySoft text-brand-primary">
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <ExternalLink className="w-3 h-3 text-slate-300 group-hover:text-brand-primary transition-colors" />
                </div>
                <div className="text-xs font-bold text-brand-ink">{card.label}</div>
                <div className="text-[10px] text-text-secondary">{card.desc}</div>
              </Link>
            );
          })}
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Administrator Identity Card */}
          <div className="bg-surface-base border border-slate-200/90 rounded-card shadow-card p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-brand-primary" />
                <h3 className="text-xs font-bold text-brand-ink uppercase tracking-wider">
                  Thông tin Định danh Quản trị viên
                </h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-brand-primary border border-indigo-200">
                Role: ADMIN
              </span>
            </div>

            {/* Avatar Section */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3.5 p-3 rounded-xl bg-slate-50/70 border border-slate-100">
              <div className="relative group shrink-0">
                <div className="w-14 h-14 rounded-full overflow-hidden ring-2 ring-brand-primary/30 shadow-sm bg-gradient-to-tr from-brand-primary to-indigo-600 flex items-center justify-center text-white text-xl font-bold">
                  {user?.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={settings.displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{displayName ? displayName.charAt(0).toUpperCase() : 'A'}</span>
                  )}
                </div>
                {isUploadingAvatar && (
                  <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center text-white">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                )}
              </div>

              <div className="flex-1 text-center sm:text-left space-y-1.5">
                <div>
                  <h4 className="text-xs font-semibold text-brand-ink">Ảnh đại diện Quản trị viên</h4>
                  <p className="text-[11px] text-text-secondary mt-0.5">
                    Hiển thị trong nhật ký kiểm toán hệ thống (Audit Logs) và thanh điều hành. Lưu trữ trên Cloudflare R2.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 pt-0.5">
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
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-control bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors disabled:opacity-50 shadow-2xs"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>{user?.avatarUrl ? 'Đổi ảnh' : 'Tải ảnh lên'}</span>
                  </button>

                  {user?.avatarUrl && (
                    <button
                      type="button"
                      disabled={isUploadingAvatar}
                      onClick={handleRemoveAvatar}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-control bg-white border border-slate-200 text-slate-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50/50 transition-colors disabled:opacity-50"
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-brand-ink">Tên hiển thị Quản trị</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border rounded-control bg-surface-subtle focus:outline-none focus:border-brand-primary font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-brand-ink">Email Quản trị (Đã xác thực)</label>
                <input
                  type="text"
                  disabled
                  value={user?.email || ''}
                  className="w-full px-3.5 py-2 text-xs border rounded-control bg-slate-100 text-slate-500 font-mono cursor-not-allowed"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-brand-ink">Múi giờ Vận hành & Nhật ký</label>
                <input
                  type="text"
                  value={timezone}
                  onChange={e => setTimezone(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border rounded-control bg-surface-subtle text-brand-ink font-mono"
                />
              </div>
            </div>
          </div>

          {/* Admin Dictionary Diagnostic Defaults & System Audio */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <section className="bg-surface-base border border-slate-200/90 rounded-card shadow-card p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-brand-primary" />
                  <h3 className="text-xs font-bold text-brand-ink uppercase tracking-wider">
                    Cấu hình Kiểm thử API Từ điển
                  </h3>
                </div>
                <Link href="/admin?tab=dictionary" className="text-[11px] font-semibold text-brand-primary hover:underline">
                  Mở Console Từ điển →
                </Link>
              </div>
              <DictionarySourceSelect
                id="admin-profile-dictionary"
                value={dictionaryProvider}
                providers={providers}
                onChange={setDictionaryProvider}
              />
              <label className="flex gap-2 items-start text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={dictionaryFallbackEnabled}
                  onChange={e => setDictionaryFallbackEnabled(e.target.checked)}
                  className="mt-0.5 accent-brand-primary"
                />
                <span>Cho phép tự động chuyển sang nguồn dự phòng (Fallback) khi chẩn đoán nguồn từ điển.</span>
              </label>
              {dictionaryError && <p className="text-xs text-amber-800">{dictionaryError}</p>}
              <div className="pt-1 flex flex-wrap gap-1.5">
                {providers.map(provider => (
                  <span
                    key={provider.id}
                    className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                      provider.configured
                        ? provider.health?.state === 'cooldown'
                          ? 'bg-amber-50 border-amber-200 text-amber-800'
                          : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-slate-100 border-slate-200 text-slate-500'
                    }`}
                  >
                    {provider.name}: {provider.configured ? (provider.health?.state === 'cooldown' ? 'Cooldown' : 'Sẵn sàng') : 'Chưa cấu hình'}
                  </span>
                ))}
              </div>
            </section>

            <section className="bg-surface-base border border-slate-200/90 rounded-card shadow-card p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-brand-primary" />
                  <h3 className="text-xs font-bold text-brand-ink uppercase tracking-wider">
                    Cảnh báo & Thông báo Vận hành
                  </h3>
                </div>
                <span className="text-[10px] font-semibold text-brand-primary bg-brand-primarySoft px-2 py-0.5 rounded-full">
                  Admin Alerts
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-brand-ink block">Âm thanh phản hồi tác vụ quản trị</span>
                  <span className="text-[11px] text-text-secondary">
                    Phát chuông báo khi cập nhật quyền người dùng, xóa cache, đồng bộ bộ từ hoặc có lỗi API.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={toggleSound}
                  className={`px-3 py-1 text-xs font-semibold rounded-control transition-colors shrink-0 ${
                    soundEnabled ? 'bg-brand-primary text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {soundEnabled ? 'Đang bật' : 'Đã tắt'}
                </button>
              </div>

              <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-brand-ink block">Thông báo đẩy trình duyệt (Browser Push)</span>
                  <span className="text-[11px] text-text-secondary">
                    Trạng thái: {browserPushPermission === 'granted' ? 'Đã cấp quyền' : 'Chưa kích hoạt'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      notify.info('Vocelune Admin Alert', 'Hệ thống thông báo quản trị đang hoạt động tốt!', { browserPush: true })
                    }
                    className="px-2.5 py-1 text-[11px] font-medium border border-slate-200 bg-white rounded-control hover:bg-slate-50 text-slate-700"
                  >
                    Thử chuông
                  </button>
                  {browserPushSupported && browserPushPermission !== 'granted' && (
                    <button
                      type="button"
                      onClick={() => void requestBrowserPermission()}
                      className="px-2.5 py-1 text-xs font-semibold rounded-control bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      Kích hoạt
                    </button>
                  )}
                </div>
              </div>
            </section>
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => void logout().catch(() => {})}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-control transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Đăng xuất phiên Quản trị</span>
            </button>

            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-primary hover:bg-brand-primaryHover text-white rounded-control font-semibold text-xs shadow-sm transition-all"
            >
              {isSaved ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Đã lưu hồ sơ Quản trị!</span>
                </>
              ) : (
                <span>Lưu cấu hình Quản trị</span>
              )}
            </button>
          </div>
        </form>

        {/* Security & Active Sessions Management */}
        <SecurityAndSessionsSection />

        <ImageCropModal
          isOpen={isCropOpen}
          imageSrc={cropSrc}
          onClose={() => setIsCropOpen(false)}
          onComplete={handleCropComplete}
          initialAspectRatio={1}
          title="Cắt ảnh đại diện Quản trị viên"
        />
      </div>
    );
  }

  // ============================================================================
  // LEARNER PROFILE & FSRS SETTINGS VIEW
  // ============================================================================
  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div>
        <h2 className="text-lg font-bold text-brand-ink">Hồ sơ Học viên & Cài đặt Học tập</h2>
        <p className="text-xs text-text-secondary mt-0.5">
          Tùy chỉnh thông số thuật toán FSRS, ngữ điệu phát âm và các tùy chọn học tập cá nhân.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        {/* User Profile Card */}
        <div className="bg-surface-base border border-slate-200/90 rounded-card shadow-card p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <User className="w-4 h-4 text-brand-primary" />
            <h3 className="text-xs font-bold text-brand-ink uppercase tracking-wider">Thông tin cá nhân</h3>
          </div>

          {/* Avatar Section */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3.5 p-3 rounded-xl bg-slate-50/70 border border-slate-100">
            <div className="relative group shrink-0">
              <div className="w-14 h-14 rounded-full overflow-hidden ring-2 ring-white shadow-sm bg-gradient-to-tr from-brand-primary to-indigo-600 flex items-center justify-center text-white text-xl font-bold">
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
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              )}
            </div>

            <div className="flex-1 text-center sm:text-left space-y-1.5">
              <div>
                <h4 className="text-xs font-semibold text-brand-ink">Ảnh đại diện</h4>
                <p className="text-[11px] text-text-secondary mt-0.5">
                  Định dạng PNG, JPEG hoặc WebP (tối đa 5MB). Lưu trữ trực tiếp trên Cloudflare R2.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 pt-0.5">
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
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-control bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors disabled:opacity-50 shadow-2xs"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{user?.avatarUrl ? 'Đổi ảnh' : 'Tải ảnh lên'}</span>
                </button>

                {user?.avatarUrl && (
                  <button
                    type="button"
                    disabled={isUploadingAvatar}
                    onClick={handleRemoveAvatar}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-control bg-white border border-slate-200 text-slate-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50/50 transition-colors disabled:opacity-50"
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

        <section className="bg-surface-base border border-slate-200/90 rounded-card shadow-card p-4 sm:p-5 space-y-3">
          <h3 className="text-xs font-bold text-brand-ink uppercase tracking-wider">Từ điển mặc định</h3>
          <DictionarySourceSelect id="profile-dictionary" value={dictionaryProvider} providers={providers} onChange={setDictionaryProvider} />
          <p className="text-[11px] text-text-secondary">Nguồn này được dùng mặc định khi thêm từ. Bạn có thể đổi riêng cho mỗi lần tra cứu.</p>
          <label className="flex gap-2 items-start text-xs text-slate-700"><input type="checkbox" checked={dictionaryFallbackEnabled} onChange={e => setDictionaryFallbackEnabled(e.target.checked)} className="mt-0.5" />Cho phép thử nhiều nguồn dự phòng khi nguồn chọn thủ công lỗi hoặc không tìm thấy từ.</label>
          {dictionaryError && <p className="text-xs text-amber-800">{dictionaryError}</p>}
          <ul className="text-[11px] space-y-0.5 text-text-secondary">{providers.map(provider => <li key={provider.id}>{provider.name}: {provider.configured ? 'Sẵn sàng' : 'Chưa cấu hình'}{provider.configured && !provider.persistenceSupported ? ' · Chỉ xem tham khảo' : ''}</li>)}</ul>
        </section>

        {/* FSRS Settings Card */}
        <div className="bg-surface-base border border-slate-200/90 rounded-card shadow-card p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <Brain className="w-4 h-4 text-brand-primary" />
            <h3 className="text-xs font-bold text-brand-ink uppercase tracking-wider">
              Cấu hình thuật toán FSRS-6 (Spaced Repetition)
            </h3>
          </div>

          <label className="block text-xs font-semibold text-brand-ink">Giờ bắt đầu ngày học (0–23)<input type="number" min={0} max={23} value={dayStartHour} onChange={e => setDayStartHour(Number(e.target.value))} className="block border rounded-control px-2.5 py-1 text-xs mt-1 w-24 bg-surface-subtle" /></label>
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
        <div className="bg-surface-base border border-slate-200/90 rounded-card shadow-card p-4 sm:p-5 space-y-3.5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <Volume2 className="w-4 h-4 text-brand-primary" />
            <h3 className="text-xs font-bold text-brand-ink uppercase tracking-wider">
              Ngữ điệu & Âm thanh phát âm
            </h3>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-brand-ink">
                Chất giọng mặc định (Dialect)
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setDialect('en-us');
                    speakWord('Vocelune American Accent', 'en-us');
                  }}
                  className={`p-2.5 rounded-control border text-left text-xs transition-all ${
                    dialect === 'en-us'
                      ? 'border-brand-primary bg-brand-primarySoft/50 text-brand-primary font-bold ring-1 ring-brand-primary/20'
                      : 'border-slate-200 hover:bg-slate-50 text-text-secondary'
                  }`}
                >
                  <span className="block font-semibold">Anh - Mỹ (US)</span>
                  <span className="text-[10px] font-normal text-text-secondary">
                    Phổ biến trong TOEFL, giao tiếp quốc tế
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDialect('en-gb');
                    speakWord('Vocelune British Accent', 'en-gb');
                  }}
                  className={`p-2.5 rounded-control border text-left text-xs transition-all ${
                    dialect === 'en-gb'
                      ? 'border-brand-primary bg-brand-primarySoft/50 text-brand-primary font-bold ring-1 ring-brand-primary/20'
                      : 'border-slate-200 hover:bg-slate-50 text-text-secondary'
                  }`}
                >
                  <span className="block font-semibold">Anh - Anh (UK)</span>
                  <span className="text-[10px] font-normal text-text-secondary">
                    Chuẩn Oxford 3000, IELTS
                  </span>
                </button>
              </div>
            </div>

            {/* Auto pronounce toggle */}
            <div className="flex items-center justify-between pt-1">
              <div>
                <span className="text-xs font-semibold text-brand-ink block">
                  Tự động phát âm khi lật thẻ
                </span>
                <span className="text-[10px] text-text-secondary">
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
        <div className="bg-surface-base border border-slate-200/90 rounded-card shadow-card p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-brand-primary" />
              <h3 className="text-xs font-bold text-brand-ink uppercase tracking-wider">Thông báo & Nhắc nhở lịch học qua Email</h3>
            </div>
            <span className="text-[10px] font-semibold text-brand-primary bg-brand-primarySoft px-2 py-0.5 rounded-full flex items-center gap-1">
              <Clock className="w-3 h-3" /> Tự động 06:00 & 23:59
            </span>
          </div>

          <div className="space-y-3">
            {/* 06:00 AM Reminder */}
            <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/80 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-brand-ink">⏰ Nhắc nhở lịch học mỗi sáng (06:00 AM)</span>
                    <span className="px-1.5 py-0.2 text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">Múi giờ: {timezone}</span>
                  </div>
                  <p className="text-[11px] text-text-secondary leading-normal">
                    Tự động gửi email vào lúc 06:00 sáng thông báo số lượng từ cần ôn tập ngắt quãng (FSRS) và mục tiêu từ mới trong ngày.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={emailReminderStudy}
                  onChange={(e) => setEmailReminderStudy(e.target.checked)}
                  className="w-4 h-4 accent-brand-primary cursor-pointer mt-0.5"
                />
              </div>
              <div className="flex justify-end pt-0.5">
                <button
                  type="button"
                  disabled={isTestingReminder}
                  onClick={handleTestReminder}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-control bg-white border border-slate-200 text-slate-700 hover:text-brand-primary hover:border-brand-primary/50 transition-colors disabled:opacity-50"
                >
                  {isTestingReminder ? <Loader2 className="w-3 h-3 animate-spin text-brand-primary" /> : <Send className="w-3 h-3" />}
                  <span>Gửi thử email 06:00 AM</span>
                </button>
              </div>
            </div>

            {/* 11:59 PM Summary */}
            <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/80 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-brand-ink">🌙 Tổng kết kiến thức mỗi tối (11:59 PM)</span>
                    <span className="px-1.5 py-0.2 text-[9px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded">Múi giờ: {timezone}</span>
                  </div>
                  <p className="text-[11px] text-text-secondary leading-normal">
                    Tự động gửi email vào lúc 11:59 tối tổng kết danh sách các từ vựng đã ôn luyện, tỷ lệ phản xạ chính xác và tiến độ củng cố trí nhớ dài hạn.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={emailDailySummary}
                  onChange={(e) => setEmailDailySummary(e.target.checked)}
                  className="w-4 h-4 accent-brand-primary cursor-pointer mt-0.5"
                />
              </div>
              <div className="flex justify-end pt-0.5">
                <button
                  type="button"
                  disabled={isTestingSummary}
                  onClick={handleTestSummary}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-control bg-white border border-slate-200 text-slate-700 hover:text-brand-primary hover:border-brand-primary/50 transition-colors disabled:opacity-50"
                >
                  {isTestingSummary ? <Loader2 className="w-3 h-3 animate-spin text-brand-primary" /> : <Send className="w-3 h-3" />}
                  <span>Gửi thử email 11:59 PM</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* In-App & Browser Push Notification Settings Card */}
        <div className="bg-surface-base border border-slate-200/90 rounded-card shadow-card p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-brand-primary" />
              <h3 className="text-xs font-bold text-brand-ink uppercase tracking-wider">Thông báo đẩy & Âm thanh trực quan</h3>
            </div>
            <span className="text-[10px] font-semibold text-brand-primary bg-brand-primarySoft px-2 py-0.5 rounded-full flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Web Audio & Push
            </span>
          </div>

          <div className="space-y-3">
            {/* Audio Feedback Toggle */}
            <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-brand-ink">🔔 Hiệu ứng âm thanh thông báo (Visual Audio Chime)</span>
                  <span className={`px-1.5 py-0.2 text-[9px] font-semibold rounded ${soundEnabled ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                    {soundEnabled ? 'Đang bật' : 'Đã tắt'}
                  </span>
                </div>
                <p className="text-[11px] text-text-secondary leading-normal">
                  Phát âm thanh tổng hợp đa tầng (Web Audio API) khi tạo thẻ, tạo topic, cập nhật dữ liệu, hoàn thành import hoặc gặp lỗi.
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => notify.success('Âm thanh thử nghiệm', 'Đây là chuông âm thanh trực quan thông báo thành công.')}
                  className="px-2 py-1 text-[11px] font-medium border border-slate-200 bg-white rounded-control hover:bg-slate-50 text-slate-700"
                >
                  Nghe thử
                </button>
                <button
                  type="button"
                  onClick={toggleSound}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-control transition-colors ${soundEnabled ? 'bg-brand-primary text-white' : 'bg-slate-200 text-slate-700'}`}
                >
                  {soundEnabled ? 'Bật' : 'Tắt'}
                </button>
              </div>
            </div>

            {/* Browser Push Notification Permission */}
            <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-brand-ink">🌐 Thông báo đẩy trình duyệt (Browser Push Notification)</span>
                  <span className={`px-1.5 py-0.2 text-[9px] font-semibold rounded ${browserPushPermission === 'granted' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                    {browserPushPermission === 'granted' ? 'Đã cấp quyền' : browserPushPermission === 'denied' ? 'Bị chặn' : 'Chưa kích hoạt'}
                  </span>
                </div>
                <p className="text-[11px] text-text-secondary leading-normal">
                  Hiển thị thông báo đẩy ở góc màn hình hệ điều hành ngay cả khi bạn đang duyệt tab khác trong lúc xử lý import hoặc ôn tập.
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    notify.info('Vocelune Push Notification', 'Thông báo đẩy của bạn đang hoạt động bình thường!', { browserPush: true });
                  }}
                  className="px-2 py-1 text-[11px] font-medium border border-slate-200 bg-white rounded-control hover:bg-slate-50 text-slate-700"
                >
                  Gửi thử
                </button>
                {browserPushSupported && browserPushPermission !== 'granted' && (
                  <button
                    type="button"
                    onClick={() => void requestBrowserPermission()}
                    className="px-2.5 py-1 text-xs font-semibold rounded-control bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                  >
                    Bật thông báo
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Submit & Reset Bar */}
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={() => void logout().catch(() => {})}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-control transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Đăng xuất</span>
          </button>

          <button
            type="submit"
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-primary hover:bg-brand-primaryHover text-white rounded-control font-semibold text-xs shadow-sm transition-all"
          >
            {isSaved ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Đã lưu thành công!</span>
              </>
            ) : (
              <span>Lưu cài đặt</span>
            )}
          </button>
        </div>
      </form>

      {/* Security & Active Sessions Management */}
      <SecurityAndSessionsSection />

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

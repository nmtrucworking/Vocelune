'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu,
  Plus,
  Volume2,
  VolumeX,
  Bell,
  Settings,
  LogOut,
  ChevronDown,
  Flame,
  BookOpen,
  TrendingUp,
  Sparkles,
  User,
  ShieldCheck,
  BarChart3,
  FileSpreadsheet,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useVocelune } from '@/context/VoceluneContext';
import { useNotification } from '@/context/NotificationContext';
import { speakWord } from '@/lib/speech';

interface NavbarProps {
  onOpenMobileSidebar: () => void;
  onOpenQuickAdd: () => void;
  pageTitle?: string;
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export function Navbar({
  onOpenMobileSidebar,
  onOpenQuickAdd,
  pageTitle,
  sidebarCollapsed = false,
  onToggleSidebar,
}: NavbarProps) {
  const router = useRouter();
  const { user, settings, streak, vocabItems, observedRetention, logout } = useVocelune();
  const { notify, soundEnabled, toggleSound, browserPushSupported, browserPushPermission, requestBrowserPermission } = useNotification();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const handleTestAudio = () => {
    speakWord('Vocelune, a rhythm for every word.', settings.englishDialect);
  };

  // Close popover when clicking outside or pressing Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setPopoverOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setPopoverOpen(false);
      }
    }

    if (popoverOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [popoverOpen]);

  const handleLogout = async () => {
    setPopoverOpen(false);
    await logout();
    router.push('/login');
  };

  const initialLetter = (settings.displayName || user?.displayName || 'U').charAt(0).toUpperCase();

  return (
    <header className="h-16 bg-surface-base border-b border-slate-200/80 px-4 md:px-8 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-2.5">
        {/* Mobile menu button */}
        <button
          onClick={onOpenMobileSidebar}
          className="p-2 rounded-lg text-text-secondary hover:bg-slate-100 md:hidden"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Desktop Sidebar Toggle */}
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="hidden md:flex p-2 rounded-lg text-slate-500 hover:text-brand-ink hover:bg-slate-100 transition-colors"
            title={sidebarCollapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="w-4.5 h-4.5 text-brand-primary" />
            ) : (
              <PanelLeftClose className="w-4.5 h-4.5 text-slate-500" />
            )}
          </button>
        )}

        {pageTitle && (
          <h1 className="text-base font-semibold text-brand-ink hidden sm:block">
            {pageTitle}
          </h1>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Sound FX Toggle */}
        <button
          onClick={toggleSound}
          title={soundEnabled ? 'Âm thanh thông báo: Đang bật (Click để tắt)' : 'Âm thanh thông báo: Đang tắt (Click để bật)'}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-control transition-colors ${
            soundEnabled
              ? 'text-slate-700 hover:text-brand-primary bg-slate-100 hover:bg-slate-200/80'
              : 'text-slate-400 hover:text-slate-600 bg-slate-100/60'
          }`}
        >
          {soundEnabled ? (
            <Volume2 className="w-3.5 h-3.5 text-brand-primary" />
          ) : (
            <VolumeX className="w-3.5 h-3.5 text-slate-400" />
          )}
          <span className="hidden sm:inline">{soundEnabled ? 'Âm thanh' : 'Tắt âm'}</span>
        </button>

        {/* Audio Dialect Quick Tester */}
        <button
          onClick={handleTestAudio}
          title={`Phát âm mẫu (${settings.englishDialect.toUpperCase()})`}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:text-brand-primary bg-slate-100 hover:bg-brand-primarySoft rounded-control transition-colors"
        >
          <span className="uppercase font-mono text-[11px]">{settings.englishDialect}</span>
        </button>

        {/* Quick Add Button */}
        <button
          onClick={onOpenQuickAdd}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-brand-primary hover:bg-brand-primaryHover rounded-control shadow-sm transition-all duration-150 active:scale-95"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Thêm từ</span>
        </button>

        {/* Profile Avatar & Interactive Popover */}
        <div className="relative pl-2 border-l border-slate-200" ref={popoverRef}>
          <button
            onClick={() => setPopoverOpen(!popoverOpen)}
            className="flex items-center gap-2 p-1 rounded-full hover:bg-slate-100/80 transition-colors focus:outline-none group"
            aria-label="Menu tài khoản cá nhân"
            aria-expanded={popoverOpen}
          >
            {/* Avatar with gradient and online status indicator */}
            <div className="relative">
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={settings.displayName}
                  className="w-8 h-8 rounded-full object-cover ring-2 ring-brand-primary/20 group-hover:ring-brand-primary/40 transition-all"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-primary to-indigo-500 text-white flex items-center justify-center font-bold text-xs shadow-xs ring-2 ring-brand-primary/20 group-hover:ring-brand-primary/40 transition-all">
                  {initialLetter}
                </div>
              )}
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full" />
            </div>

            <div className="hidden lg:flex items-center gap-1.5 text-left">
              <span className="text-xs font-semibold text-brand-ink max-w-[120px] truncate">
                {settings.displayName}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                  popoverOpen ? 'rotate-180 text-brand-primary' : ''
                }`}
              />
            </div>
          </button>

          {/* Animated Popover Menu */}
          <AnimatePresence>
            {popoverOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="absolute right-0 mt-2 w-72 bg-surface-base rounded-2xl shadow-elevated border border-slate-200/90 overflow-hidden z-50 divide-y divide-slate-100"
              >
                {/* User Header Summary */}
                <div className="p-4 bg-gradient-to-br from-brand-canvas/60 via-white to-white space-y-3">
                  <div className="flex items-center gap-3">
                    {user?.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={settings.displayName}
                        className="w-11 h-11 rounded-full object-cover shadow-md ring-2 ring-brand-primary/20"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-brand-primary to-indigo-600 text-white flex items-center justify-center font-extrabold text-sm shadow-md ring-2 ring-brand-primary/20">
                        {initialLetter}
                      </div>
                    )}
                    <div className="space-y-0.5 overflow-hidden">
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-bold text-sm text-brand-ink truncate">
                          {settings.displayName}
                        </h4>
                        <ShieldCheck className="w-3.5 h-3.5 text-brand-primary shrink-0" />
                      </div>
                      <p className="text-[11px] text-text-secondary truncate">
                        {user?.email || 'learner@vocelune.com'}
                      </p>
                      <div className="pt-0.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-primarySoft text-brand-primary">
                          <Sparkles className="w-2.5 h-2.5" />
                          <span>Học viên FSRS</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Micro Stats Strip */}
                  <div className="grid grid-cols-3 gap-1 bg-surface-subtle p-2 rounded-xl border border-slate-200/60 text-center">
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-text-secondary flex items-center justify-center gap-0.5">
                        <Flame className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                        <span>Chuỗi</span>
                      </span>
                      <span className="text-xs font-extrabold text-brand-ink">
                        {streak}d
                      </span>
                    </div>

                    <div className="space-y-0.5 border-x border-slate-200/60">
                      <span className="text-[10px] text-text-secondary flex items-center justify-center gap-0.5">
                        <BookOpen className="w-2.5 h-2.5 text-brand-primary" />
                        <span>Kho từ</span>
                      </span>
                      <span className="text-xs font-extrabold text-brand-ink">
                        {vocabItems.length}
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[10px] text-text-secondary flex items-center justify-center gap-0.5">
                        <TrendingUp className="w-2.5 h-2.5 text-emerald-600" />
                        <span>Tỷ lệ nhớ</span>
                      </span>
                      <span className="text-xs font-extrabold text-emerald-600">
                        {observedRetention !== null ? `${observedRetention}%` : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Navigation Links */}
                <div className="p-1.5 space-y-0.5 text-xs">
                  <Link
                    href="/profile"
                    onClick={() => setPopoverOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-700 hover:text-brand-ink hover:bg-slate-100 font-medium transition-colors"
                  >
                    <Settings className="w-4 h-4 text-slate-400" />
                    <span>Hồ sơ & Cài đặt hệ thống</span>
                  </Link>

                  <Link
                    href="/library"
                    onClick={() => setPopoverOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-700 hover:text-brand-ink hover:bg-slate-100 font-medium transition-colors"
                  >
                    <BookOpen className="w-4 h-4 text-slate-400" />
                    <span>Thư viện từ vựng & Chủ đề</span>
                  </Link>

                  <Link
                    href="/analytics"
                    onClick={() => setPopoverOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-700 hover:text-brand-ink hover:bg-slate-100 font-medium transition-colors"
                  >
                    <BarChart3 className="w-4 h-4 text-slate-400" />
                    <span>Phân tích & Tiến độ FSRS</span>
                  </Link>

                  <Link
                    href="/import"
                    onClick={() => setPopoverOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-700 hover:text-brand-ink hover:bg-slate-100 font-medium transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-slate-400" />
                    <span>Nhập / Xuất dữ liệu</span>
                  </Link>
                </div>

                {/* Notifications & Audio Feedback Settings */}
                <div className="p-2 space-y-1 bg-slate-50/70 border-t border-slate-100 text-xs">
                  <div className="px-2 py-1 flex items-center justify-between text-slate-600 font-semibold text-[11px] uppercase tracking-wider">
                    <span>Thông báo & Âm thanh</span>
                    <Bell className="w-3.5 h-3.5 text-brand-primary" />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      notify.success(
                        'Vocelune Push Notification',
                        'Âm thanh trực quan và thông báo đẩy đang hoạt động hoàn hảo!',
                        { browserPush: true }
                      );
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-brand-primary hover:bg-brand-primarySoft font-medium flex items-center justify-between transition-colors"
                  >
                    <span>Thử thông báo & chuông</span>
                    <Sparkles className="w-3.5 h-3.5" />
                  </button>

                  {browserPushSupported && browserPushPermission !== 'granted' && (
                    <button
                      type="button"
                      onClick={() => void requestBrowserPermission()}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 font-medium flex items-center justify-between transition-colors"
                    >
                      <span>Bật thông báo đẩy trình duyệt</span>
                      <ShieldCheck className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Footer Action: Logout */}
                <div className="p-1.5">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-rose-600 hover:bg-rose-50 font-semibold text-xs transition-colors"
                  >
                    <LogOut className="w-4 h-4 text-rose-500" />
                    <span>Đăng xuất tài khoản</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}

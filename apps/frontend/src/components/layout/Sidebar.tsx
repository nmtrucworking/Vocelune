'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Brain,
  BookOpen,
  CheckSquare,
  BarChart3,
  FileSpreadsheet,
  Settings,
  Sparkles,
  Flame,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  Users,
  Library,
  Database,
  Activity,
  ScrollText,
  Globe,
} from 'lucide-react';
import { Logo } from './Logo';
import { useVocelune } from '@/context/VoceluneContext';

interface SidebarProps {
  onCloseMobile?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({ onCloseMobile, collapsed = false, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { dueCards, streak, vocabItems, user } = useVocelune();
  const isAdmin = user?.role === 'admin';
  const [adminTab, setAdminTab] = useState<string>('overview');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      setAdminTab(params.get('tab') || 'overview');
    };
    syncFromUrl();
    const onTabEvent = (e: Event) => {
      const custom = e as CustomEvent<string>;
      if (custom.detail) setAdminTab(custom.detail);
    };
    window.addEventListener('popstate', syncFromUrl);
    window.addEventListener('vocelune-admin-tab', onTabEvent);
    return () => {
      window.removeEventListener('popstate', syncFromUrl);
      window.removeEventListener('vocelune-admin-tab', onTabEvent);
    };
  }, [pathname]);

  const handleAdminTabClick = (e: React.MouseEvent, tabId: string) => {
    onCloseMobile?.();
    setAdminTab(tabId);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('vocelune-admin-tab', { detail: tabId }));
      if (pathname === '/admin' || pathname === '/dashboard') {
        e.preventDefault();
        window.history.pushState(null, '', `/admin?tab=${tabId}`);
      } else {
        e.preventDefault();
        router.push(`/admin?tab=${tabId}`);
      }
    }
  };

  const learnerNavItems = [
    {
      href: '/dashboard',
      label: 'Tổng quan',
      icon: LayoutDashboard,
      badge: null,
      badgeColor: undefined as string | undefined,
      isActive: pathname === '/dashboard',
      adminTabId: undefined as string | undefined,
    },
    {
      href: '/study',
      label: 'Học SRS',
      icon: Brain,
      badge: dueCards.length > 0 ? `${dueCards.length}` : null,
      badgeColor: 'bg-brand-primary text-white',
      isActive: pathname.startsWith('/study'),
      adminTabId: undefined,
    },
    {
      href: '/library',
      label: 'Thư viện',
      icon: BookOpen,
      badge: `${vocabItems.length}`,
      badgeColor: 'bg-surface-muted text-text-secondary',
      isActive: pathname.startsWith('/library'),
      adminTabId: undefined,
    },
    {
      href: '/tests',
      label: 'Kiểm tra',
      icon: CheckSquare,
      badge: null,
      badgeColor: undefined,
      isActive: pathname.startsWith('/tests'),
      adminTabId: undefined,
    },
    {
      href: '/analytics',
      label: 'Phân tích',
      icon: BarChart3,
      badge: null,
      badgeColor: undefined,
      isActive: pathname.startsWith('/analytics'),
      adminTabId: undefined,
    },
    {
      href: '/import',
      label: 'Nhập / Xuất',
      icon: FileSpreadsheet,
      badge: null,
      badgeColor: undefined,
      isActive: pathname.startsWith('/import'),
      adminTabId: undefined,
    },
    {
      href: '/profile',
      label: 'Hồ sơ & Cài đặt',
      icon: Settings,
      badge: null,
      badgeColor: undefined,
      isActive: pathname.startsWith('/profile'),
      adminTabId: undefined,
    },
  ];

  const isOnAdminView = pathname === '/admin' || pathname === '/dashboard';

  const adminNavItems = [
    {
      href: '/admin?tab=overview',
      label: 'Tổng quan hệ thống',
      icon: LayoutDashboard,
      badge: null,
      badgeColor: undefined as string | undefined,
      isActive: isOnAdminView && adminTab === 'overview',
      adminTabId: 'overview',
    },
    {
      href: '/admin?tab=users',
      label: 'Người dùng & Quyền',
      icon: Users,
      badge: null,
      badgeColor: undefined,
      isActive: isOnAdminView && adminTab === 'users',
      adminTabId: 'users',
    },
    {
      href: '/admin?tab=decks',
      label: 'Bộ từ công khai',
      icon: Library,
      badge: null,
      badgeColor: undefined,
      isActive: isOnAdminView && adminTab === 'decks',
      adminTabId: 'decks',
    },
    {
      href: '/admin?tab=dictionary',
      label: 'API Từ điển & Kho từ',
      icon: Database,
      badge: 'API',
      badgeColor: 'bg-brand-primarySoft text-brand-primary',
      isActive: isOnAdminView && adminTab === 'dictionary',
      adminTabId: 'dictionary',
    },
    {
      href: '/admin?tab=operations',
      label: 'Vận hành & Hàng đợi',
      icon: Activity,
      badge: null,
      badgeColor: undefined,
      isActive: isOnAdminView && adminTab === 'operations',
      adminTabId: 'operations',
    },
    {
      href: '/admin?tab=audit',
      label: 'Nhật ký kiểm toán',
      icon: ScrollText,
      badge: null,
      badgeColor: undefined,
      isActive: isOnAdminView && adminTab === 'audit',
      adminTabId: 'audit',
    },
    {
      href: '/profile',
      label: 'Hồ sơ Quản trị viên',
      icon: ShieldCheck,
      badge: null,
      badgeColor: undefined,
      isActive: pathname.startsWith('/profile'),
      adminTabId: undefined,
    },
    {
      href: '/explore',
      label: 'Trang khám phá (Public)',
      icon: Globe,
      badge: null,
      badgeColor: undefined,
      isActive: pathname.startsWith('/explore'),
      adminTabId: undefined,
    },
  ];

  const navItems = isAdmin ? adminNavItems : learnerNavItems;

  return (
    <aside
      className={`h-full bg-surface-base border-r border-slate-200/80 flex flex-col justify-between select-none transition-all duration-200 ${
        collapsed ? 'w-14 py-3 px-1.5 items-center' : 'w-52 py-3 px-2.5'
      }`}
    >
      <div className={`space-y-3 w-full ${collapsed ? 'flex flex-col items-center' : ''}`}>
        {/* Brand Logo & Collapse Toggle */}
        <div className={`flex items-center ${collapsed ? 'justify-center w-full px-0' : 'justify-between px-1'}`}>
          <Logo size="sm" showTagline={!collapsed} iconOnly={collapsed} href={isAdmin ? '/admin' : '/dashboard'} />
          {!collapsed && onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-1 rounded-md text-slate-400 hover:text-brand-ink hover:bg-slate-100 transition-colors"
              title="Thu gọn thanh điều hướng"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Role Section Label */}
        {!collapsed && (
          <div className="px-2 pt-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {isAdmin ? 'Quản trị Website' : 'Không gian học tập'}
            </span>
          </div>
        )}

        {/* Navigation Links */}
        <nav className="space-y-0.5 w-full">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.isActive;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={(e) => {
                  if (item.adminTabId) {
                    handleAdminTabClick(e, item.adminTabId);
                  } else {
                    onCloseMobile?.();
                  }
                }}
                title={collapsed ? `${item.label}${item.badge ? ` (${item.badge})` : ''}` : undefined}
                className={`relative flex items-center rounded-lg font-medium text-xs transition-all duration-150 group ${
                  collapsed
                    ? 'justify-center p-2 my-0.5'
                    : 'justify-between px-2.5 py-1.5'
                } ${
                  isActive
                    ? 'bg-brand-primarySoft text-brand-primary font-semibold shadow-2xs'
                    : 'text-text-secondary hover:text-brand-ink hover:bg-slate-50'
                }`}
              >
                <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-2'}`}>
                  <Icon
                    className={`w-3.5 h-3.5 transition-colors shrink-0 ${
                      isActive ? 'text-brand-primary' : 'text-slate-400 group-hover:text-brand-ink'
                    }`}
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </div>

                {item.badge && (
                  collapsed ? (
                    <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-brand-primary ring-2 ring-white" />
                  ) : (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold font-mono ${
                        item.badgeColor || 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Summary Card */}
      <div className={`pt-2.5 border-t border-slate-100 w-full ${collapsed ? 'flex flex-col items-center space-y-1.5' : 'space-y-2'}`}>
        {/* Toggle Expand button when collapsed */}
        {collapsed && onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-md text-slate-400 hover:text-brand-ink hover:bg-slate-100 transition-colors"
            title="Mở rộng thanh điều hướng"
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen className="w-3.5 h-3.5" />
          </button>
        )}

        {isAdmin ? (
          <>
            <div
              title="Chế độ Quản trị Hệ thống Vocelune"
              className={`flex items-center rounded-lg bg-indigo-50/90 border border-indigo-200/70 text-indigo-950 ${
                collapsed ? 'p-1.5 justify-center' : 'justify-between px-2.5 py-1.5 text-[11px]'
              }`}
            >
              <div className="flex items-center gap-1.5 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-brand-primary shrink-0" />
                {!collapsed && <span>Quyền hạn:</span>}
              </div>
              {!collapsed && <span className="font-bold text-brand-primary text-[10px] uppercase tracking-wider">Root Admin</span>}
            </div>
            {!collapsed && (
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/70 text-[10px] text-text-secondary leading-snug space-y-1">
                <div className="font-semibold text-brand-ink">Trung tâm Điều hành</div>
                <p>Quản lý người dùng, kho từ công khai, quota API từ điển và kiểm toán hệ thống.</p>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Streak Indicator */}
            <div
              title={`Chuỗi ngày học: ${streak} ngày liên tục`}
              className={`flex items-center rounded-lg bg-amber-50/80 border border-amber-200/60 text-amber-900 ${
                collapsed ? 'p-1.5 justify-center' : 'justify-between px-2 py-1 text-[11px]'
              }`}
            >
              <div className="flex items-center gap-1.5 font-medium">
                <Flame className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
                {!collapsed && <span>Chuỗi:</span>}
              </div>
              <span className="font-bold text-amber-800 text-[11px] font-mono">{streak}{collapsed ? 'd' : ' ngày'}</span>
            </div>

            {/* Quick Review Prompt if cards due */}
            {dueCards.length > 0 && !collapsed && (
              <div className="p-2 rounded-lg bg-brand-primarySoft/60 border border-brand-primary/20 text-[11px] space-y-1">
                <div className="flex items-center gap-1 font-semibold text-brand-primary text-[10px]">
                  <Sparkles className="w-2.5 h-2.5" />
                  <span>Đến hạn ôn tập</span>
                </div>
                <p className="text-text-secondary text-[10px] leading-tight">
                  Có <strong>{dueCards.length} thẻ</strong> cần ôn hôm nay.
                </p>
                <Link
                  href="/study"
                  className="block text-center py-0.5 px-2 bg-brand-primary text-white rounded font-medium text-[10px] hover:bg-brand-primaryHover transition-colors shadow-2xs"
                >
                  Ôn ngay
                </Link>
              </div>
            )}
          </>
        )}

        {!collapsed && (
          <div className="text-[9px] text-slate-400 text-center">
            {isAdmin ? 'Vocelune Admin Console v1.0' : 'Vocelune v1.0 • FSRS-6'}
          </div>
        )}
      </div>
    </aside>
  );
}

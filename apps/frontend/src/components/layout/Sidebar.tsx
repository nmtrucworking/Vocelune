'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  const { dueCards, streak, vocabItems } = useVocelune();

  const navItems = [
    {
      href: '/dashboard',
      label: 'Tổng quan',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      href: '/study',
      label: 'Học SRS',
      icon: Brain,
      badge: dueCards.length > 0 ? `${dueCards.length}` : null,
      badgeColor: 'bg-brand-primary text-white',
      highlight: dueCards.length > 0,
    },
    {
      href: '/library',
      label: 'Thư viện',
      icon: BookOpen,
      badge: `${vocabItems.length}`,
      badgeColor: 'bg-surface-muted text-text-secondary',
    },
    {
      href: '/tests',
      label: 'Kiểm tra',
      icon: CheckSquare,
      badge: null,
    },
    {
      href: '/analytics',
      label: 'Phân tích',
      icon: BarChart3,
      badge: null,
    },
    {
      href: '/import',
      label: 'Nhập / Xuất',
      icon: FileSpreadsheet,
      badge: null,
    },
    {
      href: '/profile',
      label: 'Hồ sơ & Cài đặt',
      icon: Settings,
      badge: null,
    },
  ];

  return (
    <aside
      className={`h-full bg-surface-base border-r border-slate-200/80 flex flex-col justify-between select-none transition-all duration-200 ${
        collapsed ? 'w-18 py-4 px-2 items-center' : 'w-60 py-4 px-3.5'
      }`}
    >
      <div className={`space-y-4 w-full ${collapsed ? 'flex flex-col items-center' : ''}`}>
        {/* Brand Logo & Collapse Toggle */}
        <div className={`flex items-center ${collapsed ? 'justify-center w-full px-0' : 'justify-between px-1.5'}`}>
          <Logo size="sm" showTagline={!collapsed} iconOnly={collapsed} href="/dashboard" />
          {!collapsed && onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-1 rounded-md text-slate-400 hover:text-brand-ink hover:bg-slate-100 transition-colors"
              title="Thu gọn thanh điều hướng"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1 w-full">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onCloseMobile}
                title={collapsed ? `${item.label}${item.badge ? ` (${item.badge})` : ''}` : undefined}
                className={`relative flex items-center rounded-control font-medium text-[13px] transition-all duration-150 group ${
                  collapsed
                    ? 'justify-center p-2.5 my-1'
                    : 'justify-between px-3 py-2'
                } ${
                  isActive
                    ? 'bg-brand-primarySoft text-brand-primary font-semibold shadow-xs'
                    : 'text-text-secondary hover:text-brand-ink hover:bg-slate-50'
                }`}
              >
                <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-2.5'}`}>
                  <Icon
                    className={`w-4 h-4 transition-colors shrink-0 ${
                      isActive ? 'text-brand-primary' : 'text-slate-400 group-hover:text-brand-ink'
                    }`}
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </div>

                {item.badge && (
                  collapsed ? (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-brand-primary ring-2 ring-white" />
                  ) : (
                    <span
                      className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold font-mono ${
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
      <div className={`pt-3 border-t border-slate-100 w-full ${collapsed ? 'flex flex-col items-center space-y-2' : 'space-y-2.5'}`}>
        {/* Toggle Expand button when collapsed */}
        {collapsed && onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="p-2 rounded-lg text-slate-400 hover:text-brand-ink hover:bg-slate-100 transition-colors"
            title="Mở rộng thanh điều hướng"
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen className="w-4.5 h-4.5" />
          </button>
        )}

        {/* Streak Indicator */}
        <div
          title={`Chuỗi ngày học: ${streak} ngày liên tục`}
          className={`flex items-center rounded-control bg-amber-50/80 border border-amber-200/60 text-amber-900 ${
            collapsed ? 'p-2 justify-center' : 'justify-between px-2.5 py-1.5 text-xs'
          }`}
        >
          <div className="flex items-center gap-1.5 font-medium">
            <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
            {!collapsed && <span className="text-[11px]">Chuỗi ngày:</span>}
          </div>
          <span className="font-bold text-amber-800 text-xs font-mono">{streak}{collapsed ? 'd' : ' ngày'}</span>
        </div>

        {/* Quick Review Prompt if cards due */}
        {dueCards.length > 0 && !collapsed && (
          <div className="p-2.5 rounded-control bg-brand-primarySoft/60 border border-brand-primary/20 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-brand-primary text-[11px]">
              <Sparkles className="w-3 h-3" />
              <span>Đến hạn ôn tập</span>
            </div>
            <p className="text-text-secondary text-[11px] leading-tight">
              Có <strong>{dueCards.length} thẻ</strong> sẵn sàng củng cố hôm nay.
            </p>
            <Link
              href="/study"
              className="block text-center py-1 px-2 bg-brand-primary text-white rounded-md font-medium text-[11px] hover:bg-brand-primaryHover transition-colors shadow-xs"
            >
              Ôn ngay
            </Link>
          </div>
        )}

        {!collapsed && (
          <div className="px-1 text-[10px] text-slate-400 text-center">
            Vocelune v1.0 • FSRS-6
          </div>
        )}
      </div>
    </aside>
  );
}

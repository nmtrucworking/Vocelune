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
} from 'lucide-react';
import { Logo } from './Logo';
import { useVocelune } from '@/context/VoceluneContext';

interface SidebarProps {
  onCloseMobile?: () => void;
}

export function Sidebar({ onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const { dueCards, streak, vocabItems } = useVocelune();

  const navItems = [
    {
      href: '/app/dashboard',
      label: 'Tổng quan',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      href: '/app/study',
      label: 'Học SRS',
      icon: Brain,
      badge: dueCards.length > 0 ? `${dueCards.length}` : null,
      badgeColor: 'bg-brand-primary text-white',
      highlight: dueCards.length > 0,
    },
    {
      href: '/app/library',
      label: 'Thư viện',
      icon: BookOpen,
      badge: `${vocabItems.length}`,
      badgeColor: 'bg-surface-muted text-text-secondary',
    },
    {
      href: '/app/tests',
      label: 'Kiểm tra',
      icon: CheckSquare,
      badge: null,
    },
    {
      href: '/app/analytics',
      label: 'Phân tích',
      icon: BarChart3,
      badge: null,
    },
    {
      href: '/app/import',
      label: 'Nhập / Xuất',
      icon: FileSpreadsheet,
      badge: null,
    },
    {
      href: '/app/profile',
      label: 'Hồ sơ & Cài đặt',
      icon: Settings,
      badge: null,
    },
  ];

  return (
    <aside className="w-64 h-full bg-surface-base border-r border-slate-200/80 flex flex-col justify-between py-5 px-4 select-none">
      <div className="space-y-6">
        {/* Brand Logo */}
        <div className="px-2">
          <Logo size="md" showTagline />
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/app/dashboard' && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onCloseMobile}
                className={`flex items-center justify-between px-3 py-2.5 rounded-control font-medium text-sm transition-all duration-150 ${
                  isActive
                    ? 'bg-brand-primarySoft text-brand-primary font-semibold shadow-xs'
                    : 'text-text-secondary hover:text-brand-ink hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4.5 h-4.5 transition-colors ${
                      isActive ? 'text-brand-primary' : 'text-slate-400 group-hover:text-brand-ink'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                {item.badge && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      item.badgeColor || 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Summary Card */}
      <div className="pt-4 border-t border-slate-100 space-y-3">
        {/* Streak Indicator */}
        <div className="flex items-center justify-between px-3 py-2 rounded-control bg-amber-50/80 border border-amber-200/60 text-amber-900 text-xs">
          <div className="flex items-center gap-2 font-medium">
            <Flame className="w-4 h-4 text-amber-500 fill-amber-500" />
            <span>Chuỗi ngày học:</span>
          </div>
          <span className="font-bold text-amber-800">{streak} ngày</span>
        </div>

        {/* Quick Review Prompt if cards due */}
        {dueCards.length > 0 && (
          <div className="p-3 rounded-control bg-brand-primarySoft/60 border border-brand-primary/20 text-xs space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-brand-primary">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Đến hạn ôn tập</span>
            </div>
            <p className="text-text-secondary text-[11px] leading-relaxed">
              Bạn có <strong>{dueCards.length} thẻ</strong> sẵn sàng để củng cố trí nhớ hôm nay.
            </p>
            <Link
              href="/app/study"
              className="block text-center py-1.5 px-2 bg-brand-primary text-white rounded-lg font-medium text-xs hover:bg-brand-primaryHover transition-colors shadow-xs"
            >
              Ôn ngay
            </Link>
          </div>
        )}

        <div className="px-2 text-[11px] text-slate-400 text-center">
          Vocelune v1.0 • FSRS-6 Engine
        </div>
      </div>
    </aside>
  );
}

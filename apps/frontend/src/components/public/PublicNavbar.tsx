'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Menu,
  X,
  ArrowRight,
  BookOpen,
  Sparkles,
  Layers,
  GraduationCap,
  LogIn,
  User,
} from 'lucide-react';
import { Logo } from '@/components/layout/Logo';
import { useVocelune } from '@/context/VoceluneContext';

interface PublicNavbarProps {
  activeSection?: string;
}

export function PublicNavbar({ activeSection }: PublicNavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user } = useVocelune();
  const pathname = usePathname();

  const navLinks = [
    { label: 'Phương pháp FSRS', href: '/#methodology' },
    { label: 'Tính năng', href: '/#features' },
    { label: 'Kho từ vựng', href: '/explore', isRoute: true },
    { label: 'So sánh', href: '/#comparison' },
    { label: 'Hỏi đáp', href: '/#faq' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/70 bg-surface-base/85 backdrop-blur-md transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        {/* Logo */}
        <Logo size="md" showTagline href="/" />

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-2">
          {navLinks.map((link) => {
            const isCurrent = link.isRoute
              ? pathname === link.href
              : false;

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  isCurrent
                    ? 'text-brand-primary bg-brand-primarySoft'
                    : 'text-text-secondary hover:text-brand-ink hover:bg-slate-100/70'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Right CTA / Auth Status */}
        <div className="hidden sm:flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-secondary font-medium hidden lg:inline">
                Xin chào, <strong className="text-brand-ink">{user.displayName || user.email.split('@')[0]}</strong>
              </span>
              <Link
                href="/app/dashboard"
                className="px-4 py-2 bg-brand-primary hover:bg-brand-primaryHover text-white rounded-control font-semibold text-xs shadow-sm transition-all flex items-center gap-1.5 group"
              >
                <span>Vào bàn học</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <Link
                href="/login"
                className="text-xs font-semibold text-text-secondary hover:text-brand-ink px-3 py-2 transition-colors rounded-lg hover:bg-slate-100/60"
              >
                Đăng nhập
              </Link>
              <Link
                href="/register"
                className="px-4 py-2 bg-brand-primary hover:bg-brand-primaryHover text-white rounded-control font-semibold text-xs shadow-sm transition-all duration-150 flex items-center gap-1.5 group"
              >
                <span>Bắt đầu học</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          )}
        </div>

        {/* Mobile menu button */}
        <div className="flex sm:hidden items-center gap-2">
          {user && (
            <Link
              href="/app/dashboard"
              className="p-2 text-brand-primary bg-brand-primarySoft rounded-lg text-xs font-semibold"
              title="Vào bàn học"
            >
              <User className="w-4 h-4" />
            </Link>
          )}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-text-secondary hover:text-brand-ink hover:bg-slate-100 transition-colors"
            aria-label="Mở bảng điều hướng"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-200 bg-surface-base px-5 py-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-150 shadow-lg">
          <nav className="flex flex-col space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:text-brand-ink hover:bg-slate-50 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
            {user ? (
              <Link
                href="/app/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full py-2.5 px-4 bg-brand-primary text-white rounded-control font-semibold text-sm text-center flex items-center justify-center gap-2 shadow-sm"
              >
                <span>Vào bàn học cá nhân</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-brand-ink rounded-control font-semibold text-sm text-center transition-colors"
                >
                  Đăng nhập
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-2.5 px-4 bg-brand-primary hover:bg-brand-primaryHover text-white rounded-control font-semibold text-sm text-center flex items-center justify-center gap-2 shadow-sm transition-colors"
                >
                  <span>Bắt đầu học miễn phí</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

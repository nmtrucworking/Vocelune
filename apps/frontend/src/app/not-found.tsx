import React from 'react';
import Link from 'next/link';
import { Compass, Home, BookOpen, ArrowRight, LayoutDashboard, LogIn } from 'lucide-react';
import { Logo } from '@/components/layout/Logo';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-brand-canvas flex flex-col items-center justify-center p-6 text-center selection:bg-brand-primarySoft selection:text-brand-primary">
      <div className="w-full max-w-md bg-surface-base border border-slate-200/90 rounded-card shadow-card p-8 space-y-6">
        {/* Brand */}
        <div className="flex justify-center">
          <Logo size="md" showTagline href="/" />
        </div>

        {/* 404 Orbital Badge */}
        <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-2 border-dashed border-brand-primary/30 animate-spin" style={{ animationDuration: '12s' }} />
          <div className="w-16 h-16 rounded-full bg-brand-primarySoft text-brand-primary flex items-center justify-center font-extrabold text-2xl shadow-sm">
            404
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-extrabold text-brand-ink">
            Trang không tồn tại
          </h1>
          <p className="text-xs text-text-secondary leading-relaxed">
            Đường dẫn bạn yêu cầu không tồn tại hoặc đã được thay đổi cấu trúc. Hãy thử truy cập một trong các liên kết dưới đây:
          </p>
        </div>

        {/* Quick Nav Buttons */}
        <div className="grid grid-cols-1 gap-2.5 pt-2 text-left">
          <Link
            href="/"
            className="flex items-center justify-between p-3 rounded-control bg-slate-50 hover:bg-slate-100 border border-slate-200/70 text-xs font-semibold text-brand-ink transition-colors group"
          >
            <div className="flex items-center gap-2.5">
              <Home className="w-4 h-4 text-brand-primary" />
              <span>Trang chủ Vocelune</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </Link>

          <Link
            href="/explore"
            className="flex items-center justify-between p-3 rounded-control bg-slate-50 hover:bg-slate-100 border border-slate-200/70 text-xs font-semibold text-brand-ink transition-colors group"
          >
            <div className="flex items-center gap-2.5">
              <BookOpen className="w-4 h-4 text-emerald-600" />
              <span>Khám phá bộ từ vựng công khai</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </Link>

          <Link
            href="/app/dashboard"
            className="flex items-center justify-between p-3 rounded-control bg-brand-primarySoft hover:bg-brand-primarySoft/80 border border-brand-primary/20 text-xs font-semibold text-brand-primary transition-colors group"
          >
            <div className="flex items-center gap-2.5">
              <LayoutDashboard className="w-4 h-4 text-brand-primary" />
              <span>Vào bàn học cá nhân</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-brand-primary group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </div>

      <div className="mt-8 text-xs text-text-secondary">
        Vocelune • EVLP-SRS-001 Compliant Platform
      </div>
    </div>
  );
}

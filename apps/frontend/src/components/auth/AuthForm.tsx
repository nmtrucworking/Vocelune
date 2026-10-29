'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Mail,
  Lock,
  User as UserIcon,
  HelpCircle,
  ArrowLeft,
} from 'lucide-react';
import { useVocelune } from '@/context/VoceluneContext';
import { post } from '@/lib/api';
import { Logo } from '@/components/layout/Logo';

interface AuthFormProps {
  initialMode?: 'login' | 'register' | 'forgot';
  redirectTo?: string;
  isStandalone?: boolean;
}

export function AuthForm({
  initialMode = 'login',
  redirectTo,
  isStandalone = false,
}: AuthFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, user } = useVocelune();

  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'error' | 'success' } | null>(null);

  const destination = redirectTo || searchParams.get('redirect') || '/dashboard';

  // If already logged in, redirect
  useEffect(() => {
    if (user && isStandalone) {
      router.push(destination);
    }
  }, [user, isStandalone, router, destination]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);

    try {
      if (mode === 'forgot') {
        const result = await post<{ message: string }>('/auth/password/forgot', { email });
        setMessage({
          type: 'success',
          text: result.message || 'Đã gửi liên kết hướng dẫn đặt lại mật khẩu đến email của bạn.',
        });
      } else {
        await login(email.trim(), password, mode === 'register' ? name.trim() : undefined);
        router.push(destination);
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Không thể kết nối máy chủ hoặc thông tin chưa chính xác.',
      });
    } finally {
      setBusy(false);
    }
  };

  const containerContent = (
    <div className="w-full max-w-md mx-auto">
      {/* Back to home on standalone */}
      {isStandalone && (
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-brand-ink transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            <span>Trở về trang chủ</span>
          </Link>
        </div>
      )}

      {/* Card container */}
      <div className="bg-surface-base rounded-card border border-slate-200/90 shadow-card p-6 sm:p-8 space-y-6">
        {/* Brand header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <Logo size="md" showTagline href="/" />
          </div>

          <h2 className="text-xl font-extrabold text-brand-ink pt-2">
            {mode === 'login' && 'Đăng nhập vào Vocelune'}
            {mode === 'register' && 'Tạo tài khoản học từ vựng'}
            {mode === 'forgot' && 'Khôi phục mật khẩu'}
          </h2>

          <p className="text-xs text-text-secondary max-w-xs mx-auto">
            {mode === 'login' && 'Tiếp tục lộ trình ôn tập thích ứng FSRS và lưu giữ vốn từ dài hạn.'}
            {mode === 'register' && 'Bắt đầu học miễn phí với thuật toán FSRS-6 và kho từ vựng chuẩn.'}
            {mode === 'forgot' && 'Nhập email tài khoản để nhận đường dẫn đặt lại mật khẩu.'}
          </p>
        </div>

        {/* Mode Switcher Tabs (Only if not in forgot mode) */}
        {mode !== 'forgot' && (
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setMessage(null);
              }}
              className={`py-2 rounded-lg transition-all ${
                mode === 'login'
                  ? 'bg-surface-base text-brand-primary shadow-xs'
                  : 'text-text-secondary hover:text-brand-ink'
              }`}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setMessage(null);
              }}
              className={`py-2 rounded-lg transition-all ${
                mode === 'register'
                  ? 'bg-surface-base text-brand-primary shadow-xs'
                  : 'text-text-secondary hover:text-brand-ink'
              }`}
            >
              Đăng ký mới
            </button>
          </div>
        )}

        {/* Message Alert */}
        {message && (
          <div
            role="status"
            className={`p-3.5 rounded-control text-xs flex items-start gap-2.5 ${
              message.type === 'error'
                ? 'bg-rose-50 border border-rose-200 text-rose-800'
                : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
            }`}
          >
            {message.type === 'error' ? (
              <span className="w-1.5 h-1.5 rounded-full bg-rose-600 mt-1.5 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            )}
            <p className="leading-relaxed">{message.text}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Display Name field (register only) */}
          {mode === 'register' && (
            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-bold text-brand-ink">
                Tên hiển thị của bạn
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nhập tên hiển thị của bạn"
                  className="w-full pl-9 pr-3 py-2.5 bg-brand-canvas/60 border border-slate-200 rounded-control text-xs text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all"
                  autoComplete="name"
                />
              </div>
            </div>
          )}

          {/* Email field */}
          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-bold text-brand-ink">
              Địa chỉ Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                required
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tenban@domain.com"
                className="w-full pl-9 pr-3 py-2.5 bg-brand-canvas/60 border border-slate-200 rounded-control text-xs text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all"
                autoComplete="email"
              />
            </div>
          </div>

          {/* Password field */}
          {mode !== 'forgot' && (
            <div className="space-y-1.5 text-left">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-brand-ink">
                  Mật khẩu
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setMessage(null);
                    }}
                    className="text-[11px] font-semibold text-brand-primary hover:text-brand-primaryHover transition-colors"
                  >
                    Quên mật khẩu?
                  </button>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={12}
                  maxLength={128}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-10 py-2.5 bg-brand-canvas/60 border border-slate-200 rounded-control text-xs text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all font-mono"
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex items-center justify-between text-[11px] text-text-secondary pt-0.5">
                <span>Yêu cầu ít nhất 12 ký tự bảo mật.</span>
                {password.length > 0 && (
                  <span
                    className={`font-semibold ${
                      password.length >= 12 ? 'text-emerald-600' : 'text-amber-600'
                    }`}
                  >
                    {password.length}/12 ký tự
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={busy || (mode !== 'forgot' && password.length < 12)}
            className="w-full py-3 px-4 bg-brand-primary hover:bg-brand-primaryHover disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-control shadow-sm transition-all duration-150 flex items-center justify-center gap-2 group active:scale-[0.99]"
          >
            {busy ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>
                  {mode === 'forgot'
                    ? 'Gửi hướng dẫn đặt lại mật khẩu'
                    : mode === 'register'
                    ? 'Tạo tài khoản và bắt đầu học'
                    : 'Đăng nhập vào tài khoản'}
                </span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </button>
        </form>

        {/* Footer toggles */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-center text-xs text-text-secondary">
          {mode === 'forgot' ? (
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setMessage(null);
              }}
              className="text-brand-primary font-semibold hover:underline"
            >
              ← Quay lại đăng nhập
            </button>
          ) : (
            <span>
              {mode === 'login' ? 'Chưa có tài khoản? ' : 'Đã có tài khoản? '}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'login' ? 'register' : 'login');
                  setMessage(null);
                }}
                className="font-bold text-brand-primary hover:underline ml-1"
              >
                {mode === 'login' ? 'Đăng ký ngay' : 'Đăng nhập'}
              </button>
            </span>
          )}
        </div>
      </div>

      {/* Trust pill below card */}
      <div className="mt-6 text-center text-xs text-text-secondary flex items-center justify-center gap-4">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Bảo mật chuẩn EVLP-SRS-001</span>
        </div>
        <span>•</span>
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-brand-primary" />
          <span>Miễn phí 100%</span>
        </div>
      </div>
    </div>
  );

  if (isStandalone) {
    return (
      <div className="min-h-screen bg-brand-canvas flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 selection:bg-brand-primarySoft selection:text-brand-primary">
        {containerContent}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-canvas flex flex-col items-center justify-center p-4 selection:bg-brand-primarySoft selection:text-brand-primary">
      {containerContent}
    </div>
  );
}

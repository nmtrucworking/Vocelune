'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  KeyRound,
} from 'lucide-react';
import { Logo } from '@/components/layout/Logo';
import { post } from '@/lib/api';

function ResetPasswordForm() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'error' | 'success' } | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Check both hash params and search params
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const searchParams = new URLSearchParams(window.location.search);
    const resolvedToken = hashParams.get('token') || searchParams.get('token') || '';
    setToken(resolvedToken);

    // Clean sensitive token from URL history
    if (resolvedToken) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    if (!token) {
      setMessage({
        type: 'error',
        text: 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu lại.',
      });
      return;
    }

    if (password !== confirmPassword) {
      setMessage({
        type: 'error',
        text: 'Mật khẩu xác nhận không khớp. Vui lòng kiểm tra lại.',
      });
      return;
    }

    if (password.length < 12) {
      setMessage({
        type: 'error',
        text: 'Mật khẩu phải có độ dài tối thiểu 12 ký tự.',
      });
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      await post('/auth/password/reset', { token, password });
      setDone(true);
      setMessage({
        type: 'success',
        text: 'Đã đổi mật khẩu thành công! Bạn có thể sử dụng mật khẩu mới để đăng nhập.',
      });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Không thể đặt lại mật khẩu. Liên kết có thể đã hết hạn.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Back button */}
      <div className="mb-6">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-brand-ink transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          <span>Quay lại đăng nhập</span>
        </Link>
      </div>

      <div className="bg-surface-base rounded-card border border-slate-200/90 shadow-card p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <Logo size="md" showTagline href="/" />
          </div>

          <div className="w-12 h-12 rounded-full bg-brand-primarySoft text-brand-primary mx-auto flex items-center justify-center mt-2">
            <KeyRound className="w-6 h-6" />
          </div>

          <h1 className="text-xl font-extrabold text-brand-ink">
            Thiết lập mật khẩu mới
          </h1>

          <p className="text-xs text-text-secondary max-w-xs mx-auto">
            Nhập mật khẩu an toàn mới cho tài khoản Vocelune của bạn (tối thiểu 12 ký tự).
          </p>
        </div>

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
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            )}
            <p className="leading-relaxed">{message.text}</p>
          </div>
        )}

        {/* No token alert */}
        {!token && !done && (
          <div className="p-3.5 rounded-control text-xs bg-amber-50 border border-amber-200 text-amber-800 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Không tìm thấy mã xác thực (token). Nếu bạn vừa mở từ email, hãy đảm bảo liên kết được sao chép đầy đủ.
            </p>
          </div>
        )}

        {!done ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* New Password */}
            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-bold text-brand-ink">
                Mật khẩu mới
              </label>
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
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-bold text-brand-ink">
                Xác nhận lại mật khẩu mới
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={12}
                  maxLength={128}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-10 py-2.5 bg-brand-canvas/60 border border-slate-200 rounded-control text-xs text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all font-mono"
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div className="text-[11px] text-text-secondary">
              Mật khẩu phải chứa ít nhất 12 ký tự để đảm bảo an toàn.
            </div>

            <button
              type="submit"
              disabled={busy || !token || password.length < 12}
              className="w-full py-3 px-4 bg-brand-primary hover:bg-brand-primaryHover disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-control shadow-sm transition-all duration-150 flex items-center justify-center gap-2 group active:scale-[0.99]"
            >
              {busy ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Lưu mật khẩu mới</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>
        ) : (
          <div className="pt-2">
            <Link
              href="/login"
              className="w-full py-3 px-4 bg-brand-primary hover:bg-brand-primaryHover text-white font-bold text-xs rounded-control shadow-sm transition-all flex items-center justify-center gap-2"
            >
              <span>Tiến hành đăng nhập</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen bg-brand-canvas flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 selection:bg-brand-primarySoft selection:text-brand-primary">
      <Suspense
        fallback={
          <div className="w-8 h-8 rounded-full border-2 border-brand-primary/20 border-t-brand-primary animate-spin mx-auto" />
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}

'use client';
import { useState } from 'react';
import { useVocelune } from '@/context/VoceluneContext';
import { post } from '@/lib/api';
export function AuthForm() {
  const { login } = useVocelune();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [name, setName] = useState('');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  return <div className="min-h-screen bg-brand-canvas grid place-items-center p-6"><form className="bg-white rounded-2xl border p-8 w-full max-w-md space-y-4 shadow-card" onSubmit={async e => {
    e.preventDefault(); if (busy) return; setBusy(true); setMessage('');
    try {
      if (mode === 'forgot') { const result = await post<{ message: string }>('/auth/password/forgot', { email }); setMessage(result.message); }
      else await login(email, password, mode === 'register' ? name : undefined);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Không thể kết nối máy chủ.'); } finally { setBusy(false); }
  }}>
    <h1 className="text-2xl font-bold text-brand-primary">Vocelune</h1>
    <h2 className="font-semibold">{mode === 'login' ? 'Đăng nhập để tiếp tục học' : mode === 'register' ? 'Tạo tài khoản của bạn' : 'Đặt lại mật khẩu'}</h2>
    {mode === 'register' && <label className="block text-sm">Tên hiển thị<input required maxLength={100} value={name} onChange={e => setName(e.target.value)} className="mt-1 block w-full border rounded-lg p-3" autoComplete="name" /></label>}
    <label className="block text-sm">Email<input type="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} className="mt-1 block w-full border rounded-lg p-3" autoComplete="email" /></label>
    {mode !== 'forgot' && <label className="block text-sm">Mật khẩu<input type="password" required minLength={12} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} className="mt-1 block w-full border rounded-lg p-3" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} /><span className="text-xs text-slate-500">Ít nhất 12 ký tự.</span></label>}
    {message && <p role="status" className="text-sm text-rose-700">{message}</p>}
    <button disabled={busy} className="w-full bg-brand-primary text-white rounded-lg p-3 font-semibold disabled:opacity-50">{busy ? 'Đang xử lý…' : mode === 'forgot' ? 'Gửi hướng dẫn' : mode === 'register' ? 'Đăng ký' : 'Đăng nhập'}</button>
    <div className="flex justify-between text-xs text-brand-primary"><button type="button" onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setMessage(''); }}>{mode === 'register' ? 'Đã có tài khoản' : 'Tạo tài khoản'}</button><button type="button" onClick={() => { setMode(mode === 'forgot' ? 'login' : 'forgot'); setMessage(''); }}>{mode === 'forgot' ? 'Đăng nhập' : 'Quên mật khẩu'}</button></div>
  </form></div>;
}

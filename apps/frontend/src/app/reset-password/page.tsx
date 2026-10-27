'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { post } from '@/lib/api';
export default function ResetPasswordPage() {
  const [token, setToken] = useState(''), [password, setPassword] = useState(''), [message, setMessage] = useState(''), [done, setDone] = useState(false);
  useEffect(() => { setToken(new URLSearchParams(location.hash.slice(1)).get('token') || ''); history.replaceState(null, '', location.pathname); }, []);
  return <main className="min-h-screen grid place-items-center bg-brand-canvas p-6"><form className="max-w-md w-full space-y-4 bg-white border rounded-2xl p-8" onSubmit={async e => {
    e.preventDefault(); try { await post('/auth/password/reset', { token, password }); setDone(true); setMessage('Đã đổi mật khẩu. Vui lòng đăng nhập lại.'); } catch (err) { setMessage(err instanceof Error ? err.message : 'Không thể đặt lại mật khẩu.'); }
  }}><h1 className="font-bold text-xl">Đặt lại mật khẩu</h1>{!done && <><label className="block text-sm">Mật khẩu mới<input className="block border rounded-lg p-3 mt-2 w-full" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} /></label><button className="bg-brand-primary text-white p-3 rounded-lg w-full" disabled={!token}>Lưu mật khẩu mới</button></>}{message && <p role="status">{message}</p>}<Link href="/app/dashboard" className="block text-brand-primary text-sm">Đăng nhập</Link></form></main>;
}

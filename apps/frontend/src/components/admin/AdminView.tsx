'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, Users, Library, ScrollText, LayoutDashboard } from 'lucide-react';
import { api } from '@/lib/api';
import { useVocelune } from '@/context/VoceluneContext';

type Stats = Record<'users' | 'disabledUsers' | 'admins' | 'newUsers7d' | 'activeUsers7d' | 'decks' | 'publicDecks' | 'vocabulary' | 'reviews7d' | 'pendingImports' | 'pendingEmails', number>;
type AdminUser = { id: string; email: string; displayName: string; role: string; disabledAt: string | null; createdAt: string; vocabularyCount: number; deckCount: number; reviewCount: number };
type AdminDeck = { id: string; name: string; description: string; topicGroup: string; isPublic: boolean; forkCount: number; itemCount: number; createdAt: string; author: { id: string; email: string; displayName: string } };
type AuditItem = { id: string; action: string; resourceId: string | null; metadata: unknown; occurredAt: string; actor: { email: string; displayName: string } | null };
type Page<T> = { items: T[]; nextCursor: string | null };
type Tab = 'overview' | 'users' | 'decks' | 'audit';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
  { id: 'users', label: 'Người dùng', icon: Users },
  { id: 'decks', label: 'Bộ từ công khai', icon: Library },
  { id: 'audit', label: 'Nhật ký', icon: ScrollText },
];
const STAT_LABELS: [keyof Stats, string][] = [
  ['users', 'Tổng người dùng'], ['activeUsers7d', 'Hoạt động 7 ngày'], ['newUsers7d', 'Mới 7 ngày'], ['disabledUsers', 'Bị khóa'],
  ['admins', 'Quản trị viên'], ['decks', 'Bộ từ'], ['publicDecks', 'Bộ từ công khai'], ['vocabulary', 'Từ vựng'],
  ['reviews7d', 'Lượt ôn 7 ngày'], ['pendingImports', 'Nhập đang chờ'], ['pendingEmails', 'Email đang chờ'],
];
const ROLE_LABEL: Record<string, string> = { learner: 'Người học', admin: 'Quản trị', editorial: 'Biên tập' };
const input = 'border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30';
const btn = 'px-2.5 py-1 rounded-md text-[11px] font-semibold border border-slate-200 hover:bg-slate-50 disabled:opacity-40';
const fmt = (v: string) => new Date(v).toLocaleString('vi-VN');
const qs = (o: Record<string, string | undefined>) => {
  const p = new URLSearchParams();
  Object.entries(o).forEach(([k, v]) => v && p.set(k, v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

function usePaged<T>(path: string, params: Record<string, string | undefined>) {
  const [items, setItems] = useState<T[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const key = JSON.stringify(params);
  const load = useCallback(async (cursor?: string) => {
    setLoading(true); setError(null);
    try {
      const page = await api<Page<T>>(`${path}${qs({ ...JSON.parse(key), cursor, limit: '25' })}`);
      setItems(prev => (cursor ? [...prev, ...page.items] : page.items));
      setNext(page.nextCursor);
    } catch (e) { setError(e instanceof Error ? e.message : 'Không thể tải dữ liệu.'); }
    finally { setLoading(false); }
  }, [path, key]);
  useEffect(() => { void load(); }, [load]);
  return { items, setItems, next, loading, error, reload: () => load(), more: () => next && load(next) };
}

function Status({ error, loading, empty }: { error: string | null; loading: boolean; empty: boolean }) {
  if (error) return <p role="alert" className="text-xs text-rose-600 py-2">{error}</p>;
  if (loading) return <p className="text-xs text-text-secondary py-2">Đang tải...</p>;
  if (empty) return <p className="text-xs text-text-secondary py-2">Không có dữ liệu.</p>;
  return null;
}

function Overview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api<Stats>('/admin/stats').then(setStats).catch(e => setError(e.message)); }, []);
  if (!stats) return <Status error={error} loading={!error} empty={false} />;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {STAT_LABELS.map(([k, label]) => (
        <div key={k} className="bg-surface-base border border-slate-200/80 rounded-xl p-3">
          <div className="text-xl font-bold text-brand-ink">{stats[k].toLocaleString('vi-VN')}</div>
          <div className="text-[11px] text-text-secondary">{label}</div>
        </div>
      ))}
    </div>
  );
}

function UsersTab() {
  const { user: me } = useVocelune();
  const [q, setQ] = useState(''), [role, setRole] = useState(''), [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const list = usePaged<AdminUser>('/admin/users', { q: search || undefined, role: role || undefined, status: status || undefined });
  const [busy, setBusy] = useState<string | null>(null), [actionError, setActionError] = useState<string | null>(null);
  const patch = async (u: AdminUser, body: { role?: string; disabled?: boolean }, confirmText: string) => {
    if (!window.confirm(confirmText)) return;
    setBusy(u.id); setActionError(null);
    try {
      const updated = await api<Pick<AdminUser, 'id' | 'role' | 'disabledAt'>>(`/admin/users/${u.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      list.setItems(prev => prev.map(x => (x.id === u.id ? { ...x, role: updated.role, disabledAt: updated.disabledAt } : x)));
    } catch (e) { setActionError(e instanceof Error ? e.message : 'Thao tác thất bại.'); }
    finally { setBusy(null); }
  };
  return (
    <div className="space-y-3">
      <form className="flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); setSearch(q.trim()); }}>
        <input className={`${input} w-56`} placeholder="Tìm email hoặc tên" value={q} onChange={e => setQ(e.target.value)} />
        <select className={input} value={role} onChange={e => setRole(e.target.value)} aria-label="Vai trò">
          <option value="">Mọi vai trò</option>{Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select className={input} value={status} onChange={e => setStatus(e.target.value)} aria-label="Trạng thái">
          <option value="">Mọi trạng thái</option><option value="active">Hoạt động</option><option value="disabled">Bị khóa</option>
        </select>
        <button className={btn}>Tìm</button>
      </form>
      {actionError && <p role="alert" className="text-xs text-rose-600">{actionError}</p>}
      <div className="overflow-x-auto bg-surface-base border border-slate-200/80 rounded-xl">
        <table className="w-full text-xs">
          <thead className="text-left text-text-secondary"><tr>{['Người dùng', 'Vai trò', 'Từ / Bộ / Lượt ôn', 'Ngày tạo', ''].map(h => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr></thead>
          <tbody>
            {list.items.map(u => {
              const self = u.id === me?.id;
              return (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className="px-3 py-2"><div className="font-semibold text-brand-ink">{u.displayName}{u.disabledAt && <span className="ml-1.5 text-[10px] text-rose-600">(đã khóa)</span>}</div><div className="text-text-secondary">{u.email}</div></td>
                  <td className="px-3 py-2">
                    <select className={input} value={u.role} disabled={self || busy === u.id} aria-label={`Vai trò của ${u.email}`}
                      onChange={e => void patch(u, { role: e.target.value }, `Đổi vai trò của ${u.email} thành "${ROLE_LABEL[e.target.value]}"? Người dùng sẽ bị đăng xuất.`)}>
                      {Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2 font-mono">{u.vocabularyCount} / {u.deckCount} / {u.reviewCount}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{fmt(u.createdAt)}</td>
                  <td className="px-3 py-2 text-right">
                    <button className={btn} disabled={self || busy === u.id}
                      onClick={() => void patch(u, { disabled: !u.disabledAt }, u.disabledAt ? `Mở khóa ${u.email}?` : `Khóa ${u.email}? Mọi phiên đăng nhập sẽ bị thu hồi.`)}>
                      {u.disabledAt ? 'Mở khóa' : 'Khóa'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="px-3"><Status error={list.error} loading={list.loading} empty={!list.items.length} /></div>
      </div>
      {list.next && <button className={btn} onClick={() => void list.more()} disabled={list.loading}>Tải thêm</button>}
    </div>
  );
}

function DecksTab() {
  const [status, setStatus] = useState<'public' | 'hidden'>('public');
  const [q, setQ] = useState(''), [search, setSearch] = useState('');
  const list = usePaged<AdminDeck>('/admin/decks', { status, q: search || undefined });
  const [error, setError] = useState<string | null>(null);
  const act = async (d: AdminDeck, run: () => Promise<unknown>) => {
    setError(null);
    try { await run(); list.setItems(prev => prev.filter(x => x.id !== d.id)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Thao tác thất bại.'); }
  };
  const toggle = (d: AdminDeck) => act(d, () => api(`/admin/decks/${d.id}`, { method: 'PATCH', body: JSON.stringify({ isPublic: !d.isPublic }) }));
  const remove = (d: AdminDeck) => window.confirm(`Xóa bộ từ "${d.name}"? Thao tác này gỡ bộ từ khỏi chủ sở hữu.`) && act(d, () => api(`/admin/decks/${d.id}`, { method: 'DELETE' }));
  return (
    <div className="space-y-3">
      <form className="flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); setSearch(q.trim()); }}>
        <input className={`${input} w-56`} placeholder="Tìm tên bộ từ" value={q} onChange={e => setQ(e.target.value)} />
        <select className={input} value={status} onChange={e => setStatus(e.target.value as 'public' | 'hidden')} aria-label="Trạng thái bộ từ">
          <option value="public">Đang công khai</option><option value="hidden">Đã gỡ / riêng tư</option>
        </select>
        <button className={btn}>Tìm</button>
      </form>
      {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
      <div className="bg-surface-base border border-slate-200/80 rounded-xl divide-y divide-slate-100">
        {list.items.map(d => (
          <div key={d.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-brand-ink truncate">{d.name} <span className="font-normal text-text-secondary">· {d.topicGroup}</span></div>
              <div className="text-[11px] text-text-secondary truncate">{d.author.displayName} ({d.author.email}) · {d.itemCount} từ · {d.forkCount} lượt sao chép</div>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button className={btn} onClick={() => void toggle(d)}>{d.isPublic ? 'Gỡ công khai' : 'Công khai'}</button>
              <button className={`${btn} text-rose-600`} onClick={() => void remove(d)}>Xóa</button>
            </div>
          </div>
        ))}
        <div className="px-3"><Status error={list.error} loading={list.loading} empty={!list.items.length} /></div>
      </div>
      {list.next && <button className={btn} onClick={() => void list.more()} disabled={list.loading}>Tải thêm</button>}
    </div>
  );
}

function AuditTab() {
  const [action, setAction] = useState('');
  const list = usePaged<AuditItem>('/admin/audit-logs', { action: action || undefined });
  return (
    <div className="space-y-3">
      <select className={input} value={action} onChange={e => setAction(e.target.value)} aria-label="Lọc hành động">
        <option value="">Mọi hành động</option><option value="admin.user">Người dùng</option><option value="admin.deck">Bộ từ</option><option value="admin.operations">Vận hành</option><option value="admin.stats">Thống kê</option>
      </select>
      <div className="bg-surface-base border border-slate-200/80 rounded-xl divide-y divide-slate-100">
        {list.items.map(l => (
          <div key={l.id} className="px-3 py-2 text-xs">
            <div className="flex justify-between gap-3"><span className="font-mono font-semibold text-brand-ink">{l.action}</span><span className="text-text-secondary whitespace-nowrap">{fmt(l.occurredAt)}</span></div>
            <div className="text-text-secondary">{l.actor ? `${l.actor.displayName} (${l.actor.email})` : 'Hệ thống'}{l.resourceId && ` · ${l.resourceId}`}</div>
            {l.metadata != null && <pre className="mt-1 text-[10px] bg-slate-50 rounded p-1.5 overflow-x-auto">{JSON.stringify(l.metadata, null, 1)}</pre>}
          </div>
        ))}
        <div className="px-3"><Status error={list.error} loading={list.loading} empty={!list.items.length} /></div>
      </div>
      {list.next && <button className={btn} onClick={() => void list.more()} disabled={list.loading}>Tải thêm</button>}
    </div>
  );
}

export function AdminView() {
  const { user } = useVocelune();
  const [tab, setTab] = useState<Tab>('overview');
  if (user?.role !== 'admin') {
    return <p role="alert" className="text-sm text-text-secondary py-8 text-center">Bạn không có quyền truy cập trang quản trị.</p>;
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-brand-primary" /><h1 className="text-base font-bold text-brand-ink">Quản trị</h1></div>
      <div className="flex gap-1 border-b border-slate-200/80" role="tablist">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 -mb-px ${tab === id ? 'border-brand-primary text-brand-primary' : 'border-transparent text-text-secondary hover:text-brand-ink'}`}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>
      {tab === 'overview' && <Overview />}
      {tab === 'users' && <UsersTab />}
      {tab === 'decks' && <DecksTab />}
      {tab === 'audit' && <AuditTab />}
    </div>
  );
}

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Users,
  Library,
  ScrollText,
  LayoutDashboard,
  Database,
  Activity,
  RefreshCw,
  Search,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Volume2,
  Plus,
  Trash2,
  Edit3,
  Zap,
  Globe,
  Lock,
  Unlock,
  LogOut,
  Server,
  Layers,
  BookOpen,
  RotateCcw,
  UserCheck,
} from 'lucide-react';
import { api, post } from '@/lib/api';
import { useVocelune } from '@/context/VoceluneContext';
import { useNotification } from '@/context/NotificationContext';
import { speakWord } from '@/lib/speech';
import type { DictionaryLookup } from '@/lib/dictionary';
import type { PartOfSpeech as DictionaryPos } from '@/types';

type Stats = {
  users: number;
  disabledUsers: number;
  admins: number;
  newUsers7d: number;
  activeUsers7d: number;
  decks: number;
  publicDecks: number;
  vocabulary: number;
  reviews7d: number;
  pendingImports: number;
  pendingEmails: number;
  localDictionaryEntries?: number;
  dictionaryRequests24h?: number;
};

type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  disabledAt: string | null;
  createdAt: string;
  vocabularyCount: number;
  deckCount: number;
  reviewCount: number;
  activeSessionsCount?: number;
};

type AdminDeck = {
  id: string;
  name: string;
  description: string;
  topicGroup: string;
  isPublic: boolean;
  forkCount: number;
  itemCount: number;
  createdAt: string;
  author: { id: string; email: string; displayName: string };
};

type AuditItem = {
  id: string;
  action: string;
  resourceId: string | null;
  metadata: unknown;
  occurredAt: string;
  actor: { email: string; displayName: string } | null;
};

type AdminDictionaryProvider = {
  id: string;
  name: string;
  tier: 'local' | 'free' | 'api_key';
  configured: boolean;
  licenseMode: 'LIVE_ONLY' | 'PERSIST_LICENSED' | 'OPEN_LICENSE';
  persistenceSupported: boolean;
  persistFields: string[];
  description: string;
  entryCount: number | null;
  health: {
    state: 'healthy' | 'cooldown';
    retryAt: string | null;
    failures: number;
    reason: string | null;
    updatedAt: string | null;
  };
  quota: {
    dailyUsed: number;
    dailyLimit: number | null;
    monthlyUsed: number;
    monthlyLimit: number | null;
  };
  telemetry24h: {
    totalRequests: number;
    successCount: number;
    errorCount: number;
    rateLimitCount: number;
    avgLatencyMs: number;
    maxLatencyMs: number;
  };
};

type DictionaryOverviewData = {
  config: {
    lookupCacheSize: number;
    translationCacheSize: number;
    cacheTtlSeconds: number;
    maxRequests: number;
    licenseMode: string;
    userAgent: string;
  };
  providers: AdminDictionaryProvider[];
  localCorpus: {
    totalEntries: number;
    byProvider: Record<string, number>;
    byPos: { partOfSpeech: string; count: number }[];
  };
};

type ProbeResponse = {
  lookup: DictionaryLookup;
  diagnostics: {
    ipa: { ipa: string; dialect: string; source: string };
    cefr: { cefr: string; confidence: string; source: string; reasoning: string } | null;
    translation: { translation: string; alternatives: string[]; source: string } | null;
  };
};

type LocalEntryRow = {
  id: string;
  provider: 'local_kaikki' | 'local_wordnet';
  entryRef: string;
  lemma: string;
  normalized: string;
  partOfSpeech: string;
  datasetVersion: string;
  importedAt: string;
  candidate: {
    lemma: string;
    partOfSpeech: string;
    senses?: {
      definition?: { value?: string | null };
      meaningVi?: { value?: string | null };
      examples?: { items?: string[] };
      exampleVi?: { value?: string | null };
      pronunciations?: { dialect?: string; ipa?: string }[];
      synonyms?: string[];
      antonyms?: string[];
      domains?: string[];
      cefr?: { status?: string; value?: string | null };
      etymology?: string | null;
    }[];
  };
};

type OperationsOverviewData = {
  imports: {
    byStatus: Record<string, number>;
    recent: {
      id: string;
      status: string;
      policy: string;
      result: unknown;
      createdAt: string;
      completedAt: string | null;
      user: { email: string; displayName: string };
    }[];
  };
  emails: {
    byStatus: Record<string, number>;
    recent: {
      id: string;
      to: string;
      subject: string;
      status: string;
      attempts: number;
      createdAt: string;
      sentAt: string | null;
    }[];
  };
  activeSessions: number;
  mediaReadyCount: number;
  providerUsageLast24h: {
    provider: string;
    status: number;
    count: number;
    avgLatencyMs: number;
  }[];
};

type Page<T> = { items: T[]; nextCursor: string | null; total?: number };
export type AdminTab = 'overview' | 'users' | 'decks' | 'dictionary' | 'operations' | 'audit';

const TABS: { id: AdminTab; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Tổng quan hệ thống', icon: LayoutDashboard },
  { id: 'users', label: 'Người dùng & Quyền', icon: Users },
  { id: 'decks', label: 'Bộ từ công khai', icon: Library },
  { id: 'dictionary', label: 'API Từ điển & Kho từ', icon: Database },
  { id: 'operations', label: 'Vận hành & Hàng đợi', icon: Activity },
  { id: 'audit', label: 'Nhật ký kiểm toán', icon: ScrollText },
];

const ROLE_LABEL: Record<string, string> = {
  learner: 'Người học',
  admin: 'Quản trị',
  editorial: 'Biên tập',
};

const POS_OPTIONS: { value: DictionaryPos; label: string }[] = [
  { value: 'noun', label: 'Danh từ (noun)' },
  { value: 'verb', label: 'Động từ (verb)' },
  { value: 'adjective', label: 'Tính từ (adjective)' },
  { value: 'adverb', label: 'Trạng từ (adverb)' },
  { value: 'idiom', label: 'Thành ngữ (idiom)' },
  { value: 'phrase', label: 'Cụm từ (phrase)' },
  { value: 'preposition', label: 'Giới từ (preposition)' },
  { value: 'conjunction', label: 'Liên từ (conjunction)' },
  { value: 'other', label: 'Khác (other)' },
];

const input =
  'border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary';
const btn =
  'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-slate-200 bg-white hover:bg-slate-50 text-brand-ink transition-colors disabled:opacity-40';
const btnPrimary =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-primary hover:bg-brand-primaryHover text-white shadow-2xs transition-colors disabled:opacity-50';
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
  const [total, setTotal] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const key = JSON.stringify(params);

  const load = useCallback(
    async (cursor?: string) => {
      setLoading(true);
      setError(null);
      try {
        const page = await api<Page<T>>(`${path}${qs({ ...JSON.parse(key), cursor, limit: '25' })}`);
        setItems(prev => (cursor ? [...prev, ...page.items] : page.items));
        setNext(page.nextCursor);
        if (page.total !== undefined) setTotal(page.total);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Không thể tải dữ liệu.');
      } finally {
        setLoading(false);
      }
    },
    [path, key]
  );

  useEffect(() => {
    void load();
  }, [load]);

  return { items, setItems, next, total, loading, error, reload: () => load(), more: () => next && load(next) };
}

function Status({ error, loading, empty }: { error: string | null; loading: boolean; empty: boolean }) {
  if (error) return <p role="alert" className="text-xs text-rose-600 py-3">{error}</p>;
  if (loading) return <p className="text-xs text-text-secondary py-3">Đang tải dữ liệu...</p>;
  if (empty) return <p className="text-xs text-text-secondary py-3">Không có dữ liệu phù hợp.</p>;
  return null;
}

// ============================================================================
// 1. OVERVIEW TAB
// ============================================================================
function OverviewTab({ onSwitchTab }: { onSwitchTab: (tab: AdminTab) => void }) {
  const { notify } = useNotification();
  const [stats, setStats] = useState<Stats | null>(null);
  const [dictOverview, setDictOverview] = useState<DictionaryOverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);

  const load = useCallback(() => {
    setError(null);
    Promise.all([
      api<Stats>('/admin/stats'),
      api<DictionaryOverviewData>('/admin/dictionary/overview').catch(() => null),
    ])
      .then(([s, d]) => {
        setStats(s);
        if (d) setDictOverview(d);
      })
      .catch(e => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSeedOfficial = async () => {
    setSeeding(true);
    try {
      const res = await post<{ ok: boolean; decksSynced: number; wordsSynced: number }>('/admin/decks/seed-official');
      notify.success('Đã đồng bộ Bộ từ Chuẩn!', `Đã cập nhật ${res.decksSynced} bộ từ công khai (${res.wordsSynced} mục từ).`);
      load();
    } catch (e: any) {
      notify.error('Lỗi đồng bộ bộ từ', e?.message || 'Không thể khởi tạo bộ từ chuẩn.');
    } finally {
      setSeeding(false);
    }
  };

  const handleClearCache = async () => {
    setClearingCache(true);
    try {
      const res = await post<{ lookupCleared: number; translationCleared: number }>('/admin/dictionary/cache/clear');
      notify.success('Đã xóa bộ nhớ đệm!', `Đã dọn ${res.lookupCleared} cache tra cứu và ${res.translationCleared} cache dịch thuật.`);
      load();
    } catch (e: any) {
      notify.error('Lỗi xóa cache', e?.message || 'Không thể xóa cache.');
    } finally {
      setClearingCache(false);
    }
  };

  if (!stats) return <Status error={error} loading={!error} empty={false} />;

  const statCards: { key: keyof Stats; label: string; sub: string; color: string }[] = [
    { key: 'users', label: 'Tổng người dùng', sub: `${stats.admins} Quản trị · ${stats.disabledUsers} Đã khóa`, color: 'text-brand-primary' },
    { key: 'activeUsers7d', label: 'Hoạt động 7 ngày', sub: `+${stats.newUsers7d} tài khoản mới tuần qua`, color: 'text-emerald-600' },
    { key: 'publicDecks', label: 'Bộ từ công khai', sub: `Trên tổng số ${stats.decks} bộ từ toàn hệ thống`, color: 'text-indigo-600' },
    { key: 'vocabulary', label: 'Tổng mục từ vựng', sub: `${stats.reviews7d.toLocaleString('vi-VN')} lượt ôn tập 7 ngày qua`, color: 'text-brand-ink' },
    { key: 'localDictionaryEntries', label: 'Kho từ điển Local DB', sub: 'Kaikki & Open English WordNet', color: 'text-amber-700' },
    { key: 'dictionaryRequests24h', label: 'Truy vấn API Từ điển 24h', sub: 'Tổng lượt gọi qua cổng tích hợp', color: 'text-sky-700' },
    { key: 'pendingImports', label: 'Hàng đợi Import', sub: 'Tác vụ CSV / XLSX đang chờ', color: stats.pendingImports > 0 ? 'text-amber-600' : 'text-slate-700' },
    { key: 'pendingEmails', label: 'Hàng đợi Email Outbox', sub: 'Email thông báo / khôi phục chờ gửi', color: stats.pendingEmails > 0 ? 'text-amber-600' : 'text-slate-700' },
  ];

  return (
    <div className="space-y-4">
      {/* Quick Actions Strip */}
      <div className="bg-surface-base border border-slate-200/80 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="text-xs font-bold text-brand-ink flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-brand-primary" />
            <span>Tác vụ Quản trị Nhanh (Quick Operations)</span>
          </div>
          <p className="text-[11px] text-text-secondary">
            Khởi tạo bộ từ chuẩn, dọn bộ nhớ đệm từ điển hoặc mở công cụ kiểm thử API trực tiếp.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={handleSeedOfficial} disabled={seeding} className={btnPrimary}>
            <Sparkles className="w-3.5 h-3.5" />
            <span>{seeding ? 'Đang đồng bộ...' : 'Đồng bộ 5 Bộ từ Chuẩn'}</span>
          </button>
          <button type="button" onClick={() => onSwitchTab('dictionary')} className={btn}>
            <Database className="w-3.5 h-3.5 text-brand-primary" />
            <span>Kiểm thử & Quota API Từ điển</span>
          </button>
          <button type="button" onClick={handleClearCache} disabled={clearingCache} className={btn}>
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>{clearingCache ? 'Đang xóa...' : 'Xóa Cache Từ điển'}</span>
          </button>
          <button type="button" onClick={load} className={btn}>
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map(c => (
          <div key={c.key} className="bg-surface-base border border-slate-200/80 rounded-xl p-3.5 space-y-1 shadow-2xs">
            <div className="text-[11px] font-semibold text-text-secondary">{c.label}</div>
            <div className={`text-2xl font-extrabold font-mono ${c.color}`}>
              {(stats[c.key] ?? 0).toLocaleString('vi-VN')}
            </div>
            <div className="text-[10px] text-text-secondary truncate">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Dictionary API Health Matrix Summary */}
      {dictOverview && (
        <div className="bg-surface-base border border-slate-200/80 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-brand-ink uppercase tracking-wider flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-brand-primary" />
                <span>Trạng thái Hệ sinh thái API Từ điển (9 Nguồn Tích hợp)</span>
              </h3>
              <p className="text-[11px] text-text-secondary">
                Ngân sách tối đa: {dictOverview.config.maxRequests} requests/lần tra · Cache TTL: {dictOverview.config.cacheTtlSeconds}s · Đang lưu đệm: {dictOverview.config.lookupCacheSize} từ & {dictOverview.config.translationCacheSize} bản dịch
              </p>
            </div>
            <button type="button" onClick={() => onSwitchTab('dictionary')} className={btn}>
              Quản lý chi tiết & Playground →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {dictOverview.providers.map(p => (
              <div
                key={p.id}
                className="p-2.5 rounded-lg border border-slate-200/80 bg-slate-50/50 flex items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-brand-ink truncate flex items-center gap-1.5">
                    <span>{p.name}</span>
                    <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded bg-slate-200/70 text-slate-700">
                      {p.tier}
                    </span>
                  </div>
                  <div className="text-[10px] text-text-secondary">
                    {p.tier === 'local'
                      ? `Kho nội bộ: ${(p.entryCount ?? 0).toLocaleString('vi-VN')} mục từ`
                      : p.quota.dailyLimit
                      ? `Quota ngày: ${p.quota.dailyUsed}/${p.quota.dailyLimit} · 24h: ${p.telemetry24h.totalRequests} req`
                      : p.quota.monthlyLimit
                      ? `Quota tháng: ${p.quota.monthlyUsed}/${p.quota.monthlyLimit} · 24h: ${p.telemetry24h.totalRequests} req`
                      : `24h: ${p.telemetry24h.totalRequests} req · TB ${p.telemetry24h.avgLatencyMs}ms`}
                  </div>
                </div>
                <span
                  className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    !p.configured
                      ? 'bg-slate-100 text-slate-500'
                      : p.health.state === 'cooldown'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {!p.configured ? 'Thiếu Key' : p.health.state === 'cooldown' ? 'Cooldown' : 'Healthy'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 2. USERS TAB
// ============================================================================
function UsersTab() {
  const { user: me } = useVocelune();
  const { notify } = useNotification();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const list = usePaged<AdminUser>('/admin/users', {
    q: search || undefined,
    role: role || undefined,
    status: status || undefined,
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const patch = async (u: AdminUser, body: { role?: string; disabled?: boolean }, confirmText: string) => {
    if (!window.confirm(confirmText)) return;
    setBusy(u.id);
    setActionError(null);
    try {
      const updated = await api<Pick<AdminUser, 'id' | 'role' | 'disabledAt'>>(`/admin/users/${u.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      list.setItems(prev =>
        prev.map(x => (x.id === u.id ? { ...x, role: updated.role, disabledAt: updated.disabledAt } : x))
      );
      notify.success('Đã cập nhật tài khoản', `Tài khoản ${u.email} đã được cập nhật.`);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Thao tác thất bại.');
    } finally {
      setBusy(null);
    }
  };

  const revokeSessions = async (u: AdminUser) => {
    if (!window.confirm(`Thu hồi mọi phiên đăng nhập đang hoạt động của ${u.email}?`)) return;
    setBusy(u.id);
    setActionError(null);
    try {
      const res = await post<{ revokedCount: number }>(`/admin/users/${u.id}/revoke-sessions`);
      list.setItems(prev => prev.map(x => (x.id === u.id ? { ...x, activeSessionsCount: 0 } : x)));
      notify.info('Đã thu hồi phiên đăng nhập', `Đã đăng xuất ${res.revokedCount} phiên của ${u.email}.`);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Không thể thu hồi phiên.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <form
        className="flex flex-wrap items-center gap-2 bg-surface-base border border-slate-200/80 rounded-xl p-3"
        onSubmit={e => {
          e.preventDefault();
          setSearch(q.trim());
        }}
      >
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            className={`${input} w-full pl-8`}
            placeholder="Tìm email hoặc tên hiển thị..."
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>
        <select className={input} value={role} onChange={e => setRole(e.target.value)} aria-label="Vai trò">
          <option value="">Mọi vai trò</option>
          {Object.entries(ROLE_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select className={input} value={status} onChange={e => setStatus(e.target.value)} aria-label="Trạng thái">
          <option value="">Mọi trạng thái</option>
          <option value="active">Đang hoạt động</option>
          <option value="disabled">Đã khóa</option>
        </select>
        <button className={btnPrimary}>Tìm kiếm</button>
      </form>

      {actionError && <p role="alert" className="text-xs text-rose-600">{actionError}</p>}

      <div className="overflow-x-auto bg-surface-base border border-slate-200/80 rounded-xl">
        <table className="w-full text-xs">
          <thead className="text-left text-text-secondary bg-slate-50/70 border-b border-slate-200/60">
            <tr>
              {['Người dùng', 'Trạng thái', 'Vai trò', 'Từ / Bộ / Lượt ôn', 'Phiên', 'Ngày tạo', 'Thao tác'].map(h => (
                <th key={h} className="px-3 py-2.5 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.items.map(u => {
              const self = u.id === me?.id;
              return (
                <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50/40">
                  <td className="px-3 py-2.5">
                    <div className="font-semibold text-brand-ink flex items-center gap-1.5">
                      <span>{u.displayName}</span>
                      {self && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-brand-primarySoft text-brand-primary font-bold">
                          Bạn
                        </span>
                      )}
                    </div>
                    <div className="text-text-secondary font-mono text-[11px]">{u.email}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    {u.disabledAt ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        <Lock className="w-2.5 h-2.5" /> Đã khóa
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <UserCheck className="w-2.5 h-2.5" /> Hoạt động
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <select
                      className={input}
                      value={u.role}
                      disabled={self || busy === u.id}
                      aria-label={`Vai trò của ${u.email}`}
                      onChange={e =>
                        void patch(
                          u,
                          { role: e.target.value },
                          `Đổi vai trò của ${u.email} thành "${ROLE_LABEL[e.target.value]}"? Người dùng sẽ bị đăng xuất.`
                        )
                      }
                    >
                      {Object.entries(ROLE_LABEL).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2.5 font-mono">
                    {u.vocabularyCount} / {u.deckCount} / {u.reviewCount}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-text-secondary">
                    {u.activeSessionsCount ?? 0}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-text-secondary">{fmt(u.createdAt)}</td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap space-x-1.5">
                    {!self && (
                      <button
                        type="button"
                        className={btn}
                        disabled={busy === u.id}
                        onClick={() => void revokeSessions(u)}
                        title="Đăng xuất tài khoản này khỏi mọi thiết bị"
                      >
                        <LogOut className="w-3 h-3 text-slate-500" />
                        <span>Thu hồi phiên</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className={`${btn} ${u.disabledAt ? 'text-emerald-700' : 'text-rose-600'}`}
                      disabled={self || busy === u.id}
                      onClick={() =>
                        void patch(
                          u,
                          { disabled: !u.disabledAt },
                          u.disabledAt ? `Mở khóa ${u.email}?` : `Khóa ${u.email}? Mọi phiên đăng nhập sẽ bị thu hồi.`
                        )
                      }
                    >
                      {u.disabledAt ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                      <span>{u.disabledAt ? 'Mở khóa' : 'Khóa'}</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="px-3">
          <Status error={list.error} loading={list.loading} empty={!list.items.length} />
        </div>
      </div>
      {list.next && (
        <button className={btn} onClick={() => void list.more()} disabled={list.loading}>
          Tải thêm người dùng
        </button>
      )}
    </div>
  );
}

// ============================================================================
// 3. DECKS TAB
// ============================================================================
function DecksTab() {
  const { notify } = useNotification();
  const [status, setStatus] = useState<'public' | 'hidden'>('public');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const list = usePaged<AdminDeck>('/admin/decks', { status, q: search || undefined });
  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editTopic, setEditTopic] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const startEdit = (d: AdminDeck) => {
    setEditingId(d.id);
    setEditName(d.name);
    setEditTopic(d.topicGroup);
    setEditDesc(d.description || '');
  };

  const saveEdit = async (d: AdminDeck) => {
    setError(null);
    try {
      const updated = await api<Pick<AdminDeck, 'id' | 'name' | 'description' | 'topicGroup' | 'isPublic'>>(
        `/admin/decks/${d.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            name: editName.trim(),
            topicGroup: editTopic.trim(),
            description: editDesc.trim(),
          }),
        }
      );
      list.setItems(prev => prev.map(x => (x.id === d.id ? { ...x, ...updated } : x)));
      setEditingId(null);
      notify.success('Đã cập nhật bộ từ!', `Bộ từ "${updated.name}" đã được lưu.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể cập nhật bộ từ.');
    }
  };

  const toggle = async (d: AdminDeck) => {
    setError(null);
    try {
      await api(`/admin/decks/${d.id}`, { method: 'PATCH', body: JSON.stringify({ isPublic: !d.isPublic }) });
      list.setItems(prev => prev.filter(x => x.id !== d.id));
      notify.info(d.isPublic ? 'Đã gỡ khỏi kho công khai' : 'Đã công khai bộ từ', d.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Thao tác thất bại.');
    }
  };

  const remove = async (d: AdminDeck) => {
    if (!window.confirm(`Xóa bộ từ "${d.name}"? Thao tác này gỡ bộ từ khỏi chủ sở hữu.`)) return;
    setError(null);
    try {
      await api(`/admin/decks/${d.id}`, { method: 'DELETE' });
      list.setItems(prev => prev.filter(x => x.id !== d.id));
      notify.info('Đã xóa bộ từ', d.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Thao tác thất bại.');
    }
  };

  const handleSeedOfficial = async () => {
    setSeeding(true);
    try {
      const res = await post<{ decksSynced: number; wordsSynced: number }>('/admin/decks/seed-official');
      notify.success('Đã đồng bộ Bộ từ Chuẩn Vocelune!', `Đã cập nhật ${res.decksSynced} bộ từ (${res.wordsSynced} từ vựng).`);
      void list.reload();
    } catch (e: any) {
      notify.error('Lỗi đồng bộ', e?.message || 'Không thể đồng bộ bộ từ chuẩn.');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-surface-base border border-slate-200/80 rounded-xl p-3">
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={e => {
            e.preventDefault();
            setSearch(q.trim());
          }}
        >
          <input
            className={`${input} w-56`}
            placeholder="Tìm tên bộ từ..."
            value={q}
            onChange={e => setQ(e.target.value)}
          />
          <select
            className={input}
            value={status}
            onChange={e => setStatus(e.target.value as 'public' | 'hidden')}
            aria-label="Trạng thái bộ từ"
          >
            <option value="public">Đang công khai</option>
            <option value="hidden">Đã gỡ / riêng tư</option>
          </select>
          <button className={btn}>Tìm</button>
        </form>

        <button type="button" onClick={handleSeedOfficial} disabled={seeding} className={btnPrimary}>
          <Sparkles className="w-3.5 h-3.5" />
          <span>{seeding ? 'Đang khởi tạo...' : 'Đồng bộ 5 Bộ từ Chuẩn Vocelune'}</span>
        </button>
      </div>

      {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}

      <div className="bg-surface-base border border-slate-200/80 rounded-xl divide-y divide-slate-100">
        {list.items.map(d => (
          <div key={d.id} className="p-3 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-0.5">
                <div className="text-xs font-bold text-brand-ink flex items-center gap-2 flex-wrap">
                  <span>{d.name}</span>
                  <span className="px-2 py-0.2 rounded-full text-[10px] font-semibold bg-brand-primarySoft text-brand-primary">
                    {d.topicGroup}
                  </span>
                </div>
                {d.description && <p className="text-[11px] text-text-secondary line-clamp-2">{d.description}</p>}
                <div className="text-[11px] text-text-secondary">
                  Tác giả: <strong>{d.author.displayName}</strong> ({d.author.email}) · <strong>{d.itemCount}</strong> từ ·{' '}
                  <strong>{d.forkCount}</strong> lượt sao chép
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button type="button" className={btn} onClick={() => startEdit(d)}>
                  <Edit3 className="w-3 h-3" />
                  <span>Sửa</span>
                </button>
                <button type="button" className={btn} onClick={() => void toggle(d)}>
                  {d.isPublic ? 'Gỡ công khai' : 'Công khai'}
                </button>
                <button type="button" className={`${btn} text-rose-600`} onClick={() => void remove(d)}>
                  <Trash2 className="w-3 h-3" />
                  <span>Xóa</span>
                </button>
              </div>
            </div>

            {editingId === d.id && (
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 space-y-2.5 mt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">Tên bộ từ</label>
                    <input className={`${input} w-full`} value={editName} onChange={e => setEditName(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">Nhóm chủ đề (Topic Group)</label>
                    <input className={`${input} w-full`} value={editTopic} onChange={e => setEditTopic(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">Mô tả</label>
                  <input className={`${input} w-full`} value={editDesc} onChange={e => setEditDesc(e.target.value)} />
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" className={btn} onClick={() => setEditingId(null)}>
                    Hủy
                  </button>
                  <button type="button" className={btnPrimary} onClick={() => void saveEdit(d)}>
                    Lưu thay đổi
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        <div className="px-3">
          <Status error={list.error} loading={list.loading} empty={!list.items.length} />
        </div>
      </div>
      {list.next && (
        <button className={btn} onClick={() => void list.more()} disabled={list.loading}>
          Tải thêm
        </button>
      )}
    </div>
  );
}

// ============================================================================
// 4. DICTIONARY API & LOCAL CORPUS TAB
// ============================================================================
function DictionaryTab() {
  const { notify } = useNotification();
  const [overview, setOverview] = useState<DictionaryOverviewData | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  // Live Probe / Diagnostic Playground State
  const [probeWord, setProbeWord] = useState('resilient');
  const [probePos, setProbePos] = useState<DictionaryPos>('adjective');
  const [probeDialect, setProbeDialect] = useState<'en-us' | 'en-gb'>('en-us');
  const [probeProvider, setProbeProvider] = useState<string>('auto');
  const [probeStrategy, setProbeStrategy] = useState<'auto_enrich' | 'manual'>('auto_enrich');
  const [probeDomain, setProbeDomain] = useState('');
  const [probeContext, setProbeContext] = useState('');
  const [probeFresh, setProbeFresh] = useState(true);
  const [probing, setProbing] = useState(false);
  const [probeResult, setProbeResult] = useState<ProbeResponse | null>(null);
  const [probeError, setProbeError] = useState<string | null>(null);

  // Local Corpus Upsert State
  const [entryFilterQ, setEntryFilterQ] = useState('');
  const [entrySearch, setEntrySearch] = useState('');
  const [entryFilterProvider, setEntryFilterProvider] = useState('');
  const [entryFilterPos, setEntryFilterPos] = useState('');
  const entriesList = usePaged<LocalEntryRow>('/admin/dictionary/entries', {
    q: entrySearch || undefined,
    provider: entryFilterProvider || undefined,
    partOfSpeech: entryFilterPos || undefined,
  });

  const [showEntryForm, setShowEntryForm] = useState(false);
  const [formProvider, setFormProvider] = useState<'local_kaikki' | 'local_wordnet'>('local_kaikki');
  const [formLemma, setFormLemma] = useState('');
  const [formPos, setFormPos] = useState<DictionaryPos>('noun');
  const [formIpa, setFormIpa] = useState('');
  const [formDialect, setFormDialect] = useState<'en-us' | 'en-gb' | 'unknown'>('en-us');
  const [formCefr, setFormCefr] = useState<'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | 'unknown'>('B2');
  const [formDefEn, setFormDefEn] = useState('');
  const [formMeaningVi, setFormMeaningVi] = useState('');
  const [formExamples, setFormExamples] = useState('');
  const [formExampleVi, setFormExampleVi] = useState('');
  const [formSynonyms, setFormSynonyms] = useState('');
  const [formAntonyms, setFormAntonyms] = useState('');
  const [formDomains, setFormDomains] = useState('');
  const [savingEntry, setSavingEntry] = useState(false);

  const loadOverview = useCallback(async () => {
    setLoadingOverview(true);
    setOverviewError(null);
    try {
      const data = await api<DictionaryOverviewData>('/admin/dictionary/overview');
      setOverview(data);
    } catch (e: any) {
      setOverviewError(e?.message || 'Không thể tải trạng thái API Từ điển.');
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const handleResetHealth = async (providerId: string) => {
    try {
      await post(`/admin/dictionary/providers/${providerId}/reset-health`);
      notify.success('Đã mở khóa Circuit Breaker!', `Nguồn ${providerId} đã được đưa về trạng thái Healthy.`);
      await loadOverview();
    } catch (e: any) {
      notify.error('Lỗi reset health', e?.message || 'Không thể reset trạng thái.');
    }
  };

  const handleResetQuota = async (providerId: string) => {
    try {
      await post(`/admin/dictionary/providers/${providerId}/reset-quota`);
      notify.success('Đã đặt lại bộ đếm Quota!', `Đã reset hạn mức sử dụng cho ${providerId}.`);
      await loadOverview();
    } catch (e: any) {
      notify.error('Lỗi reset quota', e?.message || 'Không thể reset hạn mức.');
    }
  };

  const handleClearCache = async () => {
    try {
      const res = await post<{ lookupCleared: number; translationCleared: number }>('/admin/dictionary/cache/clear');
      notify.success('Đã dọn bộ nhớ đệm!', `Đã xóa ${res.lookupCleared} mục tra cứu và ${res.translationCleared} mục dịch.`);
      await loadOverview();
    } catch (e: any) {
      notify.error('Lỗi xóa cache', e?.message || 'Không thể xóa cache.');
    }
  };

  const handleRunProbe = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!probeWord.trim()) return;
    setProbing(true);
    setProbeError(null);
    try {
      const res = await post<ProbeResponse>('/admin/dictionary/probe', {
        word: probeWord.trim(),
        partOfSpeech: probePos,
        dialect: probeDialect,
        provider: probeProvider,
        strategy: probeStrategy,
        allowFallback: probeProvider === 'auto' || probeStrategy === 'auto_enrich',
        ...(probeDomain.trim() ? { domain: probeDomain.trim() } : {}),
        ...(probeContext.trim() ? { contextSentence: probeContext.trim() } : {}),
        fresh: probeFresh,
        includeTranslation: true,
      });
      setProbeResult(res);
      await loadOverview();
    } catch (err: any) {
      setProbeError(err?.message || 'Lỗi khi chạy chẩn đoán API Từ điển.');
    } finally {
      setProbing(false);
    }
  };

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formLemma.trim() || !formDefEn.trim()) return;
    setSavingEntry(true);
    try {
      await post('/admin/dictionary/entries', {
        provider: formProvider,
        lemma: formLemma.trim(),
        partOfSpeech: formPos,
        definitionEn: formDefEn.trim(),
        ...(formMeaningVi.trim() ? { meaningVi: formMeaningVi.trim() } : {}),
        ...(formIpa.trim() ? { ipa: formIpa.trim() } : {}),
        dialect: formDialect,
        cefr: formCefr,
        examples: formExamples
          .split('\n')
          .map(s => s.trim())
          .filter(Boolean),
        ...(formExampleVi.trim() ? { exampleVi: formExampleVi.trim() } : {}),
        synonyms: formSynonyms
          .split(',')
          .map(s => s.trim())
          .filter(Boolean),
        antonyms: formAntonyms
          .split(',')
          .map(s => s.trim())
          .filter(Boolean),
        domains: formDomains
          .split(',')
          .map(s => s.trim())
          .filter(Boolean),
      });
      notify.success('Đã lưu vào Kho Từ điển Nội bộ!', `Mục từ "${formLemma}" (${formPos}) đã sẵn sàng phục vụ tra cứu.`);
      setShowEntryForm(false);
      void entriesList.reload();
      void loadOverview();
    } catch (err: any) {
      notify.error('Không thể lưu mục từ điển', err?.message || 'Lỗi dữ liệu.');
    } finally {
      setSavingEntry(false);
    }
  };

  const handlePrefillFromProbe = (lemma: string, pos: DictionaryPos, sense: any) => {
    setFormProvider('local_kaikki');
    setFormLemma(lemma);
    setFormPos(pos);
    setFormDefEn(sense.definition?.value || '');
    setFormMeaningVi(sense.meaningVi?.value || probeResult?.diagnostics.translation?.translation || '');
    setFormIpa(sense.pronunciations?.[0]?.ipa || probeResult?.diagnostics.ipa?.ipa || '');
    setFormDialect('en-us');
    setFormCefr((probeResult?.diagnostics.cefr?.cefr as any) || 'B2');
    setFormExamples((sense.examples?.items || []).join('\n'));
    setFormSynonyms((sense.synonyms || []).join(', '));
    setFormAntonyms((sense.antonyms || []).join(', '));
    setFormDomains((sense.domains || []).join(', '));
    setShowEntryForm(true);
    notify.info('Đã nạp dữ liệu vào biểu mẫu', 'Kiểm tra và bấm Lưu để đưa vào Kho Từ điển Nội bộ.');
  };

  const handleEditLocalRow = (row: LocalEntryRow) => {
    const s = row.candidate?.senses?.[0];
    setFormProvider(row.provider);
    setFormLemma(row.lemma);
    setFormPos(row.partOfSpeech as DictionaryPos);
    setFormDefEn(s?.definition?.value || '');
    setFormMeaningVi(s?.meaningVi?.value || '');
    setFormIpa(s?.pronunciations?.[0]?.ipa || '');
    setFormDialect((s?.pronunciations?.[0]?.dialect as any) || 'en-us');
    setFormCefr((s?.cefr?.value as any) || 'unknown');
    setFormExamples((s?.examples?.items || []).join('\n'));
    setFormExampleVi(s?.exampleVi?.value || '');
    setFormSynonyms((s?.synonyms || []).join(', '));
    setFormAntonyms((s?.antonyms || []).join(', '));
    setFormDomains((s?.domains || []).join(', '));
    setShowEntryForm(true);
  };

  const handleDeleteLocalRow = async (row: LocalEntryRow) => {
    if (!window.confirm(`Xóa mục từ "${row.lemma}" (${row.partOfSpeech}) khỏi kho ${row.provider}?`)) return;
    try {
      await api(`/admin/dictionary/entries/${row.id}`, { method: 'DELETE' });
      entriesList.setItems(prev => prev.filter(x => x.id !== row.id));
      notify.info('Đã xóa mục từ nội bộ', `${row.lemma} (${row.partOfSpeech})`);
      void loadOverview();
    } catch (e: any) {
      notify.error('Không thể xóa', e?.message || 'Lỗi máy chủ.');
    }
  };

  return (
    <div className="space-y-5">
      {/* SECTION 1: PROVIDERS HEALTH, CIRCUIT BREAKER & QUOTAS */}
      <div className="bg-surface-base border border-slate-200/80 rounded-xl p-4 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-xs font-bold text-brand-ink uppercase tracking-wider flex items-center gap-1.5">
              <Server className="w-4 h-4 text-brand-primary" />
              <span>1. Quản lý 9 Nguồn API Từ điển, Circuit Breaker & Quota</span>
            </h2>
            {overview && (
              <p className="text-[11px] text-text-secondary mt-0.5">
                Chế độ bản quyền: <strong>{overview.config.licenseMode}</strong> · Tối đa{' '}
                <strong>{overview.config.maxRequests}</strong> nguồn/lần tra · Cache:{' '}
                <strong>{overview.config.lookupCacheSize}</strong> lookup /{' '}
                <strong>{overview.config.translationCacheSize}</strong> dịch thuật (TTL {overview.config.cacheTtlSeconds}s)
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => void handleResetHealth('all')} className={btn}>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Reset Toàn bộ Health</span>
            </button>
            <button type="button" onClick={() => void handleResetQuota('all')} className={btn}>
              <RotateCcw className="w-3.5 h-3.5 text-brand-primary" />
              <span>Reset Toàn bộ Quota</span>
            </button>
            <button type="button" onClick={() => void handleClearCache()} className={btn}>
              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
              <span>Xóa Cache</span>
            </button>
            <button type="button" onClick={() => void loadOverview()} className={btn}>
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <Status error={overviewError} loading={loadingOverview} empty={!overview} />

        {overview && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-text-secondary bg-slate-50/80 border-y border-slate-200/60">
                <tr>
                  {[
                    'Nguồn từ điển',
                    'Phân tầng & Bản quyền',
                    'Trạng thái Circuit',
                    'Quota / Dữ liệu Local',
                    'Lưu lượng 24h (OK / Lỗi / 429)',
                    'Độ trễ 24h',
                    'Điều khiển',
                  ].map(h => (
                    <th key={h} className="px-2.5 py-2 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {overview.providers.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/50">
                    <td className="px-2.5 py-2.5">
                      <div className="font-bold text-brand-ink">{p.name}</div>
                      <div className="text-[10px] font-mono text-text-secondary">{p.id}</div>
                    </td>
                    <td className="px-2.5 py-2.5">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700 uppercase">
                          {p.tier}
                        </span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                            p.licenseMode === 'OPEN_LICENSE'
                              ? 'bg-emerald-50 text-emerald-700'
                              : p.licenseMode === 'PERSIST_LICENSED'
                              ? 'bg-indigo-50 text-indigo-700'
                              : 'bg-amber-50 text-amber-800'
                          }`}
                        >
                          {p.licenseMode}
                        </span>
                      </div>
                      <div className="text-[10px] text-text-secondary mt-0.5">
                        {p.persistenceSupported ? `Lưu trữ: ${p.persistFields.length} trường` : 'Chỉ xem trực tiếp (LIVE_ONLY)'}
                      </div>
                    </td>
                    <td className="px-2.5 py-2.5">
                      {!p.configured ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500">
                          <XCircle className="w-3 h-3" /> Chưa cấu hình Key
                        </span>
                      ) : p.health.state === 'cooldown' ? (
                        <div>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            <AlertTriangle className="w-3 h-3" /> Cooldown ({p.health.failures} lỗi)
                          </span>
                          {p.health.reason && (
                            <div className="text-[10px] text-rose-600 mt-0.5">Lý do: {p.health.reason}</div>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Sẵn sàng
                        </span>
                      )}
                    </td>
                    <td className="px-2.5 py-2.5 font-mono text-[11px]">
                      {p.tier === 'local' ? (
                        <span className="font-bold text-brand-primary">
                          {(p.entryCount ?? 0).toLocaleString('vi-VN')} mục từ
                        </span>
                      ) : p.quota.dailyLimit !== null ? (
                        <span>
                          {p.quota.dailyUsed} / {p.quota.dailyLimit} <span className="text-[10px] text-text-secondary">(ngày)</span>
                        </span>
                      ) : p.quota.monthlyLimit !== null ? (
                        <span>
                          {p.quota.monthlyUsed} / {p.quota.monthlyLimit} <span className="text-[10px] text-text-secondary">(tháng)</span>
                        </span>
                      ) : (
                        <span className="text-text-secondary">Không giới hạn</span>
                      )}
                    </td>
                    <td className="px-2.5 py-2.5 font-mono text-[11px]">
                      <span className="font-bold text-brand-ink">{p.telemetry24h.totalRequests}</span> req (
                      <span className="text-emerald-600">{p.telemetry24h.successCount}</span> /{' '}
                      <span className="text-rose-600">{p.telemetry24h.errorCount}</span> /{' '}
                      <span className="text-amber-600">{p.telemetry24h.rateLimitCount}</span>)
                    </td>
                    <td className="px-2.5 py-2.5 font-mono text-[11px]">
                      {p.telemetry24h.totalRequests > 0
                        ? `TB ${p.telemetry24h.avgLatencyMs}ms (max ${p.telemetry24h.maxLatencyMs}ms)`
                        : '—'}
                    </td>
                    <td className="px-2.5 py-2.5 text-right whitespace-nowrap space-x-1">
                      {p.tier !== 'local' && (
                        <>
                          <button
                            type="button"
                            className={btn}
                            onClick={() => void handleResetHealth(p.id)}
                            title="Mở khóa Cooldown & xóa bộ đếm lỗi"
                          >
                            Reset Health
                          </button>
                          {(p.quota.dailyLimit !== null || p.quota.monthlyLimit !== null) && (
                            <button
                              type="button"
                              className={btn}
                              onClick={() => void handleResetQuota(p.id)}
                              title="Đặt lại hạn mức Quota đã dùng"
                            >
                              Reset Quota
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 2: INTERACTIVE DICTIONARY API PLAYGROUND & DIAGNOSTICS */}
      <div className="bg-surface-base border border-slate-200/80 rounded-xl p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-xs font-bold text-brand-ink uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-brand-primary" />
              <span>2. Trình Chẩn đoán & Kiểm thử Trực tiếp Hệ thống API Từ điển (Playground)</span>
            </h2>
            <p className="text-[11px] text-text-secondary mt-0.5">
              Kiểm thử điều phối đa nguồn (Lookup Orchestration), chuyển đổi phiên âm IPA, ước tính cấp độ CEFR, dịch nghĩa Anh-Việt và xếp hạng ngữ cảnh.
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            {[
              { w: 'resilient', pos: 'adjective' as DictionaryPos },
              { w: 'pipeline', pos: 'noun' as DictionaryPos },
              { w: 'ephemeral', pos: 'adjective' as DictionaryPos },
              { w: 'abandon', pos: 'verb' as DictionaryPos },
              { w: 'synergy', pos: 'noun' as DictionaryPos },
            ].map(sample => (
              <button
                key={sample.w}
                type="button"
                onClick={() => {
                  setProbeWord(sample.w);
                  setProbePos(sample.pos);
                }}
                className="px-2 py-0.5 text-[11px] font-mono rounded-full bg-slate-100 hover:bg-brand-primarySoft hover:text-brand-primary text-slate-700 transition-colors"
              >
                {sample.w}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleRunProbe} className="space-y-3 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/70">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
            <div>
              <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">Từ vựng (Headword)</label>
              <input
                className={`${input} w-full font-semibold`}
                value={probeWord}
                onChange={e => setProbeWord(e.target.value)}
                placeholder="Nhập từ tiếng Anh..."
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">Từ loại (POS)</label>
              <select
                className={`${input} w-full`}
                value={probePos}
                onChange={e => setProbePos(e.target.value as DictionaryPos)}
              >
                {POS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">Nguồn ưu tiên</label>
              <select
                className={`${input} w-full`}
                value={probeProvider}
                onChange={e => setProbeProvider(e.target.value)}
              >
                <option value="auto">Tự động (Auto Orchestration)</option>
                <option value="local_kaikki">Kaikki / Wiktionary Local</option>
                <option value="local_wordnet">Open English WordNet Local</option>
                <option value="free_dictionary">Free Dictionary API</option>
                <option value="wiktionary">Wiktionary REST API</option>
                <option value="merriam_webster">Merriam-Webster</option>
                <option value="oxford">Oxford Dictionaries</option>
                <option value="wordsapi">WordsAPI</option>
                <option value="collins">Collins Dictionary</option>
                <option value="datamuse">Datamuse Related Words</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">Chiến lược & Giọng</label>
              <div className="flex gap-1.5">
                <select
                  className={`${input} flex-1`}
                  value={probeStrategy}
                  onChange={e => setProbeStrategy(e.target.value as 'auto_enrich' | 'manual')}
                >
                  <option value="auto_enrich">Auto Enrich</option>
                  <option value="manual">Đơn nguồn</option>
                </select>
                <select
                  className={input}
                  value={probeDialect}
                  onChange={e => setProbeDialect(e.target.value as 'en-us' | 'en-gb')}
                >
                  <option value="en-us">US</option>
                  <option value="en-gb">UK</option>
                </select>
              </div>
            </div>
            <div className="flex items-end">
              <button type="submit" disabled={probing} className={`${btnPrimary} w-full justify-center py-2`}>
                <Search className="w-3.5 h-3.5" />
                <span>{probing ? 'Đang chẩn đoán...' : 'Chạy Chẩn đoán API'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            <div>
              <input
                className={`${input} w-full`}
                placeholder="Chuyên ngành (VD: computer_science, finance)..."
                value={probeDomain}
                onChange={e => setProbeDomain(e.target.value)}
              />
            </div>
            <div>
              <input
                className={`${input} w-full`}
                placeholder="Câu ngữ cảnh để xếp hạng nghĩa (Context sentence)..."
                value={probeContext}
                onChange={e => setProbeContext(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-700 px-1">
              <input
                type="checkbox"
                checked={probeFresh}
                onChange={e => setProbeFresh(e.target.checked)}
                className="accent-brand-primary"
              />
              <span>Bỏ qua Cache (Fresh re-fetch từ nguồn)</span>
            </label>
          </div>
        </form>

        {probeError && <p role="alert" className="text-xs text-rose-600">{probeError}</p>}

        {probeResult && (
          <div className="space-y-3 pt-1">
            {/* Execution Metrics Strip */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-indigo-50/70 border border-indigo-200/70 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-bold text-brand-ink">
                  Nguồn chính: <span className="font-mono text-brand-primary">{probeResult.lookup.provider}</span>
                </span>
                <span>
                  Thời gian: <strong>{probeResult.lookup.metrics?.durationMs ?? 0}ms</strong>
                </span>
                <span>
                  External HTTP: <strong>{probeResult.lookup.metrics?.externalRequests ?? 0}</strong>
                </span>
                <span>
                  Cache: <strong>{probeResult.lookup.metrics?.cacheHit ? 'HIT' : 'MISS'}</strong>
                </span>
              </div>
              {probeResult.lookup.attemptedProviders && (
                <div className="text-[11px] font-mono text-text-secondary">
                  Chuỗi thử: {probeResult.lookup.attemptedProviders.join(' → ')}
                </div>
              )}
            </div>

            {/* Auxiliary APIs Diagnostic Cards (IPA, CEFR, Translation) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl border border-slate-200/80 bg-white space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-text-secondary">API Phiên âm IPA (/convert-ipa)</span>
                  <button
                    type="button"
                    onClick={() => speakWord(probeResult.lookup.query.word, probeDialect)}
                    className="p-1 rounded hover:bg-slate-100 text-brand-primary"
                    title="Nghe phát âm"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="text-sm font-bold font-mono text-brand-primary">
                  {probeResult.diagnostics.ipa.ipa || 'Chưa có IPA'}
                </div>
                <div className="text-[10px] text-text-secondary">
                  Nguồn giải mã: <strong>{probeResult.diagnostics.ipa.source}</strong> ({probeResult.diagnostics.ipa.dialect})
                </div>
              </div>

              <div className="p-3 rounded-xl border border-slate-200/80 bg-white space-y-1">
                <div className="text-[10px] font-bold uppercase text-text-secondary">
                  API Ước lượng CEFR (/estimate-cefr)
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-xs font-extrabold bg-brand-primarySoft text-brand-primary">
                    {probeResult.diagnostics.cefr?.cefr || 'N/A'}
                  </span>
                  <span className="text-xs font-semibold text-brand-ink">
                    {probeResult.diagnostics.cefr?.confidence || ''}
                  </span>
                </div>
                <div className="text-[10px] text-text-secondary truncate">
                  {probeResult.diagnostics.cefr?.reasoning || probeResult.diagnostics.cefr?.source}
                </div>
              </div>

              <div className="p-3 rounded-xl border border-slate-200/80 bg-white space-y-1">
                <div className="text-[10px] font-bold uppercase text-text-secondary">
                  API Dịch thuật Anh-Việt (/translate)
                </div>
                <div className="text-xs font-bold text-emerald-700 line-clamp-2">
                  {probeResult.diagnostics.translation?.translation || 'Không có bản dịch'}
                </div>
                <div className="text-[10px] text-text-secondary truncate">
                  Engine: <strong>{probeResult.diagnostics.translation?.source || 'none'}</strong>
                  {probeResult.diagnostics.translation?.alternatives?.length
                    ? ` · Gợi ý: ${probeResult.diagnostics.translation.alternatives.slice(0, 3).join(', ')}`
                    : ''}
                </div>
              </div>
            </div>

            {/* Warnings */}
            {probeResult.lookup.warnings.length > 0 && (
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 space-y-0.5">
                {probeResult.lookup.warnings.map((w, i) => (
                  <div key={i}>• {w}</div>
                ))}
              </div>
            )}

            {/* Candidates & Senses List */}
            {probeResult.lookup.candidates.length > 0 ? (
              <div className="space-y-2">
                {probeResult.lookup.candidates.map((cand, ci) => (
                  <div key={ci} className="border border-slate-200/80 rounded-xl divide-y divide-slate-100 bg-white">
                    <div className="px-3 py-2 bg-slate-50/80 flex items-center justify-between text-xs">
                      <div className="font-bold text-brand-ink">
                        {cand.lemma} <span className="text-brand-primary font-mono">({cand.partOfSpeech})</span>
                      </div>
                      <span className="text-[10px] font-mono text-text-secondary">{cand.providerEntryRef}</span>
                    </div>
                    {cand.senses.map((sense, si) => (
                      <div key={si} className="p-3 space-y-1.5 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-semibold text-brand-ink">
                            <span className="text-brand-primary font-mono mr-1.5">#{si + 1}</span>
                            {sense.definition.value || '(Không có định nghĩa)'}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {sense.provider && (
                              <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-mono text-[10px]">
                                {sense.provider}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => handlePrefillFromProbe(cand.lemma, cand.partOfSpeech, sense)}
                              className="px-2 py-0.5 rounded bg-brand-primarySoft text-brand-primary hover:bg-brand-primary hover:text-white font-semibold text-[10px] transition-colors"
                            >
                              + Đưa vào Kho Local
                            </button>
                          </div>
                        </div>
                        {sense.meaningVi?.value && (
                          <div className="text-emerald-700 font-medium">🇻🇳 Nghĩa VI: {sense.meaningVi.value}</div>
                        )}
                        {sense.examples.items.length > 0 && (
                          <div className="text-[11px] text-text-secondary italic">
                            VD: &ldquo;{sense.examples.items[0]}&rdquo;
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2 text-[10px] text-text-secondary pt-0.5">
                          {sense.pronunciations.map((p, pi) => (
                            <span key={pi} className="font-mono bg-slate-100 px-1.5 py-0.2 rounded">
                              {p.dialect}: {p.ipa}
                            </span>
                          ))}
                          {sense.synonyms && sense.synonyms.length > 0 && (
                            <span>Đồng nghĩa: {sense.synonyms.slice(0, 6).join(', ')}</span>
                          )}
                          {sense.domains && sense.domains.length > 0 && (
                            <span>Lĩnh vực: {sense.domains.join(', ')}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-text-secondary py-2">Không có ứng viên nghĩa nào trả về cho truy vấn này.</p>
            )}
          </div>
        )}
      </div>

      {/* SECTION 3: LOCAL OPEN-DATA DICTIONARY CORPUS MANAGER */}
      <div className="bg-surface-base border border-slate-200/80 rounded-xl p-4 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-xs font-bold text-brand-ink uppercase tracking-wider flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-brand-primary" />
              <span>
                3. Quản lý Kho Từ điển Nội bộ PostgreSQL (Local Corpus:{' '}
                {(overview?.localCorpus.totalEntries ?? entriesList.total ?? 0).toLocaleString('vi-VN')} mục từ)
              </span>
            </h2>
            <p className="text-[11px] text-text-secondary mt-0.5">
              Quản lý dữ liệu từ điển mở (Kaikki / Wiktionary & Open English WordNet) lưu trực tiếp trong PostgreSQL, ưu tiên tra cứu 0ms không tốn hạn mức API.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowEntryForm(!showEntryForm)}
            className={btnPrimary}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{showEntryForm ? 'Đóng biểu mẫu' : 'Thêm / Cập nhật Mục từ Local'}</span>
          </button>
        </div>

        {/* Upsert Local Dictionary Entry Form */}
        {showEntryForm && (
          <form
            onSubmit={handleSaveEntry}
            className="p-4 rounded-xl bg-indigo-50/40 border border-indigo-200/80 space-y-3"
          >
            <div className="text-xs font-bold text-brand-ink flex items-center justify-between">
              <span>Biên tập Mục từ điển Nội bộ (Upsert vào PostgreSQL)</span>
              <span className="text-[10px] font-normal text-text-secondary">
                Tự động chuẩn hóa NFC & xóa cache tra cứu sau khi lưu
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">Kho dữ liệu</label>
                <select
                  className={`${input} w-full`}
                  value={formProvider}
                  onChange={e => setFormProvider(e.target.value as 'local_kaikki' | 'local_wordnet')}
                >
                  <option value="local_kaikki">Kaikki / Wiktionary Local</option>
                  <option value="local_wordnet">Open English WordNet Local</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">Từ vựng (Lemma) *</label>
                <input
                  required
                  className={`${input} w-full font-semibold`}
                  value={formLemma}
                  onChange={e => setFormLemma(e.target.value)}
                  placeholder="VD: resilient"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">Từ loại (POS) *</label>
                <select
                  className={`${input} w-full`}
                  value={formPos}
                  onChange={e => setFormPos(e.target.value as DictionaryPos)}
                >
                  {POS_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">Phiên âm IPA</label>
                <input
                  className={`${input} w-full font-mono`}
                  value={formIpa}
                  onChange={e => setFormIpa(e.target.value)}
                  placeholder="/rɪˈzɪl.jənt/"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">Cấp độ CEFR</label>
                <select
                  className={`${input} w-full`}
                  value={formCefr}
                  onChange={e => setFormCefr(e.target.value as any)}
                >
                  {['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'unknown'].map(c => (
                    <option key={c} value={c}>
                      {c === 'unknown' ? 'Chưa xác minh' : `Chuẩn ${c}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">
                  Định nghĩa tiếng Anh (Definition EN) *
                </label>
                <textarea
                  required
                  rows={2}
                  className={`${input} w-full`}
                  value={formDefEn}
                  onChange={e => setFormDefEn(e.target.value)}
                  placeholder="Able to withstand or recover quickly from difficult conditions..."
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">
                  Nghĩa tiếng Việt chuẩn (Meaning VI)
                </label>
                <textarea
                  rows={2}
                  className={`${input} w-full`}
                  value={formMeaningVi}
                  onChange={e => setFormMeaningVi(e.target.value)}
                  placeholder="Kiên cường, có khả năng phục hồi nhanh..."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">
                  Câu ví dụ tiếng Anh (Mỗi dòng 1 câu)
                </label>
                <textarea
                  rows={2}
                  className={`${input} w-full`}
                  value={formExamples}
                  onChange={e => setFormExamples(e.target.value)}
                  placeholder="She is a resilient leader who adapts to every crisis."
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">
                  Dịch câu ví dụ tiếng Việt
                </label>
                <textarea
                  rows={2}
                  className={`${input} w-full`}
                  value={formExampleVi}
                  onChange={e => setFormExampleVi(e.target.value)}
                  placeholder="Cô ấy là một nhà lãnh đạo kiên cường..."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">
                  Từ đồng nghĩa (Cách nhau bởi dấu phẩy)
                </label>
                <input
                  className={`${input} w-full`}
                  value={formSynonyms}
                  onChange={e => setFormSynonyms(e.target.value)}
                  placeholder="strong, tough, adaptable"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">
                  Từ trái nghĩa (Cách nhau bởi dấu phẩy)
                </label>
                <input
                  className={`${input} w-full`}
                  value={formAntonyms}
                  onChange={e => setFormAntonyms(e.target.value)}
                  placeholder="fragile, vulnerable"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">
                  Lĩnh vực (Domains - cách nhau dấu phẩy)
                </label>
                <input
                  className={`${input} w-full`}
                  value={formDomains}
                  onChange={e => setFormDomains(e.target.value)}
                  placeholder="psychology, business, engineering"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className={btn} onClick={() => setShowEntryForm(false)}>
                Hủy
              </button>
              <button type="submit" disabled={savingEntry} className={btnPrimary}>
                {savingEntry ? 'Đang lưu...' : 'Lưu vào Kho Từ điển Nội bộ'}
              </button>
            </div>
          </form>
        )}

        {/* Filter Bar for Local Entries */}
        <form
          className="flex flex-wrap gap-2"
          onSubmit={e => {
            e.preventDefault();
            setEntrySearch(entryFilterQ.trim());
          }}
        >
          <input
            className={`${input} w-60`}
            placeholder="Tìm từ trong kho Local DB..."
            value={entryFilterQ}
            onChange={e => setEntryFilterQ(e.target.value)}
          />
          <select
            className={input}
            value={entryFilterProvider}
            onChange={e => setEntryFilterProvider(e.target.value)}
            aria-label="Lọc kho từ điển"
          >
            <option value="">Mọi nguồn Local</option>
            <option value="local_kaikki">Kaikki / Wiktionary</option>
            <option value="local_wordnet">Open English WordNet</option>
          </select>
          <select
            className={input}
            value={entryFilterPos}
            onChange={e => setEntryFilterPos(e.target.value)}
            aria-label="Lọc từ loại"
          >
            <option value="">Mọi từ loại</option>
            {POS_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button className={btn}>Lọc mục từ</button>
        </form>

        <div className="border border-slate-200/80 rounded-xl divide-y divide-slate-100">
          {entriesList.items.map(row => {
            const firstSense = row.candidate?.senses?.[0];
            const ipa = firstSense?.pronunciations?.[0]?.ipa;
            return (
              <div key={row.id} className="p-3 flex items-start justify-between gap-3 text-xs hover:bg-slate-50/50">
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-brand-ink text-sm">{row.lemma}</span>
                    <span className="font-mono text-brand-primary font-semibold">({row.partOfSpeech})</span>
                    {ipa && <span className="font-mono text-text-secondary bg-slate-100 px-1.5 py-0.2 rounded">{ipa}</span>}
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700">
                      {row.provider} · {row.datasetVersion}
                    </span>
                  </div>
                  {firstSense?.definition?.value && (
                    <div className="text-slate-700 line-clamp-2">{firstSense.definition.value}</div>
                  )}
                  {firstSense?.meaningVi?.value && (
                    <div className="text-emerald-700 font-medium">🇻🇳 {firstSense.meaningVi.value}</div>
                  )}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button type="button" className={btn} onClick={() => handleEditLocalRow(row)}>
                    <Edit3 className="w-3 h-3" />
                    <span>Sửa</span>
                  </button>
                  <button type="button" className={`${btn} text-rose-600`} onClick={() => void handleDeleteLocalRow(row)}>
                    <Trash2 className="w-3 h-3" />
                    <span>Xóa</span>
                  </button>
                </div>
              </div>
            );
          })}
          <div className="px-3">
            <Status error={entriesList.error} loading={entriesList.loading} empty={!entriesList.items.length} />
          </div>
        </div>
        {entriesList.next && (
          <button className={btn} onClick={() => void entriesList.more()} disabled={entriesList.loading}>
            Tải thêm mục từ
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 5. OPERATIONS & QUEUES TAB
// ============================================================================
function OperationsTab() {
  const { notify } = useNotification();
  const [data, setData] = useState<OperationsOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<OperationsOverviewData>('/admin/operations/overview');
      setData(res);
    } catch (e: any) {
      setError(e?.message || 'Không thể tải dữ liệu vận hành.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRetryEmails = async () => {
    setRetrying(true);
    try {
      const res = await post<{ retriedCount: number }>('/admin/operations/retry-emails');
      notify.success('Đã đưa email lỗi vào hàng đợi gửi lại!', `Số lượng email: ${res.retriedCount}`);
      await load();
    } catch (e: any) {
      notify.error('Không thể thử lại email', e?.message || 'Lỗi máy chủ.');
    } finally {
      setRetrying(false);
    }
  };

  if (!data) return <Status error={error} loading={loading} empty={false} />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-surface-base border border-slate-200/80 rounded-xl p-3.5">
          <div className="text-[11px] text-text-secondary font-semibold">Phiên đăng nhập Active</div>
          <div className="text-2xl font-extrabold font-mono text-brand-primary">{data.activeSessions}</div>
        </div>
        <div className="bg-surface-base border border-slate-200/80 rounded-xl p-3.5">
          <div className="text-[11px] text-text-secondary font-semibold">Tệp Media R2 Ready</div>
          <div className="text-2xl font-extrabold font-mono text-indigo-600">{data.mediaReadyCount}</div>
        </div>
        <div className="bg-surface-base border border-slate-200/80 rounded-xl p-3.5">
          <div className="text-[11px] text-text-secondary font-semibold">Import (Completed / Failed)</div>
          <div className="text-2xl font-extrabold font-mono text-emerald-600">
            {data.imports.byStatus.completed ?? 0}{' '}
            <span className="text-sm text-rose-600">/ {data.imports.byStatus.failed ?? 0}</span>
          </div>
        </div>
        <div className="bg-surface-base border border-slate-200/80 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-text-secondary font-semibold">Email (Sent / Pending / Failed)</div>
            <div className="text-xl font-extrabold font-mono text-brand-ink">
              {data.emails.byStatus.sent ?? 0} / {data.emails.byStatus.pending ?? 0} /{' '}
              <span className="text-rose-600">{data.emails.byStatus.failed ?? 0}</span>
            </div>
          </div>
          {(data.emails.byStatus.failed ?? 0) > 0 && (
            <button type="button" onClick={handleRetryEmails} disabled={retrying} className={btn}>
              Gửi lại
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Import Jobs */}
        <div className="bg-surface-base border border-slate-200/80 rounded-xl p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-brand-ink uppercase tracking-wider">Tác vụ Import gần đây</h3>
            <button type="button" onClick={load} className={btn}>
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            {data.imports.recent.length === 0 ? (
              <p className="text-text-secondary py-2">Chưa có tác vụ import nào.</p>
            ) : (
              data.imports.recent.map(job => (
                <div key={job.id} className="py-2 flex items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold text-brand-ink">
                      {job.user.displayName} ({job.user.email})
                    </div>
                    <div className="text-[11px] text-text-secondary">
                      Policy: {job.policy} · {fmt(job.createdAt)}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      job.status === 'completed'
                        ? 'bg-emerald-50 text-emerald-700'
                        : job.status === 'failed'
                        ? 'bg-rose-50 text-rose-700'
                        : 'bg-amber-50 text-amber-800'
                    }`}
                  >
                    {job.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Outbox Emails */}
        <div className="bg-surface-base border border-slate-200/80 rounded-xl p-4 space-y-2.5">
          <h3 className="text-xs font-bold text-brand-ink uppercase tracking-wider">Hàng đợi Email Outbox gần đây</h3>
          <div className="divide-y divide-slate-100 text-xs">
            {data.emails.recent.length === 0 ? (
              <p className="text-text-secondary py-2">Chưa có email nào trong hàng đợi.</p>
            ) : (
              data.emails.recent.map(mail => (
                <div key={mail.id} className="py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-brand-ink truncate">{mail.subject}</div>
                    <div className="text-[11px] text-text-secondary truncate">
                      Tới: {mail.to} · Thử: {mail.attempts} lần · {fmt(mail.createdAt)}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      mail.status === 'sent'
                        ? 'bg-emerald-50 text-emerald-700'
                        : mail.status === 'failed'
                        ? 'bg-rose-50 text-rose-700'
                        : 'bg-amber-50 text-amber-800'
                    }`}
                  >
                    {mail.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 6. AUDIT LOGS TAB
// ============================================================================
function AuditTab() {
  const [action, setAction] = useState('');
  const list = usePaged<AuditItem>('/admin/audit-logs', { action: action || undefined });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-surface-base border border-slate-200/80 rounded-xl p-3">
        <div className="flex items-center gap-2">
          <ScrollText className="w-4 h-4 text-brand-primary" />
          <span className="text-xs font-bold text-brand-ink">Nhật ký Kiểm toán Bảo mật & Quản trị</span>
        </div>
        <select className={input} value={action} onChange={e => setAction(e.target.value)} aria-label="Lọc hành động">
          <option value="">Mọi hành động</option>
          <option value="admin.user">Tác vụ Người dùng (admin.user.*)</option>
          <option value="admin.deck">Tác vụ Bộ từ (admin.deck.*)</option>
          <option value="admin.dictionary">Tác vụ API Từ điển (admin.dictionary.*)</option>
          <option value="admin.operations">Tác vụ Vận hành (admin.operations.*)</option>
          <option value="admin.stats">Truy xuất Thống kê (admin.stats.*)</option>
          <option value="media.cleanup">Dọn dẹp Media (media.cleanup)</option>
        </select>
      </div>

      <div className="bg-surface-base border border-slate-200/80 rounded-xl divide-y divide-slate-100">
        {list.items.map(l => (
          <div key={l.id} className="px-3.5 py-2.5 text-xs space-y-1 hover:bg-slate-50/50">
            <div className="flex justify-between gap-3">
              <span className="font-mono font-bold text-brand-primary">{l.action}</span>
              <span className="text-text-secondary whitespace-nowrap font-mono text-[11px]">{fmt(l.occurredAt)}</span>
            </div>
            <div className="text-text-secondary text-[11px]">
              Thực hiện bởi: <strong>{l.actor ? `${l.actor.displayName} (${l.actor.email})` : 'Hệ thống tự động'}</strong>
              {l.resourceId && <span className="font-mono"> · Đối tượng: {l.resourceId}</span>}
            </div>
            {l.metadata != null && (
              <pre className="mt-1 text-[10px] bg-slate-50 border border-slate-200/60 rounded-lg p-2 overflow-x-auto font-mono text-slate-700">
                {JSON.stringify(l.metadata, null, 2)}
              </pre>
            )}
          </div>
        ))}
        <div className="px-3">
          <Status error={list.error} loading={list.loading} empty={!list.items.length} />
        </div>
      </div>
      {list.next && (
        <button className={btn} onClick={() => void list.more()} disabled={list.loading}>
          Tải thêm nhật ký
        </button>
      )}
    </div>
  );
}

// ============================================================================
// MAIN ADMIN CONSOLE VIEW
// ============================================================================
export function AdminView() {
  const { user } = useVocelune();
  const [tab, setTab] = useState<AdminTab>('overview');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const t = params.get('tab') as AdminTab | null;
      if (t && TABS.some(x => x.id === t)) {
        setTab(t);
      }
    };
    syncFromUrl();
    const onCustomTab = (e: Event) => {
      const custom = e as CustomEvent<AdminTab>;
      if (custom.detail && TABS.some(x => x.id === custom.detail)) {
        setTab(custom.detail);
      }
    };
    window.addEventListener('popstate', syncFromUrl);
    window.addEventListener('vocelune-admin-tab', onCustomTab);
    return () => {
      window.removeEventListener('popstate', syncFromUrl);
      window.removeEventListener('vocelune-admin-tab', onCustomTab);
    };
  }, []);

  const handleSelectTab = (nextTab: AdminTab) => {
    setTab(nextTab);
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', `/admin?tab=${nextTab}`);
      window.dispatchEvent(new CustomEvent('vocelune-admin-tab', { detail: nextTab }));
    }
  };

  if (user?.role !== 'admin') {
    return (
      <p role="alert" className="text-sm text-text-secondary py-8 text-center">
        Bạn không có quyền truy cập trang quản trị.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Admin Console Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-surface-base border border-slate-200/80 rounded-xl p-4 shadow-2xs">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-brand-primary" />
            <h1 className="text-base font-extrabold text-brand-ink">Trung tâm Quản trị Website & API Từ điển</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-brand-primary border border-indigo-200">
              Admin Console
            </span>
          </div>
          <p className="text-xs text-text-secondary">
            Điều hành người dùng, kiểm duyệt bộ từ công khai, giám sát 9 nguồn API từ điển, kho dữ liệu Kaikki/WordNet và nhật ký hệ thống.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/explore" className={btn}>
            <Globe className="w-3.5 h-3.5 text-brand-primary" />
            <span>Xem Cổng Công khai</span>
          </Link>
          <Link href="/profile" className={btn}>
            <ShieldCheck className="w-3.5 h-3.5 text-brand-primary" />
            <span>Hồ sơ Quản trị</span>
          </Link>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-1 border-b border-slate-200/80 overflow-x-auto" role="tablist">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => handleSelectTab(id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 -mb-px whitespace-nowrap transition-colors ${
              tab === id
                ? 'border-brand-primary text-brand-primary bg-brand-primarySoft/30 rounded-t-lg'
                : 'border-transparent text-text-secondary hover:text-brand-ink'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'overview' && <OverviewTab onSwitchTab={handleSelectTab} />}
      {tab === 'users' && <UsersTab />}
      {tab === 'decks' && <DecksTab />}
      {tab === 'dictionary' && <DictionaryTab />}
      {tab === 'operations' && <OperationsTab />}
      {tab === 'audit' && <AuditTab />}
    </div>
  );
}

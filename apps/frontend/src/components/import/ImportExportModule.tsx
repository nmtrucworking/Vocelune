'use client';
import { useState, useEffect } from 'react';
import { useVocelune } from '@/context/VoceluneContext';
import { api, post, downloadApi } from '@/lib/api';
type Job = { id: string; status: string; rows: { rowNumber: number; data?: { word: string; partOfSpeech: string; meaningVi: string }; status: string; error?: unknown; duplicateId?: string }[]; result?: { created: number; updated: number; skipped: number; failed: number } };
export function ImportExportModule() {
  const { decks, refresh } = useVocelune();
  const [history, setHistory] = useState<{ id: string; status: string; createdAt: string }[]>([]);
  useEffect(() => { void api<typeof history>('/imports').then(setHistory).catch(() => {}); }, []);
  const [deckId, setDeckId] = useState(decks[0]?.id || '');
  const [policy, setPolicy] = useState('skip'), [job, setJob] = useState<Job | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const run = async (action: () => Promise<void>) => { setBusy(true); setError(''); try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Không thể xử lý tệp.'); } finally { setBusy(false); } };
  const upload = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) throw new Error('Tệp tối đa 10 MB.');
    const form = new FormData(); form.append('file', file); form.append('deckId', deckId); form.append('policy', policy);
    setJob(await api<Job>('/imports/upload', { method: 'POST', body: form, headers: { 'Idempotency-Key': crypto.randomUUID() } }));
  };
  const commit = async () => {
    if (!job) return;
    let result = await post<Job>(`/imports/${job.id}/commit`); setJob(result);
    // Polling is bounded; the persisted job remains resumable after leaving the page.
    for (let i = 0; i < 60 && ['queued', 'processing'].includes(result.status); i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      result = await api<Job>(`/imports/${job.id}`); setJob(result);
    }
    await refresh();
    if (['queued', 'processing'].includes(result.status)) setError('Tác vụ vẫn đang chạy. Dùng “Kiểm tra trạng thái” để xem lại.');
  };
  return <div className="max-w-5xl mx-auto space-y-6">
    <h1 className="font-bold text-2xl">Nhập & Xuất dữ liệu</h1>
    <p className="text-sm text-text-secondary">CSV/XLSX tối đa 5.000 dòng, 10 MB. Hệ thống kiểm tra từng dòng và giữ riêng các nghĩa khác nhau của cùng một từ.</p>
    {error && <p role="alert" className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-3 text-sm">{error}</p>}
    {history.length > 0 && <label className="block text-sm">Mở lại lượt nhập trước<select className="block mt-2 border rounded-lg p-2 w-full" value="" disabled={busy} onChange={e => { if (e.target.value) void run(async () => setJob(await api<Job>(`/imports/${e.target.value}`))); }}><option value="">Chọn lượt nhập</option>{history.map(j => <option key={j.id} value={j.id}>{new Date(j.createdAt).toLocaleString('vi-VN')} · {j.status}</option>)}</select></label>}
    <section className="bg-white border rounded-xl p-6 space-y-4">
      <h2 className="font-semibold">1. Chọn bộ từ và tệp nhập</h2>
      <div className="flex gap-3 flex-wrap">{(['csv', 'xlsx'] as const).map(format => <button key={format} disabled={busy} className="border rounded-lg px-4 py-2 text-sm" onClick={() => void run(() => downloadApi(`/imports/template?format=${format}`, `vocelune-template.${format}`))}>Tải mẫu .{format}</button>)}</div>
      <p className="text-xs text-slate-500">Các dòng mẫu có example_only=true và sẽ được bỏ qua. Chỉ nhập nội dung bạn sở hữu hoặc được phép sử dụng.</p>
      <label className="block text-sm">Bộ từ đích<select disabled={busy} value={deckId} onChange={e => { setDeckId(e.target.value); setJob(null); }} className="block border rounded-lg p-2 mt-1 w-full">{decks.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
      <label className="block text-sm">Khi trùng đúng từ + từ loại + nghĩa<select disabled={busy} value={policy} onChange={e => { setPolicy(e.target.value); setJob(null); }} className="block border rounded-lg p-2 mt-1 w-full"><option value="skip">Bỏ qua</option><option value="merge">Cập nhật ghi chú và ví dụ</option><option value="create_new">Tạo bản riêng</option></select></label>
      <input disabled={busy} type="file" accept=".csv,.xlsx" aria-label="Chọn tệp từ vựng" onChange={e => { const file = e.target.files?.[0]; if (file) void run(() => upload(file)); e.target.value = ''; }} />
    </section>
    {job && <section className="bg-white border rounded-xl p-6 space-y-4"><h2 className="font-semibold">2. Kiểm tra & xác nhận</h2><p className="text-sm">{job.rows.length} dòng · Trạng thái: {job.status}</p>
      <div className="overflow-auto max-h-96"><table className="w-full text-xs text-left"><thead><tr>{['Dòng', 'Từ', 'Từ loại', 'Nghĩa', 'Kết quả'].map(h => <th key={h} className="p-2 border-b">{h}</th>)}</tr></thead><tbody>{job.rows.slice(0, 100).map(row => <tr key={row.rowNumber}><td className="p-2 border-b">{row.rowNumber}</td><td className="p-2 border-b">{row.data?.word}</td><td className="p-2 border-b">{row.data?.partOfSpeech}</td><td className="p-2 border-b">{row.data?.meaningVi}</td><td className="p-2 border-b">{row.status}{row.duplicateId ? ' · Đã tồn tại' : ''}{row.error ? ` · ${typeof row.error === 'string' ? row.error : JSON.stringify(row.error)}` : ''}</td></tr>)}</tbody></table></div>
      {job.rows.length > 100 && <p className="text-xs">Hiển thị 100 dòng đầu.</p>}
      {job.result && <p className="text-sm">Đã tạo: {job.result.created} · Cập nhật: {job.result.updated} · Bỏ qua: {job.result.skipped} · Lỗi: {job.result.failed}</p>}
      <div className="flex gap-3"><button disabled={busy || !['preview', 'failed'].includes(job.status)} onClick={() => void run(commit)} className="bg-brand-primary text-white px-4 py-2 rounded-lg disabled:opacity-50">{busy ? 'Đang xử lý…' : 'Xác nhận nhập'}</button><button disabled={busy} className="border rounded-lg px-4 py-2 text-sm" onClick={() => void run(async () => { setJob(await api(`/imports/${job.id}`)); await refresh(); })}>Kiểm tra trạng thái</button><button disabled={busy} className="border rounded-lg px-4 py-2 text-sm" onClick={() => void run(() => downloadApi(`/imports/${job.id}/errors.csv`, 'vocelune-import-errors.csv'))}>Tải báo cáo lỗi</button></div>
    </section>}
    <section className="bg-white border rounded-xl p-6 space-y-4"><h2 className="font-semibold">Xuất dữ liệu cá nhân</h2><p className="text-sm text-text-secondary">JSON gồm hồ sơ, kho từ, bộ từ, lịch thẻ, lịch sử ôn và kiểm tra. CSV/XLSX chứa kho từ có thể nhập lại.</p><div className="flex gap-3">{(['csv', 'xlsx', 'json'] as const).map(format => <button disabled={busy} key={format} className="border rounded-lg px-4 py-2 text-sm" onClick={() => void run(() => downloadApi('/exports', `vocelune-export.${format}`, { format }))}>Xuất .{format}</button>)}</div></section>
  </div>;
}

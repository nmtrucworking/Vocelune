'use client';

import { useState, useEffect, useRef } from 'react';
import { useVocelune } from '@/context/VoceluneContext';
import { useNotification } from '@/context/NotificationContext';
import { api, post, downloadApi } from '@/lib/api';
import { Upload, CheckCircle2, AlertTriangle, FileSpreadsheet, RefreshCw, Download, Loader2 } from 'lucide-react';

type Job = {
  id: string;
  status: string;
  rows: {
    rowNumber: number;
    data?: { word: string; partOfSpeech: string; meaningVi: string };
    status: string;
    error?: unknown;
    duplicateId?: string;
  }[];
  result?: { created: number; updated: number; skipped: number; failed: number };
};

export function ImportExportModule() {
  const { decks, refresh } = useVocelune();
  const { notify } = useNotification();
  const [history, setHistory] = useState<{ id: string; status: string; createdAt: string }[]>([]);
  const [deckId, setDeckId] = useState(decks[0]?.id || '');
  const [policy, setPolicy] = useState('skip');
  const [job, setJob] = useState<Job | null>(null);
  const [busy, setBusy] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    void api<typeof history>('/imports').then(setHistory).catch(() => {});
  }, []);

  useEffect(() => {
    if (!deckId && decks.length > 0) {
      setDeckId(decks[0].id);
    }
  }, [decks, deckId]);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Không thể xử lý yêu cầu.';
      notify.error('Thao tác không thành công', msg);
    } finally {
      setBusy(false);
    }
  };

  const upload = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      notify.error('Tệp quá lớn', 'Kích thước tệp tối đa cho phép là 10 MB.');
      return;
    }
    const targetDeckId = deckId || decks[0]?.id;
    if (!targetDeckId) {
      notify.warning('Chưa có bộ từ', 'Vui lòng tạo ít nhất một bộ từ trước khi nhập.');
      return;
    }
    const form = new FormData();
    form.append('file', file);
    form.append('deckId', targetDeckId);
    form.append('policy', policy);

    const uploadedJob = await api<Job>('/imports/upload', {
      method: 'POST',
      body: form,
      headers: { 'Idempotency-Key': crypto.randomUUID() },
    });
    setJob(uploadedJob);
    notify.info('Tải tệp thành công', `Đã quét ${uploadedJob.rows.length} dòng. Vui lòng kiểm tra bản xem trước bên dưới.`);
  };

  const pollJobStatus = (jobId: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    let attempts = 0;
    pollingRef.current = setInterval(async () => {
      attempts++;
      try {
        const current = await api<Job>(`/imports/${jobId}`);
        setJob(current);

        if (current.status === 'completed') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setBusy(false);
          await refresh();
          notify.success(
            'Nhập dữ liệu thành công!',
            `Đã tạo ${current.result?.created ?? 0} từ, cập nhật ${current.result?.updated ?? 0} từ, bỏ qua ${current.result?.skipped ?? 0} từ.`,
            { browserPush: true }
          );
        } else if (current.status === 'failed') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setBusy(false);
          notify.error('Nhập dữ liệu thất bại', 'Quá trình nhập gặp lỗi. Bạn có thể tải báo cáo lỗi để kiểm tra.');
        } else if (attempts >= 60) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setBusy(false);
          notify.info('Tác vụ đang tiếp tục chạy nền', 'Bạn có thể rời trang hoặc bấm "Kiểm tra trạng thái" bất cứ lúc nào.');
        }
      } catch {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setBusy(false);
      }
    }, 1200);
  };

  const commit = async () => {
    if (!job) return;
    setBusy(true);
    notify.info('Đang bắt đầu nhập bất đồng bộ...', 'Hệ thống đang tiến hành xử lý các dòng từ vựng.');

    try {
      const queuedJob = await post<Job>(`/imports/${job.id}/commit`);
      setJob(queuedJob);

      if (queuedJob.status === 'completed') {
        setBusy(false);
        await refresh();
        notify.success('Nhập dữ liệu hoàn tất!', `Đã tạo ${queuedJob.result?.created ?? 0} từ mới.`);
      } else {
        pollJobStatus(job.id);
      }
    } catch (e) {
      setBusy(false);
      const msg = e instanceof Error ? e.message : 'Không thể bắt đầu nhập dữ liệu.';
      notify.error('Lỗi khởi động nhập', msg);
    }
  };

  // Compute progress percentage
  const totalRows = job?.rows?.length || 0;
  const processedRows = job?.rows?.filter((r) => r.status !== 'pending').length || 0;
  const progressPercent = totalRows > 0 ? Math.round((processedRows / totalRows) * 100) : 0;
  const isProcessing = Boolean(job && ['queued', 'processing'].includes(job.status));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-bold text-2xl text-brand-ink">Nhập & Xuất dữ liệu</h1>
          <p className="text-sm text-text-secondary mt-1">
            CSV / XLSX tối đa 5.000 dòng, 10 MB. Hệ thống xử lý bất đồng bộ an toàn và lưu lịch sử.
          </p>
        </div>
      </div>

      {history.length > 0 && (
        <div className="bg-white border border-slate-200/90 rounded-card p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <label className="text-sm font-medium text-brand-ink flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-brand-primary" />
            Mở lại lượt nhập trước đó:
          </label>
          <select
            className="border rounded-control p-2 text-sm bg-surface-base text-brand-ink min-w-[280px]"
            value=""
            disabled={busy}
            onChange={(e) => {
              if (e.target.value) {
                void run(async () => {
                  const pastJob = await api<Job>(`/imports/${e.target.value}`);
                  setJob(pastJob);
                  if (['queued', 'processing'].includes(pastJob.status)) {
                    pollJobStatus(pastJob.id);
                  }
                });
              }
            }}
          >
            <option value="">Chọn một lượt nhập đã lưu</option>
            {history.map((j) => (
              <option key={j.id} value={j.id}>
                {new Date(j.createdAt).toLocaleString('vi-VN')} · {j.status}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Section 1: File Selection */}
      <section className="bg-surface-base border border-slate-200/90 rounded-card p-6 space-y-5 shadow-subtle">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-base text-brand-ink">1. Chọn bộ từ và tệp nhập</h2>
          <div className="flex gap-2">
            {(['csv', 'xlsx'] as const).map((format) => (
              <button
                key={format}
                disabled={busy}
                className="inline-flex items-center gap-1.5 border border-slate-200 rounded-control px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                onClick={() =>
                  void run(() =>
                    downloadApi(`/imports/template?format=${format}`, `vocelune-template.${format}`)
                  )
                }
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                Mẫu .{format}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-text-secondary">
          Dòng mẫu có <code className="bg-slate-100 px-1 py-0.5 rounded text-brand-ink">example_only=true</code> sẽ được bỏ qua. Hãy đảm bảo tệp chứa các cột tối thiểu: <strong>word, part_of_speech, meaning_vi</strong>.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Bộ từ đích</label>
            <select
              disabled={busy}
              value={deckId}
              onChange={(e) => {
                setDeckId(e.target.value);
                setJob(null);
              }}
              className="w-full border border-slate-200 rounded-control p-2.5 text-sm bg-surface-base text-brand-ink"
            >
              {decks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.topicGroup})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Khi trùng đúng từ + từ loại + nghĩa
            </label>
            <select
              disabled={busy}
              value={policy}
              onChange={(e) => {
                setPolicy(e.target.value);
                setJob(null);
              }}
              className="w-full border border-slate-200 rounded-control p-2.5 text-sm bg-surface-base text-brand-ink"
            >
              <option value="skip">Bỏ qua (Giữ nguyên từ cũ)</option>
              <option value="merge">Cập nhật ghi chú và ví dụ mới</option>
              <option value="create_new">Tạo bản riêng (Cho phép trùng)</option>
            </select>
          </div>
        </div>

        <div className="mt-2">
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 hover:border-brand-primary rounded-xl p-6 cursor-pointer bg-slate-50/50 hover:bg-brand-canvas transition-colors">
            <Upload className="w-8 h-8 text-brand-primary mb-2" />
            <span className="text-sm font-medium text-brand-ink">Chọn tệp CSV hoặc XLSX từ máy</span>
            <span className="text-xs text-text-secondary mt-1">Kéo thả hoặc click để duyệt tệp (Tối đa 10 MB)</span>
            <input
              disabled={busy}
              type="file"
              accept=".csv,.xlsx"
              className="hidden"
              aria-label="Chọn tệp từ vựng"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void run(() => upload(file));
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </section>

      {/* Section 2: Review & Async Progress */}
      {job && (
        <section className="bg-surface-base border border-slate-200/90 rounded-card p-6 space-y-5 shadow-subtle">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-base text-brand-ink">2. Kiểm tra & xác nhận</h2>
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                job.status === 'completed'
                  ? 'bg-emerald-100 text-emerald-800'
                  : job.status === 'failed'
                  ? 'bg-rose-100 text-rose-800'
                  : isProcessing
                  ? 'bg-amber-100 text-amber-800 flex items-center gap-1.5'
                  : 'bg-slate-100 text-slate-800'
              }`}
            >
              {isProcessing && <Loader2 className="w-3 h-3 animate-spin" />}
              {job.status === 'completed'
                ? 'Hoàn thành'
                : job.status === 'queued'
                ? 'Đang đợi xử lý...'
                : job.status === 'processing'
                ? 'Đang xử lý...'
                : job.status === 'failed'
                ? 'Thất bại'
                : 'Bản xem trước'}
            </span>
          </div>

          {/* Async Progress Bar */}
          {isProcessing && (
            <div className="space-y-2 p-4 bg-amber-50/60 border border-amber-200/80 rounded-xl">
              <div className="flex justify-between text-xs font-medium text-amber-900">
                <span>Tiến trình xử lý bất đồng bộ:</span>
                <span>{processedRows} / {totalRows} từ ({progressPercent}%)</span>
              </div>
              <div className="w-full bg-amber-200/50 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-brand-primary h-full transition-all duration-300 rounded-full"
                  style={{ width: `${Math.max(5, progressPercent)}%` }}
                />
              </div>
              <p className="text-[11px] text-amber-700">
                Tác vụ đang chạy nền an toàn. Bạn có thể chuyển tab hoặc làm việc khác trong khi hệ thống nạp dữ liệu.
              </p>
            </div>
          )}

          {job.status === 'completed' && job.result && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl p-4 text-sm flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong>Nhập thành công hoàn toàn!</strong>
                <p className="text-xs text-emerald-800 mt-0.5">
                  Đã tạo mới <strong>{job.result.created}</strong> từ, cập nhật <strong>{job.result.updated}</strong> từ, bỏ qua <strong>{job.result.skipped}</strong> từ
                  {job.result.failed > 0 ? `, phát hiện ${job.result.failed} lỗi` : ''}.
                </p>
              </div>
            </div>
          )}

          {/* Table preview */}
          <div className="overflow-auto max-h-80 border border-slate-100 rounded-lg">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 sticky top-0">
                <tr>
                  {['Dòng', 'Từ', 'Từ loại', 'Nghĩa tiếng Việt', 'Trạng thái'].map((h) => (
                    <th key={h} className="p-2.5 font-semibold border-b border-slate-200">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {job.rows.slice(0, 100).map((row) => (
                  <tr key={row.rowNumber} className="hover:bg-slate-50/50">
                    <td className="p-2.5 text-slate-500 font-sans">{row.rowNumber}</td>
                    <td className="p-2.5 font-semibold text-brand-ink">{row.data?.word}</td>
                    <td className="p-2.5 text-slate-600 font-sans">{row.data?.partOfSpeech}</td>
                    <td className="p-2.5 font-sans max-w-xs truncate">{row.data?.meaningVi}</td>
                    <td className="p-2.5 font-sans">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${
                          row.status === 'created'
                            ? 'bg-emerald-100 text-emerald-800'
                            : row.status === 'updated'
                            ? 'bg-blue-100 text-blue-800'
                            : row.status === 'skipped'
                            ? 'bg-slate-100 text-slate-600'
                            : row.status === 'failed'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {row.status}
                        {row.duplicateId ? ' (Trùng)' : ''}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {job.rows.length > 100 && (
            <p className="text-xs text-text-secondary">Hiển thị 100 trên tổng số {job.rows.length} dòng.</p>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 flex-wrap">
            {job.status !== 'completed' && (
              <button
                disabled={busy || isProcessing}
                onClick={() => void run(commit)}
                className="bg-brand-primary text-white font-medium px-5 py-2.5 rounded-control disabled:opacity-50 flex items-center gap-2 shadow-subtle hover:bg-brand-primary/95 transition-all text-sm"
              >
                {busy || isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Đang xử lý nền...
                  </>
                ) : (
                  'Xác nhận nhập bất đồng bộ'
                )}
              </button>
            )}

            <button
              disabled={busy}
              className="border border-slate-200 rounded-control px-4 py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-1.5"
              onClick={() =>
                void run(async () => {
                  const updated = await api<Job>(`/imports/${job.id}`);
                  setJob(updated);
                  await refresh();
                  notify.info('Đã cập nhật trạng thái', `Trạng thái hiện tại: ${updated.status}`);
                })
              }
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Kiểm tra trạng thái
            </button>

            <button
              disabled={busy}
              className="border border-slate-200 rounded-control px-4 py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-1.5"
              onClick={() =>
                void run(() =>
                  downloadApi(`/imports/${job.id}/errors.csv`, 'vocelune-import-errors.csv')
                )
              }
            >
              <Download className="w-3.5 h-3.5" />
              Tải báo cáo lỗi
            </button>
          </div>
        </section>
      )}

      {/* Section 3: Export */}
      <section className="bg-surface-base border border-slate-200/90 rounded-card p-6 space-y-4 shadow-subtle">
        <h2 className="font-semibold text-base text-brand-ink">Xuất dữ liệu cá nhân</h2>
        <p className="text-sm text-text-secondary">
          JSON bao gồm hồ sơ, kho từ, bộ từ, lịch thẻ, lịch sử ôn và kiểm tra FSRS. CSV/XLSX chứa kho từ chuẩn hóa có thể nhập lại.
        </p>
        <div className="flex gap-3">
          {(['csv', 'xlsx', 'json'] as const).map((format) => (
            <button
              disabled={busy}
              key={format}
              className="border border-slate-200 rounded-control px-4 py-2 text-sm font-medium hover:bg-slate-50 transition-colors"
              onClick={() =>
                void run(() =>
                  downloadApi('/exports', `vocelune-export.${format}`, { format })
                )
              }
            >
              Xuất .{format.toUpperCase()}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileText,
  Sparkles,
  ArrowRight,
  Database,
  Trash2,
} from 'lucide-react';
import { useVocelune } from '@/context/VoceluneContext';
import { VocabItem, PartOfSpeech, CEFRLevel } from '@/types';

export function ImportExportModule() {
  const { vocabItems, decks, importVocabItems } = useVocelune();

  const [dragActive, setDragActive] = useState(false);
  const [parsedRows, setParsedRows] = useState<Partial<VocabItem>[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [selectedDeckId, setSelectedDeckId] = useState(decks[0]?.id || 'deck_oxford');
  const [importResult, setImportResult] = useState<{
    created: number;
    updated: number;
    skipped: number;
  } | null>(null);

  // Template CSV content
  const handleDownloadTemplate = () => {
    const csvContent =
      'word,part_of_speech,meaning_vi,definition_en,example_en,example_vi,ipa,cefr_level,tags,notes\n' +
      'meticulous,adjective,"Tỉ mỉ, cẩn thận từng chi tiết","Very careful and with great attention to every detail.","He is meticulous about keeping his laboratory clean.","Anh ấy rất tỉ mỉ trong việc giữ phòng thí nghiệm sạch sẽ.","/məˈtɪk.jə.ləs/",C1,"academic;personality","Collocation: meticulous planning."\n' +
      'innovate,verb,"Đổi mới, sáng tạo","To introduce changes and new ideas.","Companies must innovate constantly to stay competitive.","Các công ty phải không ngừng đổi mới để duy trì tính cạnh tranh.","/ˈɪn.ə.veɪt/",B2,"business;action","Noun: innovation."\n';

    const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), csvContent], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'vocelune_vocabulary_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export all user data to CSV
  const handleExportCSV = () => {
    const headers = [
      'word',
      'part_of_speech',
      'meaning_vi',
      'definition_en',
      'example_en',
      'example_vi',
      'phonetic',
      'cefr',
      'tags',
      'notes',
    ];

    // Sanitize CSV values to avoid formula injection (=, +, -, @)
    const sanitize = (str: string = '') => {
      let cleaned = str.replace(/"/g, '""');
      if (/^[=+\-@]/.test(cleaned)) cleaned = "'" + cleaned;
      return `"${cleaned}"`;
    };

    const rows = vocabItems.map((v) =>
      [
        sanitize(v.word),
        sanitize(v.partOfSpeech),
        sanitize(v.meaningVi),
        sanitize(v.definitionEn),
        sanitize(v.exampleEn),
        sanitize(v.exampleVi),
        sanitize(v.phonetic),
        sanitize(v.cefr),
        sanitize(v.tags.join(';')),
        sanitize(v.notes),
      ].join(',')
    );

    const csvData = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), csvData], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `vocelune_backup_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export JSON
  const handleExportJSON = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(vocabItems, null, 2));
    const link = document.createElement('a');
    link.href = dataStr;
    link.setAttribute('download', `vocelune_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Parse uploaded CSV file
  const parseCSV = (content: string) => {
    const lines = content.split('\n').filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];

    const parsed: Partial<VocabItem>[] = [];

    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // Regex parsing for CSV with quotes support
      const cols: string[] = [];
      let inQuote = false;
      let curr = '';

      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          inQuote = !inQuote;
        } else if (char === ',' && !inQuote) {
          cols.push(curr.trim().replace(/^"|"$/g, ''));
          curr = '';
        } else {
          curr += char;
        }
      }
      cols.push(curr.trim().replace(/^"|"$/g, ''));

      if (cols[0] && cols[0].length > 0) {
        parsed.push({
          word: cols[0],
          partOfSpeech: (cols[1] || 'noun').toLowerCase() as PartOfSpeech,
          meaningVi: cols[2] || '',
          definitionEn: cols[3] || '',
          exampleEn: cols[4] || '',
          exampleVi: cols[5] || '',
          phonetic: cols[6] || `/${cols[0]}/`,
          cefr: (cols[7] || 'B2') as CEFRLevel,
          tags: cols[8] ? cols[8].split(';').map((t) => t.trim()) : ['imported'],
          notes: cols[9] || '',
        });
      }
    }

    return parsed;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const rows = parseCSV(text);
      setParsedRows(rows);
    };
    reader.readAsText(file);
  };

  // Commit Import
  const handleCommitImport = () => {
    if (parsedRows.length === 0) return;
    const result = importVocabItems(parsedRows, selectedDeckId);
    setImportResult(result);
    setParsedRows([]);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-brand-ink">Nhập & Xuất dữ liệu</h2>
        <p className="text-xs text-text-secondary mt-1">
          Đồng bộ bộ từ vựng cá nhân qua định dạng CSV/XLSX với quy tắc kiểm duyệt chống trùng lặp.
        </p>
      </div>

      {/* Import Card */}
      <div className="bg-surface-base border border-slate-200/90 rounded-card shadow-card p-6 md:p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-brand-primary" />
            <h3 className="text-sm font-semibold text-brand-ink">
              Nhập từ vựng từ file CSV
            </h3>
          </div>

          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-slate-100 hover:bg-slate-200 text-brand-ink font-semibold text-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Tải file mẫu (.csv)</span>
          </button>
        </div>

        {/* Upload Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            const file = e.dataTransfer.files?.[0];
            if (file) {
              setFileName(file.name);
              const reader = new FileReader();
              reader.onload = (event) => {
                const text = event.target?.result as string;
                setParsedRows(parseCSV(text));
              };
              reader.readAsText(file);
            }
          }}
          className={`border-2 border-dashed rounded-control p-8 text-center transition-all ${
            dragActive
              ? 'border-brand-primary bg-brand-primarySoft/40'
              : 'border-slate-300 hover:border-brand-primary bg-surface-subtle'
          }`}
        >
          <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-xs font-semibold text-brand-ink">
            Kéo thả file CSV vào đây hoặc chọn từ máy tính
          </p>
          <p className="text-[11px] text-text-secondary mt-1">
            Hỗ trợ định dạng UTF-8, tối đa 5.000 dòng/file.
          </p>

          <label className="mt-4 inline-block px-4 py-2 bg-brand-primary hover:bg-brand-primaryHover text-white rounded-control text-xs font-semibold cursor-pointer shadow-xs transition-all">
            <span>Chọn file từ thiết bị</span>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        </div>

        {/* Preview parsed rows */}
        {parsedRows.length > 0 && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-semibold text-brand-ink">
                  Xem trước dữ liệu ({parsedRows.length} từ)
                </h4>
                <p className="text-[11px] text-text-secondary">
                  File: <strong>{fileName}</strong>
                </p>
              </div>

              {/* Target Deck */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-secondary">Nhập vào bộ:</span>
                <select
                  value={selectedDeckId}
                  onChange={(e) => setSelectedDeckId(e.target.value)}
                  className="px-2.5 py-1 text-xs border rounded-control bg-surface-base font-medium"
                >
                  {decks.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Preview table */}
            <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-control">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-text-secondary sticky top-0 border-b">
                  <tr>
                    <th className="py-2 px-3">Từ vựng</th>
                    <th className="py-2 px-3">Từ loại</th>
                    <th className="py-2 px-3">Nghĩa tiếng Việt</th>
                    <th className="py-2 px-3">Cấp độ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedRows.slice(0, 10).map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-bold text-brand-ink">
                        {row.word}
                      </td>
                      <td className="py-2 px-3 italic text-text-secondary">
                        {row.partOfSpeech}
                      </td>
                      <td className="py-2 px-3 text-brand-ink">{row.meaningVi}</td>
                      <td className="py-2 px-3 font-semibold">{row.cefr}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {parsedRows.length > 10 && (
              <p className="text-[11px] text-slate-400 italic text-right">
                Hiển thị 10/{parsedRows.length} từ đầu tiên...
              </p>
            )}

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setParsedRows([])}
                className="px-3.5 py-2 text-xs font-semibold text-text-secondary hover:bg-slate-100 rounded-control"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleCommitImport}
                className="px-5 py-2 text-xs font-semibold text-white bg-brand-primary hover:bg-brand-primaryHover rounded-control shadow-sm flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Xác nhận nhập vào thư viện</span>
              </button>
            </div>
          </div>
        )}

        {/* Result Message */}
        {importResult && (
          <div className="p-4 rounded-control bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1">
            <div className="flex items-center gap-2 font-bold text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Nhập dữ liệu thành công!</span>
            </div>
            <p>
              Đã tạo mới <strong>{importResult.created}</strong> từ, cập nhật{' '}
              <strong>{importResult.updated}</strong> từ, bỏ qua{' '}
              <strong>{importResult.skipped}</strong> từ lỗi. Các thẻ FSRS đã sẵn sàng trong Thư viện.
            </p>
          </div>
        )}
      </div>

      {/* Export Section */}
      <div className="bg-surface-base border border-slate-200/90 rounded-card shadow-card p-6 md:p-8 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
          <Database className="w-5 h-5 text-brand-primary" />
          <h3 className="text-sm font-semibold text-brand-ink">
            Xuất dữ liệu kho từ vựng cá nhân
          </h3>
        </div>

        <p className="text-xs text-text-secondary leading-relaxed">
          Xuất toàn bộ kho từ vựng và lịch sử thẻ do bạn sở hữu. Dữ liệu được bảo mật và lọc bỏ các nội dung không có bản quyền xuất theo quy chuẩn FR-EXP-01.
        </p>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-brand-primary text-white font-semibold text-xs rounded-control hover:bg-brand-primaryHover shadow-xs transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất file CSV ({vocabItems.length} từ)</span>
          </button>

          <button
            onClick={handleExportJSON}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-brand-ink font-semibold text-xs rounded-control transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Xuất file JSON</span>
          </button>
        </div>
      </div>
    </div>
  );
}

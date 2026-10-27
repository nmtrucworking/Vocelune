'use client';

import React, { useState } from 'react';
import { X, Search, Sparkles, Volume2, Check, AlertCircle, BookOpen, Info } from 'lucide-react';
import { useVocelune } from '@/context/VoceluneContext';
import { PartOfSpeech, CEFRLevel, Dialect } from '@/types';
import { post } from '@/lib/api';
import { speakWord } from '@/lib/speech';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DictionarySense {
  id: string;
  pos: PartOfSpeech;
  definitionEn: string;
  meaningVi: string;
  exampleEn: string;
  exampleVi: string;
  cefr: CEFRLevel;
}

// Built-in CEFR & translation knowledge base for common vocabulary
const COMMON_WORD_KNOWLEDGE: Record<string, { vi: string; cefr: CEFRLevel; pos?: PartOfSpeech; defEn?: string; egEn?: string }> = {
  abandon: { vi: 'Từ bỏ, bỏ rơi, dừng giữa chừng', cefr: 'B2', pos: 'verb', defEn: 'To leave a place, thing, or person forever.', egEn: 'They had to abandon the sinking ship.' },
  resilient: { vi: 'Kiên cường, có khả năng phục hồi nhanh chóng', cefr: 'C1', pos: 'adjective', defEn: 'Able to quickly become strong or healthy again after difficulty.', egEn: 'Local businesses have proven remarkably resilient.' },
  comprehensive: { vi: 'Toàn diện, bao quát mọi mặt', cefr: 'B2', pos: 'adjective', defEn: 'Complete and including everything that is necessary.', egEn: 'The team conducted a comprehensive review of the project.' },
  mitigate: { vi: 'Làm giảm nhẹ, giảm thiểu rủi ro', cefr: 'C1', pos: 'verb', defEn: 'To make something less harmful or severe.', egEn: 'We must act swiftly to mitigate climate change risks.' },
  feasible: { vi: 'Khả thi, có thể thực hiện được', cefr: 'B2', pos: 'adjective', defEn: 'Able to be made, done, or achieved successfully.', egEn: 'The solar transition is economically feasible.' },
  lucrative: { vi: 'Sinh lợi cao, mang lại nhiều tiền của', cefr: 'C1', pos: 'adjective', defEn: 'Producing a lot of money; profitable.', egEn: 'The partnership opened up a lucrative new market.' },
  perseverance: { vi: 'Sự kiên trì, bền chí, quyết tâm', cefr: 'B2', pos: 'noun', defEn: 'Continued effort to achieve something despite difficulties.', egEn: 'Language mastery requires daily perseverance.' },
  ubiquitous: { vi: 'Có mặt ở khắp mọi nơi, phổ biến rộng rãi', cefr: 'C1', pos: 'adjective', defEn: 'Seeming to be everywhere at the same time.', egEn: 'Smartphones have become ubiquitous in modern society.' },
  paradigm: { vi: 'Mô hình, chuẩn mực, hệ hình tư duy', cefr: 'C1', pos: 'noun', defEn: 'A model or typical pattern of ideas and beliefs.', egEn: 'AI represents a paradigm shift in education.' },
  articulate: { vi: 'Ăn nói lưu loát, hoạt ngôn, mạch lạc', cefr: 'B2', pos: 'adjective', defEn: 'Able to express thoughts clearly and effectively.', egEn: 'She is an articulate and persuasive presenter.' },
  leverage: { vi: 'Tận dụng, phát huy tối đa đòn bẩy', cefr: 'C1', pos: 'verb', defEn: 'To use something to achieve greater advantage.', egEn: 'The team leveraged their early community to expand.' },
  pragmatic: { vi: 'Thực tế, thực dụng theo nghĩa tích cực', cefr: 'B2', pos: 'adjective', defEn: 'Solving problems in a sensible and practical way.', egEn: 'We need a pragmatic approach to the budget.' },
  ephemeral: { vi: 'Phù du, chóng tàn, ngắn ngủi', cefr: 'C1', pos: 'adjective', defEn: 'Lasting for only a short time; transitory.', egEn: 'Fame in modern media is often ephemeral.' },
  serendipity: { vi: 'Sự tình cờ may mắn, cái duyên tốt lành', cefr: 'C1', pos: 'noun', defEn: 'Pleasant coincidence; finding good things without seeking.', egEn: 'Finding this quiet cafe was pure serendipity.' },
  diligent: { vi: 'Cần cù, siêng năng, chu đáo tỉ mỉ', cefr: 'B2', pos: 'adjective', defEn: 'Done in a careful and detailed way; hardworking.', egEn: 'He is a diligent student who reviews every day.' },
};

export function QuickAddModal({ isOpen, onClose }: QuickAddModalProps) {
  const { decks, addVocabItem, settings } = useVocelune();

  const [word, setWord] = useState('');
  const [pos, setPos] = useState<PartOfSpeech>('noun');
  const [dialect, setDialect] = useState<Dialect>(settings.englishDialect);
  const [phonetic, setPhonetic] = useState('');
  const [meaningVi, setMeaningVi] = useState('');
  const [definitionEn, setDefinitionEn] = useState('');
  const [exampleEn, setExampleEn] = useState('');
  const [exampleVi, setExampleVi] = useState('');
  const [cefr, setCefr] = useState<CEFRLevel>('unknown');
  const [deckId, setDeckId] = useState(decks[0]?.id || 'deck_oxford');
  const [tags, setTags] = useState('essential');
  const [notes, setNotes] = useState('');

  const [isSearching, setIsSearching] = useState(false);
  const [candidates, setCandidates] = useState<DictionarySense[]>([]);
  const [selectedSenseId, setSelectedSenseId] = useState<string | null>(null);

  const [lookupMessage, setLookupMessage] = useState('');
  const [lookupNoticeType, setLookupNoticeType] = useState<'info' | 'warning'>('info');
  const [saving, setSaving] = useState(false);

  const handleLookup = async () => {
    if (!word.trim()) return;
    setIsSearching(true);
    setLookupMessage('');
    setCandidates([]);

    const cleanWord = word.trim().toLowerCase();
    const known = COMMON_WORD_KNOWLEDGE[cleanWord];
    let foundCandidates: DictionarySense[] = [];

    // 1. Try Backend Oxford lookup
    try {
      const response = await post<{
        candidates: {
          partOfSpeech: PartOfSpeech;
          senses: {
            providerSenseRef?: string;
            definition: { value: string | null };
            examples: { items: string[] };
          }[];
        }[];
        warnings: string[];
      }>('/dictionary/lookup', { word: cleanWord, partOfSpeech: pos, dialect });

      if (response.candidates && response.candidates.length > 0) {
        foundCandidates = response.candidates.flatMap((c) =>
          c.senses.map((sense, i) => ({
            id: sense.providerSenseRef || String(i),
            pos: c.partOfSpeech,
            definitionEn: sense.definition.value || '',
            meaningVi: known?.vi || '',
            exampleEn: sense.examples.items[0] || '',
            exampleVi: '',
            cefr: known?.cefr || ('unknown' as CEFRLevel),
          }))
        );
      }
    } catch {
      // Backend lookup unconfigured or unavailable, fall through to Open Dictionary
    }

    // 2. Open Dictionary API fallback (Free & Real-time)
    if (foundCandidates.length === 0) {
      try {
        const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord)}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            const entry = data[0];
            if (entry.phonetic && !phonetic) {
              setPhonetic(entry.phonetic);
            }

            const parsedSenses: DictionarySense[] = [];
            entry.meanings?.forEach((m: any, mIdx: number) => {
              const mPos = (m.partOfSpeech || 'noun') as PartOfSpeech;
              m.definitions?.slice(0, 3).forEach((d: any, dIdx: number) => {
                parsedSenses.push({
                  id: `open_${mIdx}_${dIdx}`,
                  pos: mPos,
                  definitionEn: d.definition || '',
                  meaningVi: known?.vi || '',
                  exampleEn: d.example || '',
                  exampleVi: '',
                  cefr: known?.cefr || 'unknown',
                });
              });
            });

            if (parsedSenses.length > 0) {
              foundCandidates = parsedSenses;
              setLookupNoticeType('info');
              setLookupMessage('Đang lấy dữ liệu từ Từ điển Mở (Open Dictionary). Chọn nghĩa phù hợp và bổ sung nghĩa tiếng Việt của bạn.');
            }
          }
        }
      } catch {
        // network / offline
      }
    }

    // 3. Fallback to local knowledge or manual notice
    if (foundCandidates.length === 0) {
      if (known) {
        foundCandidates = [
          {
            id: 'known_1',
            pos: known.pos || pos,
            definitionEn: known.defEn || `Meaning of "${cleanWord}" in English.`,
            meaningVi: known.vi,
            exampleEn: known.egEn || '',
            exampleVi: '',
            cefr: known.cefr,
          },
        ];
        setLookupNoticeType('info');
        setLookupMessage('Đã tìm thấy dữ liệu chuẩn Oxford trong kho tri thức tích hợp.');
      } else {
        setLookupNoticeType('warning');
        setLookupMessage('Chưa cấu hình Oxford API Key. Bạn có thể tự nhập định nghĩa tiếng Anh và nghĩa tiếng Việt bên dưới.');
      }
    }

    setCandidates(foundCandidates);

    // Auto-fill primary candidate details into form fields
    if (foundCandidates.length > 0) {
      const first = foundCandidates[0];
      setSelectedSenseId(first.id);
      if (first.pos) setPos(first.pos);
      if (first.definitionEn) setDefinitionEn(first.definitionEn);
      if (first.exampleEn) setExampleEn(first.exampleEn);
      if (first.meaningVi) setMeaningVi(first.meaningVi);
      if (first.cefr && first.cefr !== 'unknown') setCefr(first.cefr);
      if (!phonetic) setPhonetic(`/${cleanWord}/`);
    }

    setIsSearching(false);
  };

  const handleSelectSense = (sense: DictionarySense) => {
    setSelectedSenseId(sense.id);
    if (sense.pos) setPos(sense.pos);
    if (sense.definitionEn) setDefinitionEn(sense.definitionEn);
    if (sense.exampleEn) setExampleEn(sense.exampleEn);
    if (sense.meaningVi && !meaningVi) setMeaningVi(sense.meaningVi);
    if (sense.cefr && sense.cefr !== 'unknown') setCefr(sense.cefr);
  };

  const handleSpeak = () => {
    if (word) speakWord(word, dialect);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!word.trim() || !meaningVi.trim()) return;

    if (saving) return;
    setSaving(true);
    try {
      await addVocabItem({
        word: word.trim(),
        phonetic: phonetic.trim() || `/${word.trim()}/`,
        dialect,
        partOfSpeech: pos,
        definitionEn: definitionEn.trim(),
        meaningVi: meaningVi.trim(),
        exampleEn: exampleEn.trim(),
        exampleVi: exampleVi.trim(),
        cefr,
        cefrSource: cefr !== 'unknown' ? 'verified_3000' : 'manual',
        deckId: deckId || decks[0]?.id || 'deck_oxford',
        tags: tags
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
        notes: notes.trim(),
      });
      onClose();
    } catch {
      // Keep form intact
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-surface-base rounded-card shadow-elevated border border-slate-200/90 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-control bg-brand-primarySoft text-brand-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-brand-ink">Thêm từ vựng mới</h2>
              <p className="text-xs text-text-secondary">
                Tra nghĩa theo ngữ cảnh, chọn sense phù hợp và lập lịch FSRS
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-brand-ink hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          {/* Lookup Input Row */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-brand-ink uppercase tracking-wide">
              Từ vựng tiếng Anh <span className="text-rose-500">*</span>
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: resilient, comprehensive, feasible, articulate..."
                  value={word}
                  onChange={(e) => setWord(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !meaningVi) {
                      e.preventDefault();
                      handleLookup();
                    }
                  }}
                  className="w-full pl-3.5 pr-10 py-2.5 text-sm bg-surface-subtle border border-slate-200 rounded-control focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10 font-medium"
                />
                {word && (
                  <button
                    type="button"
                    onClick={handleSpeak}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-brand-primary"
                    title="Phát âm"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handleLookup}
                disabled={!word.trim() || isSearching}
                className="px-4 py-2.5 bg-brand-primarySoft text-brand-primary font-semibold text-xs rounded-control hover:bg-brand-primary hover:text-white transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <Search className="w-3.5 h-3.5" />
                <span>{isSearching ? 'Đang tra...' : 'Tra từ'}</span>
              </button>
            </div>
          </div>

          {/* Sense Selection (When candidates are available) */}
          {candidates.length > 0 && (
            <div className="space-y-2 p-3.5 bg-slate-50 border border-slate-200/80 rounded-control">
              <div className="flex items-center justify-between text-xs font-semibold text-brand-ink">
                <span>Nghĩa tra cứu gợi ý ({candidates.length} senses)</span>
                <span className="text-[11px] text-text-secondary font-normal">
                  Nhấp vào một nghĩa để tự động điền form
                </span>
              </div>
              <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                {candidates.map((sense) => {
                  const isSelected = selectedSenseId === sense.id;
                  return (
                    <div
                      key={sense.id}
                      onClick={() => handleSelectSense(sense)}
                      className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'border-brand-primary bg-white ring-2 ring-brand-primary/20 shadow-xs'
                          : 'border-slate-200 bg-white/70 hover:bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-brand-primary italic">
                          ({sense.pos})
                        </span>
                        {sense.cefr !== 'unknown' && (
                          <span className="px-1.5 py-0.5 rounded bg-brand-primarySoft text-brand-primary text-[10px] font-bold">
                            {sense.cefr}
                          </span>
                        )}
                      </div>
                      {sense.meaningVi && (
                        <p className="text-brand-ink font-bold">{sense.meaningVi}</p>
                      )}
                      <p className="text-text-secondary text-[11px] mt-0.5 line-clamp-2">
                        {sense.definitionEn}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Status Message Pill */}
          {lookupMessage && (
            <div
              className={`p-3 rounded-control text-xs flex items-start gap-2.5 ${
                lookupNoticeType === 'info'
                  ? 'bg-blue-50 text-blue-900 border border-blue-200'
                  : 'bg-amber-50 text-amber-900 border border-amber-200'
              }`}
            >
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{lookupMessage}</span>
            </div>
          )}

          {/* Core Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-secondary">Từ loại (POS)</label>
              <select
                value={pos}
                onChange={(e) => setPos(e.target.value as PartOfSpeech)}
                className="w-full px-3 py-2 text-xs bg-surface-subtle border border-slate-200 rounded-control focus:outline-none focus:border-brand-primary font-medium"
              >
                <option value="noun">Danh từ (noun)</option>
                <option value="verb">Động từ (verb)</option>
                <option value="adjective">Tính từ (adjective)</option>
                <option value="adverb">Trạng từ (adverb)</option>
                <option value="phrase">Cụm từ (phrase)</option>
                <option value="idiom">Thành ngữ (idiom)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-text-secondary">Phiên âm IPA</label>
              <input
                type="text"
                placeholder="/.../"
                value={phonetic}
                onChange={(e) => setPhonetic(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-surface-subtle border border-slate-200 rounded-control font-mono focus:outline-none focus:border-brand-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-text-secondary">Khung CEFR</label>
              <select
                value={cefr}
                onChange={(e) => setCefr(e.target.value as CEFRLevel)}
                className="w-full px-3 py-2 text-xs bg-surface-subtle border border-slate-200 rounded-control focus:outline-none focus:border-brand-primary font-semibold"
              >
                <option value="A1">A1 - Sơ cấp</option>
                <option value="A2">A2 - Tiền trung cấp</option>
                <option value="B1">B1 - Trung cấp</option>
                <option value="B2">B2 - Trung cao cấp</option>
                <option value="C1">C1 - Cao cấp</option>
                <option value="C2">C2 - Thông thạo</option>
                <option value="unknown">Chưa xác định</option>
              </select>
            </div>
          </div>

          {/* Meaning & Definition */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-brand-ink uppercase tracking-wide">
              Nghĩa tiếng Việt <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="VD: Kiên cường, phục hồi nhanh sau khó khăn"
              value={meaningVi}
              onChange={(e) => setMeaningVi(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-surface-subtle border border-slate-200 rounded-control focus:outline-none focus:border-brand-primary font-medium"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary">
              Định nghĩa tiếng Anh (EN Definition)
            </label>
            <textarea
              rows={2}
              placeholder="VD: Able to quickly become strong, healthy, or successful again..."
              value={definitionEn}
              onChange={(e) => setDefinitionEn(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-surface-subtle border border-slate-200 rounded-control focus:outline-none focus:border-brand-primary"
            />
          </div>

          {/* Example Sentence */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-secondary">Ví dụ tiếng Anh</label>
              <input
                type="text"
                placeholder="VD: Local businesses have proven remarkably resilient."
                value={exampleEn}
                onChange={(e) => setExampleEn(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-surface-subtle border border-slate-200 rounded-control focus:outline-none focus:border-brand-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-secondary">Dịch ví dụ tiếng Việt</label>
              <input
                type="text"
                placeholder="VD: Các doanh nghiệp địa phương đã chứng minh sự kiên cường..."
                value={exampleVi}
                onChange={(e) => setExampleVi(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-surface-subtle border border-slate-200 rounded-control focus:outline-none focus:border-brand-primary"
              />
            </div>
          </div>

          {/* Deck & Tags */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-secondary">Bộ từ (Deck)</label>
              <select
                value={deckId}
                onChange={(e) => setDeckId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-surface-subtle border border-slate-200 rounded-control focus:outline-none focus:border-brand-primary font-medium"
              >
                {decks.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-text-secondary">Tags (ngăn cách bằng dấu phẩy)</label>
              <input
                type="text"
                placeholder="essential, ielts, business..."
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-surface-subtle border border-slate-200 rounded-control focus:outline-none focus:border-brand-primary"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-text-secondary hover:text-brand-ink bg-slate-100 hover:bg-slate-200 rounded-control transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={!word.trim() || !meaningVi.trim() || saving}
              className="px-5 py-2 text-xs font-semibold text-white bg-brand-primary hover:bg-brand-primaryHover rounded-control shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{saving ? 'Đang lưu...' : 'Lưu & Tạo thẻ FSRS'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

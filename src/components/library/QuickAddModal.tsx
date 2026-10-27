'use client';

import React, { useState } from 'react';
import { X, Search, Sparkles, Volume2, Check, AlertCircle, BookOpen } from 'lucide-react';
import { useVocelune } from '@/context/VoceluneContext';
import { PartOfSpeech, CEFRLevel, Dialect } from '@/types';
import { speakWord } from '@/lib/speech';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SimulatedSense {
  id: string;
  pos: PartOfSpeech;
  definitionEn: string;
  meaningVi: string;
  exampleEn: string;
  exampleVi: string;
  cefr: CEFRLevel;
}

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
  const [cefr, setCefr] = useState<CEFRLevel>('B2');
  const [deckId, setDeckId] = useState(decks[0]?.id || 'deck_oxford');
  const [tags, setTags] = useState('essential');
  const [notes, setNotes] = useState('');

  const [isSearching, setIsSearching] = useState(false);
  const [candidates, setCandidates] = useState<SimulatedSense[]>([]);
  const [selectedSenseId, setSelectedSenseId] = useState<string | null>(null);

  if (!isOpen) return null;

  // Simulate smart dictionary lookup with multi-sense preview (FR-ENR-01 & 02)
  const handleLookup = () => {
    if (!word.trim()) return;
    setIsSearching(true);

    setTimeout(() => {
      const normalized = word.toLowerCase().trim();

      // Realistic dictionary sense candidates
      const mockSenses: Record<string, SimulatedSense[]> = {
        ephemeral: [
          {
            id: 'sense_1',
            pos: 'adjective',
            definitionEn: 'Lasting for only a short time; transitory.',
            meaningVi: 'Phù du, chóng tàn, chỉ tồn tại trong thời gian ngắn',
            exampleEn: 'Fame in the digital age is often fleeting and ephemeral.',
            exampleVi: 'Sự nổi tiếng trong thời đại số thường chóng vánh và phù du.',
            cefr: 'C1',
          },
        ],
        serendipity: [
          {
            id: 'sense_1',
            pos: 'noun',
            definitionEn: 'The occurrence of valuable or agreeable things not sought for; pleasant coincidence.',
            meaningVi: 'Sự tình cờ may mắn, cái duyên bất ngờ tìm thấy điều tốt đẹp',
            exampleEn: 'Finding this peaceful bookshop was pure serendipity.',
            exampleVi: 'Tìm thấy tiệm sách yên bình này quả thực là một cái duyên tình cờ may mắn.',
            cefr: 'C1',
          },
        ],
        diligent: [
          {
            id: 'sense_1',
            pos: 'adjective',
            definitionEn: 'Done in a careful and detailed way; working with steady effort.',
            meaningVi: 'Cần cù, siêng năng, chu đáo và tỉ mỉ',
            exampleEn: 'Leo is a diligent researcher who checks every primary source.',
            exampleVi: 'Leo là một nhà nghiên cứu cần cù luôn kiểm tra từng nguồn tư liệu gốc.',
            cefr: 'B2',
          },
        ],
      };

      const found = mockSenses[normalized] || [
        {
          id: 'sense_custom_1',
          pos: pos,
          definitionEn: `Meaning and usage of "${normalized}" in contemporary English.`,
          meaningVi: `Nghĩa tiếng Việt của từ "${normalized}"`,
          exampleEn: `She used the word "${normalized}" in her academic essay.`,
          exampleVi: `Cô ấy đã sử dụng từ "${normalized}" trong bài luận học thuật của mình.`,
          cefr: 'B2',
        },
      ];

      setCandidates(found);
      setSelectedSenseId(found[0].id);

      // Pre-fill form with primary candidate
      const primary = found[0];
      setPhonetic(`/${normalized}/`);
      setPos(primary.pos);
      setDefinitionEn(primary.definitionEn);
      setMeaningVi(primary.meaningVi);
      setExampleEn(primary.exampleEn);
      setExampleVi(primary.exampleVi);
      setCefr(primary.cefr);

      setIsSearching(false);
    }, 350);
  };

  const handleSelectSense = (sense: SimulatedSense) => {
    setSelectedSenseId(sense.id);
    setPos(sense.pos);
    setDefinitionEn(sense.definitionEn);
    setMeaningVi(sense.meaningVi);
    setExampleEn(sense.exampleEn);
    setExampleVi(sense.exampleVi);
    setCefr(sense.cefr);
  };

  const handleSpeak = () => {
    if (word) speakWord(word, dialect);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!word.trim() || !meaningVi.trim()) return;

    addVocabItem({
      word: word.trim(),
      phonetic: phonetic.trim() || `/${word.trim()}/`,
      dialect,
      partOfSpeech: pos,
      definitionEn: definitionEn.trim(),
      meaningVi: meaningVi.trim(),
      exampleEn: exampleEn.trim(),
      exampleVi: exampleVi.trim(),
      cefr,
      cefrSource: 'manual',
      deckId: deckId || decks[0]?.id || 'deck_oxford',
      tags: tags
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
      notes: notes.trim(),
    });

    onClose();
  };

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
                  placeholder="Ví dụ: resilient, ephemeral, leverage..."
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
                <span>Chọn nghĩa phù hợp ({candidates.length} senses)</span>
                <span className="text-[11px] text-text-secondary font-normal">
                  Chỉ lưu sense bạn muốn học
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
                          ? 'border-brand-primary bg-white ring-1 ring-brand-primary/20 shadow-xs'
                          : 'border-slate-200 bg-white/70 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-brand-primary italic">
                          ({sense.pos})
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-brand-primarySoft text-brand-primary text-[10px] font-bold">
                          {sense.cefr}
                        </span>
                      </div>
                      <p className="text-brand-ink font-medium">{sense.meaningVi}</p>
                      <p className="text-text-secondary text-[11px] mt-0.5 line-clamp-1">
                        {sense.definitionEn}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Core Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-secondary">Từ loại (POS)</label>
              <select
                value={pos}
                onChange={(e) => setPos(e.target.value as PartOfSpeech)}
                className="w-full px-3 py-2 text-xs bg-surface-subtle border border-slate-200 rounded-control focus:outline-none focus:border-brand-primary"
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

          {/* Deck, Tags, Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-secondary">Bộ từ (Deck)</label>
              <select
                value={deckId}
                onChange={(e) => setDeckId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-surface-subtle border border-slate-200 rounded-control focus:outline-none focus:border-brand-primary"
              >
                {decks.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-text-secondary">Tags (ngăn cách bởi dấu phẩy)</label>
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
              disabled={!word.trim() || !meaningVi.trim()}
              className="px-5 py-2 text-xs font-semibold text-white bg-brand-primary hover:bg-brand-primaryHover rounded-control shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Lưu & Tạo thẻ FSRS</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

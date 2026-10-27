'use client';

import React, { useState } from 'react';
import { X, Volume2, Trash2, Check, Sparkles } from 'lucide-react';
import { useVocelune } from '@/context/VoceluneContext';
import { VocabItem, PartOfSpeech, CEFRLevel } from '@/types';
import { speakWord } from '@/lib/speech';
import { AudioButton } from '../common/AudioButton';

interface WordDetailModalProps {
  vocab: VocabItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function WordDetailModal({ vocab, isOpen, onClose }: WordDetailModalProps) {
  const { updateVocabItem, deleteVocabItem, decks, cards, settings } = useVocelune();

  const [isEditing, setIsEditing] = useState(false);
  const [word, setWord] = useState(vocab?.word || '');
  const [meaningVi, setMeaningVi] = useState(vocab?.meaningVi || '');
  const [definitionEn, setDefinitionEn] = useState(vocab?.definitionEn || '');
  const [exampleEn, setExampleEn] = useState(vocab?.exampleEn || '');
  const [exampleVi, setExampleVi] = useState(vocab?.exampleVi || '');
  const [phonetic, setPhonetic] = useState(vocab?.phonetic || '');
  const [cefr, setCefr] = useState<CEFRLevel>(vocab?.cefr || 'B2');
  const [pos, setPos] = useState<PartOfSpeech>(vocab?.partOfSpeech || 'noun');
  const [notes, setNotes] = useState(vocab?.notes || '');

  // Reset local state when opened with a new vocab item
  React.useEffect(() => {
    if (vocab) {
      setWord(vocab.word);
      setMeaningVi(vocab.meaningVi);
      setDefinitionEn(vocab.definitionEn);
      setExampleEn(vocab.exampleEn);
      setExampleVi(vocab.exampleVi);
      setPhonetic(vocab.phonetic);
      setCefr(vocab.cefr);
      setPos(vocab.partOfSpeech);
      setNotes(vocab.notes || '');
      setIsEditing(false);
    }
  }, [vocab]);

  if (!isOpen || !vocab) return null;

  const card = cards.find((c) => c.vocabItemId === vocab.id);
  const deck = decks.find((d) => d.id === vocab.deckId);

  const handleSpeak = () => {
    speakWord(vocab.word, vocab.dialect || settings.englishDialect);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateVocabItem(vocab.id, {
      word: word.trim(),
      meaningVi: meaningVi.trim(),
      definitionEn: definitionEn.trim(),
      exampleEn: exampleEn.trim(),
      exampleVi: exampleVi.trim(),
      phonetic: phonetic.trim(),
      cefr,
      partOfSpeech: pos,
      notes: notes.trim(),
    });
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (confirm(`Bạn có chắc muốn xóa từ "${vocab.word}" khỏi thư viện?`)) {
      deleteVocabItem(vocab.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-surface-base rounded-card shadow-elevated border border-slate-200/90 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-brand-primarySoft text-brand-primary">
              {vocab.cefr}
            </span>
            <span className="text-xs text-text-secondary font-medium">
              {deck?.name || 'Thư viện'}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="px-2.5 py-1 text-xs font-medium text-brand-primary hover:bg-brand-primarySoft rounded-lg transition-colors"
            >
              {isEditing ? 'Hủy sửa' : 'Chỉnh sửa'}
            </button>
            <button
              onClick={handleDelete}
              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
              title="Xóa từ"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-brand-ink rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        {isEditing ? (
          <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-text-secondary">Từ vựng</label>
                <input
                  type="text"
                  value={word}
                  onChange={(e) => setWord(e.target.value)}
                  className="w-full px-3 py-2 text-xs border rounded-control"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-text-secondary">Phiên âm</label>
                <input
                  type="text"
                  value={phonetic}
                  onChange={(e) => setPhonetic(e.target.value)}
                  className="w-full px-3 py-2 text-xs border rounded-control font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-text-secondary">Nghĩa tiếng Việt</label>
              <input
                type="text"
                value={meaningVi}
                onChange={(e) => setMeaningVi(e.target.value)}
                className="w-full px-3 py-2 text-xs border rounded-control font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-text-secondary">Định nghĩa tiếng Anh</label>
              <textarea
                rows={2}
                value={definitionEn}
                onChange={(e) => setDefinitionEn(e.target.value)}
                className="w-full px-3 py-2 text-xs border rounded-control"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-text-secondary">Ví dụ tiếng Anh</label>
              <input
                type="text"
                value={exampleEn}
                onChange={(e) => setExampleEn(e.target.value)}
                className="w-full px-3 py-2 text-xs border rounded-control"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-text-secondary">Ghi chú cá nhân</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs border rounded-control"
              />
            </div>

            <div className="pt-3 border-t flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-3 py-1.5 text-xs font-semibold text-text-secondary hover:bg-slate-100 rounded-control"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold text-white bg-brand-primary rounded-control hover:bg-brand-primaryHover flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Lưu thay đổi</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="p-6 space-y-5 overflow-y-auto">
            {/* Word & Pronunciation */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-2xl font-bold text-brand-ink">{vocab.word}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-sm text-text-secondary">
                    {vocab.phonetic}
                  </span>
                  <span className="text-xs italic text-brand-primary font-medium">
                    ({vocab.partOfSpeech})
                  </span>
                </div>
              </div>

              <AudioButton
                text={vocab.word}
                dialect={vocab.dialect || settings.englishDialect}
                size="md"
              />
            </div>

            {/* Meaning */}
            <div className="p-3.5 rounded-control bg-slate-50 border border-slate-100 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                Nghĩa tiếng Việt
              </span>
              <p className="text-sm font-semibold text-brand-ink">{vocab.meaningVi}</p>
            </div>

            {vocab.definitionEn && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                  Định nghĩa tiếng Anh
                </span>
                <p className="text-xs text-brand-ink leading-relaxed font-normal">
                  {vocab.definitionEn}
                </p>
              </div>
            )}

            {vocab.exampleEn && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                  Ví dụ ngữ cảnh
                </span>
                <div className="p-3 rounded-control bg-brand-canvas border border-slate-100 text-xs">
                  <p className="italic text-brand-ink font-medium">
                    &ldquo;{vocab.exampleEn}&rdquo;
                  </p>
                  {vocab.exampleVi && (
                    <p className="text-text-secondary mt-1">{vocab.exampleVi}</p>
                  )}
                </div>
              </div>
            )}

            {vocab.notes && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                  Ghi chú
                </span>
                <p className="text-xs text-text-secondary bg-amber-50/70 p-2.5 rounded-control border border-amber-200/60">
                  {vocab.notes}
                </p>
              </div>
            )}

            {/* SRS Card Status */}
            {card && (
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-text-secondary">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-brand-primary" />
                  <span>Trạng thái SRS:</span>
                  <strong className="text-brand-ink uppercase font-semibold">
                    {card.state}
                  </strong>
                </div>
                <span>
                  Độ ổn định: <strong>{card.stability.toFixed(1)} ngày</strong>
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

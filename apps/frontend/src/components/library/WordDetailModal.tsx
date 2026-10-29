'use client';

import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Volume2, Trash2, Check, Sparkles, Folder, BookOpen, Plus, Image as ImageIcon, Crop, Loader2 } from 'lucide-react';
import { useVocelune } from '@/context/VoceluneContext';
import { VocabItem, PartOfSpeech, CEFRLevel, Deck } from '@/types';
import { speakWord } from '@/lib/speech';
import { translateText } from '@/lib/dictionary';
import { DictionaryAttribution } from '../dictionary/DictionaryAttribution';
import { AudioButton } from '../common/AudioButton';
import { LexicalMetadataView } from '../dictionary/LexicalMetadataView';
import { ImageCropModal } from '../common/ImageCropModal';

interface WordDetailModalProps {
  vocab: VocabItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function WordDetailModal({ vocab, isOpen, onClose }: WordDetailModalProps) {
  const { updateVocabItem, deleteVocabItem, addDeck, decks, cards, settings, uploadVocabImage, removeVocabImage } = useVocelune();

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
  const [selectedDeckId, setSelectedDeckId] = useState(vocab?.deckId || decks[0]?.id || '');
  const [isCreatingNewTopic, setIsCreatingNewTopic] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [newDeckName, setNewDeckName] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Vocab Image & Crop state
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [isCropOpen, setIsCropOpen] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setImageError('Chỉ hỗ trợ ảnh PNG, JPEG hoặc WebP.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCropSrc(reader.result as string);
      setIsCropOpen(true);
    };
    reader.readAsDataURL(file);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const handleCropComplete = async (dataUrl: string) => {
    if (!vocab) return;
    setImageError(null);
    setIsUploadingImage(true);
    try {
      await uploadVocabImage(vocab.id, dataUrl);
    } catch (err: any) {
      setImageError(err?.message || 'Không thể tải ảnh minh họa lên.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!vocab || !vocab.mediaId) return;
    setImageError(null);
    setIsUploadingImage(true);
    try {
      await removeVocabImage(vocab.id, vocab.mediaId);
    } catch (err: any) {
      setImageError(err?.message || 'Không thể gỡ ảnh.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Group existing decks by topic group
  const decksByTopic = useMemo(() => {
    const map = new Map<string, Deck[]>();
    for (const d of decks) {
      const topic = d.topicGroup?.trim() || 'Chung';
      if (!map.has(topic)) {
        map.set(topic, []);
      }
      map.get(topic)!.push(d);
    }
    return map;
  }, [decks]);

  const handleAutoTranslate = async () => {
    const textToTranslate = definitionEn.trim() || word.trim();
    if (!textToTranslate || isTranslating) return;
    setIsTranslating(true);
    try {
      const res = await translateText(textToTranslate, 'en', 'vi');
      if (res.translation) {
        setMeaningVi(res.translation);
      }
    } finally {
      setIsTranslating(false);
    }
  };

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
      setSelectedDeckId(vocab.deckId || decks[0]?.id || '');
      setIsCreatingNewTopic(false);
      setNewTopicName('');
      setNewDeckName('');
      setIsEditing(false);
    }
  }, [vocab, decks]);

  if (!isOpen || !vocab) return null;

  const card = cards.find((c) => c.vocabItemId === vocab.id);
  const deck = decks.find((d) => d.id === vocab.deckId);

  const handleSpeak = () => {
    speakWord(vocab.word, vocab.dialect || settings.englishDialect);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      let targetDeckId = selectedDeckId;

      // If user specified a brand new topic, create a deck for it first
      if (isCreatingNewTopic && newTopicName.trim()) {
        const trimmedTopic = newTopicName.trim();
        const deckTitle = newDeckName.trim() || `${trimmedTopic} - Từ vựng`;
        const createdDeck = await addDeck({
          name: deckTitle,
          description: `Bộ từ thuộc chủ đề ${trimmedTopic}`,
          topicGroup: trimmedTopic,
          color: '#5949E8',
          icon: 'BookOpen',
        });
        targetDeckId = createdDeck.id;
      }

      await updateVocabItem(vocab.id, {
        word: word.trim(),
        meaningVi: meaningVi.trim(),
        definitionEn: definitionEn.trim(),
        exampleEn: exampleEn.trim(),
        exampleVi: exampleVi.trim(),
        phonetic: phonetic.trim(),
        cefr,
        partOfSpeech: pos,
        notes: notes.trim(),
        deckId: targetDeckId,
      });
      setIsEditing(false);
    } catch {
      // Error banner is shown by the app
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (confirm(`Bạn có chắc muốn xóa từ "${vocab.word}" khỏi thư viện?`)) {
      try {
        await deleteVocabItem(vocab.id);
        onClose();
      } catch {
        // Keep modal open
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-surface-base rounded-card shadow-elevated border border-slate-200/90 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-brand-primarySoft text-brand-primary">
              {vocab.cefr}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/70 flex items-center gap-1">
              <Folder className="w-3 h-3 text-indigo-600" />
              <span>{deck?.topicGroup || 'Chung'}</span>
            </span>
            <span className="text-xs text-text-secondary font-medium flex items-center gap-1">
              <BookOpen className="w-3 h-3 text-slate-400" />
              <span>{deck?.name || 'Thư viện'}</span>
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
                  className="w-full px-3 py-2 text-xs border rounded-control focus:border-brand-primary focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-text-secondary">Phiên âm</label>
                <input
                  type="text"
                  value={phonetic}
                  onChange={(e) => setPhonetic(e.target.value)}
                  className="w-full px-3 py-2 text-xs border rounded-control font-mono focus:border-brand-primary focus:outline-none"
                />
              </div>
            </div>

            {/* Topic & Deck Selector */}
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-control space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-brand-ink flex items-center gap-1.5">
                  <Folder className="w-3.5 h-3.5 text-brand-primary" />
                  <span>Chủ đề & Bộ từ</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsCreatingNewTopic(!isCreatingNewTopic)}
                  className="text-[11px] font-semibold text-brand-primary hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>{isCreatingNewTopic ? 'Chọn chủ đề có sẵn' : 'Tạo chủ đề mới'}</span>
                </button>
              </div>

              {!isCreatingNewTopic ? (
                <div>
                  <select
                    value={selectedDeckId}
                    onChange={(e) => setSelectedDeckId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-control font-medium focus:outline-none focus:border-brand-primary"
                  >
                    {Array.from(decksByTopic.entries()).map(([topicName, topicDecks]) => (
                      <optgroup key={topicName} label={`Chủ đề: ${topicName}`}>
                        {topicDecks.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({topicName})
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div className="space-y-1">
                    <label className="text-[10px] text-text-secondary font-medium">
                      Tên chủ đề mới
                    </label>
                    <input
                      type="text"
                      placeholder="VD: Du lịch & Đời sống"
                      value={newTopicName}
                      onChange={(e) => setNewTopicName(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-control focus:outline-none focus:border-brand-primary"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-text-secondary font-medium">
                      Tên bộ từ (Deck)
                    </label>
                    <input
                      type="text"
                      placeholder="VD: Khách sạn & Sân bay"
                      value={newDeckName}
                      onChange={(e) => setNewDeckName(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-control focus:outline-none focus:border-brand-primary"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-text-secondary">Từ loại (POS)</label>
                <select
                  value={pos}
                  onChange={(e) => setPos(e.target.value as PartOfSpeech)}
                  className="w-full px-3 py-2 text-xs border rounded-control bg-white"
                >
                  <option value="noun">Noun (Danh từ)</option>
                  <option value="verb">Verb (Động từ)</option>
                  <option value="adjective">Adjective (Tính từ)</option>
                  <option value="adverb">Adverb (Phó từ)</option>
                  <option value="phrase">Phrase (Cụm từ)</option>
                  <option value="idiom">Idiom (Thành ngữ)</option>
                  <option value="preposition">Preposition (Giới từ)</option>
                  <option value="conjunction">Conjunction (Liên từ)</option>
                  <option value="other">Other (Khác)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-text-secondary">Cấp độ CEFR</label>
                <select
                  value={cefr}
                  onChange={(e) => setCefr(e.target.value as CEFRLevel)}
                  className="w-full px-3 py-2 text-xs border rounded-control bg-white font-semibold"
                >
                  <option value="A1">A1 - Sơ cấp</option>
                  <option value="A2">A2 - Cơ bản</option>
                  <option value="B1">B1 - Trung cấp</option>
                  <option value="B2">B2 - Trung cao</option>
                  <option value="C1">C1 - Cao cấp</option>
                  <option value="C2">C2 - Thành thạo</option>
                  <option value="unknown">Chưa xác định</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-text-secondary">Nghĩa tiếng Việt</label>
                <button
                  type="button"
                  onClick={handleAutoTranslate}
                  disabled={isTranslating || !word.trim()}
                  className="text-[11px] font-semibold text-brand-primary hover:underline flex items-center gap-1 disabled:opacity-40"
                  title="Tự động dịch sang tiếng Việt"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>{isTranslating ? 'Đang dịch...' : 'Dịch tự động'}</span>
                </button>
              </div>
              <input
                type="text"
                value={meaningVi}
                onChange={(e) => setMeaningVi(e.target.value)}
                className="w-full px-3 py-2 text-xs border rounded-control font-medium focus:border-brand-primary focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-text-secondary">Định nghĩa tiếng Anh</label>
              <textarea
                rows={2}
                value={definitionEn}
                onChange={(e) => setDefinitionEn(e.target.value)}
                className="w-full px-3 py-2 text-xs border rounded-control focus:border-brand-primary focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-text-secondary">Ví dụ tiếng Anh</label>
              <input
                type="text"
                value={exampleEn}
                onChange={(e) => setExampleEn(e.target.value)}
                className="w-full px-3 py-2 text-xs border rounded-control focus:border-brand-primary focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-text-secondary">Ghi chú cá nhân</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs border rounded-control focus:border-brand-primary focus:outline-none"
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
                disabled={isSaving}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-brand-primary rounded-control hover:bg-brand-primaryHover flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="p-6 space-y-5 overflow-y-auto">
            {vocab.provenance?.attribution?.length ? <DictionaryAttribution provider={vocab.provenance.provider} sources={vocab.provenance.attribution} /> : null}
            <LexicalMetadataView metadata={vocab.lexicalMetadata} />
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

            {/* Topic & Deck info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-control bg-slate-50 border border-slate-100 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1">
                  <Folder className="w-3 h-3 text-brand-primary" />
                  <span>Chủ đề</span>
                </span>
                <p className="text-xs font-semibold text-brand-ink">
                  {deck?.topicGroup || 'Chung'}
                </p>
              </div>

              <div className="p-3 rounded-control bg-slate-50 border border-slate-100 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1">
                  <BookOpen className="w-3 h-3 text-brand-primary" />
                  <span>Bộ từ (Deck)</span>
                </span>
                <p className="text-xs font-semibold text-brand-ink">
                  {deck?.name || 'Từ vựng chung'}
                </p>
              </div>
            </div>

            {/* Vocab Illustrative Image */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-brand-primary" />
                  <span>Ảnh minh họa</span>
                </span>
                <input
                  type="file"
                  ref={imageInputRef}
                  onChange={handleImageFileChange}
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={isUploadingImage}
                  onClick={() => imageInputRef.current?.click()}
                  className="flex items-center gap-1 text-[11px] font-semibold text-brand-primary hover:underline disabled:opacity-50"
                >
                  {isUploadingImage ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <Crop className="w-3 h-3" />
                      <span>{vocab.imageUrl ? 'Cắt / Đổi ảnh' : 'Thêm ảnh mới'}</span>
                    </>
                  )}
                </button>
              </div>

              {imageError && (
                <p className="text-[11px] text-rose-600 bg-rose-50 px-2.5 py-1 rounded-md">{imageError}</p>
              )}

              {vocab.imageUrl ? (
                <div className="relative group rounded-xl overflow-hidden border border-slate-200/80 bg-slate-900/5 max-h-60 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={vocab.imageUrl}
                    alt={vocab.word}
                    className="max-h-56 w-full object-contain rounded-lg"
                  />
                  <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/70 p-1.5 rounded-lg backdrop-blur-xs">
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      title="Chỉnh sửa hoặc đổi ảnh"
                      className="px-2 py-1 rounded bg-white/20 hover:bg-white/40 text-white text-[11px] font-medium flex items-center gap-1 transition-colors"
                    >
                      <Crop className="w-3.5 h-3.5" />
                      <span>Sửa</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      title="Xóa ảnh"
                      className="p-1 rounded bg-rose-500/80 hover:bg-rose-500 text-white text-[11px] transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => imageInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 hover:border-brand-primary/50 hover:bg-brand-primarySoft/10 transition-all rounded-xl p-4 text-center cursor-pointer flex flex-col items-center justify-center gap-1 text-text-secondary group"
                >
                  <div className="p-2 rounded-full bg-slate-100 group-hover:bg-brand-primarySoft text-text-muted group-hover:text-brand-primary transition-colors">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-semibold text-brand-ink">Thêm ảnh minh họa cho từ vựng này</p>
                  <p className="text-[10px] text-text-muted">Hỗ trợ cắt ảnh vuông / chữ nhật, phóng to thu nhỏ, xoay 90° & lật ảnh</p>
                </div>
              )}
            </div>

            {/* Definition EN */}
            {vocab.definitionEn && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                  Định nghĩa tiếng Anh
                </span>
                <p className="text-xs text-text-primary leading-relaxed bg-surface-subtle p-3 rounded-control border border-slate-100">
                  {vocab.definitionEn}
                </p>
              </div>
            )}

            {/* Example */}
            {vocab.exampleEn && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                  Câu ví dụ minh họa
                </span>
                <div className="p-3 rounded-control bg-brand-primarySoft/30 border border-brand-primary/10 space-y-1">
                  <p className="text-xs italic text-brand-ink font-medium">
                    &ldquo;{vocab.exampleEn}&rdquo;
                  </p>
                  {vocab.exampleVi && (
                    <p className="text-xs text-text-secondary">
                      &rarr; {vocab.exampleVi}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* FSRS SRS Stats Badge */}
            {card && (
              <div className="p-3.5 rounded-control bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-text-secondary">
                    Trạng thái ghi nhớ FSRS
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      card.state === 'review'
                        ? 'bg-emerald-50 text-emerald-700'
                        : card.state === 'learning'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-brand-primarySoft text-brand-primary'
                    }`}
                  >
                    {card.state}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/60 text-center">
                  <div>
                    <span className="text-[10px] text-text-secondary block">Độ ổn định (S)</span>
                    <span className="text-xs font-bold text-brand-ink font-mono">
                      {card.stability.toFixed(1)}d
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-secondary block">Độ khó (D)</span>
                    <span className="text-xs font-bold text-brand-ink font-mono">
                      {card.difficulty.toFixed(1)}/10
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-secondary block">Số lần ôn</span>
                    <span className="text-xs font-bold text-brand-ink font-mono">
                      {card.reps} ({card.lapses} quên)
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            {vocab.notes && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                  Ghi chú cá nhân
                </span>
                <p className="text-xs text-text-secondary bg-slate-50 p-2.5 rounded-control">
                  {vocab.notes}
                </p>
              </div>
            )}
          </div>
        )}

        <ImageCropModal
          isOpen={isCropOpen}
          imageSrc={cropSrc}
          onClose={() => setIsCropOpen(false)}
          onComplete={handleCropComplete}
          initialAspectRatio={4 / 3}
          title={`Cắt & chỉnh ảnh cho từ "${vocab?.word || ''}"`}
        />
      </motion.div>
    </div>
  );
}

'use client';

import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Volume2, Trash2, Check, Sparkles, Folder, BookOpen, Plus, Image as ImageIcon, Crop, Loader2, Wand2, Globe, Search, Upload } from 'lucide-react';
import { useVocelune } from '@/context/VoceluneContext';
import { useNotification } from '@/context/NotificationContext';
import { VocabItem, PartOfSpeech, CEFRLevel, Deck } from '@/types';
import { api, post } from '@/lib/api';
import { speakWord } from '@/lib/speech';
import { translateText, convertWordToIpa, estimateWordCefr } from '@/lib/dictionary';
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
  const { notify } = useNotification();

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
  const [isConvertingIpa, setIsConvertingIpa] = useState(false);
  const [isEstimatingCefr, setIsEstimatingCefr] = useState(false);

  const handleConvertIpa = async () => {
    const targetWord = word.trim();
    if (!targetWord || isConvertingIpa) return;
    setIsConvertingIpa(true);
    try {
      const res = await convertWordToIpa(targetWord, vocab?.dialect || settings.englishDialect);
      if (res.ipa) {
        setPhonetic(res.ipa);
      }
    } finally {
      setIsConvertingIpa(false);
    }
  };

  const handleEstimateCefr = async () => {
    const targetWord = word.trim();
    if (!targetWord || isEstimatingCefr) return;
    setIsEstimatingCefr(true);
    try {
      const res = await estimateWordCefr(targetWord, pos, definitionEn);
      if (res.cefr && res.cefr !== 'unknown') {
        setCefr(res.cefr);
        notify.info('Đã ước tính CEFR', `Cấp độ ${res.cefr}: ${res.reasoning || res.source}`);
      }
    } finally {
      setIsEstimatingCefr(false);
    }
  };

  // Vocab Image & Crop state
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [isCropOpen, setIsCropOpen] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [showImageSearchModal, setShowImageSearchModal] = useState(false);
  const [imageSearchQuery, setImageSearchQuery] = useState('');
  const [isSearchingOnlineImages, setIsSearchingOnlineImages] = useState(false);
  const [onlineImageResults, setOnlineImageResults] = useState<{ id: string; title: string; thumbUrl: string; fullUrl: string }[]>([]);
  const [isLoadingSelectedImage, setIsLoadingSelectedImage] = useState(false);

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

  const handleOpenImageSearch = () => {
    const q = vocab?.word.trim() || '';
    setImageSearchQuery(q);
    setShowImageSearchModal(true);
    if (q) void performOnlineImageSearch(q);
  };

  const performOnlineImageSearch = async (queryText: string) => {
    const q = queryText.trim();
    if (!q) return;
    setIsSearchingOnlineImages(true);
    setImageError(null);
    try {
      const res = await api<{ id: string; title: string; thumbUrl: string; fullUrl: string }[]>(`/media/search-images?q=${encodeURIComponent(q)}`);
      setOnlineImageResults(res || []);
    } catch {
      setImageError('Không thể tìm kiếm ảnh trực tuyến lúc này.');
    } finally {
      setIsSearchingOnlineImages(false);
    }
  };

  const handleSelectOnlineImage = async (img: { thumbUrl: string; fullUrl: string }) => {
    setIsLoadingSelectedImage(true);
    setImageError(null);
    try {
      const res = await post<{ dataUrl: string }>('/media/fetch-url', { url: img.fullUrl });
      if (res?.dataUrl) {
        setCropSrc(res.dataUrl);
        setIsCropOpen(true);
        setShowImageSearchModal(false);
      }
    } catch (err: any) {
      setImageError(err?.message || 'Không thể tải ảnh này về.');
    } finally {
      setIsLoadingSelectedImage(false);
    }
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
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-text-secondary">Phiên âm IPA</label>
                  <button
                    type="button"
                    disabled={!word.trim() || isConvertingIpa}
                    onClick={handleConvertIpa}
                    className="text-[11px] text-brand-primary hover:underline font-medium flex items-center gap-1 disabled:opacity-50"
                    title="Tự động lấy hoặc chuyển đổi sang chuẩn IPA"
                  >
                    {isConvertingIpa ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                    {isConvertingIpa ? 'Đang lấy...' : 'Lấy IPA'}
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="/.../"
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
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-text-secondary">Cấp độ CEFR</label>
                  <button
                    type="button"
                    onClick={handleEstimateCefr}
                    disabled={isEstimatingCefr || !word.trim()}
                    className="text-[11px] text-brand-primary hover:underline font-medium flex items-center gap-1 disabled:opacity-50"
                    title="Tự động ước lượng cấp độ CEFR theo từ điển & độ phổ biến"
                  >
                    {isEstimatingCefr ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                    <span>{isEstimatingCefr ? 'Đang đoán...' : 'Đoán CEFR'}</span>
                  </button>
                </div>
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
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isUploadingImage}
                    onClick={handleOpenImageSearch}
                    className="flex items-center gap-1 text-[11px] font-semibold text-brand-primary hover:underline disabled:opacity-50 cursor-pointer"
                  >
                    <Globe className="w-3 h-3" />
                    <span>Tìm online</span>
                  </button>
                  <button
                    type="button"
                    disabled={isUploadingImage}
                    onClick={() => imageInputRef.current?.click()}
                    className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 hover:text-brand-primary hover:underline disabled:opacity-50 cursor-pointer"
                  >
                    {isUploadingImage ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Đang lưu...</span>
                      </>
                    ) : (
                      <>
                        <Crop className="w-3 h-3" />
                        <span>{vocab.imageUrl ? 'Cắt / Đổi ảnh' : 'Tải từ máy'}</span>
                      </>
                    )}
                  </button>
                </div>
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
                      className="px-2 py-1 rounded bg-white/20 hover:bg-white/40 text-white text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Crop className="w-3.5 h-3.5" />
                      <span>Sửa</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      title="Xóa ảnh"
                      className="p-1 rounded bg-rose-500/80 hover:bg-rose-500 text-white text-[11px] transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div
                    onClick={() => imageInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-200 hover:border-brand-primary/50 hover:bg-brand-primarySoft/10 transition-all rounded-xl p-3.5 text-center cursor-pointer flex flex-col items-center justify-center gap-1 text-text-secondary group"
                  >
                    <div className="p-1.5 rounded-full bg-slate-100 group-hover:bg-brand-primarySoft text-text-muted group-hover:text-brand-primary transition-colors">
                      <Upload className="w-4 h-4" />
                    </div>
                    <p className="text-xs font-semibold text-brand-ink">Tải ảnh từ máy</p>
                    <p className="text-[10px] text-text-muted">PNG, JPG, WebP</p>
                  </div>

                  <div
                    onClick={handleOpenImageSearch}
                    className="border-2 border-dashed border-slate-200 hover:border-brand-primary/50 hover:bg-brand-primarySoft/10 transition-all rounded-xl p-3.5 text-center cursor-pointer flex flex-col items-center justify-center gap-1 text-text-secondary group"
                  >
                    <div className="p-1.5 rounded-full bg-slate-100 group-hover:bg-brand-primarySoft text-text-muted group-hover:text-brand-primary transition-colors">
                      <Globe className="w-4 h-4" />
                    </div>
                    <p className="text-xs font-semibold text-brand-ink">Tìm ảnh online</p>
                    <p className="text-[10px] text-text-muted">Kho ảnh trực tuyến</p>
                  </div>
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

        {/* Online Image Search Modal */}
        {showImageSearchModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[80vh] flex flex-col overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-brand-primary" />
                  <span className="font-bold text-sm text-brand-ink">Tìm kiếm ảnh minh họa trực tuyến</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowImageSearchModal(false)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search input */}
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void performOnlineImageSearch(imageSearchQuery);
                  }}
                  className="flex gap-2"
                >
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Nhập từ khóa tìm ảnh (VD: apple, tree, smiling, runner...)"
                      value={imageSearchQuery}
                      onChange={(e) => setImageSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-control focus:outline-none focus:border-brand-primary"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSearchingOnlineImages || !imageSearchQuery.trim()}
                    className="px-4 py-2 bg-brand-primary text-white text-xs font-semibold rounded-control hover:bg-brand-primaryHover disabled:opacity-50 flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    {isSearchingOnlineImages ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                    <span>{isSearchingOnlineImages ? 'Đang tìm...' : 'Tìm ảnh'}</span>
                  </button>
                </form>
              </div>

              {/* Results Grid */}
              <div className="p-4 flex-1 overflow-y-auto min-h-[220px]">
                {isLoadingSelectedImage && (
                  <div className="py-12 flex flex-col items-center justify-center space-y-2 text-brand-primary">
                    <Loader2 className="w-7 h-7 animate-spin" />
                    <span className="text-xs font-medium text-slate-600">Đang tải và chuẩn bị ảnh để cắt...</span>
                  </div>
                )}

                {!isLoadingSelectedImage && isSearchingOnlineImages && (
                  <div className="py-12 flex flex-col items-center justify-center space-y-2 text-brand-primary">
                    <Loader2 className="w-7 h-7 animate-spin" />
                    <span className="text-xs font-medium text-slate-600">Đang tìm kiếm kho ảnh trực tuyến...</span>
                  </div>
                )}

                {!isLoadingSelectedImage && !isSearchingOnlineImages && onlineImageResults.length === 0 && (
                  <div className="py-12 text-center text-text-secondary text-xs">
                    <ImageIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p>Không tìm thấy ảnh phù hợp cho từ khóa này.</p>
                    <p className="text-[11px] text-slate-400 mt-1">Hãy thử nhập từ khóa tiếng Anh đơn giản hơn.</p>
                  </div>
                )}

                {!isLoadingSelectedImage && !isSearchingOnlineImages && onlineImageResults.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {onlineImageResults.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => void handleSelectOnlineImage(item)}
                        className="group flex flex-col border border-slate-200 rounded-xl overflow-hidden hover:border-brand-primary hover:shadow-sm transition-all text-left bg-white cursor-pointer"
                      >
                        <div className="aspect-square w-full bg-slate-100 overflow-hidden relative">
                          <img
                            src={item.thumbUrl}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            loading="lazy"
                          />
                        </div>
                        <div className="p-2">
                          <p className="text-[11px] font-medium text-slate-700 truncate group-hover:text-brand-primary">
                            {item.title}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
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

'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Search,
  Sparkles,
  Volume2,
  Check,
  Info,
  Wand2,
  Loader2,
  Image as ImageIcon,
  Upload,
  Globe,
  Trash2,
  Crop,
  RotateCcw,
} from 'lucide-react';
import { useVocelune } from '@/context/VoceluneContext';
import { useNotification } from '@/context/NotificationContext';
import { PartOfSpeech, CEFRLevel, Dialect, VocabItem } from '@/types';
import { api, post } from '@/lib/api';
import { DictionaryLookup, DictionaryProvider, useDictionaryProviders, translateText, convertWordToIpa, estimateWordCefr } from '@/lib/dictionary';
import { COMMON_WORD_KNOWLEDGE } from '@/lib/local-vocabulary-hints';
import { DictionarySourceSelect } from '../dictionary/DictionarySourceSelect';
import { DictionaryAttribution } from '../dictionary/DictionaryAttribution';
import { speakWord } from '@/lib/speech';
import { LexicalMetadataView } from '../dictionary/LexicalMetadataView';
import { ImageCropModal } from '../common/ImageCropModal';

interface QuickAddModalProps { isOpen: boolean; onClose: () => void }
export function QuickAddModal({ isOpen, onClose }: QuickAddModalProps) {
  const { decks, addVocabItem, settings, refresh, uploadVocabImage } = useVocelune();
  const { notify } = useNotification();
  const { providers, error: providerError } = useDictionaryProviders(isOpen);
  const [word, setWord] = useState('');
  const [pos, setPos] = useState<PartOfSpeech>('noun');
  const [domain, setDomain] = useState(''), [contextSentence, setContextSentence] = useState('');
  const [dialect, setDialect] = useState<Dialect>(settings.englishDialect);
  const [source, setSource] = useState<DictionaryProvider>(settings.dictionaryProvider || 'free_dictionary');
  const [allowFallback, setAllowFallback] = useState(settings.dictionaryFallbackEnabled || false);
  const [phonetic, setPhonetic] = useState(''), [meaningVi, setMeaningVi] = useState('');
  const [definitionEn, setDefinitionEn] = useState(''), [exampleEn, setExampleEn] = useState(''), [exampleVi, setExampleVi] = useState('');
  const [cefr, setCefr] = useState<CEFRLevel>('unknown');
  const [deckId, setDeckId] = useState(decks[0]?.id || '');
  const [tags, setTags] = useState('essential'), [notes, setNotes] = useState('');
  const [keepOpen, setKeepOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false), [saving, setSaving] = useState(false);
  const [isConvertingIpa, setIsConvertingIpa] = useState(false);
  const [isEstimatingCefr, setIsEstimatingCefr] = useState(false);
  const [meaningAlternatives, setMeaningAlternatives] = useState<string[]>([]);
  const [isTranslatingMeaning, setIsTranslatingMeaning] = useState(false);
  const [isTranslatingExample, setIsTranslatingExample] = useState(false);
  const [result, setResult] = useState<DictionaryLookup | null>(null);
  const [selectedSenseId, setSelectedSenseId] = useState<string | null>(null);
  const [includeProviderContent, setIncludeProviderContent] = useState(false);
  const [lookupMessage, setLookupMessage] = useState('');
  const [lookupNoticeType, setLookupNoticeType] = useState<'info' | 'warning'>('info');

  // Image attachment & search states
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [isCropOpen, setIsCropOpen] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [showImageSearchModal, setShowImageSearchModal] = useState(false);
  const [imageSearchQuery, setImageSearchQuery] = useState('');
  const [isSearchingOnlineImages, setIsSearchingOnlineImages] = useState(false);
  const [onlineImageResults, setOnlineImageResults] = useState<{ id: string; title: string; thumbUrl: string; fullUrl: string }[]>([]);
  const [isLoadingSelectedImage, setIsLoadingSelectedImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const request = useRef<{ sequence: number; controller?: AbortController }>({ sequence: 0 });
  const meaningTranslation = useRef(0), exampleTranslation = useRef(0);

  useEffect(() => {
    if (isOpen) {
      setSource(settings.dictionaryProvider || 'free_dictionary');
      setAllowFallback(settings.dictionaryFallbackEnabled || false);
      setDialect(settings.englishDialect);
      setResult(null);
      setSelectedSenseId(null);
      setIncludeProviderContent(false);
      setLookupMessage('');
      setIsSearching(false);
      setMeaningAlternatives([]);
      setIsTranslatingMeaning(false);
      setIsTranslatingExample(false);
      setImageSrc(null);
      setCropSrc(null);
      setIsCropOpen(false);
      setImageError(null);
      setShowImageSearchModal(false);
      setOnlineImageResults([]);
    }
    return () => { request.current.controller?.abort(); request.current.sequence++; meaningTranslation.current++; exampleTranslation.current++; };
  }, [isOpen, settings.dictionaryProvider, settings.dictionaryFallbackEnabled, settings.englishDialect]);
  const candidates = (result?.candidates || []).flatMap(candidate => candidate.senses.map(sense => ({
    ...sense, id: `${sense.provider}:${candidate.providerEntryRef}:${sense.providerSenseRef}`, entryRef: candidate.providerEntryRef, pos: candidate.partOfSpeech,
  })));
  const selected = candidates.find(sense => sense.id === selectedSenseId);
  const selectedPronunciation = selected?.pronunciations.find(p => p.dialect === dialect && p.ipa)
    ?? selected?.pronunciations.find(p => p.dialect === 'unknown' && p.ipa)
    ?? selected?.pronunciations.find(p => Boolean(p.ipa));
  const providerValues = { definitionEn: selected?.definition.value || '', exampleEn: selected?.examples.items[0] || '', phonetic: selectedPronunciation?.ipa || '' };
  const fromProvider = (field: keyof typeof providerValues) => !!(includeProviderContent && selected?.persistFields.includes(field) && providerValues[field]);
  const known = COMMON_WORD_KNOWLEDGE[word.trim().toLowerCase()];
  const sourceStatus = providers.find(provider => provider.id === source);
  const invalidateLookup = () => {
    request.current.controller?.abort(); request.current.sequence++;
    meaningTranslation.current++; exampleTranslation.current++;
    setIsTranslatingMeaning(false); setIsTranslatingExample(false);
    setResult(null); setSelectedSenseId(null); setIncludeProviderContent(false); setLookupMessage(''); setIsSearching(false);
    setMeaningAlternatives([]);
  };
  const handleLookup = async () => {
    if (!word.trim() || saving) return;
    meaningTranslation.current++; exampleTranslation.current++;
    setIsTranslatingMeaning(false); setIsTranslatingExample(false);
    request.current.controller?.abort();
    const controller = new AbortController(), sequence = ++request.current.sequence;
    request.current.controller = controller;
    setIsSearching(true); setResult(null); setSelectedSenseId(null); setIncludeProviderContent(false); setLookupMessage(''); setMeaningAlternatives([]);
    try {
      const response = await api<DictionaryLookup>('/dictionary/lookup', { method: 'POST', body: JSON.stringify({ word: word.trim(), partOfSpeech: pos, dialect, provider: source, allowFallback, strategy: source === 'auto' ? 'auto_enrich' : 'manual', ...(domain ? { domain } : {}), ...(contextSentence ? { contextSentence } : {}) }), signal: controller.signal });
      if (sequence !== request.current.sequence || controller.signal.aborted) return;
      setResult(response); setLookupNoticeType(response.candidates.length ? 'info' : 'warning');
      setLookupMessage(response.warnings.join(' '));

      // Auto-set Vietnamese meaning if available and meaningVi is empty
      if (!response.candidates.length && response.translationVi?.translation) {
        if (!meaningVi.trim()) {
          setMeaningVi(response.translationVi.translation);
        }
        setMeaningAlternatives(response.translationVi.alternatives || []);
      } else if (!response.candidates.length && known && !meaningVi.trim()) {
        setMeaningVi(known.vi);
      }
    } catch (error) {
      if (sequence !== request.current.sequence || controller.signal.aborted) return;
      setLookupNoticeType('warning'); setLookupMessage(error instanceof Error ? error.message : 'Không thể tra từ.');
      if (known && !meaningVi.trim()) setMeaningVi(known.vi);
    } finally { if (sequence === request.current.sequence) setIsSearching(false); }
  };
  const handleTranslateMeaning = async (customText?: string) => {
    if (selected && !selected.persistFields.includes('definitionEn')) { setLookupMessage('Nghĩa này chỉ được xem tham khảo. Hãy tự biên soạn nghĩa tiếng Việt khi lưu.'); return; }
    const textToTranslate = customText || selected?.definition.value || word.trim();
    if (!textToTranslate || isTranslatingMeaning) return;
    const sequence = ++meaningTranslation.current;
    setIsTranslatingMeaning(true);
    try {
      const res = await translateText(textToTranslate, 'en', 'vi');
      if (sequence !== meaningTranslation.current) return;
      if (res.translation) {
        setMeaningVi(res.translation);
        if (res.alternatives?.length) {
          setMeaningAlternatives(res.alternatives);
        }
      }
    } catch {
      // translation fallback
    } finally {
      if (sequence === meaningTranslation.current) setIsTranslatingMeaning(false);
    }
  };
  const handleTranslateExample = async () => {
    const text = (fromProvider('exampleEn') ? providerValues.exampleEn : exampleEn).trim();
    if (!text || isTranslatingExample) return;
    const sequence = ++exampleTranslation.current;
    setIsTranslatingExample(true);
    try {
      const res = await translateText(text, 'en', 'vi');
      if (sequence !== exampleTranslation.current) return;
      if (res.translation) {
        setExampleVi(res.translation);
      }
    } catch {
      // fallback
    } finally {
      if (sequence === exampleTranslation.current) setIsTranslatingExample(false);
    }
  };
  const handleConvertIpa = async () => {
    const targetWord = word.trim();
    if (!targetWord || isConvertingIpa) return;
    setIsConvertingIpa(true);
    try {
      const res = await convertWordToIpa(targetWord, dialect);
      if (res.ipa) {
        setPhonetic(res.ipa);
        setLookupNoticeType('info');
        setLookupMessage(`Đã tạo phiên âm IPA (${res.source === 'datamuse_arpabet' ? 'chuẩn CMU' : 'từ điển'}): ${res.ipa}`);
      } else {
        setLookupNoticeType('warning');
        setLookupMessage('Chưa tìm thấy phiên âm IPA cho từ này. Bạn có thể tự nhập tay theo định dạng /.../.');
      }
    } catch {
      setLookupNoticeType('warning');
      setLookupMessage('Lỗi khi chuyển đổi IPA. Vui lòng thử lại hoặc nhập tay.');
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
        setLookupNoticeType('info');
        setLookupMessage(`Đã ước tính cấp độ CEFR (${res.cefr}): ${res.reasoning || res.source}`);
      } else {
        setLookupNoticeType('warning');
        setLookupMessage('Chưa xác định được CEFR tự động. Bạn có thể chọn mức phù hợp trong danh sách.');
      }
    } catch {
      setLookupNoticeType('warning');
      setLookupMessage('Lỗi khi ước lượng CEFR. Vui lòng chọn thủ công.');
    } finally {
      setIsEstimatingCefr(false);
    }
  };
  const handleSelectSense = async (sense: typeof candidates[number]) => {
    const sequence = ++meaningTranslation.current;
    exampleTranslation.current++; setIsTranslatingExample(false);
    setSelectedSenseId(sense.id); setIncludeProviderContent(sense.persistFields.length > 0); setMeaningAlternatives([]);
    const dictionaryMeaning = sense.persistFields.includes('meaningVi') ? sense.meaningVi?.value : null;
    setMeaningVi(dictionaryMeaning || '');
    const ipaFromSense = sense.pronunciations.find(p => p.dialect === dialect && p.ipa)?.ipa
      ?? sense.pronunciations.find(p => p.dialect === 'unknown' && p.ipa)?.ipa
      ?? sense.pronunciations.find(p => Boolean(p.ipa))?.ipa;
    if (ipaFromSense) {
      setPhonetic(ipaFromSense);
    }
    if (!dictionaryMeaning && sense.definition.value && sense.persistFields.includes('definitionEn')) {
      setIsTranslatingMeaning(true);
      try {
        const translation = await translateText(sense.definition.value);
        if (sequence !== meaningTranslation.current) return;
        setMeaningVi(translation.translation); setMeaningAlternatives(translation.alternatives);
      } finally { if (sequence === meaningTranslation.current) setIsTranslatingMeaning(false); }
    } else setIsTranslatingMeaning(false);
  };
  const handleSpeak = () => { if (word) speakWord(word, dialect); };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setImageError('Chỉ hỗ trợ định dạng PNG, JPEG hoặc WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setImageError('Kích thước ảnh tối đa là 5MB.');
      return;
    }
    setImageError(null);
    const reader = new FileReader();
    reader.onload = () => {
      setCropSrc(reader.result as string);
      setIsCropOpen(true);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleOpenImageSearch = (initialQuery?: string) => {
    const q = initialQuery || word.trim();
    setImageSearchQuery(q);
    setShowImageSearchModal(true);
    if (q) {
      void performOnlineImageSearch(q);
    }
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

  const handleCropComplete = (croppedDataUrl: string) => {
    setImageSrc(croppedDataUrl);
    setIsCropOpen(false);
    setCropSrc(null);
    setImageError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!word.trim() || !meaningVi.trim() || saving || isSearching) return;
    setSaving(true);
    try {
      const ownedFields = { phonetic: phonetic.trim(), definitionEn: definitionEn.trim(), exampleEn: exampleEn.trim(), exampleVi: exampleVi.trim() };
      const common = { meaningVi: meaningVi.trim(), deckId: deckId || decks[0]?.id, tags: tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean), notes: notes.trim(), cefr, cefrSource: cefr === 'unknown' ? 'unknown' as const : 'manual' as const };
      
      let createdVocab: VocabItem;
      if (includeProviderContent && selected && result) {
        createdVocab = await post<VocabItem>('/dictionary/vocabulary', { ...result.query, provider: selected.provider || result.provider, strategy: source === 'auto' ? 'auto_enrich' : 'manual', providerEntryRef: selected.entryRef, providerSenseRef: selected.providerSenseRef, ...common, manualFields: ownedFields });
        void refresh().catch(() => {});
      } else {
        createdVocab = await addVocabItem({ word: word.trim(), partOfSpeech: pos, dialect, ...ownedFields, ...common, deckId: common.deckId || '' });
      }

      // Attach image if provided
      if (imageSrc && createdVocab?.id) {
        try {
          await uploadVocabImage(createdVocab.id, imageSrc);
        } catch (imgErr: any) {
          notify.warning('Thẻ đã lưu', 'Ảnh minh họa chưa được gắn do lỗi tải ảnh: ' + (imgErr?.message || ''));
        }
      }

      notify.success('Đã thêm thẻ mới!', `Từ "${word}" (${pos}) đã được đưa vào kho học FSRS.`);
      invalidateLookup();
      setWord('');
      setMeaningVi('');
      setDefinitionEn('');
      setExampleEn('');
      setExampleVi('');
      setPhonetic('');
      setCefr('unknown');
      setNotes('');
      setImageSrc(null);
      setCropSrc(null);
      setIsCropOpen(false);
      setImageError(null);
      if (!keepOpen) {
        onClose();
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Không thể lưu từ.';
      notify.error('Lỗi thêm từ', msg);
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
          <DictionarySourceSelect id="quick-add-dictionary" value={source} providers={providers} disabled={saving} onChange={value => { invalidateLookup(); setSource(value); }} />
          {sourceStatus && <p className="text-xs text-text-secondary">{sourceStatus.description}{!sourceStatus.configured && ' Nguồn chưa được bật trên hệ thống.'}</p>}
          {source === 'auto' ? <p className="text-xs text-text-secondary">Ưu tiên dữ liệu local và tự thử nhiều nguồn khi thiếu dữ liệu. CEFR chưa có nguồn xác minh sẽ để trống.</p> : <label className="flex items-start gap-2 text-xs text-text-secondary"><input type="checkbox" checked={allowFallback} disabled={saving} onChange={e => { invalidateLookup(); setAllowFallback(e.target.checked); }} />Thử các nguồn dự phòng khi nguồn đã chọn lỗi hoặc không tìm thấy từ</label>}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs font-semibold">Lĩnh vực (tùy chọn)
              <input value={domain} maxLength={100} disabled={saving} onChange={e => { invalidateLookup(); setDomain(e.target.value); }} placeholder="computer science, economics…" className="w-full p-2 border rounded-control font-normal" />
            </label>
            <label className="space-y-1 text-xs font-semibold">Câu ngữ cảnh (tùy chọn)
              <input value={contextSentence} maxLength={2000} disabled={saving} onChange={e => { invalidateLookup(); setContextSentence(e.target.value); }} placeholder="Our ETL pipeline processes data." className="w-full p-2 border rounded-control font-normal" />
            </label>
          </div>
          {providerError && <p role="status" className="text-xs text-amber-800">{providerError}</p>}
          {/* Lookup Input Row */}
          <div className="space-y-1.5">
            <label htmlFor="quick-add-word" className="text-xs font-semibold text-brand-ink uppercase tracking-wide">
              Từ vựng tiếng Anh <span className="text-rose-500">*</span>
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  required
                  id="quick-add-word"
                  placeholder="Ví dụ: resilient, comprehensive, feasible, articulate..."
                  value={word}
                  onChange={(e) => { invalidateLookup(); setWord(e.target.value); }}
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
                disabled={!word.trim() || isSearching || saving}
                className="px-4 py-2.5 bg-brand-primarySoft text-brand-primary font-semibold text-xs rounded-control hover:bg-brand-primary hover:text-white transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <Search className="w-3.5 h-3.5" />
                <span>{isSearching ? 'Đang tra...' : 'Tra từ'}</span>
              </button>
            </div>
          </div>

          {result && <div className="space-y-2 text-xs"><p className="font-semibold">Nguồn kết quả: {providers.find(p => p.id === result.provider)?.name || result.attribution.name}{result.fallbackUsed ? ' · Đã dùng nguồn dự phòng' : ''}</p><DictionaryAttribution provider={result.provider} sources={[result.attribution]} />
            {result.suggestions.length > 0 && <div className="flex gap-2 flex-wrap"><span>Có phải bạn muốn tìm:</span>{result.suggestions.map(suggestion => <button type="button" key={suggestion} className="underline text-brand-primary" onClick={() => { invalidateLookup(); setWord(suggestion); }}>{suggestion}</button>)}</div>}
          </div>}
          {/* Sense Selection (When candidates are available) */}
          {candidates.length > 0 && (
            <div className="space-y-2 p-3.5 bg-slate-50 border border-slate-200/80 rounded-control">
              <div className="flex items-center justify-between text-xs font-semibold text-brand-ink">
                <span>Nghĩa tra cứu gợi ý ({candidates.length} senses)</span>
                <span className="text-[11px] text-text-secondary font-normal">
                  Chọn đúng nghĩa trước khi lưu
                </span>
              </div>
              <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                {candidates.map((sense) => {
                  const isSelected = selectedSenseId === sense.id;
                  return (
                    <button type="button"
                      key={sense.id}
                      onClick={() => handleSelectSense(sense)}
                      className={`w-full text-left p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'border-brand-primary bg-white ring-2 ring-brand-primary/20 shadow-xs'
                          : 'border-slate-200 bg-white/70 hover:bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-brand-primary italic">
                          ({sense.pos}) · {providers.find(p => p.id === sense.provider)?.name || sense.provider}
                        </span>

                      </div>

                      <p className="text-text-secondary text-[11px] mt-0.5 line-clamp-2">
                        {sense.definition.value}
                      </p>
                      {!!sense.domains?.length && <p className="mt-1 text-[11px]">{sense.domains.join(' · ')}{sense.ranking?.domainMatch ? ' · Khớp lĩnh vực' : ''}</p>}

                      {isSelected && sense.definition.value && (
                        <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                          <span className="text-slate-400">Đã chọn nghĩa này</span>
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleTranslateMeaning(sense.definition.value || '');
                            }}
                            className="font-semibold text-brand-primary hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>Dịch định nghĩa này sang tiếng Việt</span>
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {selected && <div className="space-y-2 border rounded-control p-3 text-xs">
            <DictionaryAttribution provider={selected.provider || result?.provider} sources={selected.attribution} />
            <LexicalMetadataView metadata={selected} />
            {selected.missingFields?.length ? <p className="text-text-secondary">Một số trường chưa có dữ liệu; CEFR không được suy đoán từ ngữ cảnh.</p> : null}
            {selected.examples.items[0] && <p className="italic text-text-secondary">{selected.examples.items[0]}</p>}
            {selected.pronunciations.map((pronunciation, i) => <div className="flex items-center gap-2" key={i}><span>{pronunciation.ipa || 'Chưa có IPA'} · {pronunciation.dialect === 'en-us' ? 'Giọng Mỹ' : pronunciation.dialect === 'en-gb' ? 'Giọng Anh' : 'Chưa xác nhận giọng'}</span>{pronunciation.audio.playbackUrl && <button type="button" className="text-brand-primary underline" onClick={() => { const audio = new Audio(pronunciation.audio.playbackUrl); void audio.play().catch(() => { setLookupNoticeType('warning'); setLookupMessage('Không phát được audio của nguồn. Bạn có thể dùng nút phát âm bên cạnh từ.'); }); }}>Nghe từ nguồn</button>}</div>)}
            {selected.persistFields.length > 0 ? <label className="flex items-start gap-2"><input type="checkbox" checked={includeProviderContent} onChange={e => setIncludeProviderContent(e.target.checked)} />Lưu kèm các trường được phép từ nguồn đã chọn; giữ thông tin nguồn và giấy phép.</label> : <p className="text-amber-800">Nghĩa này chỉ để tham khảo. Hãy tự biên soạn các trường bên dưới khi lưu từ.</p>}
          </div>}
          {known && <div className="rounded-control bg-slate-50 border p-3 text-xs space-y-2"><p>Gợi ý cục bộ, chưa xác minh theo nguồn từ điển: {known.vi} {known.ipa ? `(${known.ipa})` : ''}</p><div className="flex flex-wrap gap-3"><button type="button" className="underline text-brand-primary" onClick={() => setMeaningVi(known.vi)}>Dùng gợi ý tiếng Việt</button>{known.ipa && <button type="button" className="underline text-brand-primary" onClick={() => setPhonetic(known.ipa!)}>Dùng IPA gợi ý ({known.ipa})</button>}<button type="button" className="underline text-brand-primary" onClick={() => setCefr(known.cefr)}>Dùng CEFR gợi ý ({known.cefr}, nhập tay)</button></div></div>}
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

          <label className="block text-xs font-semibold">Giọng muốn tra<select aria-label="Giọng muốn tra" value={dialect} disabled={saving} onChange={e => { invalidateLookup(); setDialect(e.target.value as Dialect); }} className="mt-1 block w-full border rounded-control p-2"><option value="en-us">Anh – Mỹ</option><option value="en-gb">Anh – Anh</option></select></label>
          {/* Core Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label htmlFor="quick-add-pos" className="text-xs font-medium text-text-secondary">Từ loại (POS)</label>
              <select id="quick-add-pos"
                value={pos}
                onChange={(e) => { invalidateLookup(); setPos(e.target.value as PartOfSpeech); }}
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
                placeholder={known?.ipa || '/.../'}
                value={phonetic || (fromProvider('phonetic') ? providerValues.phonetic : '')}
                onChange={(e) => setPhonetic(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-surface-subtle border border-slate-200 rounded-control font-mono focus:outline-none focus:border-brand-primary"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-text-secondary">Khung CEFR</label>
                <button
                  type="button"
                  disabled={isEstimatingCefr || !word.trim()}
                  onClick={handleEstimateCefr}
                  className="text-[11px] text-brand-primary hover:underline font-medium flex items-center gap-1 disabled:opacity-50"
                  title="Tự động ước lượng cấp độ CEFR theo từ điển & độ phổ biến"
                >
                  {isEstimatingCefr ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                  {isEstimatingCefr ? 'Đang đoán...' : 'Đoán CEFR'}
                </button>
              </div>
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
            <div className="flex items-center justify-between">
              <label htmlFor="quick-add-meaning" className="text-xs font-semibold text-brand-ink uppercase tracking-wide">
                Nghĩa tiếng Việt <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => handleTranslateMeaning()}
                disabled={!word.trim() || isTranslatingMeaning}
                className="text-[11px] font-semibold text-brand-primary hover:text-brand-primaryHover flex items-center gap-1 hover:underline disabled:opacity-40 transition-colors"
                title="Tự động dịch từ tiếng Anh hoặc định nghĩa sang tiếng Việt"
              >
                <Sparkles className="w-3 h-3" />
                <span>{isTranslatingMeaning ? 'Đang dịch...' : 'Dịch nghĩa tự động'}</span>
              </button>
            </div>
            <input
              type="text"
              required
              id="quick-add-meaning"
              placeholder="VD: Kiên cường, phục hồi nhanh sau khó khăn"
              value={meaningVi}
              onChange={(e) => { meaningTranslation.current++; setIsTranslatingMeaning(false); setMeaningVi(e.target.value); }}
              className="w-full px-3.5 py-2 text-sm bg-surface-subtle border border-slate-200 rounded-control focus:outline-none focus:border-brand-primary font-medium"
            />
            {/* Quick Suggestions / Alternatives Chips */}
            {meaningAlternatives.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[10px] text-text-secondary">Gợi ý nghĩa:</span>
                {meaningAlternatives.map((alt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setMeaningVi(alt)}
                    className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                      meaningVi === alt
                        ? 'bg-brand-primary text-white border-brand-primary'
                        : 'bg-slate-100 hover:bg-brand-canvas hover:text-brand-primary border-slate-200'
                    }`}
                  >
                    {alt}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary">
              Định nghĩa tiếng Anh (EN Definition)
            </label>
            <textarea
              rows={2}
              placeholder="VD: Able to quickly become strong, healthy, or successful again..."
              value={fromProvider('definitionEn') ? providerValues.definitionEn : definitionEn}
              readOnly={fromProvider('definitionEn')}
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
                value={fromProvider('exampleEn') ? providerValues.exampleEn : exampleEn}
                readOnly={fromProvider('exampleEn')}
                onChange={(e) => setExampleEn(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-surface-subtle border border-slate-200 rounded-control focus:outline-none focus:border-brand-primary"
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-text-secondary">Dịch ví dụ tiếng Việt</label>
                {(fromProvider('exampleEn') ? providerValues.exampleEn : exampleEn).trim() && (
                  <button
                    type="button"
                    onClick={handleTranslateExample}
                    disabled={isTranslatingExample}
                    className="text-[10px] font-semibold text-brand-primary hover:underline flex items-center gap-0.5"
                  >
                    <span>{isTranslatingExample ? 'Đang dịch...' : 'Dịch ví dụ'}</span>
                  </button>
                )}
              </div>
              <input
                type="text"
                placeholder="VD: Các doanh nghiệp địa phương đã chứng minh sự kiên cường..."
                value={exampleVi}
                onChange={(e) => { exampleTranslation.current++; setIsTranslatingExample(false); setExampleVi(e.target.value); }}
                className="w-full px-3 py-2 text-xs bg-surface-subtle border border-slate-200 rounded-control focus:outline-none focus:border-brand-primary"
              />
            </div>
          </div>

          {/* Illustration Image Section */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-brand-ink uppercase tracking-wide flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-brand-primary" />
                <span>Ảnh minh họa cho thẻ học (FSRS)</span>
              </label>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleOpenImageSearch()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-brand-primary bg-brand-primarySoft hover:bg-brand-primarySoft/80 rounded-control transition-colors cursor-pointer"
                  title="Tìm kiếm ảnh minh họa trên kho ảnh Commons"
                >
                  <Globe className="w-3 h-3" />
                  <span>Tìm ảnh online</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-control transition-colors cursor-pointer"
                  title="Tải ảnh PNG, JPEG, WebP từ máy tính"
                >
                  <Upload className="w-3 h-3" />
                  <span>Tải từ máy</span>
                </button>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleImageFileChange}
                />
              </div>
            </div>

            {imageError && (
              <p className="text-[11px] text-rose-600 bg-rose-50 px-2.5 py-1 rounded-md">{imageError}</p>
            )}

            {imageSrc ? (
              <div className="flex items-center gap-3 p-3 bg-surface-subtle border border-slate-200 rounded-xl">
                <img
                  src={imageSrc}
                  alt="Ảnh minh họa"
                  className="w-20 h-20 rounded-lg object-cover border border-slate-200 shrink-0 bg-white"
                />
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-xs font-semibold text-brand-ink truncate">Ảnh đã sẵn sàng gắn vào thẻ học</p>
                  <p className="text-[11px] text-text-secondary">Ảnh sẽ được lưu và hiển thị trực quan khi học Flashcard.</p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setCropSrc(imageSrc);
                        setIsCropOpen(true);
                      }}
                      className="text-[11px] font-semibold text-brand-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Crop className="w-3 h-3" />
                      Cắt lại ảnh
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageSrc(null)}
                      className="text-[11px] font-semibold text-rose-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      Gỡ ảnh
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-between p-3 border border-dashed border-slate-200 hover:border-brand-primary bg-slate-50/50 hover:bg-brand-canvas rounded-xl cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-brand-primarySoft text-slate-400 group-hover:text-brand-primary flex items-center justify-center transition-colors">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-700 group-hover:text-brand-ink">
                      Chưa có ảnh minh họa
                    </p>
                    <p className="text-[10.5px] text-slate-400">
                      Bấm để tải từ máy hoặc dùng nút <strong>Tìm ảnh online</strong> ở góc phải
                    </p>
                  </div>
                </div>
              </div>
            )}
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
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2.5">
            <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer select-none">
              <input
                type="checkbox"
                checked={keepOpen}
                onChange={(e) => setKeepOpen(e.target.checked)}
                className="rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
              />
              <span>Tiếp tục thêm thẻ khác</span>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-text-secondary hover:text-brand-ink bg-slate-100 hover:bg-slate-200 rounded-control transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={!word.trim() || !meaningVi.trim() || saving || isSearching}
                className="px-5 py-2 text-xs font-semibold text-white bg-brand-primary hover:bg-brand-primaryHover rounded-control shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>{saving ? 'Đang lưu...' : 'Lưu & Tạo thẻ FSRS'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>

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

      {/* Crop Modal */}
      <ImageCropModal
        isOpen={isCropOpen}
        imageSrc={cropSrc}
        onClose={() => {
          setIsCropOpen(false);
          setCropSrc(null);
        }}
        onComplete={handleCropComplete}
        initialAspectRatio={1}
        title="Cắt ảnh minh họa từ vựng"
      />
    </div>
  );
}

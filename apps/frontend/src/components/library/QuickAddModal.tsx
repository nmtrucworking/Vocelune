'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Search, Sparkles, Volume2, Check, Info } from 'lucide-react';
import { useVocelune } from '@/context/VoceluneContext';
import { PartOfSpeech, CEFRLevel, Dialect, VocabItem } from '@/types';
import { api, post } from '@/lib/api';
import { DictionaryLookup, DictionaryProvider, useDictionaryProviders, translateText } from '@/lib/dictionary';
import { COMMON_WORD_KNOWLEDGE } from '@/lib/local-vocabulary-hints';
import { DictionarySourceSelect } from '../dictionary/DictionarySourceSelect';
import { DictionaryAttribution } from '../dictionary/DictionaryAttribution';
import { speakWord } from '@/lib/speech';

interface QuickAddModalProps { isOpen: boolean; onClose: () => void }
export function QuickAddModal({ isOpen, onClose }: QuickAddModalProps) {
  const { decks, addVocabItem, settings, refresh } = useVocelune();
  const { providers, error: providerError } = useDictionaryProviders(isOpen);
  const [word, setWord] = useState('');
  const [pos, setPos] = useState<PartOfSpeech>('noun');
  const [dialect, setDialect] = useState<Dialect>(settings.englishDialect);
  const [source, setSource] = useState<DictionaryProvider>(settings.dictionaryProvider || 'free_dictionary');
  const [allowFallback, setAllowFallback] = useState(settings.dictionaryFallbackEnabled || false);
  const [phonetic, setPhonetic] = useState(''), [meaningVi, setMeaningVi] = useState('');
  const [definitionEn, setDefinitionEn] = useState(''), [exampleEn, setExampleEn] = useState(''), [exampleVi, setExampleVi] = useState('');
  const [cefr, setCefr] = useState<CEFRLevel>('unknown');
  const [deckId, setDeckId] = useState(decks[0]?.id || '');
  const [tags, setTags] = useState('essential'), [notes, setNotes] = useState('');
  const [isSearching, setIsSearching] = useState(false), [saving, setSaving] = useState(false);
  const [meaningAlternatives, setMeaningAlternatives] = useState<string[]>([]);
  const [isTranslatingMeaning, setIsTranslatingMeaning] = useState(false);
  const [isTranslatingExample, setIsTranslatingExample] = useState(false);
  const [result, setResult] = useState<DictionaryLookup | null>(null);
  const [selectedSenseId, setSelectedSenseId] = useState<string | null>(null);
  const [includeProviderContent, setIncludeProviderContent] = useState(false);
  const [lookupMessage, setLookupMessage] = useState('');
  const [lookupNoticeType, setLookupNoticeType] = useState<'info' | 'warning'>('info');
  const request = useRef<{ sequence: number; controller?: AbortController }>({ sequence: 0 });
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
    }
    return () => { request.current.controller?.abort(); request.current.sequence++; };
  }, [isOpen, settings.dictionaryProvider, settings.dictionaryFallbackEnabled, settings.englishDialect]);
  const candidates = (result?.candidates || []).flatMap(candidate => candidate.senses.map(sense => ({
    ...sense, id: `${candidate.providerEntryRef}:${sense.providerSenseRef}`, entryRef: candidate.providerEntryRef, pos: candidate.partOfSpeech,
  })));
  const selected = candidates.find(sense => sense.id === selectedSenseId);
  const selectedPronunciation = selected?.pronunciations.find(p => p.dialect === dialect && p.ipa) ?? selected?.pronunciations.find(p => p.dialect === 'unknown' && p.ipa);
  const providerValues = { definitionEn: selected?.definition.value || '', exampleEn: selected?.examples.items[0] || '', phonetic: selectedPronunciation?.ipa || '' };
  const fromProvider = (field: keyof typeof providerValues) => !!(includeProviderContent && selected?.persistFields.includes(field) && providerValues[field]);
  const known = COMMON_WORD_KNOWLEDGE[word.trim().toLowerCase()];
  const sourceStatus = providers.find(provider => provider.id === source);
  const invalidateLookup = () => {
    request.current.controller?.abort(); request.current.sequence++;
    setResult(null); setSelectedSenseId(null); setIncludeProviderContent(false); setLookupMessage(''); setIsSearching(false);
    setMeaningAlternatives([]);
  };
  const handleLookup = async () => {
    if (!word.trim() || saving) return;
    request.current.controller?.abort();
    const controller = new AbortController(), sequence = ++request.current.sequence;
    request.current.controller = controller;
    setIsSearching(true); setResult(null); setSelectedSenseId(null); setIncludeProviderContent(false); setLookupMessage(''); setMeaningAlternatives([]);
    try {
      const response = await api<DictionaryLookup>('/dictionary/lookup', { method: 'POST', body: JSON.stringify({ word: word.trim(), partOfSpeech: pos, dialect, provider: source, allowFallback: source !== 'free_dictionary' && allowFallback }), signal: controller.signal });
      if (sequence !== request.current.sequence || controller.signal.aborted) return;
      setResult(response); setLookupNoticeType(response.candidates.length ? 'info' : 'warning');
      setLookupMessage(response.warnings.join(' '));

      // Auto-set Vietnamese meaning if available and meaningVi is empty
      if (response.translationVi?.translation) {
        if (!meaningVi.trim()) {
          setMeaningVi(response.translationVi.translation);
        }
        setMeaningAlternatives(response.translationVi.alternatives || []);
      } else if (known && !meaningVi.trim()) {
        setMeaningVi(known.vi);
      }
      if (known && cefr === 'unknown') {
        setCefr(known.cefr);
      }
    } catch (error) {
      if (sequence !== request.current.sequence || controller.signal.aborted) return;
      setLookupNoticeType('warning'); setLookupMessage(error instanceof Error ? error.message : 'Không thể tra từ.');
      if (known && !meaningVi.trim()) setMeaningVi(known.vi);
      if (known && cefr === 'unknown') setCefr(known.cefr);
    } finally { if (sequence === request.current.sequence) setIsSearching(false); }
  };
  const handleTranslateMeaning = async (customText?: string) => {
    const textToTranslate = customText || selected?.definition.value || word.trim();
    if (!textToTranslate || isTranslatingMeaning) return;
    setIsTranslatingMeaning(true);
    try {
      const res = await translateText(textToTranslate, 'en', 'vi');
      if (res.translation) {
        setMeaningVi(res.translation);
        if (res.alternatives?.length) {
          setMeaningAlternatives(res.alternatives);
        }
      }
    } catch {
      // translation fallback
    } finally {
      setIsTranslatingMeaning(false);
    }
  };
  const handleTranslateExample = async () => {
    const text = (fromProvider('exampleEn') ? providerValues.exampleEn : exampleEn).trim();
    if (!text || isTranslatingExample) return;
    setIsTranslatingExample(true);
    try {
      const res = await translateText(text, 'en', 'vi');
      if (res.translation) {
        setExampleVi(res.translation);
      }
    } catch {
      // fallback
    } finally {
      setIsTranslatingExample(false);
    }
  };
  const handleSelectSense = (sense: typeof candidates[number]) => { setSelectedSenseId(sense.id); setIncludeProviderContent(sense.persistFields.length > 0); };
  const handleSpeak = () => { if (word) speakWord(word, dialect); };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!word.trim() || !meaningVi.trim() || saving || isSearching) return;
    setSaving(true);
    try {
      const ownedFields = { phonetic: phonetic.trim(), definitionEn: definitionEn.trim(), exampleEn: exampleEn.trim(), exampleVi: exampleVi.trim() };
      const common = { meaningVi: meaningVi.trim(), deckId: deckId || decks[0]?.id, tags: tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean), notes: notes.trim(), cefr, cefrSource: cefr === 'unknown' ? 'unknown' as const : 'manual' as const };
      if (includeProviderContent && selected && result) {
        await post<VocabItem>('/dictionary/vocabulary', { ...result.query, provider: result.provider, providerEntryRef: selected.entryRef, providerSenseRef: selected.providerSenseRef, ...common, manualFields: ownedFields });
        await refresh().catch(() => {});
      } else {
        await addVocabItem({ word: word.trim(), partOfSpeech: pos, dialect, ...ownedFields, ...common, deckId: common.deckId || '' });
      }
      invalidateLookup(); setWord(''); setMeaningVi(''); setDefinitionEn(''); setExampleEn(''); setExampleVi(''); setPhonetic(''); setCefr('unknown'); setNotes(''); onClose();
    } catch (error) { setLookupNoticeType('warning'); setLookupMessage(error instanceof Error ? error.message : 'Không thể lưu từ.'); }
    finally { setSaving(false); }
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
          {source !== 'free_dictionary' && <label className="flex items-start gap-2 text-xs text-text-secondary"><input type="checkbox" checked={allowFallback} disabled={saving} onChange={e => { invalidateLookup(); setAllowFallback(e.target.checked); }} />Thử Free Dictionary API khi nguồn đã chọn lỗi hoặc không tìm thấy từ</label>}
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
                          ({sense.pos})
                        </span>

                      </div>

                      <p className="text-text-secondary text-[11px] mt-0.5 line-clamp-2">
                        {sense.definition.value}
                      </p>

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
            <DictionaryAttribution provider={result?.provider} sources={selected.attribution} />
            {selected.examples.items[0] && <p className="italic text-text-secondary">{selected.examples.items[0]}</p>}
            {selected.pronunciations.map((pronunciation, i) => <div className="flex items-center gap-2" key={i}><span>{pronunciation.ipa || 'Chưa có IPA'} · {pronunciation.dialect === 'en-us' ? 'Giọng Mỹ' : pronunciation.dialect === 'en-gb' ? 'Giọng Anh' : 'Chưa xác nhận giọng'}</span>{pronunciation.audio.playbackUrl && <button type="button" className="text-brand-primary underline" onClick={() => { const audio = new Audio(pronunciation.audio.playbackUrl); void audio.play().catch(() => { setLookupNoticeType('warning'); setLookupMessage('Không phát được audio của nguồn. Bạn có thể dùng nút phát âm bên cạnh từ.'); }); }}>Nghe từ nguồn</button>}</div>)}
            {selected.persistFields.length > 0 ? <label className="flex items-start gap-2"><input type="checkbox" checked={includeProviderContent} onChange={e => setIncludeProviderContent(e.target.checked)} />Lưu kèm các trường được phép từ nguồn đã chọn; giữ thông tin nguồn và giấy phép.</label> : <p className="text-amber-800">Nghĩa này chỉ để tham khảo. Hãy tự biên soạn các trường bên dưới khi lưu từ.</p>}
          </div>}
          {known && <div className="rounded-control bg-slate-50 border p-3 text-xs space-y-2"><p>Gợi ý cục bộ, chưa xác minh theo nguồn từ điển: {known.vi}</p><div className="flex gap-3"><button type="button" className="underline text-brand-primary" onClick={() => setMeaningVi(known.vi)}>Dùng gợi ý tiếng Việt</button><button type="button" className="underline text-brand-primary" onClick={() => setCefr(known.cefr)}>Dùng CEFR gợi ý ({known.cefr}, nhập tay)</button></div></div>}
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
              <label className="text-xs font-medium text-text-secondary">Phiên âm IPA</label>
              <input
                type="text"
                placeholder="/.../"
                value={fromProvider('phonetic') ? providerValues.phonetic : phonetic}
                readOnly={fromProvider('phonetic')}
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
              onChange={(e) => setMeaningVi(e.target.value)}
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
              disabled={!word.trim() || !meaningVi.trim() || saving || isSearching}
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

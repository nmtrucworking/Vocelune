'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Volume2,
  Undo2,
  Sparkles,
  CheckCircle2,
  HelpCircle,
  RotateCcw,
  BookOpen,
  ArrowRight,
  Flame,
  Check,
  X,
  Keyboard,
  Shuffle,
} from 'lucide-react';
import { useVocelune } from '@/context/VoceluneContext';
import { Card, VocabItem, FSRSRating, StudyMode } from '@/types';
import { getFSRSPreviews, IntervalPreview } from '@/lib/fsrs-engine';
import { speakWord } from '@/lib/speech';

export function StudyConsole() {
  const { dueCards, vocabItems, gradeCard, undoLastReview, canUndo, settings } =
    useVocelune();

  // Create an active queue from due cards (or all cards if none due)
  const [queue, setQueue] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [mode, setMode] = useState<StudyMode>('flashcard');

  // Typed mode state
  const [typedInput, setTypedInput] = useState('');
  const [typedSubmitted, setTypedSubmitted] = useState(false);

  // MCQ mode state
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  // Session completion stats
  const [completedCount, setCompletedCount] = useState(0);
  const [startTime, setStartTime] = useState<number>(Date.now());

  // Initialize queue
  useEffect(() => {
    if (queue.length === 0 && dueCards.length > 0) {
      setQueue([...dueCards]);
    }
  }, [dueCards, queue.length]);

  const currentCard = queue[currentIndex] || null;
  const currentVocab: VocabItem | undefined = useMemo(() => {
    if (!currentCard) return undefined;
    return vocabItems.find((v) => v.id === currentCard.vocabItemId);
  }, [currentCard, vocabItems]);

  // Compute next interval previews for 4 ratings
  const intervalPreviews: IntervalPreview[] = useMemo(() => {
    if (!currentCard) return [];
    return getFSRSPreviews(currentCard, settings.desiredRetention);
  }, [currentCard, settings.desiredRetention]);

  // MCQ distractor options
  const mcqOptions = useMemo(() => {
    if (!currentVocab) return [];
    const others = vocabItems
      .filter((v) => v.id !== currentVocab.id)
      .map((v) => v.meaningVi);

    // Shuffle and pick 3 distractors
    const shuffled = [...others].sort(() => 0.5 - Math.random()).slice(0, 3);
    const all = [currentVocab.meaningVi, ...shuffled].sort(() => 0.5 - Math.random());
    return all;
  }, [currentVocab, vocabItems]);

  // Reveal answer
  const handleReveal = useCallback(() => {
    setIsRevealed(true);
    if (settings.autoPronounce && currentVocab) {
      speakWord(currentVocab.word, currentVocab.dialect || settings.englishDialect);
    }
  }, [settings.autoPronounce, currentVocab, settings.englishDialect]);

  // Grade action (FSRS rating 1-4)
  const handleGrade = useCallback(
    (rating: FSRSRating) => {
      if (!currentCard) return;

      const durationMs = Date.now() - startTime;
      gradeCard(currentCard.id, rating, durationMs);

      setCompletedCount((prev) => prev + 1);
      setIsRevealed(false);
      setTypedInput('');
      setTypedSubmitted(false);
      setSelectedOption(null);
      setStartTime(Date.now());

      // Move to next card
      if (currentIndex < queue.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        // Queue finished
        setCurrentIndex(queue.length);
      }
    },
    [currentCard, startTime, gradeCard, currentIndex, queue.length]
  );

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (!isRevealed) {
          handleReveal();
        }
      } else if (isRevealed) {
        if (e.key === '1') handleGrade(1);
        if (e.key === '2') handleGrade(2);
        if (e.key === '3') handleGrade(3);
        if (e.key === '4') handleGrade(4);
      }

      if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey || !isRevealed)) {
        if (canUndo) {
          e.preventDefault();
          undoLastReview();
          if (currentIndex > 0) setCurrentIndex((prev) => prev - 1);
          setIsRevealed(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRevealed, handleReveal, handleGrade, canUndo, undoLastReview, currentIndex]);

  // Handle Typed Submit
  const handleTypedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTypedSubmitted(true);
    handleReveal();
  };

  // Play word pronunciation
  const handleSpeak = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (currentVocab) {
      speakWord(currentVocab.word, currentVocab.dialect || settings.englishDialect);
    }
  };

  // Empty state: All cards done
  if (queue.length === 0 || currentIndex >= queue.length || !currentVocab || !currentCard) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shadow-sm">
          <CheckCircle2 className="w-8 h-8 stroke-[2.2]" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-brand-ink">
            {completedCount > 0 ? 'Hoàn thành lượt ôn tập!' : 'Tất cả từ đã được ôn!'}
          </h2>
          <p className="text-sm text-text-secondary max-w-md mx-auto">
            {completedCount > 0
              ? `Bạn đã hoàn thành ${completedCount} lượt thẻ truy hồi hôm nay. Lịch thích ứng FSRS đã được cập nhật.`
              : 'Hiện không có thẻ nào đến hạn. Bạn có thể thêm từ mới hoặc luyện tập tự do trong Thư viện.'}
          </p>
        </div>

        {completedCount > 0 && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-control bg-brand-primarySoft text-brand-primary text-xs font-semibold">
            <Sparkles className="w-4 h-4" />
            <span>Lịch ôn FSRS tiếp theo đã sẵn sàng</span>
          </div>
        )}

        <div className="flex items-center justify-center gap-3 pt-4">
          <button
            onClick={() => {
              // Restart practice with all cards
              setQueue([...vocabItems.map((v) => ({
                id: `card_${v.id}_en_vi`,
                vocabItemId: v.id,
                template: 'en_vi' as const,
                state: 'review' as const,
                dueAt: new Date().toISOString(),
                stability: 2,
                difficulty: 5,
                elapsedDays: 1,
                scheduledDays: 1,
                reps: 1,
                lapses: 0,
                version: 1,
              }))]);
              setCurrentIndex(0);
              setIsRevealed(false);
              setCompletedCount(0);
            }}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-brand-ink font-semibold text-xs rounded-control transition-colors flex items-center gap-2"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Ôn luyện tự do ({vocabItems.length} từ)</span>
          </button>
        </div>
      </div>
    );
  }

  const isTypedCorrect =
    typedSubmitted &&
    typedInput.trim().toLowerCase() === currentVocab.word.trim().toLowerCase();

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Top Session Progress Bar */}
      <div className="flex items-center justify-between px-1 text-xs">
        <div className="flex items-center gap-2 font-medium text-text-secondary">
          <span className="font-semibold text-brand-ink">
            Thẻ {currentIndex + 1}
          </span>
          <span>/</span>
          <span>{queue.length}</span>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-brand-primarySoft text-brand-primary">
            {currentCard.state}
          </span>
        </div>

        {/* Study Mode Selector */}
        <div className="flex items-center bg-surface-base p-1 rounded-control border border-slate-200/80 shadow-xs">
          <button
            onClick={() => setMode('flashcard')}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
              mode === 'flashcard'
                ? 'bg-brand-primary text-white shadow-xs'
                : 'text-text-secondary hover:text-brand-ink'
            }`}
          >
            Flashcard
          </button>
          <button
            onClick={() => setMode('typed')}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
              mode === 'typed'
                ? 'bg-brand-primary text-white shadow-xs'
                : 'text-text-secondary hover:text-brand-ink'
            }`}
          >
            Gõ từ
          </button>
          <button
            onClick={() => setMode('mcq')}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
              mode === 'mcq'
                ? 'bg-brand-primary text-white shadow-xs'
                : 'text-text-secondary hover:text-brand-ink'
            }`}
          >
            Trắc nghiệm
          </button>
          <button
            onClick={() => setMode('listening')}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
              mode === 'listening'
                ? 'bg-brand-primary text-white shadow-xs'
                : 'text-text-secondary hover:text-brand-ink'
            }`}
          >
            Nghe
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-brand-primary transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / queue.length) * 100}%` }}
        />
      </div>

      {/* Main Flashcard Container (Active Recall Gate) */}
      <div className="bg-surface-base border border-slate-200/90 rounded-card shadow-card p-6 md:p-8 min-h-[360px] flex flex-col justify-between relative select-none">
        {/* Card Header metadata */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700">
              {currentVocab.cefr}
            </span>
            <span className="text-xs font-medium text-text-secondary italic">
              ({currentVocab.partOfSpeech})
            </span>
          </div>

          <button
            onClick={handleSpeak}
            className="p-2 rounded-control text-brand-primary hover:bg-brand-primarySoft transition-colors flex items-center gap-1.5 text-xs font-medium"
            title="Nghe phát âm"
          >
            <Volume2 className="w-4 h-4" />
            <span className="hidden sm:inline">Phát âm</span>
          </button>
        </div>

        {/* Question Cue / Active Recall Area */}
        <div className="py-6 flex-1 flex flex-col items-center justify-center text-center space-y-4">
          {mode === 'listening' ? (
            <div className="space-y-4">
              <button
                onClick={handleSpeak}
                className="w-16 h-16 mx-auto rounded-full bg-brand-primarySoft text-brand-primary hover:bg-brand-primary hover:text-white transition-all flex items-center justify-center shadow-md active:scale-95"
              >
                <Volume2 className="w-8 h-8" />
              </button>
              <p className="text-xs text-text-secondary">
                Nhấn loa để nghe và truy hồi nghĩa tiếng Việt trước khi lật thẻ
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2">
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-brand-ink">
                  {currentVocab.word}
                </h2>
              </div>
              <p className="text-sm font-mono text-slate-400">
                {currentVocab.phonetic}
              </p>
            </div>
          )}

          {/* Mode-Specific Input / Interaction */}
          {mode === 'typed' && !isRevealed && (
            <form onSubmit={handleTypedSubmit} className="w-full max-w-sm mt-4 space-y-2">
              <input
                type="text"
                autoFocus
                placeholder="Gõ lại chính xác từ tiếng Anh..."
                value={typedInput}
                onChange={(e) => setTypedInput(e.target.value)}
                className="w-full text-center px-4 py-2.5 text-base border-2 border-slate-200 rounded-control focus:outline-none focus:border-brand-primary font-medium"
              />
              <button
                type="submit"
                className="w-full py-2 bg-slate-900 text-white rounded-control text-xs font-semibold hover:bg-slate-800 transition-colors"
              >
                Kiểm tra (Enter)
              </button>
            </form>
          )}

          {mode === 'mcq' && !isRevealed && (
            <div className="w-full max-w-md grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
              {mcqOptions.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setSelectedOption(opt);
                    handleReveal();
                  }}
                  className="p-3 text-left text-xs font-medium rounded-control border border-slate-200 hover:border-brand-primary hover:bg-brand-primarySoft/40 transition-all"
                >
                  <span className="font-bold text-slate-400 mr-1.5">
                    {String.fromCharCode(65 + i)}.
                  </span>
                  {opt}
                </button>
              ))}
            </div>
          )}

          {/* Reveal Result Area */}
          {isRevealed && (
            <div className="w-full space-y-4 pt-4 border-t border-slate-100 animate-in fade-in duration-200 text-left">
              {/* Meaning & Definition */}
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-brand-primary">
                  Nghĩa tiếng Việt
                </span>
                <p className="text-lg font-semibold text-brand-ink">
                  {currentVocab.meaningVi}
                </p>
              </div>

              {currentVocab.definitionEn && (
                <div className="space-y-0.5">
                  <span className="text-[11px] font-medium text-text-secondary">
                    Định nghĩa tiếng Anh
                  </span>
                  <p className="text-xs text-brand-ink font-normal leading-relaxed">
                    {currentVocab.definitionEn}
                  </p>
                </div>
              )}

              {/* Example sentence */}
              {currentVocab.exampleEn && (
                <div className="p-3 rounded-control bg-slate-50 border border-slate-100 text-xs space-y-1">
                  <p className="italic text-brand-ink font-medium">
                    &ldquo;{currentVocab.exampleEn}&rdquo;
                  </p>
                  {currentVocab.exampleVi && (
                    <p className="text-text-secondary text-[11px]">
                      {currentVocab.exampleVi}
                    </p>
                  )}
                </div>
              )}

              {/* Typed validation feedback */}
              {mode === 'typed' && (
                <div
                  className={`p-2.5 rounded-control text-xs font-medium flex items-center gap-2 ${
                    isTypedCorrect
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {isTypedCorrect ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>Chính xác tuyệt đối!</span>
                    </>
                  ) : (
                    <>
                      <X className="w-4 h-4 text-rose-600" />
                      <span>Bạn đã gõ: &ldquo;{typedInput || '(trống)'}&rdquo;</span>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Action Area (Gate: Show Answer -> 4 FSRS Ratings) */}
        <div className="pt-4 border-t border-slate-100">
          {!isRevealed ? (
            <button
              onClick={handleReveal}
              className="w-full py-3 bg-brand-primary text-white font-semibold text-sm rounded-control hover:bg-brand-primaryHover shadow-sm transition-all duration-150 flex items-center justify-center gap-2 active:scale-[0.99]"
            >
              <span>Xem đáp án</span>
              <kbd className="px-2 py-0.5 text-[10px] font-mono bg-white/20 rounded text-white font-normal">
                Space
              </kbd>
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[11px] text-text-secondary px-1">
                <span>Đánh giá độ nhớ để FSRS lập lịch:</span>
                <span className="flex items-center gap-1 font-mono">
                  <Keyboard className="w-3.5 h-3.5" />
                  <span>Phím 1, 2, 3, 4</span>
                </span>
              </div>

              {/* 4 FSRS Ratings Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {intervalPreviews.map((preview) => {
                  const ratingColors = {
                    1: 'hover:border-rose-400 hover:bg-rose-50/60 text-rose-700',
                    2: 'hover:border-amber-400 hover:bg-amber-50/60 text-amber-700',
                    3: 'hover:border-blue-400 hover:bg-blue-50/60 text-blue-700',
                    4: 'hover:border-emerald-400 hover:bg-emerald-50/60 text-emerald-700',
                  };

                  return (
                    <button
                      key={preview.rating}
                      onClick={() => handleGrade(preview.rating)}
                      className={`p-2.5 rounded-control border border-slate-200 bg-surface-base text-left transition-all duration-150 shadow-xs flex flex-col justify-between ${
                        ratingColors[preview.rating]
                      } active:scale-95`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs">{preview.label}</span>
                        <kbd className="px-1.5 py-0.2 text-[10px] font-mono bg-slate-100 rounded text-slate-500 font-semibold">
                          {preview.rating}
                        </kbd>
                      </div>
                      <div className="mt-1 flex items-baseline justify-between">
                        <span className="text-[10px] text-text-secondary line-clamp-1">
                          {preview.description}
                        </span>
                        <span className="text-xs font-mono font-bold text-brand-ink">
                          {preview.intervalText}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Undo Button (BR-SRS-05 / AC-05) */}
      <div className="flex items-center justify-between px-2 text-xs text-text-secondary">
        <button
          onClick={undoLastReview}
          disabled={!canUndo}
          className="flex items-center gap-1.5 py-1 px-2.5 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <Undo2 className="w-3.5 h-3.5" />
          <span>Hoàn tác lượt vừa ôn (Z)</span>
        </button>

        <span className="text-[11px] text-slate-400">
          Mô hình: FSRS-7 • Tỷ lệ mục tiêu: {(settings.desiredRetention * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

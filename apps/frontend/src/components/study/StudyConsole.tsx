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
  Smile,
} from 'lucide-react';
import { useVocelune } from '@/context/VoceluneContext';
import { Card, VocabItem, FSRSRating, StudyMode } from '@/types';
import { getFSRSPreviews, IntervalPreview } from '@/lib/fsrs-engine';
import { speakWord } from '@/lib/speech';
import { triggerConfetti } from '@/lib/confetti';
import { AudioButton } from '../common/AudioButton';

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
  const [cardAnimationKey, setCardAnimationKey] = useState(0);

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
      setCardAnimationKey((k) => k + 1);

      // Move to next card
      if (currentIndex < queue.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        // Queue finished -> trigger celebratory confetti!
        setCurrentIndex(queue.length);
        triggerConfetti();
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
          setCardAnimationKey((k) => k + 1);
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

  // Empty state: All cards done
  if (queue.length === 0 || currentIndex >= queue.length || !currentVocab || !currentCard) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
        <div className="w-20 h-20 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shadow-md animate-bounce">
          <CheckCircle2 className="w-10 h-10 stroke-[2.2]" />
        </div>

        <div className="space-y-2">
          <h2 className="text-3xl font-extrabold text-brand-ink">
            {completedCount > 0 ? 'Hoàn thành nhịp ôn hôm nay!' : 'Tất cả thẻ đã được ôn!'}
          </h2>
          <p className="text-sm text-text-secondary max-w-md mx-auto leading-relaxed">
            {completedCount > 0
              ? `Bạn đã hoàn thành ${completedCount} lượt truy hồi chất lượng cao. FSRS đã cập nhật độ ổn định và xếp lịch quay lại tối ưu.`
              : 'Hiện không có thẻ nào đến hạn. Bạn có thể thêm từ mới hoặc ôn luyện tự do trong Thư viện.'}
          </p>
        </div>

        {completedCount > 0 && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-control bg-brand-primarySoft text-brand-primary text-xs font-semibold shadow-xs">
            <Sparkles className="w-4 h-4 text-brand-primary" />
            <span>Lịch thích ứng FSRS-7 đã ghi nhận hoàn tất</span>
          </div>
        )}

        <div className="flex items-center justify-center gap-3 pt-4">
          <button
            onClick={() => {
              setQueue([
                ...vocabItems.map((v) => ({
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
                })),
              ]);
              setCurrentIndex(0);
              setIsRevealed(false);
              setCompletedCount(0);
              setCardAnimationKey((k) => k + 1);
            }}
            className="px-5 py-3 bg-brand-primary text-white hover:bg-brand-primaryHover font-semibold text-xs rounded-control transition-all shadow-md flex items-center gap-2 active:scale-95"
          >
            <RotateCcw className="w-4 h-4" />
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
            onClick={() => {
              setMode('flashcard');
              setIsRevealed(false);
            }}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all duration-150 ${
              mode === 'flashcard'
                ? 'bg-brand-primary text-white shadow-xs'
                : 'text-text-secondary hover:text-brand-ink'
            }`}
          >
            Flashcard
          </button>
          <button
            onClick={() => {
              setMode('typed');
              setIsRevealed(false);
            }}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all duration-150 ${
              mode === 'typed'
                ? 'bg-brand-primary text-white shadow-xs'
                : 'text-text-secondary hover:text-brand-ink'
            }`}
          >
            Gõ từ
          </button>
          <button
            onClick={() => {
              setMode('mcq');
              setIsRevealed(false);
            }}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all duration-150 ${
              mode === 'mcq'
                ? 'bg-brand-primary text-white shadow-xs'
                : 'text-text-secondary hover:text-brand-ink'
            }`}
          >
            Trắc nghiệm
          </button>
          <button
            onClick={() => {
              setMode('listening');
              setIsRevealed(false);
            }}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all duration-150 ${
              mode === 'listening'
                ? 'bg-brand-primary text-white shadow-xs'
                : 'text-text-secondary hover:text-brand-ink'
            }`}
          >
            Luyện nghe
          </button>
        </div>
      </div>

      {/* Progress Bar with smooth fill animation */}
      <div className="w-full h-1.5 bg-slate-200/60 rounded-full overflow-hidden">
        <div
          className="h-full bg-brand-primary rounded-full transition-all duration-500 ease-out"
          style={{ width: `${((currentIndex + 1) / queue.length) * 100}%` }}
        />
      </div>

      {/* Main Study Card with 3D Flip & Entry Slide Animation */}
      <div
        key={cardAnimationKey}
        className="perspective-1000 min-h-[380px] w-full animate-in fade-in slide-in-from-bottom-2 duration-200"
      >
        <div
          className={`relative w-full min-h-[380px] bg-surface-base border border-slate-200/90 rounded-card shadow-card p-6 md:p-8 flex flex-col justify-between select-none card-flip-transition ${
            mode === 'flashcard' && isRevealed ? 'ring-2 ring-brand-primary/20' : ''
          }`}
        >
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

            {/* High-fidelity Audio Pronunciation with Equalizer Wave */}
            <AudioButton
              text={currentVocab.word}
              dialect={currentVocab.dialect || settings.englishDialect}
              showLabel
              size="sm"
            />
          </div>

          {/* Question Cue / Active Recall Area */}
          <div className="py-6 flex-1 flex flex-col items-center justify-center text-center space-y-4">
            {mode === 'listening' ? (
              <div className="space-y-4">
                <div className="inline-block p-4 rounded-full bg-brand-primarySoft text-brand-primary animate-glow-pulse">
                  <AudioButton
                    text={currentVocab.word}
                    dialect={currentVocab.dialect || settings.englishDialect}
                    size="lg"
                  />
                </div>
                <p className="text-xs text-text-secondary">
                  Nhấn loa để nghe phát âm chuẩn studio và truy hồi nghĩa tiếng Việt trước khi lật thẻ
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-brand-ink transition-transform hover:scale-[1.02]">
                  {currentVocab.word}
                </h2>
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
                  className="w-full text-center px-4 py-2.5 text-base border-2 border-slate-200 rounded-control focus:outline-none focus:border-brand-primary font-medium shadow-xs"
                />
                <button
                  type="submit"
                  className="w-full py-2 bg-slate-900 text-white rounded-control text-xs font-semibold hover:bg-slate-800 transition-colors shadow-xs active:scale-[0.98]"
                >
                  Kiểm tra (Enter)
                </button>
              </form>
            )}

            {mode === 'mcq' && !isRevealed && (
              <div className="w-full max-w-md grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-4">
                {mcqOptions.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setSelectedOption(opt);
                      handleReveal();
                    }}
                    className="p-3 text-left text-xs font-medium rounded-control border border-slate-200 hover:border-brand-primary hover:bg-brand-primarySoft/40 transition-all hover:scale-[1.01] active:scale-[0.99]"
                  >
                    <span className="font-bold text-slate-400 mr-1.5">
                      {String.fromCharCode(65 + i)}.
                    </span>
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {/* Reveal Result Area with Smooth Fade & Scale Animation */}
            {isRevealed && (
              <div className="w-full space-y-4 pt-4 border-t border-slate-100 text-left animate-in fade-in slide-in-from-top-1 duration-200">
                {/* Meaning & Definition */}
                <div className="space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-brand-primary">
                    Nghĩa tiếng Việt
                  </span>
                  <p className="text-xl font-bold text-brand-ink">
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
                  <div className="p-3.5 rounded-control bg-slate-50 border border-slate-100 text-xs space-y-1">
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
                    className={`p-3 rounded-control text-xs font-medium flex items-center gap-2 ${
                      isTypedCorrect
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 animate-in zoom-in-95'
                        : 'bg-rose-50 text-rose-800 border border-rose-200 animate-in shake'
                    }`}
                  >
                    {isTypedCorrect ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
                        <span>Chính xác tuyệt đối!</span>
                      </>
                    ) : (
                      <>
                        <X className="w-4 h-4 text-rose-600 stroke-[3]" />
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
                className="w-full py-3.5 bg-brand-primary text-white font-bold text-sm rounded-control hover:bg-brand-primaryHover shadow-md transition-all duration-150 flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                <span>Xem đáp án (Active Recall)</span>
                <kbd className="px-2 py-0.5 text-[10px] font-mono bg-white/20 rounded text-white font-normal">
                  Space
                </kbd>
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[11px] text-text-secondary px-1">
                  <span>Đánh giá mức độ truy hồi để FSRS cập nhật chu kỳ:</span>
                  <span className="flex items-center gap-1 font-mono">
                    <Keyboard className="w-3.5 h-3.5" />
                    <span>Phím 1, 2, 3, 4</span>
                  </span>
                </div>

                {/* 4 FSRS Ratings Grid with Spring scale hover */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {intervalPreviews.map((preview) => {
                    const ratingColors = {
                      1: 'hover:border-rose-400 hover:bg-rose-50/70 text-rose-700 active:bg-rose-100',
                      2: 'hover:border-amber-400 hover:bg-amber-50/70 text-amber-700 active:bg-amber-100',
                      3: 'hover:border-blue-400 hover:bg-blue-50/70 text-blue-700 active:bg-blue-100',
                      4: 'hover:border-emerald-400 hover:bg-emerald-50/70 text-emerald-700 active:bg-emerald-100',
                    };

                    return (
                      <button
                        key={preview.rating}
                        onClick={() => handleGrade(preview.rating)}
                        className={`p-3 rounded-control border border-slate-200 bg-surface-base text-left transition-all duration-150 shadow-xs flex flex-col justify-between hover:scale-[1.03] active:scale-95 ${
                          ratingColors[preview.rating]
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs">{preview.label}</span>
                          <kbd className="px-1.5 py-0.2 text-[10px] font-mono bg-slate-100 rounded text-slate-500 font-bold">
                            {preview.rating}
                          </kbd>
                        </div>
                        <div className="mt-1.5 flex items-baseline justify-between">
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
          Mô hình: FSRS-7 • Chuẩn EVLP-SRS-001
        </span>
      </div>
    </div>
  );
}

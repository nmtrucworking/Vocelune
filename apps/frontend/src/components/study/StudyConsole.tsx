'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Volume2,
  Undo2,
  Sparkles,
  CheckCircle2,
  RotateCcw,
  Flame,
  Check,
  X,
  Keyboard,
  ArrowRight,
  HelpCircle,
  Eye,
  Layers,
  Zap,
  Clock,
} from 'lucide-react';
import { useVocelune } from '@/context/VoceluneContext';
import { Card, VocabItem, FSRSRating, StudyMode } from '@/types';
import { getFSRSPreviews, IntervalPreview } from '@/lib/fsrs-engine';
import { speakWord } from '@/lib/speech';
import { triggerConfetti } from '@/lib/confetti';
import { AudioButton } from '../common/AudioButton';

export type StudyScope = 'due' | 'ahead' | 'all';

export function StudyConsole() {
  const { dueCards, vocabItems, decks, gradeCard, undoLastReview, canUndo, settings, revealCard, cards } =
    useVocelune();

  const [studyScope, setStudyScope] = useState<StudyScope>('due');
  const [selectedTopicGroup, setSelectedTopicGroup] = useState<string>('all');
  const [selectedDeckId, setSelectedDeckId] = useState<string>('all');

  const availableGroups = useMemo(() => {
    const set = new Set<string>();
    decks.forEach((d) => set.add(d.topicGroup || 'Chung'));
    return Array.from(set).sort();
  }, [decks]);

  const deckMap = useMemo(() => new Map(decks.map((d) => [d.id, d])), [decks]);

  const dueIdSet = useMemo(() => new Set(dueCards.map((c) => c.id)), [dueCards]);

  const scopeStats = useMemo(() => {
    let ahead = 0;
    for (const c of cards) {
      if (c.suspended) continue;
      if (!dueIdSet.has(c.id)) {
        ahead++;
      }
    }
    return {
      due: dueCards.length,
      ahead,
      all: dueCards.length + ahead,
    };
  }, [dueCards, cards, dueIdSet]);

  const candidateCards = useMemo(() => {
    let pool: Card[] = [];
    if (studyScope === 'due') {
      pool = dueCards;
    } else if (studyScope === 'ahead') {
      pool = cards.filter((c) => !c.suspended && !dueIdSet.has(c.id));
    } else {
      pool = cards.filter((c) => !c.suspended);
    }

    return pool.filter((card) => {
      const vocab = vocabItems.find((v) => v.id === card.vocabItemId);
      if (!vocab) return false;
      if (selectedDeckId !== 'all' && vocab.deckId !== selectedDeckId) return false;
      if (selectedTopicGroup !== 'all') {
        const d = deckMap.get(vocab.deckId);
        if ((d?.topicGroup || 'Chung') !== selectedTopicGroup) return false;
      }
      return true;
    });
  }, [dueCards, cards, dueIdSet, studyScope, vocabItems, selectedDeckId, selectedTopicGroup, deckMap]);

  const grading = useRef(false);
  const [revealReady, setRevealReady] = useState(false);
  // Create an active queue from due cards (or all cards if none due)
  const [queue, setQueue] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [mode, setMode] = useState<StudyMode>('flashcard');

  // Direction for card slide animation (1 = next, -1 = prev)
  const [slideDirection, setSlideDirection] = useState<number>(1);

  // Typed mode state
  const [typedInput, setTypedInput] = useState('');
  const [typedSubmitted, setTypedSubmitted] = useState(false);

  // MCQ mode state
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  // Session completion stats
  const [completedCount, setCompletedCount] = useState(0);
  const [startTime, setStartTime] = useState<number>(Date.now());

  // Initialize queue based on candidateCards
  useEffect(() => {
    setQueue(candidateCards);
    setCurrentIndex(0);
    setIsFlipped(false);
  }, [candidateCards]);

  const currentCard = queue[currentIndex] || null;
  const currentVocab: VocabItem | undefined = useMemo(() => {
    if (!currentCard) return undefined;
    return vocabItems.find((v) => v.id === currentCard.vocabItemId);
  }, [currentCard, vocabItems]);

  const isCurrentCardDue = useMemo(() => {
    if (!currentCard) return true;
    return dueIdSet.has(currentCard.id);
  }, [currentCard, dueIdSet]);

  const dueRelativeText = useMemo(() => {
    if (!currentCard) return '';
    if (currentCard.state === 'new') return 'Thẻ mới';
    const diffMs = new Date(currentCard.dueAt).getTime() - Date.now();
    if (diffMs <= 0) return 'Đến hạn ôn';
    const mins = Math.round(diffMs / 60000);
    if (mins < 60) return `${mins} phút nữa`;
    const hours = Math.round(diffMs / 3600000);
    if (hours < 24) return `${hours} giờ nữa`;
    const days = Math.round(hours / 24);
    return `${days} ngày nữa`;
  }, [currentCard]);

  useEffect(() => {
    let cancelled = false;
    setRevealReady(false);
    if (isFlipped && currentCard) void revealCard(currentCard.id).then(() => { if (!cancelled) setRevealReady(true); }).catch(() => {});
    return () => { cancelled = true; };
  }, [isFlipped, currentCard?.id, revealCard]);

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

  // Reveal answer (Flip card)
  const handleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
    if (!isFlipped && settings.autoPronounce && currentVocab) {
      speakWord(currentVocab.word, currentVocab.dialect || settings.englishDialect);
    }
  }, [isFlipped, settings.autoPronounce, currentVocab, settings.englishDialect]);

  // Grade action (FSRS rating 1-4)
  const handleGrade = useCallback(
    async (rating: FSRSRating) => {
      if (!currentCard || !revealReady || grading.current) return;
      grading.current = true;

      const durationMs = Date.now() - startTime;
      try { await gradeCard(currentCard.id, rating, durationMs); } catch { grading.current = false; return; }
      grading.current = false;

      setCompletedCount((prev) => prev + 1);
      setSlideDirection(1);
      setIsFlipped(false);
      setTypedInput('');
      setTypedSubmitted(false);
      setSelectedOption(null);
      setStartTime(Date.now());

      // Move to next card
      if (currentIndex < queue.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        // Queue finished -> trigger celebratory confetti!
        setCurrentIndex(queue.length);
        triggerConfetti();
      }
    },
    [currentCard, revealReady, startTime, gradeCard, currentIndex, queue.length]
  );

  const handleUndo = useCallback(async () => {
    if (!canUndo || grading.current) return;
    grading.current = true;
    try {
      if (await undoLastReview()) {
        setSlideDirection(-1); setCurrentIndex(i => Math.max(0, i - 1));
        setCompletedCount(c => Math.max(0, c - 1)); setIsFlipped(false); setSelectedOption(null); setStartTime(Date.now());
      }
    } catch { /* The server explains expired/conflicting undo via the app banner. */ }
    finally { grading.current = false; }
  }, [canUndo, undoLastReview]);

  // Handle MCQ selection: visual feedback, pronunciation, then flip
  const handleSelectOption = useCallback(
    (opt: string) => {
      if (isFlipped || selectedOption !== null) return;
      setSelectedOption(opt);
      if (settings.autoPronounce && currentVocab) {
        speakWord(currentVocab.word, currentVocab.dialect || settings.englishDialect);
      }
      setTimeout(() => {
        setIsFlipped(true);
      }, 400);
    },
    [isFlipped, selectedOption, settings.autoPronounce, currentVocab, settings.englishDialect]
  );

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in input and hasn't submitted yet
      if (
        document.activeElement?.tagName === 'INPUT' &&
        !typedSubmitted &&
        mode === 'typed'
      ) {
        return;
      }

      if (e.code === 'Space') {
        // In mcq or typed before submit, Space shouldn't blindly flip the card
        if (!isFlipped && (mode === 'mcq' || (mode === 'typed' && !typedSubmitted))) {
          return;
        }
        e.preventDefault();
        handleFlip();
      } else if (!isFlipped && mode === 'mcq') {
        const keyMap: Record<string, number> = {
          '1': 0, 'a': 0, 'A': 0,
          '2': 1, 'b': 1, 'B': 1,
          '3': 2, 'c': 2, 'C': 2,
          '4': 3, 'd': 3, 'D': 3,
        };
        const optIndex = keyMap[e.key];
        if (optIndex !== undefined && mcqOptions[optIndex]) {
          e.preventDefault();
          handleSelectOption(mcqOptions[optIndex]);
        }
      } else if (isFlipped) {
        if (e.key === '1') handleGrade(1);
        if (e.key === '2') handleGrade(2);
        if (e.key === '3') handleGrade(3);
        if (e.key === '4') handleGrade(4);
      }

      if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey || !isFlipped)) {
        if (canUndo) {
          e.preventDefault();
          void handleUndo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFlipped, handleFlip, handleGrade, canUndo, handleUndo, mode, typedSubmitted, mcqOptions, handleSelectOption]);

  // Handle Typed Submit: Validate and then flip card to reveal full details
  const handleTypedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedInput.trim()) return;
    setTypedSubmitted(true);
    setIsFlipped(true);
    if (settings.autoPronounce && currentVocab) {
      speakWord(currentVocab.word, currentVocab.dialect || settings.englishDialect);
    }
  };

  // Empty state: All cards done
  if (queue.length === 0 || currentIndex >= queue.length || !currentVocab || !currentCard) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="max-w-xl mx-auto py-12 px-4 text-center space-y-6"
      >
        <motion.div
          animate={{ scale: [1, 1.08, 1], rotate: [0, 5, -5, 0] }}
          transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
          className="w-20 h-20 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border-2 border-emerald-200 shadow-lg"
        >
          <CheckCircle2 className="w-10 h-10 stroke-[2.2]" />
        </motion.div>

        <div className="space-y-2">
          <h2 className="text-3xl font-extrabold text-brand-ink">
            {completedCount > 0 ? 'Hoàn thành nhịp ôn hôm nay!' : 'Tất cả thẻ đã được ôn!'}
          </h2>
          <p className="text-sm text-text-secondary max-w-md mx-auto leading-relaxed">
            {completedCount > 0
              ? `Tuyệt vời! Bạn đã hoàn thành ${completedCount} lượt truy hồi chất lượng cao. Thuật toán FSRS-6 đã ghi nhận và tối ưu thời điểm quay lại.`
              : 'Hiện không có thẻ nào đến hạn. Bạn có thể thêm từ mới hoặc ôn luyện tự do trong Thư viện.'}
          </p>
        </div>

        {completedCount > 0 && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-control bg-brand-primarySoft text-brand-primary text-xs font-semibold shadow-xs">
            <Sparkles className="w-4 h-4 text-brand-primary animate-spin" />
            <span>Đã đồng bộ lịch ôn tập FSRS-6</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4 flex-wrap">
          {scopeStats.ahead > 0 && studyScope !== 'ahead' && (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setStudyScope('ahead');
                setCompletedCount(0);
                setCurrentIndex(0);
                setIsFlipped(false);
              }}
              className="px-5 py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs rounded-control transition-colors shadow-md flex items-center gap-2"
            >
              <Zap className="w-4 h-4 fill-white" />
              <span>Học sớm các thẻ chưa đến hạn ({scopeStats.ahead} thẻ)</span>
            </motion.button>
          )}

          {scopeStats.all > 0 && studyScope !== 'all' && (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setStudyScope('all');
                setCompletedCount(0);
                setCurrentIndex(0);
                setIsFlipped(false);
              }}
              className="px-5 py-3 bg-brand-primary text-white hover:bg-brand-primaryHover font-semibold text-xs rounded-control transition-colors shadow-md flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Ôn tập toàn bộ kho từ ({scopeStats.all} thẻ)</span>
            </motion.button>
          )}

          {studyScope !== 'due' && scopeStats.due > 0 && (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setStudyScope('due');
                setCompletedCount(0);
                setCurrentIndex(0);
                setIsFlipped(false);
              }}
              className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-control transition-colors shadow-md flex items-center gap-2"
            >
              <Clock className="w-4 h-4" />
              <span>Quay lại thẻ đến hạn ({scopeStats.due} thẻ)</span>
            </motion.button>
          )}

          {(studyScope === 'ahead' || studyScope === 'all') && queue.length > 0 && (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setCurrentIndex(0);
                setIsFlipped(false);
                setCompletedCount(0);
              }}
              className="px-5 py-3 bg-slate-700 text-white hover:bg-slate-800 font-semibold text-xs rounded-control transition-colors shadow-md flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Làm mới phiên học hiện tại</span>
            </motion.button>
          )}
        </div>
      </motion.div>
    );
  }

  const isTypedCorrect =
    typedSubmitted &&
    typedInput.trim().toLowerCase() === currentVocab.word.trim().toLowerCase();

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Scope Switcher: Đến hạn vs Học sớm vs Tất cả */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-1.5 bg-slate-100/80 border border-slate-200/90 rounded-2xl shadow-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => {
              setStudyScope('due');
              setSlideDirection(1);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              studyScope === 'due'
                ? 'bg-white text-emerald-800 shadow-xs border border-emerald-200/80'
                : 'text-text-secondary hover:text-brand-ink'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-emerald-600" />
            <span>Đến hạn ôn</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                studyScope === 'due' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200/80 text-slate-600'
              }`}
            >
              {scopeStats.due}
            </span>
          </button>

          <button
            onClick={() => {
              setStudyScope('ahead');
              setSlideDirection(1);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              studyScope === 'ahead'
                ? 'bg-white text-amber-900 shadow-xs border border-amber-300'
                : 'text-text-secondary hover:text-brand-ink'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
            <span>Chưa đến hạn · Học sớm</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                studyScope === 'ahead' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200/80 text-slate-600'
              }`}
            >
              {scopeStats.ahead}
            </span>
          </button>

          <button
            onClick={() => {
              setStudyScope('all');
              setSlideDirection(1);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              studyScope === 'all'
                ? 'bg-white text-indigo-900 shadow-xs border border-indigo-200/80'
                : 'text-text-secondary hover:text-brand-ink'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-indigo-500" />
            <span>Tất cả thẻ</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                studyScope === 'all' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200/80 text-slate-600'
              }`}
            >
              {scopeStats.all}
            </span>
          </button>
        </div>

        {studyScope === 'ahead' && (
          <span className="text-[11px] text-amber-700 font-medium px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200/60 inline-flex items-center gap-1 self-start sm:self-auto">
            <Zap className="w-3 h-3 text-amber-600" />
            <span>Học trước hạn: FSRS tự động cập nhật độ nhớ</span>
          </span>
        )}
      </div>

      {/* Top Header: Progress & Mode Switcher */}
      {/* Header controls: Topic selection & Mode selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 font-medium text-text-secondary">
            <span className="font-bold text-brand-ink">
              Thẻ {currentIndex + 1}
            </span>
            <span>/</span>
            <span>{queue.length}</span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-brand-primarySoft text-brand-primary">
              {currentCard.state}
            </span>
          </div>

          {/* Quick topic group selector */}
          <div className="flex items-center gap-1 pl-2 border-l border-slate-200">
            <select
              value={selectedTopicGroup}
              onChange={(e) => {
                setSelectedTopicGroup(e.target.value);
                setSelectedDeckId('all');
              }}
              className="px-2 py-1 text-[11px] bg-surface-base border border-slate-200 rounded-md font-medium text-slate-700 focus:outline-none focus:border-brand-primary"
            >
              <option value="all">Tất cả nhóm</option>
              {availableGroups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Study Mode Selector */}
        <div className="flex items-center bg-surface-base p-1 rounded-control border border-slate-200/80 shadow-xs">
          {(['flashcard', 'typed', 'mcq', 'listening'] as StudyMode[]).map((m) => {
            const labels: Record<StudyMode, string> = {
              flashcard: 'Lật thẻ',
              typed: 'Gõ từ',
              mcq: 'Trắc nghiệm',
              listening: 'Luyện nghe',
            };
            const isActive = mode === m;
            return (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setIsFlipped(false);
                  setTypedSubmitted(false);
                  setTypedInput('');
                  setSelectedOption(null);
                }}
                className={`relative px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  isActive ? 'text-white' : 'text-text-secondary hover:text-brand-ink'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="studyModePill"
                    className="absolute inset-0 bg-brand-primary rounded-lg shadow-xs"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{labels[m]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Animated Progress Bar */}
      <div className="w-full h-2 bg-slate-200/60 rounded-full overflow-hidden p-0.5 shadow-inner">
        <motion.div
          className="h-full bg-gradient-to-r from-brand-primary to-indigo-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${((currentIndex + 1) / queue.length) * 100}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>

      {/* 3D Flappable Flashcard Canvas */}
      <div className="relative min-h-[380px] w-full" style={{ perspective: 1200 }}>
        <AnimatePresence mode="wait" custom={slideDirection}>
          <motion.div
            key={currentCard.id}
            custom={slideDirection}
            initial={{ opacity: 0, x: slideDirection * 60, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -slideDirection * 60, scale: 0.96 }}
            transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
            className="w-full"
          >
            {/* The 3D Flip Container */}
            <motion.div
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
              style={{ transformStyle: 'preserve-3d' }}
              className={`relative w-full min-h-[380px] rounded-card shadow-card ${
                !isFlipped && (mode === 'flashcard' || mode === 'listening')
                  ? 'cursor-pointer'
                  : ''
              }`}
              onClick={() => {
                // Clicking the card flips it only in flashcard or listening mode on the front
                if (!isFlipped && (mode === 'flashcard' || mode === 'listening')) {
                  handleFlip();
                }
              }}
            >
              {/* ================= CARD FRONT (Face 1) ================= */}
              <div
                style={{
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                }}
                className={`absolute inset-0 bg-surface-base border border-slate-200/90 rounded-card p-6 md:p-8 flex flex-col justify-between select-none ${
                  isFlipped ? 'pointer-events-none' : ''
                }`}
              >
                {/* Front Top Metadata Bar */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded text-[11px] font-extrabold bg-brand-primarySoft text-brand-primary">
                      {currentVocab.cefr}
                    </span>
                    <span className="text-xs font-semibold text-text-secondary italic">
                      ({currentVocab.partOfSpeech})
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    {isCurrentCardDue ? (
                      <span className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200/80 px-2 py-0.5 rounded-full font-semibold">
                        {currentCard.state === 'new' ? 'Thẻ mới' : 'Đến hạn ôn'}
                      </span>
                    ) : (
                      <span className="text-[11px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                        <Zap className="w-3 h-3 text-amber-500 fill-amber-400" />
                        <span>Học sớm · {dueRelativeText}</span>
                      </span>
                    )}
                    <span className="hidden sm:inline-block text-[11px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-mono">
                      Câu hỏi
                    </span>
                  </div>
                </div>

                {/* Front Question Content: Context-aware by Mode */}
                <div className="py-6 flex-1 flex flex-col items-center justify-center text-center space-y-4">
                  {/* Mode 1: Flashcard -> Show English Word */}
                  {mode === 'flashcard' && (
                    <div className="space-y-3">
                      <div className="inline-flex items-center gap-2">
                        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-brand-ink">
                          {currentVocab.word}
                        </h2>
                        <AudioButton
                          text={currentVocab.word}
                          dialect={currentVocab.dialect || settings.englishDialect}
                          size="md"
                        />
                      </div>
                      <p className="text-sm font-mono text-slate-400">
                        {currentVocab.phonetic}
                      </p>
                      <p className="text-xs text-slate-400 pt-2 flex items-center justify-center gap-1">
                        <Eye className="w-3.5 h-3.5" />
                        <span>Hãy tự gợi nhớ nghĩa tiếng Việt trong đầu</span>
                      </p>
                    </div>
                  )}

                  {/* Mode 2: Typed -> Show Meaning Cue, Prompt to recall English word! */}
                  {mode === 'typed' && (
                    <div className="w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-brand-primary">
                          Gợi ý nghĩa tiếng Việt
                        </span>
                        <h3 className="text-2xl font-extrabold text-brand-ink">
                          {currentVocab.meaningVi}
                        </h3>
                        <p className="text-xs text-text-secondary italic">
                          ({currentVocab.partOfSpeech}) • {currentVocab.word.length} ký tự
                          {currentVocab.word.length > 3 && (
                            <span className="font-mono text-slate-400 ml-1.5">
                              [ {currentVocab.word[0]}...{currentVocab.word[currentVocab.word.length - 1]} ]
                            </span>
                          )}
                        </p>
                      </div>

                      <form onSubmit={handleTypedSubmit} className="space-y-2 pt-2">
                        <input
                          type="text"
                          autoFocus
                          placeholder="Gõ từ tiếng Anh tương ứng..."
                          value={typedInput}
                          onChange={(e) => setTypedInput(e.target.value)}
                          className="w-full text-center px-4 py-3 text-base border-2 border-slate-200 rounded-control focus:outline-none focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 font-bold tracking-wide shadow-xs"
                        />
                        <button
                          type="submit"
                          className="w-full py-2.5 bg-brand-primary hover:bg-brand-primaryHover text-white rounded-control text-xs font-bold transition-all shadow-sm active:scale-[0.98]"
                        >
                          Kiểm tra & Lật thẻ (Enter)
                        </button>
                      </form>
                    </div>
                  )}

                  {/* Mode 3: Multiple Choice (MCQ) */}
                  {mode === 'mcq' && (
                    <div className="w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
                      <div className="space-y-1">
                        <h2 className="text-3xl font-extrabold text-brand-ink">
                          {currentVocab.word}
                        </h2>
                        <p className="text-xs font-mono text-slate-400">{currentVocab.phonetic}</p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                        {mcqOptions.map((opt, i) => {
                          const isSelected = selectedOption === opt;
                          const isCorrect = opt === currentVocab.meaningVi;
                          let btnStyle =
                            'border-slate-200 hover:border-brand-primary hover:bg-brand-primarySoft/40 text-brand-ink';
                          if (selectedOption !== null) {
                            if (isCorrect) {
                              btnStyle =
                                'border-emerald-500 bg-emerald-50 text-emerald-800 font-bold ring-2 ring-emerald-500/20';
                            } else if (isSelected) {
                              btnStyle =
                                'border-rose-500 bg-rose-50 text-rose-800 font-bold ring-2 ring-rose-500/20';
                            } else {
                              btnStyle = 'border-slate-200 opacity-40 text-slate-400';
                            }
                          }

                          return (
                            <motion.button
                              key={i}
                              whileHover={selectedOption === null ? { scale: 1.02 } : {}}
                              whileTap={selectedOption === null ? { scale: 0.98 } : {}}
                              disabled={selectedOption !== null || isFlipped}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectOption(opt);
                              }}
                              className={`p-3 text-left text-xs font-semibold rounded-control border transition-all shadow-xs flex items-center justify-between ${btnStyle}`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-400">
                                  {String.fromCharCode(65 + i)}.
                                </span>
                                <span>{opt}</span>
                              </div>
                              {selectedOption !== null && isCorrect && (
                                <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
                              )}
                              {selectedOption !== null && isSelected && !isCorrect && (
                                <X className="w-4 h-4 text-rose-600 stroke-[3]" />
                              )}
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Mode 4: Listening -> Audio Visualizer Orb */}
                  {mode === 'listening' && (
                    <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
                      <motion.div
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                        className="inline-block p-4 rounded-full bg-brand-primarySoft text-brand-primary shadow-elevated"
                      >
                        <AudioButton
                          text={currentVocab.word}
                          dialect={currentVocab.dialect || settings.englishDialect}
                          size="lg"
                        />
                      </motion.div>
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-brand-ink">
                          Nhấn loa để nghe phát âm chuẩn studio
                        </p>
                        <p className="text-xs text-text-secondary">
                          Thử gợi nhớ từ vựng và nghĩa tiếng Việt trước khi lật đáp án
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Front Footer: Hint & Flip Button */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  {mode === 'mcq' ? (
                    <>
                      <span className="text-[11px] text-text-secondary flex items-center gap-1">
                        <Keyboard className="w-3.5 h-3.5" />
                        <span>Chọn đáp án (Phím <strong>1-4</strong> hoặc <strong>A-D</strong>)</span>
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFlip();
                        }}
                        className="px-3 py-1.5 text-xs text-text-secondary hover:text-brand-ink hover:bg-slate-100 rounded-control font-medium transition-all flex items-center gap-1.5"
                      >
                        <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                        <span>Bỏ qua & Xem đáp án</span>
                      </button>
                    </>
                  ) : mode === 'typed' ? (
                    <>
                      <span className="text-[11px] text-text-secondary flex items-center gap-1">
                        <Keyboard className="w-3.5 h-3.5" />
                        <span>Nhấn <strong>Enter</strong> để kiểm tra đáp án</span>
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFlip();
                        }}
                        className="px-3 py-1.5 text-xs text-text-secondary hover:text-brand-ink hover:bg-slate-100 rounded-control font-medium transition-all flex items-center gap-1.5"
                      >
                        <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                        <span>Bỏ qua & Xem đáp án</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-[11px] text-text-secondary flex items-center gap-1">
                        <Keyboard className="w-3.5 h-3.5" />
                        <span>Nhấn <strong>Space</strong> hoặc chạm vào thẻ để lật</span>
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFlip();
                        }}
                        className="px-4 py-2 bg-brand-primary text-white text-xs font-bold rounded-control hover:bg-brand-primaryHover transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                      >
                        <span>Lật xem đáp án</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* ================= CARD BACK (Face 2: Flipped 180deg) ================= */}
              <div
                style={{
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                }}
                onClick={(e) => e.stopPropagation()}
                className={`absolute inset-0 bg-surface-base border-2 border-brand-primary/40 rounded-card p-6 md:p-8 flex flex-col justify-between select-none shadow-elevated ${
                  !isFlipped ? 'pointer-events-none' : ''
                }`}
              >
                {/* Back Top Metadata Bar */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded text-[11px] font-extrabold bg-brand-primarySoft text-brand-primary">
                      {currentVocab.cefr}
                    </span>
                    <span className="text-xs font-semibold text-brand-ink">
                      {currentVocab.word}
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      {currentVocab.phonetic}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {!isCurrentCardDue && (
                      <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                        <Zap className="w-2.5 h-2.5 text-amber-500 fill-amber-400" />
                        <span>{dueRelativeText}</span>
                      </span>
                    )}
                    <AudioButton
                      text={currentVocab.word}
                      dialect={currentVocab.dialect || settings.englishDialect}
                      size="sm"
                      showLabel
                    />
                  </div>
                </div>

                {/* Back Revealed Knowledge Body */}
                <div className="py-4 flex-1 space-y-3.5 text-left overflow-y-auto">
                  {/* MCQ verification banner if in MCQ mode */}
                  {mode === 'mcq' && (
                    <motion.div
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className={`p-3 rounded-control text-xs font-semibold flex items-center gap-2.5 ${
                        selectedOption === currentVocab.meaningVi
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : selectedOption
                          ? 'bg-rose-50 text-rose-800 border border-rose-200'
                          : 'bg-slate-50 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {selectedOption === currentVocab.meaningVi ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
                          <span>Chính xác! Bạn đã chọn đúng nghĩa: <strong>{currentVocab.meaningVi}</strong></span>
                        </>
                      ) : selectedOption ? (
                        <>
                          <X className="w-4 h-4 text-rose-600 stroke-[3]" />
                          <span>
                            Bạn đã chọn: <strong className="underline">&ldquo;{selectedOption}&rdquo;</strong> (Đáp án đúng: <strong>{currentVocab.meaningVi}</strong>)
                          </span>
                        </>
                      ) : (
                        <>
                          <HelpCircle className="w-4 h-4 text-slate-500" />
                          <span>Bạn đã bỏ qua câu hỏi này (Đáp án đúng: <strong>{currentVocab.meaningVi}</strong>)</span>
                        </>
                      )}
                    </motion.div>
                  )}

                  {/* Typed verification banner if in typed mode */}
                  {mode === 'typed' && typedSubmitted && (
                    <motion.div
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className={`p-3 rounded-control text-xs font-semibold flex items-center gap-2.5 ${
                        isTypedCorrect
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}
                    >
                      {isTypedCorrect ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
                          <span>Chính xác tuyệt đối! Bạn đã nhớ đúng 100% chính tả.</span>
                        </>
                      ) : (
                        <>
                          <X className="w-4 h-4 text-rose-600 stroke-[3]" />
                          <span>
                            Bạn đã gõ: <strong className="underline">&ldquo;{typedInput}&rdquo;</strong> (Đáp án đúng: <strong>{currentVocab.word}</strong>)
                          </span>
                        </>
                      )}
                    </motion.div>
                  )}

                  {/* Primary Meaning in Vietnamese */}
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-primary">
                      Nghĩa tiếng Việt
                    </span>
                    <h3 className="text-2xl font-extrabold text-brand-ink">
                      {currentVocab.meaningVi}
                    </h3>
                  </div>

                  {/* Illustrative Image (if attached) */}
                  {currentVocab.imageUrl && (
                    <div className="flex justify-center my-2">
                      <div className="rounded-xl overflow-hidden border border-slate-200/90 bg-slate-50 max-h-48 flex items-center justify-center p-1 shadow-xs">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={currentVocab.imageUrl}
                          alt={currentVocab.word}
                          className="max-h-44 w-auto object-contain rounded-lg"
                        />
                      </div>
                    </div>
                  )}

                  {/* English Definition */}
                  {currentVocab.definitionEn && (
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-semibold text-text-secondary">
                        Định nghĩa tiếng Anh
                      </span>
                      <p className="text-xs text-brand-ink leading-relaxed">
                        {currentVocab.definitionEn}
                      </p>
                    </div>
                  )}

                  {/* Context Example */}
                  {currentVocab.exampleEn && (
                    <div className="p-3.5 rounded-control bg-slate-50 border border-slate-100 text-xs space-y-1">
                      <p className="italic text-brand-ink font-semibold">
                        &ldquo;{currentVocab.exampleEn}&rdquo;
                      </p>
                      {currentVocab.exampleVi && (
                        <p className="text-text-secondary text-[11px]">
                          {currentVocab.exampleVi}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Back Footer: FSRS 4 Rating Choices with Animated Micro-interactions */}
                <div className="pt-3 border-t border-slate-100 space-y-2" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between text-[11px] text-text-secondary px-1">
                    <span className="font-semibold text-brand-ink">
                      Đánh giá độ nhớ để FSRS lập lịch:
                    </span>
                    <span className="font-mono text-slate-400">
                      Phím tắt 1, 2, 3, 4
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {intervalPreviews.map((preview) => {
                      const ratingStyles = {
                        1: 'hover:border-rose-400 hover:bg-rose-50/70 text-rose-700 bg-rose-50/20',
                        2: 'hover:border-amber-400 hover:bg-amber-50/70 text-amber-700 bg-amber-50/20',
                        3: 'hover:border-blue-400 hover:bg-blue-50/70 text-blue-700 bg-blue-50/20',
                        4: 'hover:border-emerald-400 hover:bg-emerald-50/70 text-emerald-700 bg-emerald-50/20',
                      };

                      return (
                        <motion.button
                          key={preview.rating}
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.96 }}
                          disabled={!revealReady}
                          onClick={() => void handleGrade(preview.rating)}
                          className={`p-2.5 rounded-control border border-slate-200 text-left transition-all shadow-xs flex flex-col justify-between ${
                            ratingStyles[preview.rating]
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs">{preview.label}</span>
                            <kbd className="px-1.5 py-0.2 text-[10px] font-mono bg-white border rounded text-slate-500 font-bold shadow-2xs">
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
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Undo Button & Footnote */}
      <div className="flex items-center justify-between px-2 text-xs text-text-secondary">
        <button
          onClick={() => void handleUndo()}
          disabled={!canUndo}
          className="flex items-center gap-1.5 py-1 px-2.5 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <Undo2 className="w-3.5 h-3.5" />
          <span>Hoàn tác lượt vừa ôn (Z)</span>
        </button>

        <span className="text-[11px] text-slate-400">
          Mô hình: FSRS-6 • Tỷ lệ mục tiêu: {(settings.desiredRetention * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

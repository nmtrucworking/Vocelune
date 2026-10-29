'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  CheckSquare,
  Play,
  RotateCcw,
  Clock,
  Award,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Volume2,
  Check,
  X,
  History,
  AlertTriangle,
  Zap,
  Filter,
} from 'lucide-react';
import { useVocelune } from '@/context/VoceluneContext';
import { useNotification } from '@/context/NotificationContext';
import { VocabItem, TestAttempt, TestQuestion, CEFRLevel, PartOfSpeech } from '@/types';
import { api, post } from '@/lib/api';
import { triggerConfetti } from '@/lib/confetti';
import { AudioButton } from '../common/AudioButton';

type TestState = 'builder' | 'running' | 'completed';

export function TestModule() {
  const { vocabItems, decks, testAttempts, refresh, cards, user, settings } =
    useVocelune();
  const { notify } = useNotification();

  // Test Builder Configuration
  const [selectedDeckId, setSelectedDeckId] = useState<string>('all');
  const [selectedCefr, setSelectedCefr] = useState<string>('all');
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [testMode, setTestMode] = useState<'mixed' | 'mcq' | 'typed'>('mixed');
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number>(5);

  // Active Test State
  const [testState, setTestState] = useState<TestState>('builder');
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [completedAttempt, setCompletedAttempt] = useState<TestAttempt | null>(null);
  const [appliedToSRS, setAppliedToSRS] = useState(false);
  const [testError, setTestError] = useState('');
  const [selfRatings, setSelfRatings] = useState<Record<string, number>>({});
  const [reviewFilter, setReviewFilter] = useState<'all' | 'correct' | 'incorrect'>('all');
  
  const answerSequences = useRef(new Map<string, number>());
  const activeAttempt = useRef<TestAttempt | null>(null);
  const submitting = useRef(false);
  const autosaveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  // Filter eligible words
  const eligibleVocab = vocabItems.filter((v) => {
    if (selectedDeckId !== 'all' && v.deckId !== selectedDeckId) return false;
    if (selectedCefr !== 'all' && v.cefr !== selectedCefr) return false;
    return true;
  });

  const loadAttempt = (attempt: TestAttempt) => {
    activeAttempt.current = attempt;
    answerSequences.current = new Map(attempt.questions.map((q) => [q.id, q.answerVersion || 0]));
    setQuestions(attempt.questions);
    setAnswers(Object.fromEntries(attempt.questions.map((q) => [q.id, q.userAnswer || ''])));
    setCurrentIndex(0);
    setSecondsRemaining(Math.max(0, Math.ceil((new Date(attempt.deadlineAt!).getTime() - Date.now()) / 1000)));
    setTestState('running');
    setAppliedToSRS(false);
    setSelfRatings({});
    setReviewFilter('all');
  };

  useEffect(() => {
    if (!user) return;
    const marker = sessionStorage.getItem(`vocelune_active_test_${user.id}`);
    if (marker) {
      void api<TestAttempt>(`/test-attempts/${marker}/report`)
        .then((attempt) => {
          if (attempt.status === 'in_progress') loadAttempt(attempt);
          else {
            setCompletedAttempt(attempt);
            setTestState('completed');
            sessionStorage.removeItem(`vocelune_active_test_${user.id}`);
          }
        })
        .catch(() => sessionStorage.removeItem(`vocelune_active_test_${user.id}`));
    }
    return () => {
      autosaveTimers.current.forEach(clearTimeout);
    };
  }, [user?.id]);

  const handleStartTest = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setTestError('');
    try {
      const definition = await post<{ id: string }>('/tests', {
        title: `Bài kiểm tra (${questionCount} câu)`,
        deckIds: selectedDeckId === 'all' ? [] : [selectedDeckId],
        cefr: selectedCefr === 'all' ? [] : [selectedCefr],
        size: questionCount,
        mode: testMode,
        durationSeconds: timeLimitMinutes * 60,
      });
      const attempt = await post<TestAttempt>(`/tests/${definition.id}/attempts`);
      sessionStorage.setItem(`vocelune_active_test_${user!.id}`, attempt.id);
      loadAttempt(attempt);
      notify.info('Bắt đầu bài kiểm tra!', `Thời lượng: ${timeLimitMinutes} phút. Chúc bạn làm bài tốt!`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Không thể tạo bài kiểm tra.';
      setTestError(msg);
      notify.error('Lỗi tạo bài thi', msg);
    } finally {
      submitting.current = false;
    }
  };

  const handleSelectAnswer = (qId: string, answer: string) => {
    setAnswers((previous) => ({ ...previous, [qId]: answer }));
    const clientSequence = (answerSequences.current.get(qId) || 0) + 1;
    answerSequences.current.set(qId, clientSequence);
    const timer = autosaveTimers.current.get(qId);
    if (timer) clearTimeout(timer);
    autosaveTimers.current.set(
      qId,
      setTimeout(() => {
        const attempt = activeAttempt.current;
        if (!attempt || submitting.current) return;
        void api(`/test-attempts/${attempt.id}/answers/${qId}`, {
          method: 'PUT',
          body: JSON.stringify({ answer, clientSequence }),
        }).catch((e) => {
          const msg = e instanceof Error ? e.message : 'Lỗi tự động lưu đáp án.';
          setTestError(msg);
          notify.warning('Tự động lưu chưa thành công', msg);
        });
      }, 500)
    );
  };

  const handleSubmitTest = async () => {
    if (!activeAttempt.current || submitting.current) return;
    submitting.current = true;
    setTestError('');
    autosaveTimers.current.forEach(clearTimeout);
    try {
      const result = await post<TestAttempt>(`/test-attempts/${activeAttempt.current.id}/submit`, {
        answers,
      });
      setCompletedAttempt(result);
      setTestState('completed');
      sessionStorage.removeItem(`vocelune_active_test_${user!.id}`);
      await refresh();
      notify.success(
        'Đã hoàn thành bài kiểm tra!',
        `Điểm đạt được: ${result.score}/${result.maxScore}`,
        { browserPush: true }
      );
      if (result.score / result.maxScore >= 0.7) triggerConfetti();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Không thể nộp bài.';
      setTestError(msg);
      notify.error('Lỗi nộp bài', msg);
    } finally {
      submitting.current = false;
    }
  };

  // Timer countdown tick
  useEffect(() => {
    if (testState !== 'running' || !activeAttempt.current) return;
    const tick = () => {
      const remaining = Math.max(
        0,
        Math.ceil((new Date(activeAttempt.current!.deadlineAt!).getTime() - Date.now()) / 1000)
      );
      setSecondsRemaining(remaining);
      if (remaining === 0) void handleSubmitTest();
    };
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [testState, answers]);

  // Keyboard navigation & MCQ Shortcuts (1-4 / A-D)
  useEffect(() => {
    if (testState !== 'running' || !questions.length) return;
    const currentQ = questions[currentIndex];
    if (!currentQ) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

      if (isInput) {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (currentIndex < questions.length - 1) {
            setCurrentIndex((prev) => prev + 1);
          }
        }
        return;
      }

      // MCQ Shortcuts (1-4 or A-D)
      if (currentQ.options && currentQ.options.length > 0) {
        let optIndex = -1;
        if (e.key === '1' || e.key.toLowerCase() === 'a') optIndex = 0;
        else if (e.key === '2' || e.key.toLowerCase() === 'b') optIndex = 1;
        else if (e.key === '3' || e.key.toLowerCase() === 'c') optIndex = 2;
        else if (e.key === '4' || e.key.toLowerCase() === 'd') optIndex = 3;

        if (optIndex >= 0 && optIndex < currentQ.options.length) {
          e.preventDefault();
          handleSelectAnswer(currentQ.id, currentQ.options[optIndex]);
          return;
        }
      }

      // Arrow navigation
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [testState, currentIndex, questions]);

  // Retake test with same pool
  const handleRetakeTest = async () => {
    if (!completedAttempt) return;
    setTestError('');
    try {
      const definition = await post<{ id: string }>('/tests', {
        title: `Bài kiểm tra (${completedAttempt.maxScore} câu)`,
        deckIds: completedAttempt.deckIds || [],
        cefr: selectedCefr === 'all' ? [] : [selectedCefr],
        size: completedAttempt.maxScore || 10,
        mode: testMode,
        durationSeconds: completedAttempt.durationSeconds || 300,
      });
      const attempt = await post<TestAttempt>(`/tests/${definition.id}/attempts`);
      sessionStorage.setItem(`vocelune_active_test_${user!.id}`, attempt.id);
      loadAttempt(attempt);
      notify.info('Bắt đầu làm lại bài thi!', 'Chúc bạn đạt kết quả cao hơn lần trước!');
    } catch {
      notify.error('Lỗi', 'Không thể khởi tạo lại bài kiểm tra.');
    }
  };

  // Quick preset: Correct -> Good (3), Incorrect -> Again (1)
  const handleAutoAssignSRS = () => {
    if (!completedAttempt) return;
    const updated: Record<string, number> = {};
    for (const q of completedAttempt.questions) {
      updated[q.id] = q.isCorrect ? 3 : 1;
    }
    setSelfRatings(updated);
    notify.info('Đã tự động gán', 'Câu đúng = Good (Nhớ được), câu sai = Again (Cần học lại).');
  };

  const applyTestToSRS = async () => {
    if (!completedAttempt || appliedToSRS) return;
    const ratings = completedAttempt.questions
      .filter((q) => selfRatings[q.id])
      .map((q) => {
        const card = cards.find(
          (c) => c.vocabItemId === q.vocabId && c.template === (q.direction || 'en_vi')
        );
        return card
          ? { questionId: q.id, rating: selfRatings[q.id], expectedCardVersion: card.version }
          : null;
      })
      .filter(Boolean);

    if (!ratings.length) {
      const msg = 'Chọn mức tự đánh giá cho ít nhất một câu có thẻ tương ứng.';
      setTestError(msg);
      notify.warning('Chưa chọn tự đánh giá', msg);
      return;
    }
    try {
      await post(`/test-attempts/${completedAttempt.id}/apply-srs`, { confirmation: true, ratings });
      setAppliedToSRS(true);
      await refresh();
      notify.success('Đã đồng bộ vào FSRS!', 'Lịch ôn tập thẻ của bạn đã được cập nhật.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Không thể cập nhật lịch ôn.';
      setTestError(msg);
      notify.error('Lỗi cập nhật SRS', msg);
    }
  };

  // BUILDER VIEW
  if (testState === 'builder') {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div>
          <h2 className="text-xl font-bold text-brand-ink">Tạo bài kiểm tra</h2>
          <p className="text-xs text-text-secondary mt-1">
            Đánh giá năng lực từ vựng độc lập. Kết quả kiểm tra không làm thay đổi lịch SRS trừ khi bạn chọn cập nhật sau khi hoàn thành.
          </p>
        </div>

        {/* Builder Card */}
        <div className="bg-surface-base border border-slate-200/90 rounded-card shadow-card p-5 md:p-7 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {/* Deck Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-brand-ink">Bộ từ nguồn</label>
              <select
                value={selectedDeckId}
                onChange={(e) => setSelectedDeckId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-surface-subtle border border-slate-200 rounded-control focus:outline-none focus:border-brand-primary"
              >
                <option value="all">Tất cả bộ từ ({vocabItems.length} từ)</option>
                {decks.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            {/* CEFR Level Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-brand-ink">Cấp độ CEFR</label>
              <select
                value={selectedCefr}
                onChange={(e) => setSelectedCefr(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-surface-subtle border border-slate-200 rounded-control focus:outline-none focus:border-brand-primary"
              >
                <option value="all">Tất cả cấp độ</option>
                <option value="A1">A1 - Beginner</option>
                <option value="A2">A2 - Elementary</option>
                <option value="B1">B1 - Intermediate</option>
                <option value="B2">B2 - Upper Intermediate</option>
                <option value="C1">C1 - Advanced</option>
                <option value="C2">C2 - Mastery</option>
              </select>
            </div>

            {/* Question Count */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-brand-ink">Số lượng câu hỏi</label>
              <select
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs bg-surface-subtle border border-slate-200 rounded-control focus:outline-none focus:border-brand-primary font-medium"
              >
                <option value={5}>5 câu (Khởi động)</option>
                <option value={10}>10 câu (Tiêu chuẩn)</option>
                <option value={20}>20 câu (Toàn diện)</option>
                <option value={30}>30 câu (Thử thách)</option>
              </select>
            </div>

            {/* Test Mode */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-brand-ink">Hình thức thi</label>
              <select
                value={testMode}
                onChange={(e) => setTestMode(e.target.value as any)}
                className="w-full px-3 py-2 text-xs bg-surface-subtle border border-slate-200 rounded-control focus:outline-none focus:border-brand-primary font-medium"
              >
                <option value="mixed">Hỗn hợp (Trắc nghiệm + Gõ từ + Nghe)</option>
                <option value="mcq">100% Trắc nghiệm 4 lựa chọn</option>
                <option value="typed">100% Gõ từ chính xác (Active Recall)</option>
              </select>
            </div>

            {/* Time Limit */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-brand-ink">Thời gian làm bài</label>
              <select
                value={timeLimitMinutes}
                onChange={(e) => setTimeLimitMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs bg-surface-subtle border border-slate-200 rounded-control focus:outline-none focus:border-brand-primary font-medium"
              >
                <option value={3}>3 phút (Phản xạ nhanh)</option>
                <option value={5}>5 phút (Tiêu chuẩn)</option>
                <option value={10}>10 phút (Thư thả)</option>
                <option value={15}>15 phút (Bài dài)</option>
              </select>
            </div>
          </div>

          {/* Word Availability Summary */}
          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-control flex items-center justify-between text-xs">
            <span className="text-text-secondary">
              Số từ vựng khả dụng theo bộ lọc hiện tại:
            </span>
            <span className="font-bold text-brand-primary font-mono text-sm">
              {eligibleVocab.length} từ
            </span>
          </div>

          {testError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-control flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{testError}</span>
            </div>
          )}

          {/* Action Button */}
          <button
            onClick={() => void handleStartTest()}
            disabled={eligibleVocab.length === 0}
            className="w-full py-2.5 bg-brand-primary hover:bg-brand-primaryHover disabled:opacity-50 text-white rounded-control text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4" />
            <span>Bắt đầu bài kiểm tra ngay ({timeLimitMinutes} phút)</span>
          </button>
        </div>

        {/* Previous Test Attempts History */}
        {testAttempts && testAttempts.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-brand-primary" />
              <h3 className="text-sm font-bold text-brand-ink">Lịch sử bài kiểm tra gần đây</h3>
            </div>

            <div className="bg-surface-base border border-slate-200/90 rounded-card shadow-card overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-text-secondary font-semibold">
                  <tr>
                    <th className="py-2.5 px-4">Thời gian</th>
                    <th className="py-2.5 px-4">Số câu</th>
                    <th className="py-2.5 px-4">Điểm số</th>
                    <th className="py-2.5 px-4">Độ chính xác</th>
                    <th className="py-2.5 px-4">Thời lượng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {testAttempts.slice(0, 5).map((att) => {
                    const percent = Math.round((att.score / att.maxScore) * 100);
                    return (
                      <tr key={att.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2.5 px-4 font-mono text-slate-600">
                          {new Date(att.submittedAt || att.startedAt).toLocaleDateString('vi-VN')}
                        </td>
                        <td className="py-2.5 px-4 text-slate-700">{att.maxScore} câu</td>
                        <td className="py-2.5 px-4 font-bold text-brand-ink">
                          {att.score}/{att.maxScore}
                        </td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                              percent >= 80
                                ? 'bg-emerald-50 text-emerald-700'
                                : percent >= 60
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {percent}%
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-500">
                          {Math.floor(att.durationSeconds / 60)}m {att.durationSeconds % 60}s
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  // RUNNING TEST VIEW
  if (testState === 'running') {
    const q = questions[currentIndex];
    const mins = Math.floor(secondsRemaining / 60);
    const secs = secondsRemaining % 60;
    const currentAnswer = answers[q.id] || '';
    const isUrgent = secondsRemaining <= 30;
    const isWarning = secondsRemaining <= 120 && !isUrgent;

    return (
      <div className="max-w-2xl mx-auto space-y-4 animate-in fade-in duration-150">
        {/* Top Header: Progress & Timer */}
        <div className="flex items-center justify-between text-xs">
          <div className="font-semibold text-brand-ink">
            Câu <span className="text-brand-primary font-bold">{currentIndex + 1}</span> / {questions.length}
          </div>

          {/* Dynamic Warning Timer */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-control font-mono text-xs font-bold transition-all ${
              isUrgent
                ? 'bg-rose-50 text-rose-700 border border-rose-300 animate-pulse'
                : isWarning
                ? 'bg-amber-50 text-amber-700 border border-amber-300'
                : 'bg-slate-100 text-brand-ink'
            }`}
          >
            <Clock
              className={`w-3.5 h-3.5 ${
                isUrgent ? 'text-rose-600' : isWarning ? 'text-amber-600' : 'text-brand-primary'
              }`}
            />
            <span>
              {mins}:{secs < 10 ? `0${secs}` : secs}
            </span>
            {isUrgent && <span className="text-[10px] font-semibold text-rose-600 ml-1">Sắp hết giờ!</span>}
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-primary transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </div>

        {/* Question Jump Palette (Navigation Palette) */}
        <div className="bg-surface-base border border-slate-200/90 rounded-control p-2.5 flex items-center justify-between gap-2 overflow-x-auto shadow-xs">
          <div className="flex items-center gap-1.5 flex-nowrap min-w-max">
            {questions.map((ques, idx) => {
              const isCurrent = idx === currentIndex;
              const isAnswered = Boolean(answers[ques.id]?.trim());
              return (
                <button
                  key={ques.id}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`w-7 h-7 rounded-md text-xs font-bold transition-all flex items-center justify-center shrink-0 ${
                    isCurrent
                      ? 'bg-brand-primary text-white ring-2 ring-brand-primary/30 shadow-xs'
                      : isAnswered
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                  }`}
                  title={`Câu ${idx + 1} (${isAnswered ? 'Đã trả lời' : 'Chưa trả lời'})`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
          <div className="text-[11px] font-semibold text-text-secondary whitespace-nowrap hidden sm:flex items-center gap-2 border-l border-slate-200 pl-3 shrink-0">
            <span className="text-emerald-700 font-bold">
              {Object.values(answers).filter(Boolean).length}/{questions.length} đã làm
            </span>
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-surface-base border border-slate-200/90 rounded-card shadow-card p-5 md:p-7 space-y-5">
          <div className="flex items-center justify-between text-xs text-text-secondary border-b pb-3">
            <span className="px-2 py-0.5 rounded bg-brand-primarySoft text-brand-primary font-bold text-[10px]">
              {q.cefr || 'B1'}
            </span>
            <span className="uppercase text-[10px] font-bold text-brand-primary tracking-wider">
              {q.mode === 'mcq' ? 'Trắc nghiệm (Phím 1-4 hoặc A-D)' : q.mode === 'typed' ? 'Gõ từ tiếng Anh' : 'Luyện nghe phản xạ'}
            </span>
          </div>

          {/* Question Cue */}
          <div className="py-3 text-center space-y-2">
            {q.mode === 'listening' ? (
              <div className="space-y-3">
                <div className="inline-block p-2 rounded-full bg-brand-primarySoft animate-glow-pulse">
                  <AudioButton text={q.audioPrompt || ''} dialect={settings.englishDialect} size="lg" />
                </div>
                <p className="text-xs text-text-secondary">
                  Nhấn loa để nghe phát âm và chọn đáp án đúng bên dưới
                </p>
              </div>
            ) : (
              <div>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-brand-ink">
                  {q.prompt}
                </h3>
                {q.subPrompt && (
                  <p className="text-xs text-text-secondary mt-1 italic">
                    {q.subPrompt}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Answer Controls */}
          {q.options ? (
            <div className="grid grid-cols-1 gap-2.5">
              {q.options.map((opt, i) => {
                const isSelected = currentAnswer === opt;
                return (
                  <button
                    key={i}
                    onClick={() => handleSelectAnswer(q.id, opt)}
                    className={`p-3 rounded-control border text-left text-xs font-medium transition-all flex items-center justify-between ${
                      isSelected
                        ? 'border-brand-primary bg-brand-primarySoft/50 text-brand-primary font-semibold ring-1 ring-brand-primary/20'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-brand-ink'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-slate-100 text-slate-500 font-bold flex items-center justify-center text-[10px] shrink-0">
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span>{opt}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                      [{i + 1}]
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-text-secondary">
                Gõ từ tiếng Anh tương ứng:
              </label>
              <input
                type="text"
                autoFocus
                placeholder="Nhập từ chính xác (Enter để chuyển câu)..."
                value={currentAnswer}
                onChange={(e) => handleSelectAnswer(q.id, e.target.value)}
                className="w-full px-4 py-2.5 text-sm border-2 border-slate-200 rounded-control focus:outline-none focus:border-brand-primary font-medium"
              />
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="px-3.5 py-1.5 text-xs font-semibold text-text-secondary hover:bg-slate-100 rounded-control disabled:opacity-30 flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Câu trước</span>
            </button>

            <div className="flex items-center gap-2">
              {currentIndex < questions.length - 1 ? (
                <button
                  onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                  className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-brand-ink rounded-control text-xs font-semibold transition-colors flex items-center gap-1"
                >
                  <span>Câu tiếp</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  onClick={() => void handleSubmitTest()}
                  className="px-4 py-1.5 bg-brand-primary hover:bg-brand-primaryHover text-white rounded-control text-xs font-bold transition-all shadow-xs flex items-center gap-1"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>Nộp bài thi</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // COMPLETED VIEW
  if (testState === 'completed' && completedAttempt) {
    const percent = Math.round((completedAttempt.score / completedAttempt.maxScore) * 100);
    const correctCount = completedAttempt.questions.filter((q) => q.isCorrect).length;
    const incorrectCount = completedAttempt.questions.length - correctCount;

    const filteredQuestions = completedAttempt.questions.filter((q) => {
      if (reviewFilter === 'correct') return q.isCorrect;
      if (reviewFilter === 'incorrect') return !q.isCorrect;
      return true;
    });

    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Score Banner Card */}
        <div className="bg-surface-base border border-slate-200/90 rounded-card shadow-card p-6 md:p-8 text-center space-y-5">
          <div className="w-16 h-16 mx-auto rounded-full bg-brand-primarySoft text-brand-primary flex items-center justify-center">
            <Award className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-brand-ink">Kết quả bài kiểm tra</h2>
            <p className="text-xs text-text-secondary">
              Hoàn thành trong {Math.floor(completedAttempt.durationSeconds / 60)} phút{' '}
              {completedAttempt.durationSeconds % 60} giây
            </p>
          </div>

          {/* Big Score Display */}
          <div className="py-2 flex items-center justify-center gap-2">
            <span className="text-4xl font-extrabold text-brand-ink">
              {completedAttempt.score}
            </span>
            <span className="text-xl text-slate-400 font-medium">
              /{completedAttempt.maxScore}
            </span>
            <span
              className={`ml-2 px-3 py-1 rounded-full text-sm font-bold ${
                percent >= 80
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : percent >= 60
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              {percent}%
            </span>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-control text-center">
              <span className="text-xs text-emerald-700 font-medium">Số câu đúng</span>
              <p className="text-lg font-extrabold text-emerald-800">{correctCount}</p>
            </div>
            <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-control text-center">
              <span className="text-xs text-rose-700 font-medium">Cần cải thiện</span>
              <p className="text-lg font-extrabold text-rose-800">{incorrectCount}</p>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
            <button
              onClick={() => void handleRetakeTest()}
              className="px-4 py-2 bg-brand-primary hover:bg-brand-primaryHover text-white rounded-control text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Làm lại bài này</span>
            </button>

            <button
              onClick={() => setTestState('builder')}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-brand-ink rounded-control text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Tạo bài thi mới</span>
            </button>
          </div>
        </div>

        {/* FSRS Synchronization Box */}
        <div className="bg-surface-base border border-slate-200/90 rounded-card shadow-card p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-brand-primary shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-brand-ink">
                  Đồng bộ kết quả vào lịch ôn tập FSRS
                </h4>
                <p className="text-[11px] text-text-secondary mt-0.5">
                  Bạn có thể chọn mức ghi nhớ cho từng từ bên dưới, hoặc nhấn tự động gán để cập nhật ngay vào FSRS.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAutoAssignSRS}
              disabled={appliedToSRS}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-brand-ink rounded-control text-[11px] font-semibold transition-colors shrink-0 flex items-center gap-1"
            >
              <Zap className="w-3 h-3 text-amber-500 fill-amber-400" />
              <span>Tự động gán (Đúng = Good, Sai = Again)</span>
            </button>
          </div>

          <button
            onClick={() => void applyTestToSRS()}
            disabled={appliedToSRS}
            className="w-full py-2 bg-brand-primary text-white rounded-control text-xs font-bold hover:bg-brand-primaryHover disabled:bg-emerald-600 transition-colors flex items-center justify-center gap-1.5 shadow-xs"
          >
            {appliedToSRS ? (
              <>
                <Check className="w-4 h-4" />
                <span>Đã lưu vào lịch ôn tập FSRS thành công</span>
              </>
            ) : (
              <span>Lưu các đánh giá trên vào FSRS</span>
            )}
          </button>
        </div>

        {/* Question Review Section with Filter Tabs */}
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-bold text-brand-ink">
              Xem lại chi tiết từng câu hỏi ({completedAttempt.questions.length})
            </h3>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-control text-xs">
              <button
                type="button"
                onClick={() => setReviewFilter('all')}
                className={`px-3 py-1 rounded font-medium transition-all ${
                  reviewFilter === 'all'
                    ? 'bg-white text-brand-ink shadow-xs font-bold'
                    : 'text-text-secondary hover:text-brand-ink'
                }`}
              >
                Tất cả ({completedAttempt.questions.length})
              </button>
              <button
                type="button"
                onClick={() => setReviewFilter('correct')}
                className={`px-3 py-1 rounded font-medium transition-all ${
                  reviewFilter === 'correct'
                    ? 'bg-white text-emerald-700 shadow-xs font-bold'
                    : 'text-text-secondary hover:text-brand-ink'
                }`}
              >
                Đúng ({correctCount})
              </button>
              <button
                type="button"
                onClick={() => setReviewFilter('incorrect')}
                className={`px-3 py-1 rounded font-medium transition-all ${
                  reviewFilter === 'incorrect'
                    ? 'bg-white text-rose-700 shadow-xs font-bold'
                    : 'text-text-secondary hover:text-brand-ink'
                }`}
              >
                Sai ({incorrectCount})
              </button>
            </div>
          </div>

          {/* Question Review Cards */}
          <div className="space-y-3">
            {filteredQuestions.map((q, idx) => {
              const currentRating = selfRatings[q.id];

              return (
                <div
                  key={q.id}
                  className={`p-4 rounded-card border text-xs bg-surface-base shadow-xs space-y-3 ${
                    q.isCorrect ? 'border-emerald-200/90' : 'border-rose-200/90'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {q.isCorrect ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      )}
                      <span className="font-bold text-brand-ink text-sm">
                        {q.prompt}
                      </span>
                      {q.prompt && (
                        <AudioButton text={q.prompt} dialect="en-us" size="sm" />
                      )}
                    </div>
                    <span className="px-2 py-0.5 rounded bg-brand-primarySoft text-brand-primary text-[10px] font-bold">
                      {q.cefr || 'B1'}
                    </span>
                  </div>

                  {/* Answer Comparison */}
                  <div className="pl-6 space-y-1.5">
                    <p className="text-text-secondary">
                      Bạn đã trả lời:{' '}
                      <strong className={q.isCorrect ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                        {q.userAnswer || '(Bỏ trống)'}
                      </strong>
                    </p>
                    {!q.isCorrect && (
                      <p className="text-text-secondary">
                        Đáp án đúng:{' '}
                        <strong className="text-emerald-700 font-bold">{q.correctAnswer}</strong>
                      </p>
                    )}
                    {q.explanation && (
                      <p className="text-[11px] text-slate-500 italic mt-1 bg-slate-50 p-2 rounded-control border border-slate-100">
                        {q.explanation}
                      </p>
                    )}
                  </div>

                  {/* FSRS Rating Pills for this Question */}
                  <div className="pl-6 pt-2 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                    <span className="text-[11px] font-semibold text-text-secondary">
                      Tự đánh giá trí nhớ:
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[
                        { val: 1, label: 'Again', desc: 'Quên' },
                        { val: 2, label: 'Hard', desc: 'Khó' },
                        { val: 3, label: 'Good', desc: 'Nhớ' },
                        { val: 4, label: 'Easy', desc: 'Dễ' },
                      ].map((item) => {
                        const isSelected = currentRating === item.val;
                        return (
                          <button
                            key={item.val}
                            type="button"
                            disabled={appliedToSRS}
                            onClick={() =>
                              setSelfRatings((prev) => ({
                                ...prev,
                                [q.id]: isSelected ? 0 : item.val,
                              }))
                            }
                            className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all ${
                              isSelected
                                ? 'bg-brand-primary text-white shadow-xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {item.label} · {item.desc}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
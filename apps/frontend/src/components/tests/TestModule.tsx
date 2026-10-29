'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  Sparkles,
  Volume2,
  Check,
  X,
  History,
} from 'lucide-react';
import { useVocelune } from '@/context/VoceluneContext';
import { useNotification } from '@/context/NotificationContext';
import { VocabItem, TestAttempt, TestQuestion, CEFRLevel, PartOfSpeech } from '@/types';
import { api, post } from '@/lib/api';
import { speakWord } from '@/lib/speech';
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
    answerSequences.current = new Map(attempt.questions.map(q => [q.id, q.answerVersion || 0]));
    setQuestions(attempt.questions); setAnswers(Object.fromEntries(attempt.questions.map(q => [q.id, q.userAnswer || ''])));
    setCurrentIndex(0); setSecondsRemaining(Math.max(0, Math.ceil((new Date(attempt.deadlineAt!).getTime() - Date.now()) / 1000)));
    setTestState('running'); setAppliedToSRS(false); setSelfRatings({});
  };
  useEffect(() => {
    if (!user) return;
    const marker = sessionStorage.getItem(`vocelune_active_test_${user.id}`);
    if (marker) void api<TestAttempt>(`/test-attempts/${marker}/report`).then(attempt => {
      if (attempt.status === 'in_progress') loadAttempt(attempt);
      else { setCompletedAttempt(attempt); setTestState('completed'); sessionStorage.removeItem(`vocelune_active_test_${user.id}`); }
    }).catch(() => sessionStorage.removeItem(`vocelune_active_test_${user.id}`));
    return () => { autosaveTimers.current.forEach(clearTimeout); };
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
      <div className="space-y-8 max-w-4xl mx-auto">
        {/* Header */}
        <div>
          <h2 className="text-xl font-bold text-brand-ink">Tạo bài kiểm tra</h2>
          <p className="text-xs text-text-secondary mt-1">
            Đánh giá năng lực từ vựng độc lập. Kết quả kiểm tra không làm thay đổi lịch SRS trừ khi bạn chọn cập nhật.
          </p>
        </div>

        {/* Builder Card */}
        <div className="bg-surface-base border border-slate-200/90 rounded-card shadow-card p-6 md:p-8 space-y-6">
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
                <option value={5}>5 câu (nhanh)</option>
                <option value={10}>10 câu (tiêu chuẩn)</option>
                <option value={20}>20 câu (chuyên sâu)</option>
                <option value={30}>30 câu (toàn diện)</option>
              </select>
            </div>

            {/* Test Mode */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-brand-ink">Hình thức thi</label>
              <select
                value={testMode}
                onChange={(e) => setTestMode(e.target.value as any)}
                className="w-full px-3 py-2 text-xs bg-surface-subtle border border-slate-200 rounded-control focus:outline-none focus:border-brand-primary"
              >
                <option value="mixed">Kết hợp (Trắc nghiệm + Gõ từ + Nghe)</option>
                <option value="mcq">Chỉ trắc nghiệm (MCQ 4 lựa chọn)</option>
                <option value="typed">Chỉ gõ từ (Active Recall chính tả)</option>
              </select>
            </div>

            {/* Timer Duration */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-brand-ink">Thời gian làm bài</label>
              <select
                value={timeLimitMinutes}
                onChange={(e) => setTimeLimitMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs bg-surface-subtle border border-slate-200 rounded-control focus:outline-none focus:border-brand-primary"
              >
                <option value={3}>3 phút</option>
                <option value={5}>5 phút</option>
                <option value={10}>10 phút</option>
                <option value={15}>15 phút</option>
              </select>
            </div>

            {/* Eligible Preview Badge */}
            <div className="space-y-1.5 flex flex-col justify-end">
              <div className="p-2.5 rounded-control bg-brand-primarySoft/60 border border-brand-primary/20 text-xs text-brand-primary flex items-center justify-between">
                <span>Khả dụng trong kho:</span>
                <strong className="font-bold">{eligibleVocab.length} từ</strong>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-text-secondary">
              Thời gian tính giờ server, tự động lưu bài làm khi chuyển câu.
            </span>
            <button
              onClick={handleStartTest}
              disabled={eligibleVocab.length === 0}
              className="px-6 py-2.5 bg-brand-primary hover:bg-brand-primaryHover text-white rounded-control font-semibold text-xs shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Bắt đầu bài kiểm tra</span>
            </button>
          </div>
        </div>

        {/* Attempt History Section */}
        {testAttempts.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-brand-ink flex items-center gap-2">
              <History className="w-4 h-4 text-text-secondary" />
              <span>Lịch sử các bài kiểm tra gần đây</span>
            </h3>

            <div className="bg-surface-base border border-slate-200/80 rounded-card overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-text-secondary font-medium border-b border-slate-100">
                  <tr>
                    <th className="py-2.5 px-4">Thời gian</th>
                    <th className="py-2.5 px-4">Số câu</th>
                    <th className="py-2.5 px-4">Điểm số</th>
                    <th className="py-2.5 px-4">Tỷ lệ đúng</th>
                    <th className="py-2.5 px-4">Thời lượng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {testAttempts.slice(0, 5).map((att) => {
                    const percent = Math.round((att.score / att.maxScore) * 100);
                    return (
                      <tr key={att.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-4 text-brand-ink font-medium">
                          {new Date(att.startedAt).toLocaleDateString('vi-VN', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-2.5 px-4 text-text-secondary">
                          {att.maxScore} câu
                        </td>
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

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Top Header: Progress & Timer */}
        <div className="flex items-center justify-between text-xs">
          <div className="font-semibold text-brand-ink">
            Câu {currentIndex + 1} / {questions.length}
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-control bg-slate-100 font-mono text-xs font-bold text-brand-ink">
            <Clock className="w-3.5 h-3.5 text-brand-primary" />
            <span>
              {mins}:{secs < 10 ? `0${secs}` : secs}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-primary transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </div>

        {/* Question Card */}
        <div className="bg-surface-base border border-slate-200/90 rounded-card shadow-card p-6 md:p-8 space-y-6">
          <div className="flex items-center justify-between text-xs text-text-secondary border-b pb-3">
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
              {q.cefr}
            </span>
            <span className="uppercase text-[11px] font-semibold text-brand-primary tracking-wider">
              {q.mode === 'mcq' ? 'Trắc nghiệm' : q.mode === 'typed' ? 'Gõ từ' : 'Luyện nghe'}
            </span>
          </div>

          {/* Question Cue */}
          <div className="py-4 text-center space-y-2">
            {q.mode === 'listening' ? (
              <div className="space-y-3">
                <div className="inline-block p-2 rounded-full bg-brand-primarySoft animate-glow-pulse">
                  <AudioButton
                    text={q.audioPrompt || ''}
                    dialect={settings.englishDialect}
                    size="lg"
                  />
                </div>
                <p className="text-xs text-text-secondary">
                  Nhấn loa để nghe phát âm và chọn đáp án đúng bên dưới
                </p>
              </div>
            ) : (
              <div>
                <h3 className="text-2xl sm:text-3xl font-bold text-brand-ink">
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
                    className={`p-3.5 rounded-control border text-left text-xs font-medium transition-all ${
                      isSelected
                        ? 'border-brand-primary bg-brand-primarySoft/50 text-brand-primary font-semibold ring-1 ring-brand-primary/20'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-brand-ink'
                    }`}
                  >
                    <span className="font-bold text-slate-400 mr-2">
                      {String.fromCharCode(65 + i)}.
                    </span>
                    {opt}
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
                placeholder="Nhập từ chính xác..."
                value={currentAnswer}
                onChange={(e) => handleSelectAnswer(q.id, e.target.value)}
                className="w-full px-4 py-2.5 text-sm border-2 border-slate-200 rounded-control focus:outline-none focus:border-brand-primary font-medium"
              />
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="px-3.5 py-2 text-xs font-semibold text-text-secondary hover:bg-slate-100 rounded-control disabled:opacity-30"
            >
              Câu trước
            </button>

            {currentIndex < questions.length - 1 ? (
              <button
                onClick={() => setCurrentIndex((prev) => prev + 1)}
                className="px-4 py-2 bg-slate-900 text-white rounded-control text-xs font-semibold hover:bg-slate-800 transition-colors"
              >
                Câu tiếp theo
              </button>
            ) : (
              <button
                onClick={handleSubmitTest}
                className="px-5 py-2 bg-brand-primary text-white rounded-control text-xs font-semibold hover:bg-brand-primaryHover shadow-sm transition-all"
              >
                Nộp bài & Chấm điểm
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // COMPLETED RESULT VIEW
  if (testState === 'completed' && completedAttempt) {
    const percent = Math.round(
      (completedAttempt.score / completedAttempt.maxScore) * 100
    );

    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Score Banner Card */}
        <div className="bg-surface-base border border-slate-200/90 rounded-card shadow-card p-6 md:p-8 text-center space-y-4">
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

          <div className="py-2">
            <span className="text-4xl font-extrabold text-brand-ink">
              {completedAttempt.score}
            </span>
            <span className="text-lg text-slate-400 font-medium">
              /{completedAttempt.maxScore}
            </span>
            <span className="ml-3 px-3 py-1 rounded-full text-sm font-bold bg-brand-primarySoft text-brand-primary">
              {percent}%
            </span>
          </div>

          {/* Opt-in SRS Update (BR-03 / 8.3) */}
          <div className="p-4 rounded-control bg-slate-50 border border-slate-200/80 text-left space-y-3">
            <div className="flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-brand-primary shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-semibold text-brand-ink">
                  Đồng bộ vào lịch ôn tập FSRS?
                </p>
                <p className="text-text-secondary text-[11px] mt-0.5">
                  Mặc định bài test không làm sai lệch lịch ôn. Bạn có thể chủ động cập nhật kết quả các câu này vào hệ thống FSRS.
                </p>
              </div>
            </div>

            <p className="text-xs text-text-secondary">Tự đánh giá sau khi xem đáp án. Chỉ các câu có thẻ đúng chiều truy hồi mới được ghi vào lịch ôn.</p>
            {completedAttempt.questions.filter(q => cards.some(c => c.vocabItemId === q.vocabId && c.template === (q.direction || 'en_vi'))).map((q, i) => <label key={q.id} className="flex justify-between gap-3 text-xs">Câu {i + 1}: {q.prompt}<select disabled={appliedToSRS} value={selfRatings[q.id] || ''} onChange={e => setSelfRatings(r => ({ ...r, [q.id]: Number(e.target.value) }))} className="border rounded p-1"><option value="">Bỏ qua</option><option value="1">Again — Không nhớ</option><option value="2">Hard — Nhớ khó khăn</option><option value="3">Good — Nhớ được</option><option value="4">Easy — Rất dễ</option></select></label>)}
            <button
              onClick={() => void applyTestToSRS()}
              disabled={appliedToSRS}
              className="w-full py-2 bg-brand-primary text-white rounded-control text-xs font-semibold hover:bg-brand-primaryHover disabled:bg-emerald-600 transition-colors flex items-center justify-center gap-1.5"
            >
              {appliedToSRS ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Đã ghi vào lịch ôn FSRS thành công</span>
                </>
              ) : (
                <span>Ghi kết quả vào lịch ôn FSRS</span>
              )}
            </button>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => setTestState('builder')}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-brand-ink rounded-control text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Làm bài kiểm tra mới</span>
            </button>
          </div>
        </div>

        {/* Detailed Question Review */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-brand-ink">
            Xem lại chi tiết từng câu hỏi ({completedAttempt.questions.length})
          </h3>

          <div className="space-y-2.5">
            {completedAttempt.questions.map((q, idx) => (
              <div
                key={q.id}
                className={`p-4 rounded-control border text-xs bg-surface-base shadow-xs space-y-2 ${
                  q.isCorrect ? 'border-emerald-200' : 'border-rose-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {q.isCorrect ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-600" />
                    )}
                    <span className="font-bold text-brand-ink">
                      Câu {idx + 1}: {q.prompt}
                    </span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-bold">
                    {q.cefr}
                  </span>
                </div>

                <div className="pl-6 space-y-1">
                  <p className="text-text-secondary">
                    Bạn trả lời:{' '}
                    <strong className={q.isCorrect ? 'text-emerald-700' : 'text-rose-700'}>
                      {q.userAnswer || '(Bỏ trống)'}
                    </strong>
                  </p>
                  {!q.isCorrect && (
                    <p className="text-text-secondary">
                      Đáp án đúng:{' '}
                      <strong className="text-emerald-700">{q.correctAnswer}</strong>
                    </p>
                  )}
                  <p className="text-[11px] text-slate-500 italic mt-1">
                    {q.explanation}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

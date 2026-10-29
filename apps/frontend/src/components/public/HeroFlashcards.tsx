'use client';

import React, { useState } from 'react';
import {
  Volume2,
  RotateCw,
  Sparkles,
  CheckCircle2,
  Clock,
  TrendingUp,
  Brain,
  HelpCircle,
  Eye,
  Check,
} from 'lucide-react';
import { AudioButton } from '@/components/common/AudioButton';

export interface DemoCard {
  id: string;
  word: string;
  phonetic: string;
  partOfSpeech: string;
  cefr: 'B1' | 'B2' | 'C1' | 'C2';
  meaningVi: string;
  definitionEn: string;
  exampleEn: string;
  exampleVi: string;
  tags: string[];
}

export const DEMO_CARDS: DemoCard[] = [
  {
    id: 'resilient',
    word: 'resilient',
    phonetic: '/rɪˈzɪl.jənt/',
    partOfSpeech: 'adjective',
    cefr: 'C1',
    meaningVi: 'Kiên cường, có khả năng phục hồi nhanh sau khó khăn',
    definitionEn: 'Able to be happy, successful, etc. again after something difficult happens.',
    exampleEn: 'Local businesses have proven remarkably resilient in the face of economic hardship.',
    exampleVi: 'Các doanh nghiệp địa phương đã chứng minh sự kiên cường đáng nể khi đối mặt với khủng hoảng.',
    tags: ['IELTS 7.5+', 'Kinh tế & Xã hội'],
  },
  {
    id: 'ephemeral',
    word: 'ephemeral',
    phonetic: '/ɪˈfem.ər.əl/',
    partOfSpeech: 'adjective',
    cefr: 'C2',
    meaningVi: 'Phù du, chóng tàn, chỉ tồn tại trong thời gian rất ngắn',
    definitionEn: 'Lasting for only a short time; transitory and fleeting.',
    exampleEn: 'Social media trends can be strikingly ephemeral, fading in mere days.',
    exampleVi: 'Các xu hướng trên mạng xã hội có thể chóng tàn một cách đáng kinh ngạc, biến mất chỉ sau vài ngày.',
    tags: ['IELTS 8.0+', 'Học thuật'],
  },
  {
    id: 'pragmatic',
    word: 'pragmatic',
    phonetic: '/præɡˈmæt.ɪk/',
    partOfSpeech: 'adjective',
    cefr: 'C1',
    meaningVi: 'Thực tế, thực dụng, giải quyết dựa trên điều kiện thực tiễn',
    definitionEn: 'Solving problems in a sensible way that suits the conditions that really exist.',
    exampleEn: 'We need a pragmatic approach rather than endless ideological debates.',
    exampleVi: 'Chúng ta cần một hướng tiếp cận thực tế hơn là những cuộc tranh luận lý thuyết vô tận.',
    tags: ['Business & Work', 'Lãnh đạo'],
  },
  {
    id: 'meticulous',
    word: 'meticulous',
    phonetic: '/məˈtɪk.jə.ləs/',
    partOfSpeech: 'adjective',
    cefr: 'C1',
    meaningVi: 'Tỉ mỉ, cẩn trọng, chú ý đến từng chi tiết nhỏ nhất',
    definitionEn: 'Very careful and with great attention to every detail.',
    exampleEn: 'The scientist kept meticulous notes throughout the clinical trials.',
    exampleVi: 'Nhà khoa học đã ghi chép cực kỳ tỉ mỉ trong suốt quá trình thử nghiệm lâm sàng.',
    tags: ['Research & Science', 'Học thuật'],
  },
];

export function HeroFlashcards() {
  const [activeTab, setActiveTab] = useState(0);
  const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({});
  const [gradeFeedback, setGradeFeedback] = useState<Record<string, { label: string; interval: string; stability: string }>>({});

  const toggleFlip = (id: string) => {
    setFlippedCards((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleGrade = (id: string, label: string, interval: string, stability: string) => {
    setGradeFeedback((prev) => ({
      ...prev,
      [id]: { label, interval, stability },
    }));
  };

  const currentCard = DEMO_CARDS[activeTab];
  const isFlipped = !!flippedCards[currentCard.id];
  const feedback = gradeFeedback[currentCard.id];

  const cefrColors = {
    B1: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    B2: 'bg-blue-100 text-blue-800 border-blue-200',
    C1: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    C2: 'bg-purple-100 text-purple-800 border-purple-200',
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-4">
      {/* 4 Cards Header Selector Tabs */}
      <div className="bg-surface-base/90 backdrop-blur-xs p-1.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-1 overflow-x-auto">
        <div className="flex items-center gap-1">
          {DEMO_CARDS.map((card, idx) => {
            const isSelected = activeTab === idx;
            const isCardFlipped = !!flippedCards[card.id];
            const isGraded = !!gradeFeedback[card.id];

            return (
              <button
                key={card.id}
                type="button"
                onClick={() => setActiveTab(idx)}
                className={`relative px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
                  isSelected
                    ? 'bg-brand-primary text-white shadow-sm'
                    : 'text-text-secondary hover:text-brand-ink hover:bg-slate-100/70'
                }`}
              >
                <span>{card.word}</span>
                <span
                  className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {card.cefr}
                </span>
                {isGraded && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 absolute top-1 right-1" />
                )}
              </button>
            );
          })}
        </div>

        <div className="hidden sm:flex items-center gap-1 text-[11px] text-text-secondary pr-2">
          <Sparkles className="w-3 h-3 text-brand-primary" />
          <span>Thẻ {activeTab + 1}/4</span>
        </div>
      </div>

      {/* 3D Flip Card Container */}
      <div className="perspective-1000 min-h-[360px]">
        <div
          className={`relative w-full rounded-2xl transition-transform duration-500 transform-style-3d ${
            isFlipped ? 'rotate-y-180' : ''
          }`}
          style={{ minHeight: '360px' }}
        >
          {/* FRONT FACE (Active Recall Gate) */}
          <div className="w-full h-full bg-surface-base border border-slate-200/90 rounded-2xl shadow-elevated p-6 sm:p-7 flex flex-col justify-between backface-hidden">
            {/* Top metadata */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                    cefrColors[currentCard.cefr]
                  }`}
                >
                  CEFR {currentCard.cefr}
                </span>
                <span className="text-text-secondary italic text-xs font-medium">
                  ({currentCard.partOfSpeech})
                </span>
              </div>

              <div className="flex items-center gap-2">
                <AudioButton
                  text={currentCard.word}
                  dialect="en-us"
                  size="sm"
                  showLabel
                />
              </div>
            </div>

            {/* Word Center */}
            <div className="py-8 text-center space-y-2">
              <div className="inline-block px-3 py-1 rounded-full bg-brand-primarySoft/40 text-[11px] font-medium text-brand-primary mb-1">
                Active Recall Gate • Thử tự nhớ nghĩa
              </div>
              <h3 className="text-3xl sm:text-4xl font-extrabold text-brand-ink font-mono tracking-tight">
                {currentCard.word}
              </h3>
              <p className="text-sm font-mono text-slate-400 font-medium">
                {currentCard.phonetic}
              </p>
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-[11px] text-text-secondary flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                <span>Không trắc nghiệm thụ động • Tự gợi nhớ trước</span>
              </span>

              <button
                type="button"
                onClick={() => toggleFlip(currentCard.id)}
                className="w-full sm:w-auto px-5 py-2.5 bg-brand-primary hover:bg-brand-primaryHover text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 group active:scale-95"
              >
                <RotateCw className="w-3.5 h-3.5 transition-transform group-hover:rotate-180 duration-300" />
                <span>Lật thẻ xem nghĩa & ví dụ</span>
              </button>
            </div>
          </div>

          {/* BACK FACE (Meaning, Context & FSRS-6 Grading) */}
          <div className="absolute inset-0 w-full h-full bg-surface-base border border-slate-200/90 rounded-2xl shadow-elevated p-6 sm:p-7 flex flex-col justify-between rotate-y-180 backface-hidden overflow-y-auto">
            {/* Top metadata */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-base text-brand-ink">
                  {currentCard.word}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {currentCard.phonetic}
                </span>
              </div>

              <button
                type="button"
                onClick={() => toggleFlip(currentCard.id)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-primary hover:text-brand-primaryHover transition-colors px-2 py-1 rounded-lg hover:bg-brand-primarySoft/60"
              >
                <RotateCw className="w-3 h-3" />
                <span>Lật lại</span>
              </button>
            </div>

            {/* Meaning & Context Sentence */}
            <div className="space-y-3 py-2 text-left">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-primary">
                  Nghĩa tiếng Việt
                </span>
                <p className="text-base sm:text-lg font-bold text-brand-ink leading-snug">
                  {currentCard.meaningVi}
                </p>
                <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                  {currentCard.definitionEn}
                </p>
              </div>

              {/* Rich Context Example Box */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Ngữ cảnh thực tế (Example in context)
                </span>
                <p className="text-brand-ink font-medium leading-relaxed italic">
                  &ldquo;{currentCard.exampleEn}&rdquo;
                </p>
                <p className="text-text-secondary text-[11px] leading-relaxed">
                  {currentCard.exampleVi}
                </p>
              </div>
            </div>

            {/* FSRS Rating Buttons & Feedback */}
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                <span>Đánh giá độ nhớ FSRS-6:</span>
                <span className="text-[9px] text-brand-primary font-semibold lowercase">
                  khoảng cách ôn thích ứng
                </span>
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleGrade(currentCard.id, 'Again', '1 phút', '+0.1')}
                  className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100/80 border border-rose-200 text-rose-700 text-center transition-all hover:-translate-y-0.5"
                >
                  <div className="text-[11px] font-bold">Again</div>
                  <div className="text-[9px] text-rose-500">1 phút</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleGrade(currentCard.id, 'Hard', '12 giờ', '+0.6')}
                  className="p-2 rounded-xl bg-amber-50 hover:bg-amber-100/80 border border-amber-200 text-amber-700 text-center transition-all hover:-translate-y-0.5"
                >
                  <div className="text-[11px] font-bold">Hard</div>
                  <div className="text-[9px] text-amber-500">12 giờ</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleGrade(currentCard.id, 'Good', '2 ngày', '+1.8')}
                  className="p-2 rounded-xl bg-blue-50 hover:bg-blue-100/80 border border-blue-200 text-blue-700 text-center transition-all hover:-translate-y-0.5"
                >
                  <div className="text-[11px] font-bold">Good</div>
                  <div className="text-[9px] text-blue-500">2 ngày</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleGrade(currentCard.id, 'Easy', '5 ngày', '+3.2')}
                  className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 text-emerald-700 text-center transition-all hover:-translate-y-0.5"
                >
                  <div className="text-[11px] font-bold">Easy</div>
                  <div className="text-[9px] text-emerald-600">5 ngày</div>
                </button>
              </div>

              {feedback && (
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-800 text-[11px] flex items-center gap-1.5 border border-emerald-200 animate-in fade-in duration-150">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>
                    Đã ghi nhận <strong>[{feedback.label}]</strong>: Ôn lại sau{' '}
                    <strong>{feedback.interval}</strong> (Độ bền trí nhớ S {feedback.stability}).
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick context cards preview pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
        {DEMO_CARDS.map((card, idx) => {
          const isSelected = activeTab === idx;
          const isFlipped = !!flippedCards[card.id];

          return (
            <div
              key={card.id}
              onClick={() => setActiveTab(idx)}
              className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                isSelected
                  ? 'bg-surface-base border-brand-primary shadow-xs ring-2 ring-brand-primary/20'
                  : 'bg-white/60 border-slate-200/70 hover:bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-xs text-brand-ink truncate">
                  {card.word}
                </span>
                <span className="text-[9px] font-bold text-text-secondary">
                  {card.cefr}
                </span>
              </div>
              <p className="text-[10px] text-text-secondary truncate mt-0.5">
                {card.meaningVi}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

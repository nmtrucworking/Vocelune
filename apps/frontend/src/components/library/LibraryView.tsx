'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Plus,
  Volume2,
  BookOpen,
  Sparkles,
  MoreVertical,
  Check,
  Trash2,
  Edit2,
  Clock,
} from 'lucide-react';
import { useVocelune } from '@/context/VoceluneContext';
import { VocabItem, PartOfSpeech, CEFRLevel } from '@/types';
import { speakWord } from '@/lib/speech';
import { WordDetailModal } from './WordDetailModal';
import { formatRelativeTime } from '@/lib/utils';
import { AudioButton } from '../common/AudioButton';

interface LibraryViewProps {
  onOpenQuickAdd: () => void;
}

export function LibraryView({ onOpenQuickAdd }: LibraryViewProps) {
  const { vocabItems, decks, cards, deleteVocabItem, settings } = useVocelune();

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeckId, setSelectedDeckId] = useState<string>('all');
  const [selectedCefr, setSelectedCefr] = useState<string>('all');
  const [selectedPos, setSelectedPos] = useState<string>('all');

  // Selected word for modal inspection
  const [selectedWord, setSelectedWord] = useState<VocabItem | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Filtered items
  const filteredVocab = useMemo(() => {
    return vocabItems.filter((item) => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesWord = item.word.toLowerCase().includes(q);
        const matchesMeaning = item.meaningVi.toLowerCase().includes(q);
        const matchesDef = item.definitionEn.toLowerCase().includes(q);
        const matchesTag = item.tags.some((t) => t.toLowerCase().includes(q));
        if (!matchesWord && !matchesMeaning && !matchesDef && !matchesTag) {
          return false;
        }
      }

      // Deck filter
      if (selectedDeckId !== 'all' && item.deckId !== selectedDeckId) {
        return false;
      }

      // CEFR filter
      if (selectedCefr !== 'all' && item.cefr !== selectedCefr) {
        return false;
      }

      // POS filter
      if (selectedPos !== 'all' && item.partOfSpeech !== selectedPos) {
        return false;
      }

      return true;
    });
  }, [vocabItems, searchQuery, selectedDeckId, selectedCefr, selectedPos]);

  // Map cards by vocabItemId
  const cardMap = useMemo(() => {
    return new Map(cards.map((c) => [c.vocabItemId, c]));
  }, [cards]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-brand-ink">Thư viện từ vựng</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Quản lý kho từ vựng cá nhân, phân loại theo CEFR và theo dõi chu kỳ thẻ SRS.
          </p>
        </div>

        <button
          onClick={onOpenQuickAdd}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-brand-primary hover:bg-brand-primaryHover text-white rounded-control font-semibold text-xs shadow-sm transition-all"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Thêm từ mới</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface-base border border-slate-200/80 rounded-card p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm theo từ, nghĩa tiếng Việt, tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-surface-subtle border border-slate-200 rounded-control focus:outline-none focus:border-brand-primary"
            />
          </div>

          {/* Deck Filter */}
          <select
            value={selectedDeckId}
            onChange={(e) => setSelectedDeckId(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-surface-subtle border border-slate-200 rounded-control focus:outline-none focus:border-brand-primary"
          >
            <option value="all">Tất cả bộ từ ({vocabItems.length})</option>
            {decks.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          {/* CEFR Level Filter */}
          <select
            value={selectedCefr}
            onChange={(e) => setSelectedCefr(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-surface-subtle border border-slate-200 rounded-control focus:outline-none focus:border-brand-primary font-medium"
          >
            <option value="all">Tất cả cấp độ CEFR</option>
            <option value="A1">A1 - Beginner</option>
            <option value="A2">A2 - Elementary</option>
            <option value="B1">B1 - Intermediate</option>
            <option value="B2">B2 - Upper Intermediate</option>
            <option value="C1">C1 - Advanced</option>
            <option value="C2">C2 - Mastery</option>
            <option value="unknown">Chưa xác định</option>
          </select>

          {/* Part of Speech Filter */}
          <select
            value={selectedPos}
            onChange={(e) => setSelectedPos(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-surface-subtle border border-slate-200 rounded-control focus:outline-none focus:border-brand-primary"
          >
            <option value="all">Tất cả từ loại (POS)</option>
            <option value="noun">Danh từ (noun)</option>
            <option value="verb">Động từ (verb)</option>
            <option value="adjective">Tính từ (adjective)</option>
            <option value="adverb">Trạng từ (adverb)</option>
            <option value="phrase">Cụm từ (phrase)</option>
          </select>
        </div>

        {/* Quick filter summary chips */}
        <div className="flex items-center justify-between text-xs text-text-secondary pt-1">
          <span>
            Hiển thị <strong>{filteredVocab.length}</strong> / {vocabItems.length} từ
          </span>

          {(searchQuery || selectedDeckId !== 'all' || selectedCefr !== 'all' || selectedPos !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedDeckId('all');
                setSelectedCefr('all');
                setSelectedPos('all');
              }}
              className="text-brand-primary hover:underline text-xs font-semibold"
            >
              Đặt lại bộ lọc
            </button>
          )}
        </div>
      </div>

      {/* Vocabulary Table */}
      <div className="bg-surface-base border border-slate-200/80 rounded-card overflow-hidden shadow-xs">
        {filteredVocab.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-text-secondary font-medium border-b border-slate-200/80">
                <tr>
                  <th className="py-3 px-4">Từ vựng & Phiên âm</th>
                  <th className="py-3 px-4">Từ loại</th>
                  <th className="py-3 px-4">Nghĩa tiếng Việt</th>
                  <th className="py-3 px-4">Cấp độ</th>
                  <th className="py-3 px-4">Trạng thái FSRS</th>
                  <th className="py-3 px-4">Hạn ôn</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredVocab.map((item) => {
                  const card = cardMap.get(item.id);
                  const isDue = card && new Date(card.dueAt).getTime() <= Date.now();

                  return (
                    <tr
                      key={item.id}
                      onClick={() => {
                        setSelectedWord(item);
                        setDetailModalOpen(true);
                      }}
                      className="hover:bg-brand-canvas/70 transition-colors cursor-pointer group"
                    >
                      {/* Word & Audio */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <AudioButton
                            text={item.word}
                            dialect={item.dialect || settings.englishDialect}
                            size="sm"
                          />
                          <div>
                            <span className="font-bold text-sm text-brand-ink">
                              {item.word}
                            </span>
                            <span className="ml-2 font-mono text-[11px] text-slate-400">
                              {item.phonetic}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* POS */}
                      <td className="py-3 px-4 italic text-text-secondary">
                        {item.partOfSpeech}
                      </td>

                      {/* Meaning */}
                      <td className="py-3 px-4 font-medium text-brand-ink max-w-xs truncate">
                        {item.meaningVi}
                      </td>

                      {/* CEFR */}
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-slate-100 text-slate-700">
                          {item.cefr}
                        </span>
                      </td>

                      {/* SRS State */}
                      <td className="py-3 px-4">
                        {card ? (
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
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Due Time */}
                      <td className="py-3 px-4 font-mono text-[11px]">
                        {card ? (
                          <span
                            className={
                              isDue
                                ? 'text-rose-600 font-bold'
                                : 'text-text-secondary'
                            }
                          >
                            {isDue ? 'Đến hạn ngay' : formatRelativeTime(card.dueAt)}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedWord(item);
                            setDetailModalOpen(true);
                          }}
                          className="px-2 py-1 text-[11px] font-semibold text-brand-primary hover:bg-brand-primarySoft rounded-md transition-colors"
                        >
                          Chi tiết
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center space-y-3">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
            <h4 className="text-sm font-semibold text-brand-ink">
              Không tìm thấy từ vựng phù hợp
            </h4>
            <p className="text-xs text-text-secondary max-w-sm mx-auto">
              Thử thay đổi từ khóa tìm kiếm hoặc điều chỉnh bộ lọc cấp độ/bộ từ.
            </p>
          </div>
        )}
      </div>

      {/* Word Detail Inspection Modal */}
      <WordDetailModal
        vocab={selectedWord}
        isOpen={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setSelectedWord(null);
        }}
      />
    </div>
  );
}

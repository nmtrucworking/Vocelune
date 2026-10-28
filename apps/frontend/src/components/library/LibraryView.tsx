'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Plus,
  Volume2,
  BookOpen,
  Sparkles,
  Globe,
  Layers,
  Check,
  Trash2,
  Edit2,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { useVocelune } from '@/context/VoceluneContext';
import { VocabItem, PartOfSpeech, CEFRLevel } from '@/types';
import { DeckManager } from './DeckManager';
import { TopicManager } from './TopicManager';
import { PublicDeckHub } from './PublicDeckHub';
import { WordDetailModal } from './WordDetailModal';
import { Pagination } from '../common/Pagination';
import { formatRelativeTime } from '@/lib/utils';
import { AudioButton } from '../common/AudioButton';

interface LibraryViewProps {
  onOpenQuickAdd: () => void;
}

export function LibraryView({ onOpenQuickAdd }: LibraryViewProps) {
  const { vocabItems, decks, cards, deleteVocabItem, settings } = useVocelune();

  // Tab switch: 'my-vocab' | 'manage-topics' | 'community-topics'
  const [activeTab, setActiveTab] = useState<'my-vocab' | 'manage-topics' | 'community-topics'>('my-vocab');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTopicGroup, setSelectedTopicGroup] = useState<string>('all');
  const [selectedDeckId, setSelectedDeckId] = useState<string>('all');
  const [selectedCefr, setSelectedCefr] = useState<string>('all');
  const [selectedPos, setSelectedPos] = useState<string>('all');

  // Pagination for vocabulary table
  const [vocabPage, setVocabPage] = useState(1);
  const [vocabPageSize, setVocabPageSize] = useState(20);

  // Deck creation prefill from topic manager
  const [createDeckWithTopic, setCreateDeckWithTopic] = useState<string | null>(null);

  // Selected word for modal inspection
  const [selectedWord, setSelectedWord] = useState<VocabItem | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Deck map for fast lookup
  const deckMap = useMemo(() => {
    return new Map(decks.map((d) => [d.id, d]));
  }, [decks]);

  // Available topic groups in user decks
  const availableTopicGroups = useMemo(() => {
    const set = new Set<string>();
    decks.forEach((d) => set.add(d.topicGroup || 'Chung'));
    return Array.from(set).sort();
  }, [decks]);

  // Filtered decks for the dropdown based on selectedTopicGroup
  const availableDecks = useMemo(() => {
    if (selectedTopicGroup === 'all') return decks;
    return decks.filter((d) => (d.topicGroup || 'Chung') === selectedTopicGroup);
  }, [decks, selectedTopicGroup]);

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

      // Topic Group filter
      if (selectedTopicGroup !== 'all') {
        const itemDeck = deckMap.get(item.deckId);
        if ((itemDeck?.topicGroup || 'Chung') !== selectedTopicGroup) {
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
  }, [vocabItems, searchQuery, selectedTopicGroup, selectedDeckId, selectedCefr, selectedPos, deckMap]);

  // Map cards by vocabItemId
  const cardMap = useMemo(() => {
    return new Map(cards.map((c) => [c.vocabItemId, c]));
  }, [cards]);

  // Paginated vocabulary items
  const totalVocabPages = Math.max(1, Math.ceil(filteredVocab.length / vocabPageSize));
  const paginatedVocab = useMemo(() => {
    const start = (vocabPage - 1) * vocabPageSize;
    return filteredVocab.slice(start, start + vocabPageSize);
  }, [filteredVocab, vocabPage, vocabPageSize]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Header & Tab Navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-brand-ink">Thư viện từ vựng & Chủ đề</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Quản lý kho từ vựng cá nhân, phân nhóm theo chủ đề và khám phá các bộ từ công khai từ cộng đồng.
          </p>
        </div>

        {activeTab === 'my-vocab' && (
          <button
            onClick={onOpenQuickAdd}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-brand-primary hover:bg-brand-primaryHover text-white rounded-control font-semibold text-xs shadow-sm transition-all active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Thêm từ mới</span>
          </button>
        )}
      </div>

      {/* Main Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-200 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('my-vocab')}
          className={`flex items-center gap-2 pb-3 px-3 transition-colors relative ${
            activeTab === 'my-vocab'
              ? 'text-brand-primary'
              : 'text-text-secondary hover:text-brand-ink'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Bộ từ của tôi ({vocabItems.length})</span>
          {activeTab === 'my-vocab' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-primary rounded-full" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('manage-topics')}
          className={`flex items-center gap-2 pb-3 px-3 transition-colors relative ${
            activeTab === 'manage-topics'
              ? 'text-brand-primary'
              : 'text-text-secondary hover:text-brand-ink'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Quản trị chủ đề</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-brand-primarySoft text-brand-primary border border-brand-primary/20">
            Topic
          </span>
          {activeTab === 'manage-topics' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-primary rounded-full" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('community-topics')}
          className={`flex items-center gap-2 pb-3 px-3 transition-colors relative ${
            activeTab === 'community-topics'
              ? 'text-brand-primary'
              : 'text-text-secondary hover:text-brand-ink'
          }`}
        >
          <Globe className="w-4 h-4 text-emerald-600" />
          <span>Khám phá cộng đồng (Public Topics)</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Chia sẻ
          </span>
          {activeTab === 'community-topics' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-primary rounded-full" />
          )}
        </button>
      </div>

      {/* View 1: My Vocabulary */}
      {activeTab === 'my-vocab' && (
        <div className="space-y-6">
          {/* Deck & Topic Group Manager Section */}
          <DeckManager
            selectedDeckId={selectedDeckId}
            createDeckWithTopic={createDeckWithTopic}
            onClearCreateDeckWithTopic={() => setCreateDeckWithTopic(null)}
            onSelectDeck={(deckId) => {
              setVocabPage(1);
              if (selectedDeckId === deckId) {
                setSelectedDeckId('all');
              } else {
                setSelectedDeckId(deckId);
                const deck = deckMap.get(deckId);
                if (deck?.topicGroup) setSelectedTopicGroup(deck.topicGroup);
              }
            }}
          />

          {/* Filter and Search Bar */}
          <div className="bg-surface-base border border-slate-200/80 rounded-card p-4 shadow-xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Search Box */}
              <div className="relative lg:col-span-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm theo từ, nghĩa, tag..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setVocabPage(1);
                  }}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-surface-subtle border border-slate-200 rounded-control focus:outline-none focus:border-brand-primary"
                />
              </div>

              {/* Topic Group Filter */}
              <select
                value={selectedTopicGroup}
                onChange={(e) => {
                  setSelectedTopicGroup(e.target.value);
                  setSelectedDeckId('all');
                  setVocabPage(1);
                }}
                className="w-full px-3 py-2 text-xs bg-surface-subtle border border-slate-200 rounded-control focus:outline-none focus:border-brand-primary font-medium"
              >
                <option value="all">Tất cả nhóm chủ đề</option>
                {availableTopicGroups.map((g) => (
                  <option key={g} value={g}>
                    Nhóm: {g}
                  </option>
                ))}
              </select>

              {/* Deck Filter */}
              <select
                value={selectedDeckId}
                onChange={(e) => {
                  setSelectedDeckId(e.target.value);
                  setVocabPage(1);
                }}
                className="w-full px-3 py-2 text-xs bg-surface-subtle border border-slate-200 rounded-control focus:outline-none focus:border-brand-primary"
              >
                <option value="all">
                  Tất cả bộ từ ({availableDecks.length})
                </option>
                {availableDecks.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({vocabItems.filter((i) => i.deckId === d.id).length})
                  </option>
                ))}
              </select>

              {/* CEFR Level Filter */}
              <select
                value={selectedCefr}
                onChange={(e) => {
                  setSelectedCefr(e.target.value);
                  setVocabPage(1);
                }}
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
                onChange={(e) => {
                  setSelectedPos(e.target.value);
                  setVocabPage(1);
                }}
                className="w-full px-3 py-2 text-xs bg-surface-subtle border border-slate-200 rounded-control focus:outline-none focus:border-brand-primary"
              >
                <option value="all">Tất cả từ loại (POS)</option>
                <option value="noun">Danh từ (noun)</option>
                <option value="verb">Động từ (verb)</option>
                <option value="adjective">Tính từ (adjective)</option>
                <option value="adverb">Trạng từ (adverb)</option>
                <option value="phrase">Cụm từ (phrase)</option>
                <option value="idiom">Thành ngữ (idiom)</option>
                <option value="preposition">Giới từ (preposition)</option>
              </select>
            </div>

            {/* Quick filter summary chips */}
            <div className="flex items-center justify-between text-xs text-text-secondary pt-1">
              <span>
                Hiển thị <strong>{filteredVocab.length}</strong> / {vocabItems.length} từ
              </span>

              {(searchQuery ||
                selectedTopicGroup !== 'all' ||
                selectedDeckId !== 'all' ||
                selectedCefr !== 'all' ||
                selectedPos !== 'all') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedTopicGroup('all');
                    setSelectedDeckId('all');
                    setSelectedCefr('all');
                    setSelectedPos('all');
                  }}
                  className="text-brand-primary hover:underline text-xs font-semibold"
                >
                  Đặt lại tất cả bộ lọc
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
                      <th className="py-3 px-4">Chủ đề & Bộ từ</th>
                      <th className="py-3 px-4">Cấp độ</th>
                      <th className="py-3 px-4">Trạng thái FSRS</th>
                      <th className="py-3 px-4">Hạn ôn</th>
                      <th className="py-3 px-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedVocab.map((item) => {
                      const card = cardMap.get(item.id);
                      const isDue = card && new Date(card.dueAt).getTime() <= Date.now();
                      const itemDeck = deckMap.get(item.deckId);

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

                          {/* Topic Group & Deck */}
                          <td className="py-3 px-4">
                            <div className="flex flex-col gap-0.5">
                              <span
                                className="px-2 py-0.5 rounded text-[10px] font-semibold text-slate-700 bg-slate-100 max-w-[140px] truncate"
                                style={{
                                  borderLeft: `3px solid ${itemDeck?.color || '#4F46E5'}`,
                                }}
                              >
                                {itemDeck?.name || 'Từ vựng'}
                              </span>
                              <span className="text-[9px] text-slate-400">
                                {itemDeck?.topicGroup || 'Chung'}
                              </span>
                            </div>
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
                  Thử thay đổi từ khóa tìm kiếm hoặc điều chỉnh bộ lọc nhóm chủ đề/bộ từ.
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => setActiveTab('community-topics')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand-primary hover:bg-brand-canvas rounded-control transition-colors"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Khám phá bộ từ có sẵn từ cộng đồng</span>
                  </button>
                </div>
              </div>
            )}

            {/* Vocabulary Table Pagination */}
            {filteredVocab.length > 0 && (
              <Pagination
                currentPage={vocabPage}
                totalPages={totalVocabPages}
                totalItems={filteredVocab.length}
                pageSize={vocabPageSize}
                onPageChange={setVocabPage}
                onPageSizeChange={(newSize) => {
                  setVocabPageSize(newSize);
                  setVocabPage(1);
                }}
                pageSizeOptions={[10, 20, 50, 100]}
                itemLabel="từ vựng"
              />
            )}
          </div>
        </div>
      )}

      {/* View 2: Topic Groups Management */}
      {activeTab === 'manage-topics' && (
        <TopicManager
          onSelectTopicForFilter={(topic) => {
            setSelectedTopicGroup(topic);
            setSelectedDeckId('all');
            setVocabPage(1);
            setActiveTab('my-vocab');
          }}
          onOpenCreateDeck={(defaultTopic) => {
            setCreateDeckWithTopic(defaultTopic);
            setActiveTab('my-vocab');
          }}
        />
      )}

      {/* View 3: Community & Public Topics Hub */}
      {activeTab === 'community-topics' && (
        <PublicDeckHub
          onForkSuccess={() => {
            setActiveTab('my-vocab');
          }}
        />
      )}

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

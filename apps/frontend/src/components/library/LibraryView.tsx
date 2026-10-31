'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  Eye,
  Flame,
  Folder,
  X,
  CheckSquare,
  Square,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  SlidersHorizontal,
  Image as ImageIcon,
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
import { FsrsInlineStatus } from './FsrsInlineStatus';

interface LibraryViewProps {
  onOpenQuickAdd: () => void;
}

export function LibraryView({ onOpenQuickAdd }: LibraryViewProps) {
  const { vocabItems, decks, cards, reviewLogs, deleteVocabItem, updateVocabItem, batchDeleteVocabItems, batchMoveVocabItems, settings } = useVocelune();

  // Tab switch: 'my-vocab' | 'manage-topics' | 'community-topics'
  const [activeTab, setActiveTab] = useState<'my-vocab' | 'manage-topics' | 'community-topics'>('my-vocab');

  // Multi-selection state for batch processing
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchMoveModalOpen, setBatchMoveModalOpen] = useState(false);
  const [batchTargetDeckId, setBatchTargetDeckId] = useState('');
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  // Filters & Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTopicGroup, setSelectedTopicGroup] = useState<string>('all');
  const [selectedDeckId, setSelectedDeckId] = useState<string>('all');
  const [selectedCefr, setSelectedCefr] = useState<string>('all');
  const [selectedPos, setSelectedPos] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all'); // 'all' | 'due' | 'new' | 'learning' | 'review' | 'suspended'
  const [selectedHasImage, setSelectedHasImage] = useState<string>('all'); // 'all' | 'has_image' | 'no_image'
  const [selectedSourceKind, setSelectedSourceKind] = useState<string>('all'); // 'all' | 'user' | 'import' | 'fork'
  const [sortBy, setSortBy] = useState<string>('created_desc');
  // 'created_desc' | 'created_asc' | 'word_asc' | 'word_desc' | 'due_asc' | 'due_desc' | 'stability_asc' | 'stability_desc' | 'difficulty_desc' | 'reps_desc'

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

  // Map cards by vocabItemId with intelligent prioritization:
  // 1. Cards with reviews (reps > 0)
  // 2. Active learning/review state over 'new'
  // 3. Higher stability / recent review
  // 4. Primary 'en_vi' template
  const cardMap = useMemo(() => {
    const map = new Map<string, (typeof cards)[0]>();
    const stateWeight: Record<string, number> = { review: 4, learning: 3, relearning: 3, new: 1 };

    for (const c of cards) {
      const existing = map.get(c.vocabItemId);
      if (!existing) {
        map.set(c.vocabItemId, c);
        continue;
      }

      const cScore =
        (c.reps > 0 ? 10000 : 0) +
        (stateWeight[c.state] || 0) * 1000 +
        Math.min(500, Math.round((c.stability || 0) * 10)) +
        (c.template === 'en_vi' ? 100 : 0) +
        (c.lastReviewedAt ? 50 : 0);

      const existingScore =
        (existing.reps > 0 ? 10000 : 0) +
        (stateWeight[existing.state] || 0) * 1000 +
        Math.min(500, Math.round((existing.stability || 0) * 10)) +
        (existing.template === 'en_vi' ? 100 : 0) +
        (existing.lastReviewedAt ? 50 : 0);

      if (cScore > existingScore) {
        map.set(c.vocabItemId, c);
      }
    }
    return map;
  }, [cards]);

  // Map review logs by cardId and vocabItemId
  const cardLogsMap = useMemo(() => {
    const cardToVocab = new Map<string, string>();
    for (const c of cards) {
      cardToVocab.set(c.id, c.vocabItemId);
    }

    const map = new Map<string, typeof reviewLogs>();
    for (const log of reviewLogs) {
      if (!map.has(log.cardId)) map.set(log.cardId, []);
      map.get(log.cardId)!.push(log);

      const vocabId = cardToVocab.get(log.cardId);
      if (vocabId) {
        if (!map.has(vocabId)) map.set(vocabId, []);
        map.get(vocabId)!.push(log);
      }
    }
    return map;
  }, [cards, reviewLogs]);

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

  // Active filters count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (selectedTopicGroup !== 'all') count++;
    if (selectedDeckId !== 'all') count++;
    if (selectedCefr !== 'all') count++;
    if (selectedPos !== 'all') count++;
    if (selectedStatus !== 'all') count++;
    if (selectedHasImage !== 'all') count++;
    if (selectedSourceKind !== 'all') count++;
    if (sortBy !== 'created_desc') count++;
    return count;
  }, [searchQuery, selectedTopicGroup, selectedDeckId, selectedCefr, selectedPos, selectedStatus, selectedHasImage, selectedSourceKind, sortBy]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedTopicGroup('all');
    setSelectedDeckId('all');
    setSelectedCefr('all');
    setSelectedPos('all');
    setSelectedStatus('all');
    setSelectedHasImage('all');
    setSelectedSourceKind('all');
    setSortBy('created_desc');
    setVocabPage(1);
  };

  const handleToggleSort = (field: 'word' | 'due' | 'created' | 'stability' | 'difficulty') => {
    setVocabPage(1);
    if (field === 'word') {
      setSortBy((prev) => (prev === 'word_asc' ? 'word_desc' : 'word_asc'));
    } else if (field === 'due') {
      setSortBy((prev) => (prev === 'due_asc' ? 'due_desc' : 'due_asc'));
    } else if (field === 'created') {
      setSortBy((prev) => (prev === 'created_desc' ? 'created_asc' : 'created_desc'));
    } else if (field === 'stability') {
      setSortBy((prev) => (prev === 'stability_asc' ? 'stability_desc' : 'stability_asc'));
    } else if (field === 'difficulty') {
      setSortBy((prev) => (prev === 'difficulty_desc' ? 'reps_desc' : 'difficulty_desc'));
    }
  };

  // Filtered and sorted items
  const filteredVocab = useMemo(() => {
    const now = Date.now();
    const result = vocabItems.filter((item) => {
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

      // FSRS Card Status filter
      if (selectedStatus !== 'all') {
        const card = cardMap.get(item.id);
        if (!card) return false;
        if (selectedStatus === 'due') {
          if (card.suspended || card.state === 'new' || new Date(card.dueAt).getTime() > now) return false;
        } else if (selectedStatus === 'new') {
          if (card.state !== 'new') return false;
        } else if (selectedStatus === 'learning') {
          if (!['learning', 'relearning'].includes(card.state)) return false;
        } else if (selectedStatus === 'review') {
          if (card.state !== 'review') return false;
        } else if (selectedStatus === 'suspended') {
          if (!card.suspended) return false;
        }
      }

      // Image filter
      if (selectedHasImage !== 'all') {
        if (selectedHasImage === 'has_image' && !item.imageUrl) return false;
        if (selectedHasImage === 'no_image' && item.imageUrl) return false;
      }

      // Source Kind filter
      if (selectedSourceKind !== 'all') {
        const source = item.sourceKind || 'user';
        if (selectedSourceKind !== source) return false;
      }

      return true;
    });

    // Sort order
    result.sort((a, b) => {
      if (sortBy === 'word_asc') {
        return a.word.localeCompare(b.word);
      }
      if (sortBy === 'word_desc') {
        return b.word.localeCompare(a.word);
      }
      if (sortBy === 'created_asc') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (sortBy === 'created_desc') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === 'due_asc') {
        const cardA = cardMap.get(a.id);
        const cardB = cardMap.get(b.id);
        const timeA = cardA?.dueAt ? new Date(cardA.dueAt).getTime() : Infinity;
        const timeB = cardB?.dueAt ? new Date(cardB.dueAt).getTime() : Infinity;
        return timeA - timeB;
      }
      if (sortBy === 'due_desc') {
        const cardA = cardMap.get(a.id);
        const cardB = cardMap.get(b.id);
        const timeA = cardA?.dueAt ? new Date(cardA.dueAt).getTime() : -Infinity;
        const timeB = cardB?.dueAt ? new Date(cardB.dueAt).getTime() : -Infinity;
        return timeB - timeA;
      }
      if (sortBy === 'stability_asc') {
        const sA = cardMap.get(a.id)?.stability ?? 0;
        const sB = cardMap.get(b.id)?.stability ?? 0;
        return sA - sB;
      }
      if (sortBy === 'stability_desc') {
        const sA = cardMap.get(a.id)?.stability ?? 0;
        const sB = cardMap.get(b.id)?.stability ?? 0;
        return sB - sA;
      }
      if (sortBy === 'difficulty_desc') {
        const dA = cardMap.get(a.id)?.difficulty ?? 0;
        const dB = cardMap.get(b.id)?.difficulty ?? 0;
        return dB - dA;
      }
      if (sortBy === 'reps_desc') {
        const rA = cardMap.get(a.id)?.reps ?? 0;
        const rB = cardMap.get(b.id)?.reps ?? 0;
        return rB - rA;
      }
      return 0;
    });

    return result;
  }, [
    vocabItems,
    searchQuery,
    selectedTopicGroup,
    selectedDeckId,
    selectedCefr,
    selectedPos,
    selectedStatus,
    selectedHasImage,
    selectedSourceKind,
    sortBy,
    deckMap,
    cardMap,
  ]);

  // Paginated vocabulary items
  const totalVocabPages = Math.max(1, Math.ceil(filteredVocab.length / vocabPageSize));
  const paginatedVocab = useMemo(() => {
    const start = (vocabPage - 1) * vocabPageSize;
    return filteredVocab.slice(start, start + vocabPageSize);
  }, [filteredVocab, vocabPage, vocabPageSize]);

  // Batch selection handlers
  const isAllPageSelected =
    paginatedVocab.length > 0 && paginatedVocab.every((item) => selectedIds.has(item.id));
  const isSomePageSelected =
    paginatedVocab.some((item) => selectedIds.has(item.id)) && !isAllPageSelected;

  const handleToggleSelectAllPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (isAllPageSelected) {
        paginatedVocab.forEach((item) => next.delete(item.id));
      } else {
        paginatedVocab.forEach((item) => next.add(item.id));
      }
      return next;
    });
  };

  const handleToggleSelectWord = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Bạn có chắc muốn xóa ${selectedIds.size} từ vựng đã chọn khỏi thư viện?`)) return;
    setIsBatchProcessing(true);
    try {
      await batchDeleteVocabItems(Array.from(selectedIds));
      setSelectedIds(new Set());
    } catch {
      // Handled by context
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const handleBatchMove = async () => {
    const target = batchTargetDeckId || decks[0]?.id;
    if (selectedIds.size === 0 || !target) return;
    setIsBatchProcessing(true);
    try {
      await batchMoveVocabItems(Array.from(selectedIds), target);
      setSelectedIds(new Set());
      setBatchMoveModalOpen(false);
    } catch {
      // Handled by context
    } finally {
      setIsBatchProcessing(false);
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto w-full px-1 sm:px-3">
      {/* Top Header & Tab Navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-brand-ink">Thư viện từ vựng & Chủ đề</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Quản lý kho từ vựng cá nhân, phân nhóm theo chủ đề và khám phá các bộ từ công khai từ cộng đồng.
          </p>
        </div>

        {activeTab === 'my-vocab' && (
          <button
            onClick={onOpenQuickAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-primary hover:bg-brand-primaryHover text-white rounded-control font-semibold text-xs shadow-2xs transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Thêm từ mới</span>
          </button>
        )}
      </div>

      {/* Main Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-200 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('my-vocab')}
          className={`flex items-center gap-1.5 pb-2 px-2.5 transition-colors relative ${
            activeTab === 'my-vocab'
              ? 'text-brand-primary'
              : 'text-text-secondary hover:text-brand-ink'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Bộ từ của tôi ({vocabItems.length})</span>
          {activeTab === 'my-vocab' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-primary rounded-full" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('manage-topics')}
          className={`flex items-center gap-1.5 pb-2 px-2.5 transition-colors relative ${
            activeTab === 'manage-topics'
              ? 'text-brand-primary'
              : 'text-text-secondary hover:text-brand-ink'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
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
          className={`flex items-center gap-1.5 pb-2 px-2.5 transition-colors relative ${
            activeTab === 'community-topics'
              ? 'text-brand-primary'
              : 'text-text-secondary hover:text-brand-ink'
          }`}
        >
          <Globe className="w-3.5 h-3.5 text-emerald-600" />
          <span>Khám phá cộng đồng (Public Topics)</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
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
            {/* Top Row: Search, Topics, Decks, Sort */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {/* Search Box */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm theo từ, nghĩa, tag..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setVocabPage(1);
                  }}
                  className="w-full pl-9 pr-7 py-2 text-xs bg-surface-subtle border border-slate-200 rounded-control focus:outline-none focus:border-brand-primary"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setVocabPage(1);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    title="Xóa tìm kiếm"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
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

              {/* Primary Sort Selector */}
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value);
                    setVocabPage(1);
                  }}
                  className="w-full pl-8 pr-3 py-2 text-xs bg-surface-subtle border border-slate-200 rounded-control focus:outline-none focus:border-brand-primary font-medium text-brand-ink"
                >
                  <option value="created_desc">Mới thêm gần đây</option>
                  <option value="created_asc">Thêm trước đó (Cũ nhất)</option>
                  <option value="word_asc">Từ vựng (A → Z)</option>
                  <option value="word_desc">Từ vựng (Z → A)</option>
                  <option value="due_asc">Đến hạn ôn sớm nhất (Ưu tiên FSRS)</option>
                  <option value="due_desc">Đến hạn ôn muộn nhất</option>
                  <option value="stability_asc">Độ nhớ yếu nhất (Cần học)</option>
                  <option value="stability_desc">Độ nhớ vững nhất</option>
                  <option value="difficulty_desc">Độ khó cao nhất</option>
                  <option value="reps_desc">Ôn nhiều lượt nhất</option>
                </select>
                <ArrowUpDown className="w-3.5 h-3.5 text-brand-primary absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Second Row: Detailed Filters (FSRS Status, CEFR, POS, Image, Source) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-0.5">
              {/* FSRS Card Status Filter */}
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setVocabPage(1);
                }}
                className={`w-full px-2.5 py-1.5 text-xs rounded-control border transition-colors ${
                  selectedStatus !== 'all'
                    ? 'border-brand-primary bg-brand-primarySoft/30 text-brand-primary font-semibold'
                    : 'border-slate-200 bg-surface-subtle text-slate-700'
                }`}
              >
                <option value="all">Trạng thái: Tất cả</option>
                <option value="due">⏰ Đến hạn ôn tập</option>
                <option value="new">🆕 Thẻ mới (chưa học)</option>
                <option value="learning">🔄 Đang học (Learning)</option>
                <option value="review">💎 Đang duy trì (Review)</option>
                <option value="suspended">⏸️ Bị tạm dừng</option>
              </select>

              {/* CEFR Level Filter */}
              <select
                value={selectedCefr}
                onChange={(e) => {
                  setSelectedCefr(e.target.value);
                  setVocabPage(1);
                }}
                className={`w-full px-2.5 py-1.5 text-xs rounded-control border transition-colors ${
                  selectedCefr !== 'all'
                    ? 'border-brand-primary bg-brand-primarySoft/30 text-brand-primary font-semibold'
                    : 'border-slate-200 bg-surface-subtle text-slate-700'
                }`}
              >
                <option value="all">CEFR: Tất cả cấp độ</option>
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
                className={`w-full px-2.5 py-1.5 text-xs rounded-control border transition-colors ${
                  selectedPos !== 'all'
                    ? 'border-brand-primary bg-brand-primarySoft/30 text-brand-primary font-semibold'
                    : 'border-slate-200 bg-surface-subtle text-slate-700'
                }`}
              >
                <option value="all">Từ loại: Tất cả (POS)</option>
                <option value="noun">Danh từ (noun)</option>
                <option value="verb">Động từ (verb)</option>
                <option value="adjective">Tính từ (adjective)</option>
                <option value="adverb">Trạng từ (adverb)</option>
                <option value="phrase">Cụm từ (phrase)</option>
                <option value="idiom">Thành ngữ (idiom)</option>
                <option value="preposition">Giới từ (preposition)</option>
              </select>

              {/* Image Filter */}
              <select
                value={selectedHasImage}
                onChange={(e) => {
                  setSelectedHasImage(e.target.value);
                  setVocabPage(1);
                }}
                className={`w-full px-2.5 py-1.5 text-xs rounded-control border transition-colors ${
                  selectedHasImage !== 'all'
                    ? 'border-brand-primary bg-brand-primarySoft/30 text-brand-primary font-semibold'
                    : 'border-slate-200 bg-surface-subtle text-slate-700'
                }`}
              >
                <option value="all">Hình ảnh: Tất cả</option>
                <option value="has_image">🖼️ Có ảnh minh họa</option>
                <option value="no_image">📝 Chưa có ảnh</option>
              </select>

              {/* Source Kind Filter */}
              <select
                value={selectedSourceKind}
                onChange={(e) => {
                  setSelectedSourceKind(e.target.value);
                  setVocabPage(1);
                }}
                className={`w-full px-2.5 py-1.5 text-xs rounded-control border transition-colors ${
                  selectedSourceKind !== 'all'
                    ? 'border-brand-primary bg-brand-primarySoft/30 text-brand-primary font-semibold'
                    : 'border-slate-200 bg-surface-subtle text-slate-700'
                }`}
              >
                <option value="all">Nguồn: Tất cả</option>
                <option value="user">✍️ Tự biên soạn</option>
                <option value="import">📥 Nhập từ tệp</option>
                <option value="fork">🌐 Sao chép Topic</option>
              </select>
            </div>

            {/* Quick filter summary chips & Reset Button */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-secondary pt-1 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <span>
                  Hiển thị <strong>{filteredVocab.length}</strong> / {vocabItems.length} từ
                </span>

                {activeFilterCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-brand-primarySoft text-brand-primary border border-brand-primary/20">
                    {activeFilterCount} điều kiện lọc
                  </span>
                )}
              </div>

              {activeFilterCount > 0 && (
                <button
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-700 text-xs font-semibold hover:underline cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  Đặt lại tất cả bộ lọc
                </button>
              )}
            </div>
          </div>

          {/* Vocabulary Table */}
          <div className="bg-surface-base border border-slate-200/80 rounded-card overflow-hidden shadow-xs">
            {filteredVocab.length > 0 ? (
              <div className="overflow-x-auto scrollbar-thin">
                <table className="min-w-[760px] w-full text-left text-xs">
                  <thead className="bg-slate-50 text-text-secondary font-semibold border-b border-slate-200/80 sticky top-0 z-10 shadow-2xs select-none">
                    <tr>
                      <th className="py-2.5 px-2.5 w-9 text-center shrink-0">
                        <input
                          type="checkbox"
                          checked={isAllPageSelected}
                          ref={(input) => {
                            if (input) input.indeterminate = isSomePageSelected;
                          }}
                          onChange={handleToggleSelectAllPage}
                          className="rounded text-brand-primary focus:ring-brand-primary cursor-pointer w-3.5 h-3.5"
                          title="Chọn tất cả từ trên trang này"
                        />
                      </th>

                      {/* Sortable: Word */}
                      <th
                        className="py-2.5 px-2.5 w-[160px] cursor-pointer hover:bg-slate-100/70 transition-colors group/th"
                        onClick={() => handleToggleSort('word')}
                        title="Bấm để sắp xếp theo chữ cái A-Z hoặc Z-A"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Từ vựng & Phiên âm</span>
                          {sortBy === 'word_asc' ? (
                            <ArrowUp className="w-3 h-3 text-brand-primary shrink-0" />
                          ) : sortBy === 'word_desc' ? (
                            <ArrowDown className="w-3 h-3 text-brand-primary shrink-0" />
                          ) : (
                            <ArrowUpDown className="w-2.5 h-2.5 text-slate-300 group-hover/th:text-slate-500 shrink-0" />
                          )}
                        </div>
                      </th>

                      <th className="py-2.5 px-2 w-14 text-center text-text-secondary italic">Từ loại</th>
                      <th className="py-2.5 px-2.5 min-w-[130px] max-w-[200px]">Nghĩa tiếng Việt</th>
                      <th className="py-2.5 px-2 w-[120px]">Chủ đề & Bộ từ</th>

                      {/* CEFR */}
                      <th className="py-2.5 px-1.5 w-12 text-center">Cấp độ</th>

                      {/* Sortable: Stability / Status */}
                      <th
                        className="py-2.5 px-2.5 w-[130px] cursor-pointer hover:bg-slate-100/70 transition-colors group/th"
                        onClick={() => handleToggleSort('stability')}
                        title="Bấm để sắp xếp theo độ nhớ FSRS"
                      >
                        <div className="flex items-center gap-1">
                          <span>Trạng thái FSRS</span>
                          {sortBy === 'stability_asc' ? (
                            <ArrowUp className="w-3 h-3 text-brand-primary shrink-0" />
                          ) : sortBy === 'stability_desc' ? (
                            <ArrowDown className="w-3 h-3 text-brand-primary shrink-0" />
                          ) : (
                            <ArrowUpDown className="w-2.5 h-2.5 text-slate-300 group-hover/th:text-slate-500 shrink-0" />
                          )}
                        </div>
                      </th>

                      {/* Sortable: Due Date */}
                      <th
                        className="py-2.5 px-2 w-16 text-center cursor-pointer hover:bg-slate-100/70 transition-colors group/th"
                        onClick={() => handleToggleSort('due')}
                        title="Bấm để sắp xếp theo hạn ôn tập sớm nhất / muộn nhất"
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>Hạn ôn</span>
                          {sortBy === 'due_asc' ? (
                            <ArrowUp className="w-3 h-3 text-brand-primary shrink-0" />
                          ) : sortBy === 'due_desc' ? (
                            <ArrowDown className="w-3 h-3 text-brand-primary shrink-0" />
                          ) : (
                            <ArrowUpDown className="w-2.5 h-2.5 text-slate-300 group-hover/th:text-slate-500 shrink-0" />
                          )}
                        </div>
                      </th>

                      <th className="py-2.5 px-1.5 w-11 text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedVocab.map((item) => {
                      const card = cardMap.get(item.id);
                      const cardLogs = card ? (cardLogsMap.get(item.id) || cardLogsMap.get(card.id)) : undefined;
                      const isDue = card && !card.suspended && card.state !== 'new' && new Date(card.dueAt).getTime() <= Date.now();
                      const itemDeck = deckMap.get(item.deckId);
                      const isSelected = selectedIds.has(item.id);

                      return (
                        <tr
                          key={item.id}
                          onClick={() => {
                            setSelectedWord(item);
                            setDetailModalOpen(true);
                          }}
                          className={`hover:bg-brand-canvas/70 transition-colors cursor-pointer group ${
                            isSelected ? 'bg-indigo-50/50' : ''
                          }`}
                        >
                          {/* Selection Checkbox */}
                          <td
                            className="py-2 px-2.5 text-center shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectWord(item.id)}
                              className="rounded text-brand-primary focus:ring-brand-primary cursor-pointer w-3.5 h-3.5"
                            />
                          </td>

                          {/* Word & Audio with stacked Word \n IPA */}
                          <td className="py-2 px-2.5">
                            <div className="flex items-center gap-2">
                              {item.imageUrl && (
                                <img
                                  src={item.imageUrl}
                                  alt={item.word}
                                  className="w-7 h-7 rounded object-cover border border-slate-200/80 shadow-2xs shrink-0"
                                />
                              )}
                              <AudioButton
                                text={item.word}
                                dialect={item.dialect || settings.englishDialect}
                                size="sm"
                              />
                              <div className="flex flex-col min-w-0">
                                <span className="font-bold text-xs sm:text-sm text-brand-ink truncate leading-tight" title={item.word}>
                                  {item.word}
                                </span>
                                {item.phonetic && (
                                  <span className="font-mono text-[10.5px] text-slate-400 truncate leading-tight mt-0.5" title={item.phonetic}>
                                    {item.phonetic}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* POS */}
                          <td className="py-2 px-2 text-center italic text-[11px] text-text-secondary truncate">
                            {item.partOfSpeech}
                          </td>

                          {/* Meaning */}
                          <td className="py-2 px-2.5 font-medium text-brand-ink max-w-[200px] truncate" title={item.meaningVi}>
                            {item.meaningVi}
                          </td>

                          {/* Topic Group & Deck */}
                          <td className="py-2 px-2">
                            <div className="flex flex-col gap-0.5">
                              <span
                                className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-slate-700 bg-slate-100 max-w-[115px] truncate"
                                style={{
                                  borderLeft: `3px solid ${itemDeck?.color || '#4F46E5'}`,
                                }}
                                title={itemDeck?.name || 'Từ vựng'}
                              >
                                {itemDeck?.name || 'Từ vựng'}
                              </span>
                              <span className="text-[9px] text-slate-400 truncate max-w-[115px]">
                                {itemDeck?.topicGroup || 'Chung'}
                              </span>
                            </div>
                          </td>

                          {/* CEFR */}
                          <td className="py-2 px-1.5 text-center">
                            <span
                              className={`px-1.5 py-0.5 rounded font-extrabold text-[10px] ${
                                item.cefr && item.cefr !== 'unknown'
                                  ? 'bg-brand-primarySoft text-brand-primary'
                                  : 'bg-slate-100 text-slate-400 font-normal'
                              }`}
                            >
                              {item.cefr && item.cefr !== 'unknown' ? item.cefr : '—'}
                            </span>
                          </td>

                          {/* FSRS State with Inline Chart */}
                          <td className="py-2 px-2.5">
                            <FsrsInlineStatus card={card} logs={cardLogs} />
                          </td>

                          {/* Due Time */}
                          <td className="py-2 px-2 font-mono text-[11px] text-center">
                            {card ? (
                              card.state === 'new' ? (
                                <span className="text-[10px] text-slate-400 font-sans">Chưa học</span>
                              ) : card.suspended ? (
                                <span className="text-[10px] text-slate-400 font-sans">Tạm dừng</span>
                              ) : isDue ? (
                                <span
                                  title="Đến hạn ôn ngay (FSRS)"
                                  className="inline-flex items-center justify-center p-1 rounded-md bg-rose-50 text-rose-600 border border-rose-200/80 shadow-2xs group-hover:scale-105 transition-transform"
                                >
                                  <Flame className="w-3.5 h-3.5 fill-rose-500 text-rose-500 animate-pulse" />
                                </span>
                              ) : (
                                <span
                                  title={`Hạn ôn: ${formatRelativeTime(card.dueAt)}`}
                                  className="inline-flex items-center justify-center gap-1 text-[10.5px] text-text-secondary whitespace-nowrap"
                                >
                                  <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span>{formatRelativeTime(card.dueAt)}</span>
                                </span>
                              )
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          {/* Actions Column */}
                          <td className="py-2 px-1.5 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedWord(item);
                                setDetailModalOpen(true);
                              }}
                              title="Xem chi tiết & Chỉnh sửa"
                              aria-label="Chi tiết"
                              className="p-1.5 text-brand-primary hover:text-white hover:bg-brand-primary bg-brand-primarySoft/60 rounded-lg transition-all duration-150 active:scale-95 inline-flex items-center justify-center shadow-2xs"
                            >
                              <Eye className="w-4 h-4" />
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

      {/* Floating Batch Action Toolbar */}
      <AnimatePresence>
        {selectedIds.size > 0 && activeTab === 'my-vocab' && (
          <motion.div
            initial={{ y: 60, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 60, opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-brand-ink text-white px-5 py-3 rounded-2xl shadow-elevated border border-white/10 flex items-center gap-3.5 text-xs backdrop-blur-md"
          >
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-brand-primary text-white flex items-center justify-center font-bold text-[11px]">
                {selectedIds.size}
              </span>
              <span className="font-semibold text-slate-200">từ đã chọn</span>
            </div>

            <div className="h-4 w-px bg-white/20" />

            <button
              type="button"
              onClick={() => {
                setBatchTargetDeckId(decks[0]?.id || '');
                setBatchMoveModalOpen(true);
              }}
              disabled={isBatchProcessing}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium flex items-center gap-1.5 transition-colors active:scale-95 disabled:opacity-50"
            >
              <Folder className="w-3.5 h-3.5 text-brand-mint" />
              <span>Chuyển chủ đề / bộ từ</span>
            </button>

            <button
              type="button"
              onClick={handleBatchDelete}
              disabled={isBatchProcessing}
              className="px-3 py-1.5 rounded-lg bg-rose-500/80 hover:bg-rose-600 text-white font-semibold flex items-center gap-1.5 transition-colors active:scale-95 disabled:opacity-50"
            >
              {isBatchProcessing ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              <span>{isBatchProcessing ? 'Đang xóa...' : 'Xóa đã chọn'}</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors"
              title="Bỏ chọn tất cả"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Batch Move To Topic / Deck Modal */}
      {batchMoveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-surface-base rounded-card shadow-elevated border border-slate-200/90 w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-sm text-brand-ink flex items-center gap-2">
                <Folder className="w-4 h-4 text-brand-primary" />
                <span>Chuyển {selectedIds.size} từ vựng sang bộ từ / chủ đề khác</span>
              </h3>
              <button
                type="button"
                onClick={() => setBatchMoveModalOpen(false)}
                className="text-slate-400 hover:text-brand-ink"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-text-secondary">
              Tất cả các từ vựng được chọn sẽ được phân loại vào bộ từ mới được chỉ định bên dưới.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-brand-ink">
                Chọn bộ từ đích (kèm chủ đề):
              </label>
              <select
                value={batchTargetDeckId}
                onChange={(e) => setBatchTargetDeckId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-surface-subtle border border-slate-200 rounded-control font-medium focus:outline-none focus:border-brand-primary"
              >
                {decks.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.topicGroup || 'Chung'})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setBatchMoveModalOpen(false)}
                className="px-3.5 py-1.5 border border-slate-200 rounded-control text-xs font-semibold text-text-secondary hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleBatchMove}
                disabled={isBatchProcessing || !batchTargetDeckId}
                className="px-4 py-1.5 bg-brand-primary hover:bg-brand-primaryHover text-white rounded-control text-xs font-bold shadow-xs disabled:opacity-50 flex items-center gap-1.5"
              >
                {isBatchProcessing && (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                <span>{isBatchProcessing ? 'Đang chuyển...' : 'Xác nhận chuyển'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

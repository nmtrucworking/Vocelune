'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layers,
  Search,
  Plus,
  Edit2,
  Trash2,
  BookOpen,
  ArrowRight,
  Check,
  X,
  Sparkles,
  Folder,
  ArrowRightLeft,
  GraduationCap,
  AlertTriangle,
  Play,
  Loader2,
} from 'lucide-react';
import { useVocelune } from '@/context/VoceluneContext';
import { useNotification } from '@/context/NotificationContext';
import { Deck, VocabItem } from '@/types';
import { Pagination } from '../common/Pagination';

const SUGGESTED_TOPIC_NAMES = [
  'IELTS / Academic',
  'Giao tiếp hàng ngày',
  'Công sở / Business',
  'Du lịch & Đời sống',
  'Công nghệ / IT',
  'Ngữ pháp & Cấu trúc',
  'TOEIC Essential',
];

interface TopicGroupDetail {
  name: string;
  isDefault: boolean;
  decks: Deck[];
  wordCount: number;
  dueCardCount: number;
}

interface TopicManagerProps {
  onSelectTopicForFilter?: (topicName: string) => void;
  onOpenCreateDeck?: (defaultTopic: string) => void;
}

export function TopicManager({
  onSelectTopicForFilter,
  onOpenCreateDeck,
}: TopicManagerProps) {
  const router = useRouter();
  const { notify } = useNotification();
  const {
    decks,
    vocabItems,
    cards,
    dueCards,
    addDeck,
    updateDeck,
    renameTopicGroup,
    deleteTopicGroup,
  } = useVocelune();

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  // Persistent list of custom topics so newly created topics never vanish
  const [customTopics, setCustomTopics] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem('vocelune_custom_topics');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('vocelune_custom_topics', JSON.stringify(customTopics));
    } catch {}
  }, [customTopics]);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [selectedDecksToAssign, setSelectedDecksToAssign] = useState<string[]>([]);

  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [targetRenameTopic, setTargetRenameTopic] = useState<string | null>(null);
  const [renamedName, setRenamedName] = useState('');

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [targetDeleteTopic, setTargetDeleteTopic] = useState<string | null>(null);
  const [reassignTargetGroup, setReassignTargetGroup] = useState('Chung');

  const [moveDecksModalOpen, setMoveDecksModalOpen] = useState(false);
  const [moveFromTopic, setMoveFromTopic] = useState<string | null>(null);
  const [selectedDeckToMove, setSelectedDeckToMove] = useState<string>('');
  const [moveToTopicGroup, setMoveToTopicGroup] = useState<string>('Chung');

  const [busy, setBusy] = useState(false);

  // Map word count and actual due cards per deck (based on FSRS dueCards)
  const { deckWordCount, deckDueCount } = useMemo(() => {
    const wordCount = new Map<string, number>();
    for (const item of vocabItems) {
      const dIds: string[] = (item as any).deckIds?.length ? (item as any).deckIds : [item.deckId];
      for (const dId of dIds) {
        if (dId) wordCount.set(dId, (wordCount.get(dId) || 0) + 1);
      }
    }

    const dueCount = new Map<string, number>();
    const vocabDeckMap = new Map<string, string[]>();
    for (const item of vocabItems) {
      const dIds: string[] = (item as any).deckIds?.length ? (item as any).deckIds : [item.deckId];
      vocabDeckMap.set(item.id, dIds);
    }

    for (const card of dueCards) {
      const deckIds = vocabDeckMap.get(card.vocabItemId) || [];
      for (const deckId of deckIds) {
        if (deckId) {
          dueCount.set(deckId, (dueCount.get(deckId) || 0) + 1);
        }
      }
    }

    return { deckWordCount: wordCount, deckDueCount: dueCount };
  }, [vocabItems, dueCards]);

  // Group all user decks into topic groups + preserve empty custom topics
  const allTopicGroups: TopicGroupDetail[] = useMemo(() => {
    const groupMap = new Map<string, Deck[]>();

    // Add user decks dynamically
    for (const d of decks) {
      const g = d.topicGroup?.trim() || 'Chung';
      if (!groupMap.has(g)) {
        groupMap.set(g, []);
      }
      groupMap.get(g)!.push(d);
    }

    // Ensure custom created topics exist even if no decks are assigned yet
    for (const ct of customTopics) {
      if (!groupMap.has(ct)) {
        groupMap.set(ct, []);
      }
    }

    // Always guarantee 'Chung' exists if list is empty
    if (groupMap.size === 0) {
      groupMap.set('Chung', []);
    }

    const result: TopicGroupDetail[] = [];
    for (const [name, deckList] of groupMap.entries()) {
      let totalWords = 0;
      let totalDue = 0;

      for (const d of deckList) {
        totalWords += deckWordCount.get(d.id) || 0;
        totalDue += deckDueCount.get(d.id) || 0;
      }

      result.push({
        name,
        isDefault: name === 'Chung',
        decks: deckList,
        wordCount: totalWords,
        dueCardCount: totalDue,
      });
    }

    // Sort: topics with decks first, then alphabetically
    return result.sort((a, b) => {
      if (a.name === 'Chung') return -1;
      if (b.name === 'Chung') return 1;
      if (a.decks.length > 0 && b.decks.length === 0) return -1;
      if (a.decks.length === 0 && b.decks.length > 0) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [decks, customTopics, deckWordCount, deckDueCount]);

  // Filter topics by search query
  const filteredTopics = useMemo(() => {
    if (!searchQuery.trim()) return allTopicGroups;
    const q = searchQuery.toLowerCase().trim();
    return allTopicGroups.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.decks.some((d) => d.name.toLowerCase().includes(q))
    );
  }, [allTopicGroups, searchQuery]);

  // Total pages
  const totalPages = Math.max(1, Math.ceil(filteredTopics.length / pageSize));

  // Current page items
  const paginatedTopics = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTopics.slice(start, start + pageSize);
  }, [filteredTopics, currentPage, pageSize]);

  // Auto reset page when search changes
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  // Actions
  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTopicName.trim();
    if (!trimmed) return;

    setBusy(true);
    try {
      // If user selected existing decks to assign to this new topic
      if (selectedDecksToAssign.length > 0) {
        for (const deckId of selectedDecksToAssign) {
          await updateDeck(deckId, { topicGroup: trimmed });
        }
      } else {
        // Automatically create a default deck under this topic so the topic is persisted in DB
        await addDeck({
          name: `Từ vựng ${trimmed}`,
          topicGroup: trimmed,
          description: `Bộ từ thuộc chủ đề ${trimmed}`,
          color: '#4F46E5',
          icon: 'folder',
          isPublic: false,
        });
      }

      setCustomTopics((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
      notify.success('Đã tạo chủ đề mới!', `Chủ đề "${trimmed}" đã được khởi tạo thành công.`);
      setCreateModalOpen(false);
      setNewTopicName('');
      setSelectedDecksToAssign([]);
    } catch (err) {
      notify.error('Không thể tạo chủ đề', err instanceof Error ? err.message : 'Lỗi không xác định.');
    } finally {
      setBusy(false);
    }
  };

  const handleRenameTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedNew = renamedName.trim();
    if (!targetRenameTopic || !trimmedNew) return;

    setBusy(true);
    try {
      await renameTopicGroup(targetRenameTopic, trimmedNew);
      setCustomTopics((prev) => prev.map((t) => (t === targetRenameTopic ? trimmedNew : t)));
      notify.success('Đã đổi tên chủ đề!', `Chủ đề đã được cập nhật thành "${trimmedNew}".`);
      setRenameModalOpen(false);
      setTargetRenameTopic(null);
      setRenamedName('');
    } catch (err) {
      notify.error('Không thể đổi tên chủ đề', err instanceof Error ? err.message : 'Lỗi không xác định.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDeleteTopic) return;

    setBusy(true);
    try {
      await deleteTopicGroup(targetDeleteTopic, reassignTargetGroup);
      setCustomTopics((prev) => prev.filter((t) => t !== targetDeleteTopic));
      notify.info('Đã xóa chủ đề', `Đã xóa "${targetDeleteTopic}". Các bộ từ đã được chuyển sang "${reassignTargetGroup}".`);
      setDeleteModalOpen(false);
      setTargetDeleteTopic(null);
    } catch (err) {
      notify.error('Không thể xóa chủ đề', err instanceof Error ? err.message : 'Lỗi không xác định.');
    } finally {
      setBusy(false);
    }
  };

  const handleMoveDeck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeckToMove || !moveToTopicGroup) return;

    setBusy(true);
    try {
      await updateDeck(selectedDeckToMove, { topicGroup: moveToTopicGroup });
      notify.success('Đã chuyển bộ từ!', 'Bộ từ đã được di chuyển sang chủ đề mới.');
      setMoveDecksModalOpen(false);
      setSelectedDeckToMove('');
    } catch (err) {
      notify.error('Không thể chuyển bộ từ', err instanceof Error ? err.message : 'Lỗi không xác định.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* Top Banner / Stats */}
      <div className="bg-surface-base border border-slate-200/90 rounded-card p-3.5 sm:p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5">
            <div className="w-7 h-7 rounded-lg bg-brand-primarySoft text-brand-primary flex items-center justify-center font-bold">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <h3 className="font-bold text-sm sm:text-base text-brand-ink">
              Quản trị chủ đề từ vựng (Topic Groups)
            </h3>
          </div>
          <p className="text-[11px] text-text-secondary max-w-xl">
            Tổ chức các bộ từ (decks) theo các nhóm chủ đề lớn. Đổi tên, phân loại lại hoặc gán nhanh các bộ từ vào chủ đề phù hợp để ôn tập có hệ thống.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setNewTopicName('');
              setSelectedDecksToAssign([]);
              setCreateModalOpen(true);
            }}
            className="px-3 py-1.5 bg-brand-primary hover:bg-brand-primaryHover text-white rounded-control font-semibold text-xs shadow-2xs transition-all flex items-center gap-1 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tạo chủ đề mới</span>
          </button>
        </div>
      </div>

      {/* Search & Overview Stats Bar */}
      <div className="bg-surface-base border border-slate-200/80 rounded-card p-3 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-2.5">
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm theo tên chủ đề hoặc bộ từ..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface-subtle border border-slate-200 rounded-control focus:outline-none focus:border-brand-primary"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => handleSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Aggregate Pills */}
        <div className="flex items-center gap-1.5 text-xs text-text-secondary self-start sm:self-auto overflow-x-auto">
          <span className="px-2 py-0.5 rounded bg-slate-100 font-medium whitespace-nowrap text-[11px]">
            Tổng: <strong className="text-brand-ink">{allTopicGroups.length}</strong> chủ đề
          </span>
          <span className="px-2 py-0.5 rounded bg-slate-100 font-medium whitespace-nowrap text-[11px]">
            Bộ từ: <strong className="text-brand-ink">{decks.length}</strong> decks
          </span>
          <span className="px-2 py-0.5 rounded bg-slate-100 font-medium whitespace-nowrap text-[11px]">
            Từ vựng: <strong className="text-brand-ink">{vocabItems.length}</strong> từ
          </span>
        </div>
      </div>

      {/* Topic Groups Grid */}
      {paginatedTopics.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {paginatedTopics.map((topic, idx) => (
            <motion.div
              key={topic.name}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: idx * 0.04 }}
              className="bg-surface-base border border-slate-200/90 rounded-card shadow-card hover:shadow-elevated transition-all flex flex-col justify-between overflow-hidden group"
            >
              {/* Card Header */}
              <div className="p-3.5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-brand-primarySoft text-brand-primary flex items-center justify-center font-bold shrink-0">
                      <Folder className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs sm:text-sm text-brand-ink group-hover:text-brand-primary transition-colors">
                        {topic.name}
                      </h4>
                      <span className="text-[10px] text-text-secondary">
                        {topic.isDefault ? 'Chủ đề hệ thống' : 'Chủ đề tùy biến'}
                      </span>
                    </div>
                  </div>

                  {/* Actions dropdown or buttons */}
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setTargetRenameTopic(topic.name);
                        setRenamedName(topic.name);
                        setRenameModalOpen(true);
                      }}
                      className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-brand-ink transition-colors"
                      title="Đổi tên chủ đề"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>

                    {topic.name !== 'Chung' && (
                      <button
                        type="button"
                        onClick={() => {
                          setTargetDeleteTopic(topic.name);
                          setReassignTargetGroup('Chung');
                          setDeleteModalOpen(true);
                        }}
                        className="p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                        title="Xóa chủ đề (chuyển bộ từ)"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Topic Stats Badges */}
                <div className="grid grid-cols-3 gap-1.5 py-1.5 px-2.5 rounded-control bg-slate-50 border border-slate-100 text-center">
                  <div>
                    <div className="text-[9px] text-text-secondary">Bộ từ</div>
                    <div className="font-bold text-[11px] text-brand-ink">
                      {topic.decks.length}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] text-text-secondary">Từ vựng</div>
                    <div className="font-bold text-[11px] text-brand-ink">
                      {topic.wordCount}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] text-text-secondary">Đến hạn</div>
                    <div
                      className={`font-bold text-[11px] ${
                        topic.dueCardCount > 0 ? 'text-rose-600' : 'text-slate-400'
                      }`}
                    >
                      {topic.dueCardCount}
                    </div>
                  </div>
                </div>

                {/* Decks inside this topic */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-text-secondary">
                    <span>Các bộ từ trong chủ đề ({topic.decks.length}):</span>
                    {topic.decks.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setMoveFromTopic(topic.name);
                          setSelectedDeckToMove(topic.decks[0].id);
                          setMoveToTopicGroup(
                            allTopicGroups.find((g) => g.name !== topic.name)?.name || 'Chung'
                          );
                          setMoveDecksModalOpen(true);
                        }}
                        className="text-brand-primary hover:underline text-[10px] flex items-center gap-1"
                      >
                        <ArrowRightLeft className="w-3 h-3" />
                        <span>Chuyển</span>
                      </button>
                    )}
                  </div>

                  {topic.decks.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {topic.decks.map((deck) => (
                        <div
                          key={deck.id}
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100 text-[11px] text-brand-ink font-medium border border-slate-200/60"
                        >
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: deck.color || '#4F46E5' }}
                          />
                          <span className="max-w-[120px] truncate">{deck.name}</span>
                          <span className="text-[9px] text-slate-400">
                            ({deckWordCount.get(deck.id) || 0})
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic py-1">
                      Chưa có bộ từ nào trong chủ đề này.
                    </p>
                  )}
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onSelectTopicForFilter?.(topic.name)}
                  className="flex-1 py-1.5 px-2.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-control text-[11px] font-semibold text-brand-ink transition-colors flex items-center justify-center gap-1"
                >
                  <BookOpen className="w-3.5 h-3.5 text-brand-primary" />
                  <span>Lọc từ trong kho</span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenCreateDeck?.(topic.name)}
                  className="py-1.5 px-2.5 bg-brand-primarySoft hover:bg-brand-primarySoft/80 text-brand-primary border border-brand-primary/20 rounded-control text-[11px] font-bold transition-colors flex items-center gap-1"
                  title="Thêm bộ từ vào chủ đề này"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm bộ từ</span>
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="py-16 text-center bg-surface-base rounded-card border border-slate-200 space-y-3">
          <Layers className="w-10 h-10 text-slate-300 mx-auto" />
          <h4 className="text-sm font-semibold text-brand-ink">
            Không tìm thấy chủ đề nào khớp với &ldquo;{searchQuery}&rdquo;
          </h4>
          <p className="text-xs text-text-secondary max-w-sm mx-auto">
            Thử nhập từ khóa tìm kiếm khác hoặc nhấn nút bên dưới để tạo chủ đề mới.
          </p>
          <button
            type="button"
            onClick={() => handleSearchChange('')}
            className="px-3.5 py-1.5 bg-brand-primarySoft text-brand-primary text-xs font-bold rounded-control hover:bg-brand-primarySoft/80 transition-colors"
          >
            Xóa tìm kiếm
          </button>
        </div>
      )}

      {/* Pagination for Topics */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={filteredTopics.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setCurrentPage(1);
        }}
        pageSizeOptions={[6, 9, 12, 18]}
        itemLabel="chủ đề"
      />

      {/* Modal 1: Create New Topic Group */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-surface-base rounded-card shadow-modal max-w-md w-full p-6 space-y-5 border border-slate-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-extrabold text-base text-brand-ink">
                Tạo nhóm chủ đề mới
              </h3>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTopic} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-brand-ink">
                  Tên chủ đề <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={60}
                  placeholder="Ví dụ: Luyện thi TOEIC 800+, Tiếng Anh Y Khoa..."
                  value={newTopicName}
                  onChange={(e) => setNewTopicName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-surface-subtle border border-slate-200 rounded-control focus:outline-none focus:border-brand-primary"
                />
              </div>

              {/* Quick Suggestion Chips */}
              <div className="space-y-1.5">
                <span className="text-[11px] text-text-secondary font-medium">
                  Gợi ý chủ đề nhanh:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTED_TOPIC_NAMES.map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => setNewTopicName(sug)}
                      className={`px-2.5 py-1 rounded text-[11px] font-medium border transition-all ${
                        newTopicName === sug
                          ? 'bg-brand-primary text-white border-brand-primary shadow-xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-brand-primary hover:text-brand-primary'
                      }`}
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>

              {/* Assign existing decks */}
              {decks.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-brand-ink">
                    Chọn các bộ từ gán vào chủ đề này ngay (tùy chọn):
                  </label>
                  <div className="max-h-36 overflow-y-auto space-y-1.5 border border-slate-200 rounded-control p-2">
                    {decks.map((d) => {
                      const isSelected = selectedDecksToAssign.includes(d.id);
                      return (
                        <label
                          key={d.id}
                          className="flex items-center justify-between p-1.5 rounded hover:bg-slate-50 cursor-pointer text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedDecksToAssign((prev) => [...prev, d.id]);
                                } else {
                                  setSelectedDecksToAssign((prev) =>
                                    prev.filter((id) => id !== d.id)
                                  );
                                }
                              }}
                              className="rounded text-brand-primary focus:ring-brand-primary"
                            />
                            <span className="font-medium text-brand-ink">{d.name}</span>
                          </div>
                          <span className="text-[10px] text-slate-400">
                            Hiện tại: {d.topicGroup || 'Chung'}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-control text-xs font-semibold text-text-secondary hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={busy || !newTopicName.trim()}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-brand-primary hover:bg-brand-primaryHover disabled:opacity-50 text-white rounded-control text-xs font-bold shadow-xs transition-all"
                >
                  {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{busy ? 'Đang tạo...' : 'Tạo chủ đề'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Rename Topic Group */}
      {renameModalOpen && targetRenameTopic && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-surface-base rounded-card shadow-modal max-w-md w-full p-6 space-y-5 border border-slate-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-extrabold text-base text-brand-ink">
                Đổi tên chủ đề
              </h3>
              <button
                type="button"
                onClick={() => setRenameModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRenameTopic} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-brand-ink">
                  Tên mới cho chủ đề &ldquo;{targetRenameTopic}&rdquo;
                </label>
                <input
                  type="text"
                  required
                  maxLength={60}
                  value={renamedName}
                  onChange={(e) => setRenamedName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-surface-subtle border border-slate-200 rounded-control focus:outline-none focus:border-brand-primary"
                />
                <p className="text-[11px] text-text-secondary">
                  * Tên chủ đề mới sẽ được tự động cập nhật cho toàn bộ các bộ từ thuộc nhóm này.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRenameModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-control text-xs font-semibold text-text-secondary hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={busy || !renamedName.trim() || renamedName.trim() === targetRenameTopic}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-brand-primary hover:bg-brand-primaryHover disabled:opacity-50 text-white rounded-control text-xs font-bold shadow-xs transition-all"
                >
                  {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{busy ? 'Đang lưu...' : 'Lưu tên mới'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Delete Topic Group */}
      {deleteModalOpen && targetDeleteTopic && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-surface-base rounded-card shadow-modal max-w-md w-full p-6 space-y-5 border border-slate-200">
            <div className="flex items-center gap-3 text-rose-600 pb-2 border-b border-slate-100">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="font-extrabold text-base text-brand-ink">
                Xác nhận xóa chủ đề &ldquo;{targetDeleteTopic}&rdquo;
              </h3>
            </div>

            <form onSubmit={handleDeleteTopic} className="space-y-4">
              <p className="text-xs text-text-secondary leading-relaxed">
                Để bảo vệ an toàn cho từ vựng của bạn, các bộ từ thuộc chủ đề này sẽ <strong>không bị xóa</strong> mà sẽ được chuyển sang một chủ đề đích an toàn.
              </p>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-brand-ink">
                  Chuyển các bộ từ sang chủ đề:
                </label>
                <select
                  value={reassignTargetGroup}
                  onChange={(e) => setReassignTargetGroup(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-surface-subtle border border-slate-200 rounded-control focus:outline-none focus:border-brand-primary font-semibold"
                >
                  {allTopicGroups
                    .filter((g) => g.name !== targetDeleteTopic)
                    .map((g) => (
                      <option key={g.name} value={g.name}>
                        {g.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-control text-xs font-semibold text-text-secondary hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-control text-xs font-bold shadow-xs transition-all"
                >
                  {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{busy ? 'Đang xóa...' : 'Xác nhận xóa và chuyển bộ từ'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Move Deck to Another Topic */}
      {moveDecksModalOpen && moveFromTopic && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-surface-base rounded-card shadow-modal max-w-md w-full p-6 space-y-5 border border-slate-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-extrabold text-base text-brand-ink">
                Chuyển bộ từ sang chủ đề khác
              </h3>
              <button
                type="button"
                onClick={() => setMoveDecksModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleMoveDeck} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-brand-ink">
                  Chọn bộ từ cần chuyển:
                </label>
                <select
                  value={selectedDeckToMove}
                  onChange={(e) => setSelectedDeckToMove(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-surface-subtle border border-slate-200 rounded-control focus:outline-none focus:border-brand-primary font-semibold"
                >
                  {decks
                    .filter((d) => (d.topicGroup || 'Chung') === moveFromTopic)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({deckWordCount.get(d.id) || 0} từ)
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-brand-ink">
                  Chuyển sang chủ đề đích:
                </label>
                <select
                  value={moveToTopicGroup}
                  onChange={(e) => setMoveToTopicGroup(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-surface-subtle border border-slate-200 rounded-control focus:outline-none focus:border-brand-primary font-semibold"
                >
                  {allTopicGroups
                    .filter((g) => g.name !== moveFromTopic)
                    .map((g) => (
                      <option key={g.name} value={g.name}>
                        {g.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMoveDecksModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-control text-xs font-semibold text-text-secondary hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={busy || !selectedDeckToMove}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-brand-primary hover:bg-brand-primaryHover disabled:opacity-50 text-white rounded-control text-xs font-bold shadow-xs transition-all"
                >
                  {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{busy ? 'Đang chuyển...' : 'Lưu thay đổi'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

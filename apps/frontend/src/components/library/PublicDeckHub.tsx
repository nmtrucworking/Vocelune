'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Globe,
  Search,
  Download,
  BookOpen,
  Sparkles,
  Users,
  CheckCircle2,
  Eye,
  Filter,
  Layers,
} from 'lucide-react';
import { useVocelune } from '@/context/VoceluneContext';
import { Deck } from '@/types';
import { api } from '@/lib/api';
import { PublicDeckPreviewModal } from './PublicDeckPreviewModal';
import { triggerConfetti } from '@/lib/confetti';
import { Pagination } from '../common/Pagination';

interface PublicDeckHubProps {
  onForkSuccess?: () => void;
}

export function PublicDeckHub({ onForkSuccess }: PublicDeckHubProps) {
  const { forkPublicDeck } = useVocelune();
  const [publicDecks, setPublicDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  // Preview modal state
  const [previewDeckId, setPreviewDeckId] = useState<string | null>(null);

  // Fork state tracking by deckId
  const [forkingMap, setForkingMap] = useState<Record<string, boolean>>({});
  const [forkedSuccessMap, setForkedSuccessMap] = useState<Record<string, boolean>>({});

  const fetchPublicDecks = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ items: Deck[]; total: number }>('/decks/public');
      setPublicDecks(res.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải kho chủ đề công khai.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchPublicDecks();
  }, []);

  // Distinct groups from public decks
  const availableGroups = useMemo(() => {
    const set = new Set<string>();
    publicDecks.forEach((d) => set.add(d.topicGroup || 'Chung'));
    return Array.from(set).sort();
  }, [publicDecks]);

  // Filtered public decks
  const filteredDecks = useMemo(() => {
    return publicDecks.filter((d) => {
      if (selectedGroup !== 'all' && (d.topicGroup || 'Chung') !== selectedGroup) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = d.name.toLowerCase().includes(q);
        const matchesDesc = (d.description || '').toLowerCase().includes(q);
        const matchesGroup = (d.topicGroup || '').toLowerCase().includes(q);
        if (!matchesName && !matchesDesc && !matchesGroup) {
          return false;
        }
      }
      return true;
    });
  }, [publicDecks, selectedGroup, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredDecks.length / pageSize));
  const paginatedDecks = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredDecks.slice(start, start + pageSize);
  }, [filteredDecks, currentPage, pageSize]);

  const handleGroupFilterChange = (grp: string) => {
    setSelectedGroup(grp);
    setCurrentPage(1);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  const handleQuickFork = async (deck: Deck) => {
    if (forkingMap[deck.id]) return;
    setForkingMap((prev) => ({ ...prev, [deck.id]: true }));
    try {
      await forkPublicDeck(deck.id);
      triggerConfetti();
      setForkedSuccessMap((prev) => ({ ...prev, [deck.id]: true }));
      // Update local fork count
      setPublicDecks((prev) =>
        prev.map((d) => (d.id === deck.id ? { ...d, forkCount: (d.forkCount || 0) + 1 } : d))
      );
      setTimeout(() => {
        onForkSuccess?.();
      }, 1000);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Không thể lưu bộ từ.');
    } finally {
      setForkingMap((prev) => ({ ...prev, [deck.id]: false }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Intro Banner */}
      <div className="bg-gradient-to-r from-brand-primary/10 via-brand-canvas/40 to-emerald-50/50 border border-brand-primary/20 rounded-card p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-control bg-brand-primary text-white flex items-center justify-center font-bold shadow-xs">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-brand-ink">
                Kho chủ đề cộng đồng (Vocelune Public Decks)
              </h3>
              <p className="text-xs text-text-secondary mt-0.5">
                Khám phá và lưu về các bộ từ vựng tuyển chọn theo chủ đề. Tự động liên kết chu kỳ ôn tập FSRS cá nhân.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-600 bg-white/80 px-3 py-1.5 rounded-control border border-slate-200">
            <span>⚡ 1-Click clone</span>
            <span>•</span>
            <span>🧠 Tích hợp FSRS</span>
            <span>•</span>
            <span>💸 Tiết kiệm tài nguyên</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface-base border border-slate-200/80 rounded-card p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm chủ đề công khai theo tên, nhóm, mô tả..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-surface-subtle border border-slate-200 rounded-control focus:outline-none focus:border-brand-primary"
            />
          </div>

          {/* Group dropdown */}
          <select
            value={selectedGroup}
            onChange={(e) => handleGroupFilterChange(e.target.value)}
            className="px-3 py-2 text-xs bg-surface-subtle border border-slate-200 rounded-control focus:outline-none focus:border-brand-primary min-w-[180px]"
          >
            <option value="all">Tất cả nhóm chủ đề</option>
            {availableGroups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        {/* Group chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          <button
            type="button"
            onClick={() => handleGroupFilterChange('all')}
            className={`px-2.5 py-1 rounded-full font-medium transition-all ${
              selectedGroup === 'all'
                ? 'bg-brand-ink text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            Tất cả ({publicDecks.length})
          </button>
          {availableGroups.map((group) => {
            const count = publicDecks.filter((d) => (d.topicGroup || 'Chung') === group).length;
            const isActive = selectedGroup === group;
            return (
              <button
                key={group}
                type="button"
                onClick={() => handleGroupFilterChange(group)}
                className={`px-2.5 py-1 rounded-full font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-brand-primary text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {group} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid of Public Decks */}
      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center text-slate-400 space-y-3">
          <div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-xs">Đang tải danh sách chủ đề công khai...</span>
        </div>
      ) : error ? (
        <div className="p-4 rounded-card bg-rose-50 text-rose-700 border border-rose-200 text-xs">
          {error}
        </div>
      ) : filteredDecks.length === 0 ? (
        <div className="bg-surface-base border border-slate-200 rounded-card p-12 text-center text-text-secondary text-xs">
          <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="font-semibold text-slate-700">Chưa tìm thấy chủ đề phù hợp</p>
          <p className="mt-1">Hãy thử tìm từ khóa khác hoặc chuyển sang chế độ "Bộ từ của tôi" để chia sẻ bộ từ đầu tiên của bạn!</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedDecks.map((deck) => {
              const isForking = !!forkingMap[deck.id];
              const isForked = !!forkedSuccessMap[deck.id];

            return (
              <div
                key={deck.id}
                className="bg-white border border-slate-200/90 rounded-card p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-3 group"
              >
                <div>
                  {/* Top Bar with Group & Topic color */}
                  <div className="flex items-start justify-between gap-2">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      {deck.topicGroup || 'Chung'}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                      <Download className="w-3 h-3" />
                      {deck.forkCount || 0}
                    </span>
                  </div>

                  {/* Title */}
                  <h4 className="font-bold text-sm text-brand-ink mt-2 group-hover:text-brand-primary transition-colors line-clamp-1">
                    {deck.name}
                  </h4>

                  {/* Description */}
                  <p className="text-xs text-text-secondary mt-1 line-clamp-2 min-h-[2rem]">
                    {deck.description || 'Chưa có mô tả chi tiết cho bộ từ này.'}
                  </p>

                  {/* Author & Word Count */}
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium pt-3 mt-1 border-t border-slate-100">
                    <span className="flex items-center gap-1.5">
                      {deck.authorAvatarUrl ? (
                        <img src={deck.authorAvatarUrl} alt={deck.authorName} className="w-4 h-4 rounded-full object-cover ring-1 ring-slate-200" />
                      ) : null}
                      <span>Tác giả: <strong>{deck.authorName || 'Cộng đồng'}</strong></span>
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-brand-canvas text-brand-primary font-bold">
                      {deck.itemCount || 0} từ
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setPreviewDeckId(deck.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-control text-xs font-semibold transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Xem trước</span>
                  </button>

                  <button
                    type="button"
                    disabled={isForking || isForked}
                    onClick={() => handleQuickFork(deck)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-control text-xs font-bold shadow-xs transition-all ${
                      isForked
                        ? 'bg-emerald-600 text-white'
                        : 'bg-brand-primary hover:bg-brand-primaryHover text-white active:scale-95 disabled:opacity-50'
                    }`}
                  >
                    {isForked ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Đã lưu!</span>
                      </>
                    ) : isForking ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Đang lưu...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        <span>Lưu bộ từ</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
          </div>

          {/* Public Decks Pagination */}
          {filteredDecks.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredDecks.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setCurrentPage(1);
              }}
              pageSizeOptions={[6, 9, 12, 18]}
              itemLabel="bộ từ công khai"
              className="rounded-card border border-slate-200"
            />
          )}
        </div>
      )}

      {/* Modal Preview */}
      <PublicDeckPreviewModal
        deckId={previewDeckId}
        onClose={() => setPreviewDeckId(null)}
        onForkSuccess={onForkSuccess}
      />
    </div>
  );
}

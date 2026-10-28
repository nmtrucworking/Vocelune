'use client';

import React, { useState, useMemo } from 'react';
import {
  Book,
  Target,
  Briefcase,
  Globe,
  Sparkles,
  GraduationCap,
  Plane,
  Code,
  Folder,
  Share2,
  Lock,
  Plus,
  Trash2,
  Edit2,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  Layers,
  Copy,
} from 'lucide-react';
import { useVocelune } from '@/context/VoceluneContext';
import { Deck } from '@/types';
import { Pagination } from '../common/Pagination';

const PRESET_COLORS = [
  { value: '#4F46E5', label: 'Indigo' },
  { value: '#0D9488', label: 'Teal' },
  { value: '#0284C7', label: 'Sky' },
  { value: '#16A34A', label: 'Green' },
  { value: '#D97706', label: 'Amber' },
  { value: '#E11D48', label: 'Rose' },
  { value: '#7C3AED', label: 'Violet' },
  { value: '#475569', label: 'Slate' },
];

const PRESET_ICONS = [
  { key: 'book', label: 'Sách', icon: Book },
  { key: 'target', label: 'Mục tiêu', icon: Target },
  { key: 'briefcase', label: 'Công sở', icon: Briefcase },
  { key: 'globe', label: 'Thế giới', icon: Globe },
  { key: 'sparkles', label: 'Cảm hứng', icon: Sparkles },
  { key: 'graduation-cap', label: 'Học thuật', icon: GraduationCap },
  { key: 'plane', label: 'Du lịch', icon: Plane },
  { key: 'code', label: 'Công nghệ', icon: Code },
];

const SUGGESTED_GROUPS = [
  'Chung',
  'IELTS / Academic',
  'Giao tiếp hàng ngày',
  'Công sở / Business',
  'Du lịch & Đời sống',
  'Công nghệ / Kỹ thuật',
  'Ngữ pháp & Cấu trúc',
];

interface DeckManagerProps {
  onSelectDeck?: (deckId: string) => void;
  selectedDeckId?: string;
  createDeckWithTopic?: string | null;
  onClearCreateDeckWithTopic?: () => void;
}

export function DeckManager({
  onSelectDeck,
  selectedDeckId,
  createDeckWithTopic,
  onClearCreateDeckWithTopic,
}: DeckManagerProps) {
  const { decks, vocabItems, addDeck, updateDeck, deleteDeck } = useVocelune();

  const [isExpanded, setIsExpanded] = useState(false);
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [deckPage, setDeckPage] = useState(1);
  const [deckPageSize, setDeckPageSize] = useState(6);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDeck, setEditingDeck] = useState<Deck | null>(null);
  const [busy, setBusy] = useState(false);

  // Form states
  const [formName, setFormName] = useState('');
  const [formGroup, setFormGroup] = useState('Chung');
  const [formDesc, setFormDesc] = useState('');
  const [formColor, setFormColor] = useState('#4F46E5');
  const [formIcon, setFormIcon] = useState('book');
  const [formIsPublic, setFormIsPublic] = useState(false);

  // Auto-open create modal if createDeckWithTopic is passed
  React.useEffect(() => {
    if (createDeckWithTopic) {
      setEditingDeck(null);
      setFormName('');
      setFormGroup(createDeckWithTopic);
      setFormDesc('');
      setFormColor('#4F46E5');
      setFormIcon('book');
      setFormIsPublic(false);
      setModalOpen(true);
      onClearCreateDeckWithTopic?.();
    }
  }, [createDeckWithTopic, onClearCreateDeckWithTopic]);

  // Map word count per deck
  const wordCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of vocabItems) {
      map.set(item.deckId, (map.get(item.deckId) || 0) + 1);
    }
    return map;
  }, [vocabItems]);

  // Distinct groups from user decks
  const availableGroups = useMemo(() => {
    const set = new Set<string>();
    decks.forEach((d) => set.add(d.topicGroup || 'Chung'));
    return Array.from(set).sort();
  }, [decks]);

  // Filtered decks
  const filteredDecks = useMemo(() => {
    if (filterGroup === 'all') return decks;
    return decks.filter((d) => (d.topicGroup || 'Chung') === filterGroup);
  }, [decks, filterGroup]);

  const totalDeckPages = Math.max(1, Math.ceil(filteredDecks.length / deckPageSize));
  const paginatedDecks = useMemo(() => {
    const start = (deckPage - 1) * deckPageSize;
    return filteredDecks.slice(start, start + deckPageSize);
  }, [filteredDecks, deckPage, deckPageSize]);

  const handleFilterGroupChange = (grp: string) => {
    setFilterGroup(grp);
    setDeckPage(1);
  };

  // Reset & open create modal
  const openCreateModal = (defaultGroup = 'Chung') => {
    setEditingDeck(null);
    setFormName('');
    setFormGroup(defaultGroup);
    setFormDesc('');
    setFormColor('#4F46E5');
    setFormIcon('book');
    setFormIsPublic(false);
    setModalOpen(true);
  };

  // Open edit modal
  const openEditModal = (deck: Deck) => {
    setEditingDeck(deck);
    setFormName(deck.name);
    setFormGroup(deck.topicGroup || 'Chung');
    setFormDesc(deck.description || '');
    setFormColor(deck.color || '#4F46E5');
    setFormIcon(deck.icon || 'book');
    setFormIsPublic(!!deck.isPublic);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || busy) return;

    setBusy(true);
    try {
      if (editingDeck) {
        await updateDeck(editingDeck.id, {
          name: formName.trim(),
          topicGroup: formGroup.trim() || 'Chung',
          description: formDesc.trim(),
          color: formColor,
          icon: formIcon,
          isPublic: formIsPublic,
        });
      } else {
        await addDeck({
          name: formName.trim(),
          topicGroup: formGroup.trim() || 'Chung',
          description: formDesc.trim(),
          color: formColor,
          icon: formIcon,
          isPublic: formIsPublic,
        });
      }
      setModalOpen(false);
    } catch {
      // Handled by context error
    } finally {
      setBusy(false);
    }
  };

  const handleTogglePublic = async (deck: Deck, e: React.MouseEvent) => {
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      await updateDeck(deck.id, { isPublic: !deck.isPublic });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (deck: Deck, e: React.MouseEvent) => {
    e.stopPropagation();
    if (busy || decks.length <= 1) return;
    if (confirm(`Bạn có chắc muốn xóa bộ từ "${deck.name}"? Các từ vựng sẽ được tự động bảo toàn sang bộ còn lại.`)) {
      setBusy(true);
      try {
        await deleteDeck(deck.id);
      } finally {
        setBusy(false);
      }
    }
  };

  const renderDeckIcon = (iconKey?: string, className = 'w-4 h-4') => {
    const entry = PRESET_ICONS.find((p) => p.key === iconKey) || PRESET_ICONS[0];
    const IconComponent = entry.icon;
    return <IconComponent className={className} />;
  };

  return (
    <div className="bg-surface-base border border-slate-200/90 rounded-card overflow-hidden shadow-xs">
      {/* Header Bar */}
      <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-surface-base to-brand-canvas/30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-control bg-brand-primary/10 text-brand-primary flex items-center justify-center font-bold">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-brand-ink">Quản lý chủ đề & Bộ từ</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-canvas text-brand-primary border border-brand-primary/20">
                {decks.length} bộ từ · {availableGroups.length} nhóm chủ đề
              </span>
            </div>
            <p className="text-xs text-text-secondary mt-0.5">
              Tổ chức từ vựng theo nhóm chuyên sâu và chia sẻ bộ từ công khai cho cộng đồng.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openCreateModal()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-primary hover:bg-brand-primaryHover text-white rounded-control text-xs font-semibold shadow-xs transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tạo bộ từ mới</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-control text-text-secondary hover:bg-slate-100 transition-colors"
            title={isExpanded ? 'Thu gọn' : 'Mở rộng'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Topic Cards & Group Filters */}
      {isExpanded && (
        <div className="p-4 border-t border-slate-100 space-y-4 bg-slate-50/50">
          {/* Topic Group Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            <span className="text-[11px] font-semibold text-text-secondary whitespace-nowrap mr-1">
              Nhóm:
            </span>
            <button
              type="button"
              onClick={() => handleFilterGroupChange('all')}
              className={`px-2.5 py-1 rounded-full font-medium transition-all ${
                filterGroup === 'all'
                  ? 'bg-brand-ink text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              Tất cả ({decks.length})
            </button>
            {availableGroups.map((group) => {
              const count = decks.filter((d) => (d.topicGroup || 'Chung') === group).length;
              const isActive = filterGroup === group;
              return (
                <button
                  key={group}
                  type="button"
                  onClick={() => handleFilterGroupChange(group)}
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

          {/* Decks Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {paginatedDecks.map((deck) => {
              const wordCount = wordCountMap.get(deck.id) ?? (deck.itemCount || 0);
              const isSelected = selectedDeckId === deck.id;

              return (
                <div
                  key={deck.id}
                  onClick={() => onSelectDeck?.(deck.id)}
                  style={{ borderLeftColor: deck.color || '#4F46E5' }}
                  className={`border-l-4 bg-white p-3.5 rounded-lg border border-slate-200/80 shadow-xs hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                    isSelected ? 'ring-2 ring-brand-primary/40 bg-brand-canvas/20' : ''
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-md flex items-center justify-center text-white text-xs shadow-xs"
                          style={{ backgroundColor: deck.color || '#4F46E5' }}
                        >
                          {renderDeckIcon(deck.icon)}
                        </div>
                        <div>
                          <h4 className="font-bold text-xs text-brand-ink line-clamp-1">
                            {deck.name}
                          </h4>
                          <span className="text-[10px] font-semibold text-slate-400">
                            {deck.topicGroup || 'Chung'}
                          </span>
                        </div>
                      </div>

                      {/* Public/Private Badge */}
                      <button
                        type="button"
                        onClick={(e) => handleTogglePublic(deck, e)}
                        title={deck.isPublic ? 'Đang công khai · Nhấp để chuyển sang riêng tư' : 'Đang riêng tư · Nhấp để công khai'}
                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                          deck.isPublic
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {deck.isPublic ? (
                          <>
                            <Globe className="w-3 h-3 text-emerald-600" />
                            <span>Công khai</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-3 h-3 text-slate-400" />
                            <span>Riêng tư</span>
                          </>
                        )}
                      </button>
                    </div>

                    {deck.description && (
                      <p className="text-[11px] text-text-secondary mt-2 line-clamp-2">
                        {deck.description}
                      </p>
                    )}
                  </div>

                  {/* Footer Stats & Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                      <span>{wordCount} từ</span>
                      {deck.isPublic && (
                        <>
                          <span>•</span>
                          <span className="text-emerald-700">{deck.forkCount || 0} lượt lưu</span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => openEditModal(deck)}
                        className="p-1 rounded text-slate-500 hover:text-brand-primary hover:bg-slate-100 transition-colors"
                        title="Chỉnh sửa chủ đề"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        disabled={busy || decks.length <= 1}
                        onClick={(e) => handleDelete(deck, e)}
                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                        title={decks.length <= 1 ? 'Cần giữ lại ít nhất 1 bộ từ' : 'Xóa bộ từ'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Deck Pagination */}
          {filteredDecks.length > deckPageSize && (
            <div className="pt-2">
              <Pagination
                currentPage={deckPage}
                totalPages={totalDeckPages}
                totalItems={filteredDecks.length}
                pageSize={deckPageSize}
                onPageChange={setDeckPage}
                onPageSizeChange={(sz) => {
                  setDeckPageSize(sz);
                  setDeckPage(1);
                }}
                pageSizeOptions={[6, 9, 12, 18]}
                itemLabel="bộ từ"
                className="rounded-lg border border-slate-200"
              />
            </div>
          )}
        </div>
      )}

      {/* Modal: Create / Edit Topic Deck */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-card shadow-modal max-w-lg w-full overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded flex items-center justify-center text-white"
                  style={{ backgroundColor: formColor }}
                >
                  {renderDeckIcon(formIcon, 'w-3.5 h-3.5')}
                </div>
                <h3 className="font-bold text-sm text-brand-ink">
                  {editingDeck ? 'Chỉnh sửa chủ đề & Bộ từ' : 'Tạo chủ đề & Bộ từ mới'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="p-5 space-y-4 text-xs">
              {/* Name */}
              <div>
                <label className="block font-semibold text-brand-ink mb-1">
                  Tên chủ đề / Bộ từ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  placeholder="Ví dụ: IELTS Band 7.5 Writing, Giao tiếp công sở..."
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-subtle border border-slate-200 rounded-control focus:outline-none focus:border-brand-primary"
                />
              </div>

              {/* Topic Group */}
              <div>
                <label className="block font-semibold text-brand-ink mb-1">
                  Nhóm chủ đề (Topic Group)
                </label>
                <div className="space-y-2">
                  <input
                    type="text"
                    required
                    maxLength={60}
                    placeholder="Chọn hoặc nhập tên nhóm (ví dụ: IELTS / Academic)"
                    value={formGroup}
                    onChange={(e) => setFormGroup(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-subtle border border-slate-200 rounded-control focus:outline-none focus:border-brand-primary"
                  />
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-text-secondary">Gợi ý nhanh:</span>
                    {SUGGESTED_GROUPS.map((sg) => (
                      <button
                        key={sg}
                        type="button"
                        onClick={() => setFormGroup(sg)}
                        className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                          formGroup === sg
                            ? 'bg-brand-primary text-white border-brand-primary'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                        }`}
                      >
                        {sg}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block font-semibold text-brand-ink mb-1">Mô tả (tùy chọn)</label>
                <textarea
                  rows={2}
                  maxLength={2000}
                  placeholder="Ghi chú ngắn về mục tiêu hoặc đối tượng của bộ từ này..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-subtle border border-slate-200 rounded-control focus:outline-none focus:border-brand-primary resize-none"
                />
              </div>

              {/* Color & Icon Pickers */}
              <div className="grid grid-cols-2 gap-4">
                {/* Color */}
                <div>
                  <label className="block font-semibold text-brand-ink mb-1.5">Màu sắc</label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setFormColor(c.value)}
                        style={{ backgroundColor: c.value }}
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-white transition-transform ${
                          formColor === c.value ? 'scale-110 ring-2 ring-offset-2 ring-brand-primary' : 'hover:scale-105'
                        }`}
                        title={c.label}
                      >
                        {formColor === c.value && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Icon */}
                <div>
                  <label className="block font-semibold text-brand-ink mb-1.5">Biểu tượng</label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {PRESET_ICONS.map((ic) => {
                      const IconComp = ic.icon;
                      const isSelected = formIcon === ic.key;
                      return (
                        <button
                          key={ic.key}
                          type="button"
                          onClick={() => setFormIcon(ic.key)}
                          className={`w-7 h-7 rounded flex items-center justify-center border transition-all ${
                            isSelected
                              ? 'bg-brand-primary text-white border-brand-primary'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                          title={ic.label}
                        >
                          <IconComp className="w-3.5 h-3.5" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Public Sharing Toggle */}
              <div className="pt-2 border-t border-slate-100">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formIsPublic}
                    onChange={(e) => setFormIsPublic(e.target.checked)}
                    className="mt-0.5 rounded text-brand-primary focus:ring-brand-primary h-4 w-4"
                  />
                  <div>
                    <span className="font-semibold text-brand-ink flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-emerald-600" />
                      Công khai bộ từ lên cộng đồng Vocelune
                    </span>
                    <p className="text-[11px] text-text-secondary mt-0.5">
                      Người học khác có thể tìm kiếm, xem trước từ vựng và lưu bộ từ này về tài khoản để học.
                    </p>
                  </div>
                </label>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-200 rounded-control font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-1.5 bg-brand-primary hover:bg-brand-primaryHover text-white rounded-control font-semibold shadow-xs disabled:opacity-50 transition-all"
                >
                  {busy ? 'Đang lưu...' : editingDeck ? 'Cập nhật' : 'Tạo mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

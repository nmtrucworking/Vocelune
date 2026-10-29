'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  BookOpen,
  Sparkles,
  Layers,
  ArrowRight,
  Download,
  CheckCircle2,
  Filter,
  GraduationCap,
  Briefcase,
  Code2,
  Globe,
  X,
  Volume2,
  ExternalLink,
  Users,
} from 'lucide-react';
import { PublicNavbar } from '@/components/public/PublicNavbar';
import { PublicFooter } from '@/components/public/PublicFooter';
import { useVocelune } from '@/context/VoceluneContext';
import { useNotification } from '@/context/NotificationContext';
import { api } from '@/lib/api';
import { Deck, VocabItem, PublicDeckPreview } from '@/types';
import { AudioButton } from '@/components/common/AudioButton';
import { Pagination } from '@/components/common/Pagination';

export default function ExplorePage() {
  const router = useRouter();
  const { user, forkPublicDeck } = useVocelune();
  const { notify } = useNotification();

  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('all');
  const [explorePage, setExplorePage] = useState(1);
  const [explorePageSize, setExplorePageSize] = useState(6);
  const [previewDeck, setPreviewDeck] = useState<Deck | null>(null);
  const [previewWords, setPreviewWords] = useState<Partial<VocabItem>[]>([]);
  const [previewCefrStats, setPreviewCefrStats] = useState<Record<string, number>>({});
  const [previewLoading, setPreviewLoading] = useState(false);
  const [forkingDeckId, setForkingDeckId] = useState<string | null>(null);
  const [forkSuccessDeckId, setForkSuccessDeckId] = useState<string | null>(null);
  const [authPromptOpen, setAuthPromptOpen] = useState(false);

  // Fetch real public decks dynamically from backend
  const fetchPublicDecks = async () => {
    setLoading(true);
    try {
      const res = await api<{ items: Deck[]; total: number }>('/decks/public');
      if (res && Array.isArray(res.items)) {
        setDecks(res.items);
      }
    } catch {
      notify.error('Không thể tải danh sách', 'Không thể đồng bộ các bộ từ vựng công khai.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchPublicDecks();
  }, []);

  // Compute available topics dynamically from real decks
  const topicOptions = useMemo(() => {
    const topicSet = new Set<string>();
    for (const d of decks) {
      if (d.topicGroup?.trim()) topicSet.add(d.topicGroup.trim());
    }
    const list = [{ id: 'all', label: 'Tất cả chủ đề' }];
    for (const t of Array.from(topicSet).sort()) {
      list.push({ id: t, label: t });
    }
    return list;
  }, [decks]);

  // Filtered decks
  const filteredDecks = useMemo(() => {
    return decks.filter((deck) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        deck.name.toLowerCase().includes(q) ||
        deck.description?.toLowerCase().includes(q) ||
        deck.topicGroup?.toLowerCase().includes(q);

      const matchesTopic =
        selectedTopic === 'all' ||
        deck.topicGroup?.toLowerCase() === selectedTopic.toLowerCase();

      return matchesSearch && matchesTopic;
    });
  }, [decks, searchQuery, selectedTopic]);

  const totalExplorePages = Math.max(1, Math.ceil(filteredDecks.length / explorePageSize));
  const paginatedDecks = useMemo(() => {
    const start = (explorePage - 1) * explorePageSize;
    return filteredDecks.slice(start, start + explorePageSize);
  }, [filteredDecks, explorePage, explorePageSize]);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setExplorePage(1);
  };

  const handleTopicChange = (topic: string) => {
    setSelectedTopic(topic);
    setExplorePage(1);
  };

  const handleOpenPreview = async (deck: Deck) => {
    setPreviewDeck(deck);
    setPreviewWords([]);
    setPreviewCefrStats({});
    setPreviewLoading(true);

    try {
      const res = await api<PublicDeckPreview>(`/decks/public/${deck.id}`);
      if (res) {
        setPreviewWords(res.sampleWords || []);
        if (res.cefrStats) {
          setPreviewCefrStats(res.cefrStats);
        }
      }
    } catch (err) {
      notify.error('Lỗi xem trước', 'Không thể tải chi tiết bộ từ vựng này.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleForkDeck = async (deckId: string) => {
    if (!user) {
      setAuthPromptOpen(true);
      return;
    }

    setForkingDeckId(deckId);
    try {
      const res = await forkPublicDeck(deckId);
      setForkSuccessDeckId(deckId);
      notify.success(
        'Đã lưu thành công!',
        `Đã tạo bộ từ "${res.deck.name}" với ${res.importedCount} từ trong thư viện.`
      );
      setTimeout(() => {
        setForkSuccessDeckId(null);
        router.push('/study');
      }, 1000);
    } catch (err) {
      notify.error('Không thể lưu bộ từ', err instanceof Error ? err.message : 'Lỗi khi lưu bộ từ vào thư viện.');
    } finally {
      setForkingDeckId(null);
    }
  };

  return (
    <div className="min-h-screen bg-brand-canvas text-brand-ink flex flex-col selection:bg-brand-primarySoft selection:text-brand-primary">
      <PublicNavbar />

      {/* Main Content Area */}
      <main className="flex-1 py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-8">
        {/* Header Hero Banner */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-primarySoft text-brand-primary text-xs font-semibold">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Kho từ vựng FSRS-6 chuẩn hóa • 1-Click Import</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-brand-ink tracking-tight">
            Khám phá bộ từ vựng cộng đồng
          </h1>

          <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
            Tuyển chọn các bộ thẻ từ vựng thiết yếu theo chuẩn khung tham chiếu Châu Âu (CEFR A1 - C2), từ vựng học thuật IELTS và giao tiếp công sở. Lưu bất kỳ bộ từ nào về tài khoản cá nhân để ôn tập theo thuật toán FSRS-6.
          </p>
        </div>

        {/* Search & Topic Filters */}
        <div className="bg-surface-base p-4 sm:p-5 rounded-card border border-slate-200/90 shadow-xs space-y-3.5">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Search input */}
            <div className="relative flex-1 w-full">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Tìm kiếm theo tên bộ từ, chủ đề hoặc mô tả..."
                className="w-full pl-10 pr-4 py-2 bg-brand-canvas/60 border border-slate-200 rounded-control text-xs text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => handleSearchChange('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Total count badge */}
            <div className="text-xs font-semibold text-text-secondary px-3 py-2 bg-slate-100 rounded-lg whitespace-nowrap self-start sm:self-auto">
              Hiển thị: <strong className="text-brand-ink">{filteredDecks.length}</strong> bộ từ
            </div>
          </div>

          {/* Topic Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {topicOptions.map((topic) => (
              <button
                key={topic.id}
                type="button"
                onClick={() => handleTopicChange(topic.id)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all shrink-0 ${
                  selectedTopic === topic.id
                    ? 'bg-brand-primary text-white shadow-xs'
                    : 'bg-slate-100 text-text-secondary hover:text-brand-ink hover:bg-slate-200/70'
                }`}
              >
                {topic.label}
              </button>
            ))}
          </div>
        </div>

        {/* Loading Spinner */}
        {loading && (
          <div className="py-16 text-center space-y-3">
            <div className="w-8 h-8 border-3 border-brand-primary/20 border-t-brand-primary rounded-full animate-spin mx-auto" />
            <p className="text-xs text-text-secondary">Đang tải danh sách bộ từ vựng công khai...</p>
          </div>
        )}

        {/* Decks Grid */}
        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {paginatedDecks.map((deck) => {
              const isForking = forkingDeckId === deck.id;
              const isSuccess = forkSuccessDeckId === deck.id;
              const authorName = (deck as any).user?.displayName || 'Ban Biên Tập Vocelune';

              return (
                <div
                  key={deck.id}
                  className="bg-surface-base rounded-card border border-slate-200/90 shadow-card hover:shadow-elevated transition-all flex flex-col justify-between overflow-hidden group"
                >
                  {/* Deck Card Header */}
                  <div className="p-5 space-y-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div
                        className="w-10 h-10 rounded-control flex items-center justify-center text-white shadow-xs shrink-0 group-hover:scale-105 transition-transform"
                        style={{ backgroundColor: deck.color || '#5949E8' }}
                      >
                        <BookOpen className="w-5 h-5" />
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-brand-primarySoft text-brand-primary border border-brand-primary/10">
                          {deck.topicGroup || 'Tổng quát'}
                        </span>
                        {deck.itemCount !== undefined && (
                          <span className="text-[11px] text-text-secondary font-medium">
                            {deck.itemCount} thẻ từ
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <h3 className="font-extrabold text-base text-brand-ink group-hover:text-brand-primary transition-colors">
                        {deck.name}
                      </h3>
                      <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">
                        {deck.description || 'Bộ từ vựng tiếng Anh kèm phiên âm IPA, nghĩa tiếng Việt và ví dụ minh họa ngữ cảnh.'}
                      </p>
                    </div>

                    {/* Author & Fork Stats */}
                    <div className="pt-1 flex items-center justify-between text-[11px] text-text-secondary border-t border-slate-100">
                      <span className="flex items-center gap-1 font-medium truncate max-w-[160px]">
                        <Users className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{authorName}</span>
                      </span>
                      <span className="font-mono text-slate-400">
                        {(deck as any).forkCount || 0} lượt lưu
                      </span>
                    </div>
                  </div>

                  {/* Deck Card Footer Buttons */}
                  <div className="p-3.5 bg-slate-50/70 border-t border-slate-100 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenPreview(deck)}
                      className="flex-1 py-1.5 px-3 bg-white hover:bg-slate-100 border border-slate-200 rounded-control text-xs font-semibold text-brand-ink transition-colors flex items-center justify-center gap-1.5"
                    >
                      <span>Xem từ vựng</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleForkDeck(deck.id)}
                      disabled={isForking || isSuccess}
                      className="flex-1 py-1.5 px-3 bg-brand-primary hover:bg-brand-primaryHover disabled:opacity-60 text-white rounded-control text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5"
                    >
                      {isSuccess ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Đã lưu!</span>
                        </>
                      ) : isForking ? (
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5" />
                          <span>{user ? 'Lưu về học' : 'Bắt đầu học'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Explore Decks Pagination */}
        {!loading && filteredDecks.length > 0 && (
          <div className="pt-2">
            <Pagination
              currentPage={explorePage}
              totalPages={totalExplorePages}
              totalItems={filteredDecks.length}
              pageSize={explorePageSize}
              onPageChange={setExplorePage}
              onPageSizeChange={(newSize) => {
                setExplorePageSize(newSize);
                setExplorePage(1);
              }}
              pageSizeOptions={[6, 9, 12, 18]}
              itemLabel="bộ từ"
              className="rounded-card border border-slate-200"
            />
          </div>
        )}

        {/* Empty Search Result */}
        {!loading && filteredDecks.length === 0 && (
          <div className="p-12 text-center bg-surface-base rounded-card border border-slate-200 space-y-3">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="font-bold text-base text-brand-ink">
              Không tìm thấy bộ từ vựng phù hợp
            </h3>
            <p className="text-xs text-text-secondary max-w-sm mx-auto">
              Không có kết quả nào khớp với &ldquo;{searchQuery}&rdquo;. Hãy thử tìm với từ khóa chung hơn hoặc chọn danh mục khác.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedTopic('all');
              }}
              className="px-4 py-2 bg-brand-primarySoft text-brand-primary text-xs font-bold rounded-control hover:bg-brand-primarySoft/80 transition-colors"
            >
              Đặt lại bộ lọc
            </button>
          </div>
        )}
      </main>

      {/* Word Preview Modal */}
      {previewDeck && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-surface-base rounded-card shadow-modal max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-start justify-between gap-3 bg-gradient-to-r from-surface-base to-brand-canvas/30">
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold shadow-xs shrink-0"
                  style={{ backgroundColor: previewDeck.color || '#5949E8' }}
                >
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-base sm:text-lg text-brand-ink">
                      {previewDeck.name}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-primarySoft text-brand-primary">
                      {previewDeck.topicGroup || 'Chung'}
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary mt-1">
                    {previewDeck.description}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPreviewDeck(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* CEFR Distribution Chips */}
            {Object.keys(previewCefrStats).length > 0 && (
              <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2 text-xs flex-wrap">
                <span className="font-semibold text-text-secondary text-[11px]">Phân bổ CEFR:</span>
                {Object.entries(previewCefrStats).map(([lvl, count]) => (
                  <span
                    key={lvl}
                    className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-white border border-slate-200 text-brand-ink"
                  >
                    {lvl}: {count} từ
                  </span>
                ))}
              </div>
            )}

            {/* Modal Word List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 divide-y divide-slate-100">
              {previewLoading ? (
                <div className="py-12 text-center space-y-2">
                  <div className="w-6 h-6 border-2 border-brand-primary/20 border-t-brand-primary rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-text-secondary">Đang tải thẻ từ vựng mẫu...</p>
                </div>
              ) : (
                <>
                  <div className="text-xs font-bold uppercase tracking-wider text-text-secondary pb-1 flex items-center justify-between">
                    <span>Danh sách từ vựng tiêu biểu</span>
                    <span className="font-normal normal-case">
                      Hiển thị {previewWords.length} thẻ mẫu
                    </span>
                  </div>

                  {previewWords.map((item, idx) => (
                    <div key={idx} className="pt-3 space-y-1.5 text-left">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-base text-brand-ink font-mono">
                            {item.word}
                          </h4>
                          {item.cefr && item.cefr !== 'unknown' && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-brand-primarySoft text-brand-primary">
                              {item.cefr}
                            </span>
                          )}
                          {item.partOfSpeech && (
                            <span className="text-xs italic text-text-secondary">
                              ({item.partOfSpeech})
                            </span>
                          )}
                        </div>

                        {item.word && (
                          <AudioButton
                            text={item.word}
                            dialect="en-us"
                            size="sm"
                            showLabel
                          />
                        )}
                      </div>

                      {item.phonetic && (
                        <div className="text-xs font-mono text-slate-400">
                          {item.phonetic}
                        </div>
                      )}

                      {item.meaningVi && (
                        <div className="text-xs font-bold text-brand-ink">
                          {item.meaningVi}
                        </div>
                      )}

                      {item.definitionEn && (
                        <div className="text-xs text-text-secondary">
                          {item.definitionEn}
                        </div>
                      )}

                      {item.exampleEn && (
                        <div className="p-2.5 rounded-control bg-slate-50 text-xs italic text-slate-600 border border-slate-100">
                          &ldquo;{item.exampleEn}&rdquo;
                          {item.exampleVi && (
                            <div className="not-italic text-text-secondary mt-0.5 font-normal">
                              {item.exampleVi}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between gap-3">
              <span className="text-xs text-text-secondary hidden sm:inline">
                * Có thể sửa từ, ghi chú và thêm từ mới sau khi lưu về tài khoản.
              </span>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setPreviewDeck(null)}
                  className="flex-1 sm:flex-initial px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-control text-xs font-semibold text-brand-ink transition-colors"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const id = previewDeck.id;
                    setPreviewDeck(null);
                    void handleForkDeck(id);
                  }}
                  className="flex-1 sm:flex-initial px-5 py-2 bg-brand-primary hover:bg-brand-primaryHover text-white rounded-control text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{user ? 'Lưu về bàn học' : 'Bắt đầu học bộ này'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Guest Auth Prompt Modal */}
      {authPromptOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-surface-base rounded-card shadow-modal max-w-md w-full p-6 space-y-5 border border-slate-200 text-center">
            <div className="w-12 h-12 rounded-full bg-brand-primarySoft text-brand-primary mx-auto flex items-center justify-center">
              <Sparkles className="w-6 h-6" />
            </div>

            <div className="space-y-1.5">
              <h3 className="font-extrabold text-lg text-brand-ink">
                Đăng nhập để bắt đầu học
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Để lưu bộ từ vựng này và kích hoạt thuật toán FSRS-6 theo dõi tiến độ cá nhân của bạn, hãy tạo tài khoản miễn phí hoặc đăng nhập.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <Link
                href="/register?redirect=/explore"
                className="w-full py-2.5 px-4 bg-brand-primary hover:bg-brand-primaryHover text-white rounded-control font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors"
              >
                <span>Tạo tài khoản miễn phí ngay</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/login?redirect=/explore"
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-brand-ink rounded-control font-semibold text-xs flex items-center justify-center transition-colors"
              >
                Đã có tài khoản? Đăng nhập
              </Link>
            </div>

            <button
              type="button"
              onClick={() => setAuthPromptOpen(false)}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              Để sau, tôi muốn xem tiếp
            </button>
          </div>
        </div>
      )}

      <PublicFooter />
    </div>
  );
}
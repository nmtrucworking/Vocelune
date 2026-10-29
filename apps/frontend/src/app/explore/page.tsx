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
import { api } from '@/lib/api';
import { Deck, VocabItem, PublicDeckPreview } from '@/types';
import { INITIAL_DECKS, INITIAL_VOCAB } from '@/lib/seed-data';
import { AudioButton } from '@/components/common/AudioButton';
import { Pagination } from '@/components/common/Pagination';

// Additional curated public decks for rich offline / fallback experience
const EXTRA_CURATED_DECKS: (Deck & { previewTags?: string[]; cefrLevel?: string; isOfficial?: boolean })[] = [
  {
    id: 'deck_oxford',
    name: 'Oxford 3000™ Core',
    description: 'Từ vựng cốt lõi thiết yếu theo chuẩn khung tham chiếu Châu Âu (CEFR A1-B2). Nền tảng giao tiếp và học thuật vững chắc.',
    color: '#5949E8',
    icon: 'BookOpen',
    topicGroup: 'Oxford 3000™',
    itemCount: 200,
    cefrLevel: 'A1 - B2',
    isOfficial: true,
    previewTags: ['abandon', 'adequate', 'clarify', 'crucial', 'sustain'],
    createdAt: '2026-10-01T08:00:00.000Z',
  },
  {
    id: 'deck_ielts',
    name: 'IELTS Academic High-Frequency',
    description: 'Bộ từ vựng học thuật tần suất cao trong bài thi IELTS Reading & Writing Band 7.0+, giúp nâng cao độ chính xác Lexical Resource.',
    color: '#1B786E',
    icon: 'GraduationCap',
    topicGroup: 'IELTS Academic',
    itemCount: 150,
    cefrLevel: 'B2 - C1',
    isOfficial: true,
    previewTags: ['resilient', 'meticulous', 'pragmatic', 'scrutinize', 'mitigate'],
    createdAt: '2026-10-05T08:00:00.000Z',
  },
  {
    id: 'deck_business',
    name: 'Business Communication',
    description: 'Từ vựng giao tiếp, đàm phán, thuyết trình và trao đổi thương mại quốc tế trong môi trường doanh nghiệp hiện đại.',
    color: '#9B5B0E',
    icon: 'Briefcase',
    topicGroup: 'Business & Work',
    itemCount: 120,
    cefrLevel: 'B2 - C1',
    isOfficial: true,
    previewTags: ['synergy', 'leverage', 'benchmark', 'stakeholder', 'contingency'],
    createdAt: '2026-10-10T08:00:00.000Z',
  },
  {
    id: 'deck_tech',
    name: 'Tech & Software Engineering',
    description: 'Thuật ngữ và từ vựng chuyên ngành công nghệ phần mềm, kiến trúc hệ thống, đám mây, dữ liệu và quy trình Agile.',
    color: '#2B59C3',
    icon: 'Code2',
    topicGroup: 'Công nghệ & IT',
    itemCount: 95,
    cefrLevel: 'B2 - C2',
    isOfficial: true,
    previewTags: ['idempotent', 'asynchronous', 'scalability', 'refactor', 'concurrency'],
    createdAt: '2026-10-18T08:00:00.000Z',
  },
  {
    id: 'deck_idioms',
    name: 'Everyday Collocations & Idioms',
    description: 'Các cụm từ cố định và thành ngữ phổ biến nhất trong giao tiếp tự nhiên của người bản xứ Anh - Mỹ.',
    color: '#E11D48',
    icon: 'Sparkles',
    topicGroup: 'Giao tiếp hàng ngày',
    itemCount: 80,
    cefrLevel: 'B1 - B2',
    isOfficial: true,
    previewTags: ['see eye to eye', 'hit the ground running', 'bite the bullet', 'touch base'],
    createdAt: '2026-10-22T08:00:00.000Z',
  },
];

// Fallback sample cards for previewing decks when backend is offline
const SAMPLE_PREVIEW_ITEMS: Record<string, Partial<VocabItem>[]> = {
  deck_oxford: [
    {
      word: 'abandon',
      phonetic: '/əˈbæn.dən/',
      partOfSpeech: 'verb',
      meaningVi: 'Từ bỏ, bỏ rơi, dừng làm gì đó giữa chừng',
      definitionEn: 'To leave a place, thing, or person, usually for ever; to stop doing an activity.',
      exampleEn: 'The crew had to abandon the sinking ship before rescue arrived.',
      exampleVi: 'Thủy thủ đoàn phải rời bỏ con tàu đang chìm trước khi đội cứu hộ đến.',
      cefr: 'B2',
    },
    {
      word: 'adequate',
      phonetic: '/ˈæd.ə.kwət/',
      partOfSpeech: 'adjective',
      meaningVi: 'Đầy đủ, thỏa đáng, đáp ứng được yêu cầu',
      definitionEn: 'Enough or satisfactory for a particular purpose.',
      exampleEn: 'The room was small but adequate for our needs.',
      exampleVi: 'Căn phòng nhỏ nhưng đủ dùng cho nhu cầu của chúng tôi.',
      cefr: 'B1',
    },
    {
      word: 'clarify',
      phonetic: '/ˈklær.ɪ.faɪ/',
      partOfSpeech: 'verb',
      meaningVi: 'Làm rõ, giải thích rõ ràng hơn',
      definitionEn: 'To make something clear or easier to understand.',
      exampleEn: 'Could you clarify the second point in your proposal?',
      exampleVi: 'Bạn có thể làm rõ điểm thứ hai trong đề xuất không?',
      cefr: 'B2',
    },
    {
      word: 'crucial',
      phonetic: '/ˈkruː.ʃəl/',
      partOfSpeech: 'adjective',
      meaningVi: 'Cực kỳ quan trọng, mang tính quyết định',
      definitionEn: 'Extremely important or necessary.',
      exampleEn: 'Early diagnosis is crucial for successful treatment.',
      exampleVi: 'Chẩn đoán sớm có ý nghĩa quyết định đối với việc điều trị thành công.',
      cefr: 'B2',
    },
  ],
  deck_ielts: [
    {
      word: 'resilient',
      phonetic: '/rɪˈzɪl.jənt/',
      partOfSpeech: 'adjective',
      meaningVi: 'Kiên cường, có khả năng phục hồi nhanh sau khó khăn',
      definitionEn: 'Able to be happy, successful, etc. again after something difficult happens.',
      exampleEn: 'Local communities have proven remarkably resilient in the face of economic hardship.',
      exampleVi: 'Cộng đồng địa phương đã chứng tỏ sự kiên cường đáng nể khi đối mặt với khó khăn kinh tế.',
      cefr: 'C1',
    },
    {
      word: 'meticulous',
      phonetic: '/məˈtɪk.jə.ləs/',
      partOfSpeech: 'adjective',
      meaningVi: 'Tỉ mỉ, cẩn trọng từng chi tiết nhỏ',
      definitionEn: 'Very careful and with great attention to every detail.',
      exampleEn: 'The researcher kept meticulous records of every experiment.',
      exampleVi: 'Nhà nghiên cứu đã ghi chép cực kỳ tỉ mỉ từng thí nghiệm.',
      cefr: 'C1',
    },
    {
      word: 'pragmatic',
      phonetic: '/præɡˈmæt.ɪk/',
      partOfSpeech: 'adjective',
      meaningVi: 'Thực tế, thực dụng, đề cao tính ứng dụng hơn lý thuyết',
      definitionEn: 'Solving problems in a sensible way that suits the conditions that really exist.',
      exampleEn: 'We need a pragmatic approach to tackling climate change.',
      exampleVi: 'Chúng ta cần một hướng tiếp cận thực tế để giải quyết vấn đề biến đổi khí hậu.',
      cefr: 'C1',
    },
    {
      word: 'scrutinize',
      phonetic: '/ˈskruː.tɪ.naɪz/',
      partOfSpeech: 'verb',
      meaningVi: 'Xem xét kỹ lưỡng, kiểm tra tỉ mỉ',
      definitionEn: 'To examine something very carefully in order to discover information.',
      exampleEn: 'The committee will scrutinize all budget proposals before approval.',
      exampleVi: 'Ủy ban sẽ xem xét kỹ lưỡng mọi đề xuất ngân sách trước khi phê duyệt.',
      cefr: 'C1',
    },
  ],
  deck_business: [
    {
      word: 'synergy',
      phonetic: '/ˈsɪn.ə.dʒi/',
      partOfSpeech: 'noun',
      meaningVi: 'Hiệu ứng cộng hưởng, sức mạnh tổng hợp',
      definitionEn: 'The combined power of a group of things when they are working together that is greater than the total power achieved separately.',
      exampleEn: 'The merger will create synergies across marketing and distribution channels.',
      exampleVi: 'Thương vụ sáp nhập sẽ tạo ra hiệu ứng cộng hưởng trên các kênh phân phối và tiếp thị.',
      cefr: 'C1',
    },
    {
      word: 'leverage',
      phonetic: '/ˈliː.vər.ɪdʒ/',
      partOfSpeech: 'verb',
      meaningVi: 'Tận dụng tối đa đòn bẩy hoặc nguồn lực có sẵn',
      definitionEn: 'To use something that you have to achieve something else.',
      exampleEn: 'We can leverage our existing customer base to launch the new product line.',
      exampleVi: 'Chúng ta có thể tận dụng tệp khách hàng hiện tại để ra mắt dòng sản phẩm mới.',
      cefr: 'B2',
    },
    {
      word: 'benchmark',
      phonetic: '/ˈbentʃ.mɑːk/',
      partOfSpeech: 'noun',
      meaningVi: 'Tiêu chuẩn đối sánh, mốc tham chiếu chuẩn',
      definitionEn: 'A level of quality that can be used as a standard when comparing other things.',
      exampleEn: 'Our performance metrics serve as the industry benchmark.',
      exampleVi: 'Các chỉ số hiệu suất của chúng tôi đóng vai trò là mốc đối sánh chuẩn cho ngành.',
      cefr: 'B2',
    },
  ],
  deck_tech: [
    {
      word: 'idempotent',
      phonetic: '/ˌaɪ.dəmˈpoʊ.tənt/',
      partOfSpeech: 'adjective',
      meaningVi: 'Tính chất lũy đẳng (thực thi nhiều lần cho kết quả giống thực thi 1 lần)',
      definitionEn: 'Denoting an operation that can be applied multiple times without changing the result beyond the initial application.',
      exampleEn: 'HTTP PUT requests should be designed to be idempotent.',
      exampleVi: 'Các yêu cầu HTTP PUT cần được thiết kế để đảm bảo tính lũy đẳng.',
      cefr: 'C2',
    },
    {
      word: 'asynchronous',
      phonetic: '/eɪˈsɪŋ.krə.nəs/',
      partOfSpeech: 'adjective',
      meaningVi: 'Bất đồng bộ (không cùng thời điểm, không chờ đợi)',
      definitionEn: 'Not existing or occurring at the same time; running independently.',
      exampleEn: 'Message queues enable asynchronous processing of heavy workloads.',
      exampleVi: 'Hàng đợi tin nhắn cho phép xử lý bất đồng bộ các tác vụ nặng.',
      cefr: 'C1',
    },
  ],
};

export default function ExplorePage() {
  const router = useRouter();
  const { user, forkPublicDeck } = useVocelune();

  const [decks, setDecks] = useState<Deck[]>(EXTRA_CURATED_DECKS);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('all');
  const [explorePage, setExplorePage] = useState(1);
  const [explorePageSize, setExplorePageSize] = useState(6);
  const [previewDeck, setPreviewDeck] = useState<Deck | null>(null);
  const [previewWords, setPreviewWords] = useState<Partial<VocabItem>[]>([]);
  const [forkingDeckId, setForkingDeckId] = useState<string | null>(null);
  const [forkSuccessDeckId, setForkSuccessDeckId] = useState<string | null>(null);
  const [authPromptOpen, setAuthPromptOpen] = useState(false);

  // Load public decks from backend, falling back to curated list
  useEffect(() => {
    let active = true;
    setLoading(true);

    api<{ items: Deck[] }>('/decks/public')
      .then((res) => {
        if (active && res.items && res.items.length > 0) {
          setDecks(res.items);
        }
      })
      .catch(() => {
        // Graceful fallback to rich curated decks
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // Filtered decks
  const filteredDecks = useMemo(() => {
    return decks.filter((deck) => {
      const matchesSearch =
        searchQuery === '' ||
        deck.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        deck.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        deck.topicGroup?.toLowerCase().includes(searchQuery.toLowerCase());

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

  const topicOptions = [
    { id: 'all', label: 'Tất cả chủ đề' },
    { id: 'Oxford 3000™', label: 'Oxford 3000™' },
    { id: 'IELTS Academic', label: 'IELTS Academic' },
    { id: 'Business & Work', label: 'Business & Work' },
    { id: 'Công nghệ & IT', label: 'Công nghệ & IT' },
    { id: 'Giao tiếp hàng ngày', label: 'Giao tiếp hàng ngày' },
  ];

  const handleOpenPreview = async (deck: Deck) => {
    setPreviewDeck(deck);

    // Try fetching preview from API
    try {
      const res = await api<PublicDeckPreview>(`/decks/public/${deck.id}`);
      if (res && res.sampleWords && res.sampleWords.length > 0) {
        setPreviewWords(res.sampleWords);
        return;
      }
    } catch {
      // Fallback
    }

    // Fallback to sample items
    const fallbackList = SAMPLE_PREVIEW_ITEMS[deck.id] || INITIAL_VOCAB.slice(0, 5);
    setPreviewWords(fallbackList);
  };

  const handleForkDeck = async (deckId: string) => {
    if (!user) {
      setAuthPromptOpen(true);
      return;
    }

    setForkingDeckId(deckId);
    try {
      await forkPublicDeck(deckId);
      setForkSuccessDeckId(deckId);
      setTimeout(() => {
        setForkSuccessDeckId(null);
        router.push('/study');
      }, 1200);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Không thể lưu bộ từ vào thư viện.');
    } finally {
      setForkingDeckId(null);
    }
  };

  return (
    <div className="min-h-screen bg-brand-canvas text-brand-ink flex flex-col selection:bg-brand-primarySoft selection:text-brand-primary">
      <PublicNavbar />

      {/* Main Content Area */}
      <main className="flex-1 py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-10">
        {/* Header Hero Banner */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-primarySoft text-brand-primary text-xs font-semibold">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Kho từ vựng chuẩn hóa • Miễn phí & Sẵn sàng học</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-brand-ink tracking-tight">
            Khám phá bộ từ vựng mẫu
          </h1>

          <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
            Tuyển chọn các bộ thẻ từ vựng thiết yếu theo chuẩn khung tham chiếu Châu Âu (CEFR), từ vựng học thuật IELTS và giao tiếp công sở. Chọn bất kỳ bộ từ nào để xem trước và lưu về bàn học cá nhân.
          </p>
        </div>

        {/* Search & Topic Filters */}
        <div className="bg-surface-base p-4 sm:p-5 rounded-card border border-slate-200/90 shadow-xs space-y-4">
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
                placeholder="Tìm kiếm theo tên bộ từ, mô tả hoặc từ khóa..."
                className="w-full pl-10 pr-4 py-2.5 bg-brand-canvas/60 border border-slate-200 rounded-control text-xs text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all"
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

        {/* Decks Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paginatedDecks.map((deck) => {
            const isForking = forkingDeckId === deck.id;
            const isSuccess = forkSuccessDeckId === deck.id;

            return (
              <div
                key={deck.id}
                className="bg-surface-base rounded-card border border-slate-200/90 shadow-card hover:shadow-elevated transition-all flex flex-col justify-between overflow-hidden group"
              >
                {/* Deck Card Header */}
                <div className="p-5 sm:p-6 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className="w-11 h-11 rounded-control flex items-center justify-center text-white shadow-xs shrink-0 group-hover:scale-105 transition-transform"
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

                  <div className="space-y-1.5">
                    <h3 className="font-extrabold text-base sm:text-lg text-brand-ink group-hover:text-brand-primary transition-colors">
                      {deck.name}
                    </h3>
                    <p className="text-xs text-text-secondary line-clamp-3 leading-relaxed">
                      {deck.description || 'Bộ từ vựng tiếng Anh kèm phiên âm IPA, nghĩa tiếng Việt và ví dụ minh họa ngữ cảnh.'}
                    </p>
                  </div>

                  {/* Sample words preview */}
                  {'previewTags' in deck && Array.isArray((deck as unknown as { previewTags: string[] }).previewTags) && (
                    <div className="pt-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-text-secondary mb-1.5">
                        Từ vựng tiêu biểu:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {((deck as unknown as { previewTags: string[] }).previewTags).map((w) => (
                          <span
                            key={w}
                            className="px-2 py-0.5 rounded bg-slate-100 text-brand-ink text-[11px] font-mono"
                          >
                            {w}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Deck Card Footer Buttons */}
                <div className="p-4 bg-slate-50/70 border-t border-slate-100 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenPreview(deck)}
                    className="flex-1 py-2 px-3 bg-white hover:bg-slate-100 border border-slate-200 rounded-control text-xs font-semibold text-brand-ink transition-colors flex items-center justify-center gap-1.5"
                  >
                    <span>Xem từ vựng</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleForkDeck(deck.id)}
                    disabled={isForking || isSuccess}
                    className="flex-1 py-2 px-3 bg-brand-primary hover:bg-brand-primaryHover disabled:opacity-60 text-white rounded-control text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5"
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

        {/* Explore Decks Pagination */}
        {filteredDecks.length > 0 && (
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
        {filteredDecks.length === 0 && (
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

            {/* Modal Word List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 divide-y divide-slate-100">
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
                      {item.cefr && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-brand-primarySoft text-brand-primary">
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

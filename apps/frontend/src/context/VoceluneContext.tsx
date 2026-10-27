'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  VocabItem,
  Deck,
  Card,
  ReviewLog,
  TestAttempt,
  UserSettings,
  FSRSRating,
  DailyActivity,
} from '@/types';
import { INITIAL_DECKS, INITIAL_SETTINGS, INITIAL_VOCAB, createInitialCards } from '@/lib/seed-data';
import { applyFSRSReview, createNewVoceluneCard } from '@/lib/fsrs-engine';

const STORAGE_KEYS = {
  VOCAB: 'vocelune_vocab_v1',
  DECKS: 'vocelune_decks_v1',
  CARDS: 'vocelune_cards_v1',
  LOGS: 'vocelune_review_logs_v1',
  TESTS: 'vocelune_test_attempts_v1',
  SETTINGS: 'vocelune_settings_v1',
};

interface VoceluneContextType {
  vocabItems: VocabItem[];
  decks: Deck[];
  cards: Card[];
  reviewLogs: ReviewLog[];
  testAttempts: TestAttempt[];
  settings: UserSettings;
  isLoaded: boolean;
  canUndo: boolean;

  // Actions
  addVocabItem: (item: Omit<VocabItem, 'id' | 'createdAt' | 'updatedAt'>) => VocabItem;
  updateVocabItem: (id: string, updates: Partial<VocabItem>) => void;
  deleteVocabItem: (id: string) => void;

  addDeck: (deck: Omit<Deck, 'id' | 'createdAt'>) => Deck;
  updateDeck: (id: string, updates: Partial<Deck>) => void;
  deleteDeck: (id: string) => void;

  gradeCard: (cardId: string, rating: FSRSRating, durationMs?: number) => void;
  undoLastReview: () => boolean;
  toggleSuspendCard: (cardId: string) => void;

  saveTestAttempt: (attempt: TestAttempt) => void;
  applyTestToSRS: (attemptId: string) => void;

  importVocabItems: (items: Partial<VocabItem>[], deckId?: string) => { created: number; updated: number; skipped: number };
  updateSettings: (updates: Partial<UserSettings>) => void;
  resetAllData: () => void;

  // Computed
  dueCards: Card[];
  newCards: Card[];
  learningCards: Card[];
  reviewCards: Card[];
  streak: number;
  observedRetention: number;
  weakWords: { vocab: VocabItem; lapses: number; reps: number }[];
  todayReviewsCount: number;
  activityHeatmap: DailyActivity[];
}

const VoceluneContext = createContext<VoceluneContextType | undefined>(undefined);

export function VoceluneProvider({ children }: { children: React.ReactNode }) {
  const [vocabItems, setVocabItems] = useState<VocabItem[]>([]);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [reviewLogs, setReviewLogs] = useState<ReviewLog[]>([]);
  const [testAttempts, setTestAttempts] = useState<TestAttempt[]>([]);
  const [settings, setSettings] = useState<UserSettings>(INITIAL_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Snapshot for undoing last review
  const [lastReviewSnapshot, setLastReviewSnapshot] = useState<{
    cardBefore: Card;
    logId: string;
  } | null>(null);

  // Initialize from LocalStorage or Seeds
  useEffect(() => {
    try {
      const storedVocab = localStorage.getItem(STORAGE_KEYS.VOCAB);
      const storedDecks = localStorage.getItem(STORAGE_KEYS.DECKS);
      const storedCards = localStorage.getItem(STORAGE_KEYS.CARDS);
      const storedLogs = localStorage.getItem(STORAGE_KEYS.LOGS);
      const storedTests = localStorage.getItem(STORAGE_KEYS.TESTS);
      const storedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);

      if (storedVocab) {
        setVocabItems(JSON.parse(storedVocab));
      } else {
        setVocabItems(INITIAL_VOCAB);
        localStorage.setItem(STORAGE_KEYS.VOCAB, JSON.stringify(INITIAL_VOCAB));
      }

      if (storedDecks) {
        setDecks(JSON.parse(storedDecks));
      } else {
        setDecks(INITIAL_DECKS);
        localStorage.setItem(STORAGE_KEYS.DECKS, JSON.stringify(INITIAL_DECKS));
      }

      if (storedCards) {
        setCards(JSON.parse(storedCards));
      } else {
        const seededCards = createInitialCards(storedVocab ? JSON.parse(storedVocab) : INITIAL_VOCAB);
        setCards(seededCards);
        localStorage.setItem(STORAGE_KEYS.CARDS, JSON.stringify(seededCards));
      }

      if (storedLogs) {
        setReviewLogs(JSON.parse(storedLogs));
      } else {
        // Generate a few initial review logs for the last 5 days
        const mockLogs: ReviewLog[] = [
          {
            id: 'log_seed_1',
            cardId: 'card_vocab_1_en_vi',
            rating: 3,
            reviewedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
            beforeState: 'learning',
            afterState: 'review',
            durationMs: 4200,
          },
          {
            id: 'log_seed_2',
            cardId: 'card_vocab_2_en_vi',
            rating: 4,
            reviewedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
            beforeState: 'new',
            afterState: 'review',
            durationMs: 3100,
          },
          {
            id: 'log_seed_3',
            cardId: 'card_vocab_3_en_vi',
            rating: 3,
            reviewedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
            beforeState: 'review',
            afterState: 'review',
            durationMs: 5100,
          },
        ];
        setReviewLogs(mockLogs);
        localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(mockLogs));
      }

      if (storedTests) {
        setTestAttempts(JSON.parse(storedTests));
      }

      if (storedSettings) {
        setSettings(JSON.parse(storedSettings));
      } else {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(INITIAL_SETTINGS));
      }
    } catch (err) {
      console.error('Failed to load storage, initializing fallback', err);
      setVocabItems(INITIAL_VOCAB);
      setDecks(INITIAL_DECKS);
      setCards(createInitialCards(INITIAL_VOCAB));
      setSettings(INITIAL_SETTINGS);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Sync state changes to localStorage
  const syncToStorage = useCallback((key: string, data: unknown) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error(`Error saving to localStorage key ${key}:`, e);
    }
  }, []);

  const addVocabItem = useCallback(
    (item: Omit<VocabItem, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString();
      const newItem: VocabItem = {
        ...item,
        id: `vocab_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        createdAt: now,
        updatedAt: now,
      };

      const updatedVocab = [newItem, ...vocabItems];
      setVocabItems(updatedVocab);
      syncToStorage(STORAGE_KEYS.VOCAB, updatedVocab);

      // Auto-generate active recall card
      const newCard = createNewVoceluneCard(newItem.id, 'en_vi');
      const updatedCards = [...cards, newCard];
      setCards(updatedCards);
      syncToStorage(STORAGE_KEYS.CARDS, updatedCards);

      return newItem;
    },
    [vocabItems, cards, syncToStorage]
  );

  const updateVocabItem = useCallback(
    (id: string, updates: Partial<VocabItem>) => {
      const updated = vocabItems.map((item) =>
        item.id === id ? { ...item, ...updates, updatedAt: new Date().toISOString() } : item
      );
      setVocabItems(updated);
      syncToStorage(STORAGE_KEYS.VOCAB, updated);
    },
    [vocabItems, syncToStorage]
  );

  const deleteVocabItem = useCallback(
    (id: string) => {
      const updatedVocab = vocabItems.filter((i) => i.id !== id);
      const updatedCards = cards.filter((c) => c.vocabItemId !== id);
      setVocabItems(updatedVocab);
      setCards(updatedCards);
      syncToStorage(STORAGE_KEYS.VOCAB, updatedVocab);
      syncToStorage(STORAGE_KEYS.CARDS, updatedCards);
    },
    [vocabItems, cards, syncToStorage]
  );

  const addDeck = useCallback(
    (deck: Omit<Deck, 'id' | 'createdAt'>) => {
      const newDeck: Deck = {
        ...deck,
        id: `deck_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        createdAt: new Date().toISOString(),
      };
      const updated = [...decks, newDeck];
      setDecks(updated);
      syncToStorage(STORAGE_KEYS.DECKS, updated);
      return newDeck;
    },
    [decks, syncToStorage]
  );

  const updateDeck = useCallback(
    (id: string, updates: Partial<Deck>) => {
      const updated = decks.map((d) => (d.id === id ? { ...d, ...updates } : d));
      setDecks(updated);
      syncToStorage(STORAGE_KEYS.DECKS, updated);
    },
    [decks, syncToStorage]
  );

  const deleteDeck = useCallback(
    (id: string) => {
      const updated = decks.filter((d) => d.id !== id);
      setDecks(updated);
      syncToStorage(STORAGE_KEYS.DECKS, updated);
    },
    [decks, syncToStorage]
  );

  // FSRS Grade Card
  const gradeCard = useCallback(
    (cardId: string, rating: FSRSRating, durationMs: number = 4000) => {
      const card = cards.find((c) => c.id === cardId);
      if (!card) return;

      const now = new Date();
      const beforeState = card.state;
      const { updatedCard, nextState } = applyFSRSReview(
        card,
        rating,
        now,
        settings.desiredRetention
      );

      const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newLog: ReviewLog = {
        id: logId,
        cardId: card.id,
        rating,
        reviewedAt: now.toISOString(),
        beforeState,
        afterState: nextState,
        durationMs,
      };

      // Keep snapshot for Undo
      setLastReviewSnapshot({
        cardBefore: { ...card },
        logId,
      });

      const updatedCards = cards.map((c) => (c.id === cardId ? updatedCard : c));
      const updatedLogs = [newLog, ...reviewLogs];

      setCards(updatedCards);
      setReviewLogs(updatedLogs);
      syncToStorage(STORAGE_KEYS.CARDS, updatedCards);
      syncToStorage(STORAGE_KEYS.LOGS, updatedLogs);
    },
    [cards, reviewLogs, settings.desiredRetention, syncToStorage]
  );

  // Undo Last Review (Atomic & audit logged)
  const undoLastReview = useCallback(() => {
    if (!lastReviewSnapshot) return false;

    const { cardBefore, logId } = lastReviewSnapshot;

    // Restore card before state
    const updatedCards = cards.map((c) => (c.id === cardBefore.id ? cardBefore : c));

    // Mark log as voided (immutable audit principle)
    const updatedLogs = reviewLogs.map((l) =>
      l.id === logId ? { ...l, voidedAt: new Date().toISOString() } : l
    );

    setCards(updatedCards);
    setReviewLogs(updatedLogs);
    setLastReviewSnapshot(null);

    syncToStorage(STORAGE_KEYS.CARDS, updatedCards);
    syncToStorage(STORAGE_KEYS.LOGS, updatedLogs);

    return true;
  }, [lastReviewSnapshot, cards, reviewLogs, syncToStorage]);

  const toggleSuspendCard = useCallback(
    (cardId: string) => {
      const updated = cards.map((c) =>
        c.id === cardId ? { ...c, suspended: !c.suspended } : c
      );
      setCards(updated);
      syncToStorage(STORAGE_KEYS.CARDS, updated);
    },
    [cards, syncToStorage]
  );

  const saveTestAttempt = useCallback(
    (attempt: TestAttempt) => {
      const updated = [attempt, ...testAttempts];
      setTestAttempts(updated);
      syncToStorage(STORAGE_KEYS.TESTS, updated);
    },
    [testAttempts, syncToStorage]
  );

  const applyTestToSRS = useCallback(
    (attemptId: string) => {
      const attempt = testAttempts.find((t) => t.id === attemptId);
      if (!attempt) return;

      attempt.questions.forEach((q) => {
        const card = cards.find((c) => c.vocabItemId === q.vocabId);
        if (card) {
          const rating: FSRSRating = q.isCorrect ? 3 : 1;
          gradeCard(card.id, rating, 3000);
        }
      });
    },
    [testAttempts, cards, gradeCard]
  );

  const importVocabItems = useCallback(
    (items: Partial<VocabItem>[], targetDeckId?: string) => {
      let created = 0;
      let updated = 0;
      let skipped = 0;

      const fallbackDeckId = targetDeckId || decks[0]?.id || 'deck_oxford';
      const existingMap = new Map(vocabItems.map((v) => [v.word.toLowerCase().trim(), v]));
      const newItems: VocabItem[] = [];
      const updatedItemsList = [...vocabItems];

      items.forEach((item) => {
        if (!item.word || !item.partOfSpeech) {
          skipped++;
          return;
        }

        const normalizedWord = item.word.toLowerCase().trim();
        const existing = existingMap.get(normalizedWord);

        if (existing) {
          // Merge / update
          const index = updatedItemsList.findIndex((v) => v.id === existing.id);
          if (index !== -1) {
            updatedItemsList[index] = {
              ...existing,
              meaningVi: item.meaningVi || existing.meaningVi,
              definitionEn: item.definitionEn || existing.definitionEn,
              exampleEn: item.exampleEn || existing.exampleEn,
              exampleVi: item.exampleVi || existing.exampleVi,
              phonetic: item.phonetic || existing.phonetic,
              cefr: item.cefr || existing.cefr,
              updatedAt: new Date().toISOString(),
            };
            updated++;
          }
        } else {
          // Create new
          const now = new Date().toISOString();
          const newItem: VocabItem = {
            id: `vocab_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            word: item.word.trim(),
            phonetic: item.phonetic || `/${item.word.trim()}/`,
            dialect: item.dialect || 'en-us',
            partOfSpeech: item.partOfSpeech || 'noun',
            definitionEn: item.definitionEn || '',
            meaningVi: item.meaningVi || '',
            exampleEn: item.exampleEn || '',
            exampleVi: item.exampleVi || '',
            cefr: item.cefr || 'unknown',
            cefrSource: 'manual',
            deckId: item.deckId || fallbackDeckId,
            tags: item.tags || ['imported'],
            notes: item.notes || '',
            createdAt: now,
            updatedAt: now,
          };
          newItems.push(newItem);
          created++;
        }
      });

      const finalVocab = [...newItems, ...updatedItemsList];
      setVocabItems(finalVocab);
      syncToStorage(STORAGE_KEYS.VOCAB, finalVocab);

      // Create cards for new items
      if (newItems.length > 0) {
        const newCardsList = newItems.map((v) => createNewVoceluneCard(v.id, 'en_vi'));
        const finalCards = [...cards, ...newCardsList];
        setCards(finalCards);
        syncToStorage(STORAGE_KEYS.CARDS, finalCards);
      }

      return { created, updated, skipped };
    },
    [vocabItems, decks, cards, syncToStorage]
  );

  const updateSettings = useCallback(
    (updates: Partial<UserSettings>) => {
      const updated = { ...settings, ...updates };
      setSettings(updated);
      syncToStorage(STORAGE_KEYS.SETTINGS, updated);
    },
    [settings, syncToStorage]
  );

  const resetAllData = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.VOCAB);
    localStorage.removeItem(STORAGE_KEYS.DECKS);
    localStorage.removeItem(STORAGE_KEYS.CARDS);
    localStorage.removeItem(STORAGE_KEYS.LOGS);
    localStorage.removeItem(STORAGE_KEYS.TESTS);
    localStorage.removeItem(STORAGE_KEYS.SETTINGS);

    setVocabItems(INITIAL_VOCAB);
    setDecks(INITIAL_DECKS);
    setCards(createInitialCards(INITIAL_VOCAB));
    setReviewLogs([]);
    setTestAttempts([]);
    setSettings(INITIAL_SETTINGS);
    setLastReviewSnapshot(null);
  }, []);

  // COMPUTED PROPERTIES
  const now = new Date();

  // Due cards: cards scheduled at or before now, not suspended
  const dueCards = useMemo(() => {
    return cards.filter((c) => !c.suspended && new Date(c.dueAt).getTime() <= now.getTime());
  }, [cards, now]);

  const newCards = useMemo(() => cards.filter((c) => c.state === 'new'), [cards]);
  const learningCards = useMemo(
    () => cards.filter((c) => c.state === 'learning' || c.state === 'relearning'),
    [cards]
  );
  const reviewCards = useMemo(() => cards.filter((c) => c.state === 'review'), [cards]);

  // Streak: consecutive days with at least 1 valid review log
  const streak = useMemo(() => {
    const validLogs = reviewLogs.filter((l) => !l.voidedAt);
    if (validLogs.length === 0) return 0;

    const daysSet = new Set(
      validLogs.map((l) => new Date(l.reviewedAt).toISOString().split('T')[0])
    );

    let count = 0;
    const checkDate = new Date();

    while (true) {
      const dateStr = checkDate.toISOString().split('T')[0];
      if (daysSet.has(dateStr)) {
        count++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        // If today has no review yet, check if yesterday did
        if (count === 0) {
          checkDate.setDate(checkDate.getDate() - 1);
          const yesterdayStr = checkDate.toISOString().split('T')[0];
          if (daysSet.has(yesterdayStr)) {
            count++;
            checkDate.setDate(checkDate.getDate() - 1);
            continue;
          }
        }
        break;
      }
    }
    return count;
  }, [reviewLogs]);

  // Observed Retention Rate: % of reviews rated Good (3) or Easy (4)
  const observedRetention = useMemo(() => {
    const validLogs = reviewLogs.filter((l) => !l.voidedAt);
    if (validLogs.length === 0) return 92; // default projected
    const successful = validLogs.filter((l) => l.rating >= 3).length;
    return Math.round((successful / validLogs.length) * 100);
  }, [reviewLogs]);

  // Weak words: words with highest lapses or Again ratings
  const weakWords = useMemo(() => {
    const vocabMap = new Map(vocabItems.map((v) => [v.id, v]));
    const results: { vocab: VocabItem; lapses: number; reps: number }[] = [];

    cards.forEach((card) => {
      const vocab = vocabMap.get(card.vocabItemId);
      if (vocab && card.lapses > 0) {
        results.push({
          vocab,
          lapses: card.lapses,
          reps: card.reps,
        });
      }
    });

    return results.sort((a, b) => b.lapses - a.lapses).slice(0, 5);
  }, [cards, vocabItems]);

  // Today's reviews count
  const todayReviewsCount = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return reviewLogs.filter(
      (l) => !l.voidedAt && l.reviewedAt.split('T')[0] === todayStr
    ).length;
  }, [reviewLogs]);

  // Heatmap for the past 60 days
  const activityHeatmap = useMemo(() => {
    const countsMap = new Map<string, { count: number; successCount: number }>();
    const validLogs = reviewLogs.filter((l) => !l.voidedAt);

    validLogs.forEach((l) => {
      const d = l.reviewedAt.split('T')[0];
      const current = countsMap.get(d) || { count: 0, successCount: 0 };
      countsMap.set(d, {
        count: current.count + 1,
        successCount: current.successCount + (l.rating >= 3 ? 1 : 0),
      });
    });

    const days: DailyActivity[] = [];
    const d = new Date();
    d.setDate(d.getDate() - 41); // last 6 weeks (42 days)

    for (let i = 0; i < 42; i++) {
      const dateStr = d.toISOString().split('T')[0];
      const data = countsMap.get(dateStr) || { count: 0, successCount: 0 };
      days.push({
        date: dateStr,
        count: data.count,
        successCount: data.successCount,
      });
      d.setDate(d.getDate() + 1);
    }

    return days;
  }, [reviewLogs]);

  return (
    <VoceluneContext.Provider
      value={{
        vocabItems,
        decks,
        cards,
        reviewLogs,
        testAttempts,
        settings,
        isLoaded,
        canUndo: !!lastReviewSnapshot,

        addVocabItem,
        updateVocabItem,
        deleteVocabItem,

        addDeck,
        updateDeck,
        deleteDeck,

        gradeCard,
        undoLastReview,
        toggleSuspendCard,

        saveTestAttempt,
        applyTestToSRS,

        importVocabItems,
        updateSettings,
        resetAllData,

        dueCards,
        newCards,
        learningCards,
        reviewCards,
        streak,
        observedRetention,
        weakWords,
        todayReviewsCount,
        activityHeatmap,
      }}
    >
      {children}
    </VoceluneContext.Provider>
  );
}

export function useVocelune() {
  const context = useContext(VoceluneContext);
  if (!context) {
    throw new Error('useVocelune must be used within a VoceluneProvider');
  }
  return context;
}

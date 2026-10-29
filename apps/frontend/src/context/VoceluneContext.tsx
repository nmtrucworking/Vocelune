'use client';
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { VocabItem, Deck, Card, ReviewLog, TestAttempt, UserSettings, FSRSRating, DailyActivity } from '@/types';
import { INITIAL_SETTINGS } from '@/lib/seed-data';
import { api, post, ApiError } from '@/lib/api';
import { useNotification } from '@/context/NotificationContext';

type User = { id: string; email: string; displayName: string; avatarAssetId?: string | null; avatarUrl?: string | null };
type Overview = { forecastData: { day: string; cards: number }[]; forgettingCurveData: { day: string; retrievability: number; threshold: number }[]; averageStability: number; streak: number; observedRetention: number | null; sampleSize: number; todayReviewsCount: number; activityHeatmap: DailyActivity[]; weakWords: { vocab: VocabItem; lapses: number; reps: number }[] };
type Snapshot = { user: User; vocabItems: VocabItem[]; decks: Deck[]; cards: Card[]; dueCards: Card[]; reviewLogs: ReviewLog[]; testAttempts: TestAttempt[]; settings: UserSettings; overview: Overview };
interface VoceluneContextType {
  analytics: Overview | null;
  user: User | null; error: string | null; clearError: () => void; refresh: () => Promise<void>;
  login: (email: string, password: string, displayName?: string) => Promise<void>; logout: () => Promise<void>;
  vocabItems: VocabItem[]; decks: Deck[]; cards: Card[]; reviewLogs: ReviewLog[]; testAttempts: TestAttempt[];
  settings: UserSettings; isLoaded: boolean; canUndo: boolean;
  addVocabItem: (item: Omit<VocabItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<VocabItem>;
  updateVocabItem: (id: string, updates: Partial<VocabItem>) => Promise<void>; deleteVocabItem: (id: string) => Promise<void>;
  addDeck: (deck: Omit<Deck, 'id' | 'createdAt'>) => Promise<Deck>; updateDeck: (id: string, updates: Partial<Deck>) => Promise<void>; deleteDeck: (id: string) => Promise<void>;
  renameTopicGroup: (oldName: string, newName: string) => Promise<void>;
  deleteTopicGroup: (name: string, targetGroup?: string) => Promise<void>;
  forkPublicDeck: (deckId: string, options?: { targetName?: string; topicGroup?: string }) => Promise<{ deck: Deck; importedCount: number }>;
  revealCard: (cardId: string) => Promise<void>; gradeCard: (cardId: string, rating: FSRSRating, durationMs?: number) => Promise<void>;
  undoLastReview: () => Promise<boolean>; toggleSuspendCard: (cardId: string) => Promise<void>;
  updateSettings: (updates: Partial<UserSettings>) => Promise<void>;
  uploadAvatar: (input: File | string) => Promise<void>;
  removeAvatar: () => Promise<void>;
  uploadVocabImage: (vocabId: string, input: File | string) => Promise<void>;
  removeVocabImage: (vocabId: string, mediaId: string) => Promise<void>;
  dueCards: Card[]; newCards: Card[]; learningCards: Card[]; reviewCards: Card[];
  streak: number; observedRetention: number | null; retentionSampleSize: number; weakWords: { vocab: VocabItem; lapses: number; reps: number }[];
  todayReviewsCount: number; activityHeatmap: DailyActivity[];
}
const VoceluneContext = createContext<VoceluneContextType | undefined>(undefined);
export function VoceluneProvider({ children }: { children: React.ReactNode }) {
  const { notify } = useNotification();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [isLoaded, setLoaded] = useState(false), [error, setError] = useState<string | null>(null);
  const [lastReview, setLastReview] = useState<{ id: string; at: number } | null>(null);
  const session = useRef<Promise<{ id: string }> | null>(null);
  const reveals = useRef(new Map<string, Promise<{ revealId: string; cardVersion: number }>>());
  const pendingReviews = useRef(new Map<string, { key: string; body: unknown }>());
  const refreshSequence = useRef(0);
  const refresh = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    try { const data = await api<Snapshot>('/bootstrap'); if (sequence === refreshSequence.current) setSnapshot(data); }
    catch (e) { if (e instanceof ApiError && e.status === 401) { if (sequence === refreshSequence.current) setSnapshot(null); return; } throw e; }
  }, []);
  useEffect(() => { refresh().catch(e => setError(e.message)).finally(() => setLoaded(true)); }, [refresh]);
  useEffect(() => {
    if (!snapshot?.user) return;
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh().catch(e => setError(e.message)); }, 60000);
    return () => clearInterval(timer);
  }, [snapshot?.user.id, refresh]);
  useEffect(() => {
    if (!lastReview) return;
    const timer = setTimeout(() => setLastReview(null), Math.max(0, lastReview.at + 30000 - Date.now()));
    return () => clearTimeout(timer);
  }, [lastReview]);
  const perform = useCallback(async <T,>(action: () => Promise<T>): Promise<T> => {
    try {
      const result = await action();
      try {
        await refresh();
        setError(null);
      } catch {
        // Background sync notice instead of hard-failing
      }
      return result;
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) await refresh().catch(() => {});
      const msg = e instanceof Error ? e.message : 'Không thể lưu dữ liệu.';
      setError(msg);
      notify.error('Lỗi thao tác', msg);
      throw e;
    }
  }, [refresh, notify]);
  const login = useCallback(async (email: string, password: string, displayName?: string) => {
    await post(displayName === undefined ? '/auth/login' : '/auth/register', { email, password, ...(displayName === undefined ? {} : { displayName }) });
    session.current = null; reveals.current.clear(); pendingReviews.current.clear(); setLastReview(null); await refresh(); setError(null);
  }, [refresh]);
  const logout = useCallback(async () => { await post('/auth/logout'); refreshSequence.current++; setSnapshot(null); session.current = null; reveals.current.clear(); pendingReviews.current.clear(); setLastReview(null); }, []);
  const addVocabItem = useCallback(async (item: Omit<VocabItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    const created = await perform(() => post<VocabItem>('/vocabulary', item));
    notify.success('Đã thêm thẻ mới!', `Từ "${item.word}" đã được đưa vào kho học FSRS.`);
    return created;
  }, [perform, notify]);
  const updateVocabItem = useCallback(async (id: string, updates: Partial<VocabItem>) => {
    setSnapshot(prev => {
      if (!prev) return prev;
      return { ...prev, vocabItems: prev.vocabItems.map(v => v.id === id ? { ...v, ...updates } : v) };
    });
    await perform(() => api(`/vocabulary/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }));
    notify.success('Đã cập nhật từ vựng!', 'Các thay đổi đã được lưu.');
  }, [perform, notify]);
  const deleteVocabItem = useCallback(async (id: string) => {
    setSnapshot(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        vocabItems: prev.vocabItems.filter(v => v.id !== id),
        cards: prev.cards.filter(c => c.vocabItemId !== id),
      };
    });
    await perform(() => api(`/vocabulary/${id}`, { method: 'DELETE' }));
    notify.info('Đã xóa từ vựng', 'Từ vựng và các thẻ liên quan đã được gỡ bỏ.');
  }, [perform, notify]);
  const addDeck = useCallback(async (deck: Omit<Deck, 'id' | 'createdAt'>) => {
    const created = await perform(() => post<Deck>('/decks', deck));
    notify.success('Đã tạo bộ từ mới!', `Bộ từ "${deck.name}" đã được tạo thành công.`);
    return created;
  }, [perform, notify]);
  const updateDeck = useCallback(async (id: string, updates: Partial<Deck>) => {
    setSnapshot(prev => {
      if (!prev) return prev;
      return { ...prev, decks: prev.decks.map(d => d.id === id ? { ...d, ...updates } : d) };
    });
    await perform(() => api(`/decks/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }));
    notify.success('Đã cập nhật bộ từ!', 'Thay đổi bộ từ đã được lưu.');
  }, [perform, notify]);
  const deleteDeck = useCallback(async (id: string) => {
    setSnapshot(prev => {
      if (!prev) return prev;
      return { ...prev, decks: prev.decks.filter(d => d.id !== id) };
    });
    await perform(() => api(`/decks/${id}`, { method: 'DELETE' }));
    notify.info('Đã xóa bộ từ', 'Bộ từ đã được gỡ khỏi thư viện.');
  }, [perform, notify]);
  const renameTopicGroup = useCallback(async (oldName: string, newName: string) => {
    setSnapshot(prev => {
      if (!prev) return prev;
      return { ...prev, decks: prev.decks.map(d => d.topicGroup === oldName ? { ...d, topicGroup: newName } : d) };
    });
    await perform(() => api(`/decks/groups/${encodeURIComponent(oldName)}`, {
      method: 'PATCH',
      body: JSON.stringify({ newName }),
    }));
    notify.success('Đã đổi tên chủ đề!', `Chủ đề đã được cập nhật thành "${newName}".`);
  }, [perform, notify]);
  const deleteTopicGroup = useCallback(async (name: string, targetGroup?: string) => {
    const fallback = targetGroup || 'Chung';
    setSnapshot(prev => {
      if (!prev) return prev;
      return { ...prev, decks: prev.decks.map(d => d.topicGroup === name ? { ...d, topicGroup: fallback } : d) };
    });
    await perform(() => api(`/decks/groups/${encodeURIComponent(name)}${targetGroup ? `?targetGroup=${encodeURIComponent(targetGroup)}` : ''}`, {
      method: 'DELETE',
    }));
    notify.info('Đã xóa chủ đề', `Các bộ từ đã được chuyển sang chủ đề "${fallback}".`);
  }, [perform, notify]);
  const forkPublicDeck = useCallback(async (deckId: string, options?: { targetName?: string; topicGroup?: string }) => {
    const result = await perform(async () => post<{ deck: Deck; importedCount: number }>(`/decks/public/${deckId}/fork`, options ?? {}));
    notify.success('Đã lưu bộ từ về thư viện!', `Đã sao chép ${result.importedCount} từ vào bộ "${result.deck.name}".`);
    return result;
  }, [perform, notify]);
  const revealCard = useCallback(async (cardId: string) => {
    if (!session.current) session.current = post<{ id: string }>('/study/sessions', { mode: 'flashcard' }).catch(e => { session.current = null; throw e; });
    const activeSession = await session.current;
    const promise = post<{ revealId: string; cardVersion: number }>(`/study/sessions/${activeSession.id}/reveal`, { cardId });
    reveals.current.set(cardId, promise);
    try { await promise; } catch (e) { reveals.current.delete(cardId); setError(e instanceof Error ? e.message : 'Không thể mở đáp án.'); throw e; }
  }, []);
  const gradeCard = useCallback(async (cardId: string, rating: FSRSRating, durationMs = 4000) => {
    await perform(async () => {
      let pending = pendingReviews.current.get(cardId);
      if (!pending) {
        const revealed = await reveals.current.get(cardId);
        const activeSession = await session.current;
        if (!revealed || !activeSession) throw new Error('Hãy mở đáp án trước khi đánh giá.');
        pending = { key: crypto.randomUUID(), body: { sessionId: activeSession.id, revealId: revealed.revealId, expectedCardVersion: revealed.cardVersion, rating, responseTimeMs: Math.min(300000, Math.max(0, durationMs)) } };
        pendingReviews.current.set(cardId, pending);
      }
      try {
        const result = await post<{ reviewId: string }>(`/cards/${cardId}/reviews`, pending.body, { 'Idempotency-Key': pending.key });
        setLastReview({ id: result.reviewId, at: Date.now() }); reveals.current.delete(cardId); pendingReviews.current.delete(cardId);
      } catch (e) {
        if (e instanceof ApiError && e.status < 500) { pendingReviews.current.delete(cardId); reveals.current.delete(cardId); }
        throw e;
      }
    });
  }, [perform]);
  const undoLastReview = useCallback(async () => {
    if (!lastReview) return false;
    await perform(() => post(`/reviews/${lastReview.id}/undo`)); setLastReview(null); reveals.current.clear(); return true;
  }, [lastReview, perform]);
  const toggleSuspendCard = useCallback(async (cardId: string) => {
    const card = snapshot?.cards.find(c => c.id === cardId); if (!card) return;
    await perform(() => api(`/cards/${cardId}`, { method: 'PATCH', body: JSON.stringify({ suspended: !card.suspended, expectedCardVersion: card.version }) }));
  }, [snapshot?.cards, perform]);
  const updateSettings = useCallback(async (updates: Partial<UserSettings>) => { await perform(() => api('/me/settings', { method: 'PATCH', body: JSON.stringify(updates) })); }, [perform]);
  const uploadAvatar = useCallback(async (input: File | string) => {
    return perform(async () => {
      let dataUrl: string;
      let mime: string = 'image/jpeg';
      let sizeBytes: number;

      if (typeof input === 'string') {
        dataUrl = input;
        const match = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,/);
        if (match) mime = match[1];
        sizeBytes = Math.round((dataUrl.length * 3) / 4);
      } else {
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(input.type)) {
          throw new Error('Chỉ hỗ trợ ảnh PNG, JPEG hoặc WebP.');
        }
        if (input.size > 5 * 1024 * 1024) {
          throw new Error('Kích thước ảnh tối đa là 5MB.');
        }
        mime = input.type;
        sizeBytes = input.size;
        dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(input);
        });
      }

      const intent = await post<{ id: string; uploadUrl: string }>('/media/upload-intents', {
        purpose: 'avatar',
        mime: mime === 'image/webp' ? 'image/webp' : mime === 'image/png' ? 'image/png' : 'image/jpeg',
        sizeBytes: Math.min(sizeBytes, 5 * 1024 * 1024),
      });

      try {
        await post(`/media/${intent.id}/upload-direct`, { dataUrl });
      } catch {
        if (typeof input !== 'string') {
          const uploadRes = await fetch(intent.uploadUrl, { method: 'PUT', headers: { 'Content-Type': mime }, body: input });
          if (!uploadRes.ok) throw new Error('Tải ảnh lên kho lưu trữ R2 không thành công.');
          await post(`/media/${intent.id}/complete`);
        }
      }

      await post('/me/avatar', { assetId: intent.id });
      await refresh();
      notify.success('Đã cập nhật ảnh đại diện!', 'Ảnh mới đã được lưu thành công.');
    });
  }, [perform, refresh, notify]);

  const removeAvatar = useCallback(async () => {
    await perform(async () => {
      await api('/me/avatar', { method: 'DELETE' });
      await refresh();
      notify.info('Đã gỡ ảnh đại diện', 'Đã quay về ảnh mặc định.');
    });
  }, [perform, refresh, notify]);

  const uploadVocabImage = useCallback(async (vocabId: string, input: File | string) => {
    return perform(async () => {
      let dataUrl: string;
      let mime: string = 'image/jpeg';
      let sizeBytes: number;

      if (typeof input === 'string') {
        dataUrl = input;
        const match = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,/);
        if (match) mime = match[1];
        sizeBytes = Math.round((dataUrl.length * 3) / 4);
      } else {
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(input.type)) {
          throw new Error('Chỉ hỗ trợ ảnh PNG, JPEG hoặc WebP.');
        }
        if (input.size > 5 * 1024 * 1024) {
          throw new Error('Kích thước ảnh tối đa là 5MB.');
        }
        mime = input.type;
        sizeBytes = input.size;
        dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(input);
        });
      }

      const intent = await post<{ id: string; uploadUrl: string }>('/media/upload-intents', {
        purpose: 'flashcard',
        mime: mime === 'image/webp' ? 'image/webp' : mime === 'image/png' ? 'image/png' : 'image/jpeg',
        sizeBytes: Math.min(sizeBytes, 5 * 1024 * 1024),
      });

      await post(`/media/${intent.id}/upload-direct`, { dataUrl });
      await post(`/media/${intent.id}/attach`, { vocabId });
      await refresh();
      notify.success('Đã tải ảnh minh họa!', 'Hình ảnh đã được gắn vào thẻ học FSRS.');
    });
  }, [perform, refresh, notify]);

  const removeVocabImage = useCallback(async (vocabId: string, mediaId: string) => {
    await perform(async () => {
      await post(`/media/${mediaId}/detach`, { vocabId });
      await refresh();
      notify.info('Đã gỡ ảnh minh họa', 'Thẻ học đã chuyển về dạng văn bản thuần.');
    });
  }, [perform, refresh, notify]);
  const cards = snapshot?.cards ?? [];
  const computed = useMemo(() => ({ newCards: cards.filter(c => c.state === 'new'), learningCards: cards.filter(c => ['learning', 'relearning'].includes(c.state)), reviewCards: cards.filter(c => c.state === 'review') }), [cards]);
  const overview = snapshot?.overview;
  return <VoceluneContext.Provider value={{ analytics: overview ?? null, user: snapshot?.user ?? null, error, clearError: () => setError(null), refresh, login, logout,
    vocabItems: snapshot?.vocabItems ?? [], decks: snapshot?.decks ?? [], cards, reviewLogs: snapshot?.reviewLogs ?? [], testAttempts: snapshot?.testAttempts ?? [], settings: snapshot?.settings ?? INITIAL_SETTINGS, isLoaded, canUndo: !!lastReview,
    addVocabItem, updateVocabItem, deleteVocabItem, addDeck, updateDeck, deleteDeck, renameTopicGroup, deleteTopicGroup, forkPublicDeck, revealCard, gradeCard, undoLastReview, toggleSuspendCard, updateSettings, uploadAvatar, removeAvatar, uploadVocabImage, removeVocabImage,
    dueCards: snapshot?.dueCards ?? [], ...computed, streak: overview?.streak ?? 0, observedRetention: overview?.observedRetention ?? null, retentionSampleSize: overview?.sampleSize ?? 0,
    weakWords: overview?.weakWords ?? [], todayReviewsCount: overview?.todayReviewsCount ?? 0, activityHeatmap: overview?.activityHeatmap.slice(-42) ?? [],
  }}>{children}</VoceluneContext.Provider>;
}
export function useVocelune() {
  const context = useContext(VoceluneContext);
  if (!context) throw new Error('useVocelune must be used within a VoceluneProvider');
  return context;
}

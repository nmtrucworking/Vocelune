import { Card, Deck, ReviewLog, VocabItem, DeckItem, UserSettings } from '@prisma/client';
export function vocabDto(v: VocabItem & { decks: DeckItem[] }) {
  const { userId, lexemeId, deletedAt, senseKey, sourceKind, provenance, decks, ...fields } = v;
  return { ...fields, deckId: decks[0]?.deckId || '', deckIds: decks.map(d => d.deckId), senseKey, sourceKind, provenance };
}
export function deckDto(d: Deck & { _count?: { items: number } }) {
  const { userId, normalizedName, deletedAt, _count, ...fields } = d;
  return { ...fields, ...(typeof _count?.items === 'number' ? { itemCount: _count.items } : {}) };
}
export function publicDeckDto(d: Deck & { user?: { id?: string; displayName: string; avatarAssetId?: string | null }; _count?: { items: number } }) {
  const { userId, normalizedName, deletedAt, _count, user, ...fields } = d;
  return {
    ...fields,
    authorName: user?.displayName || 'Cộng đồng',
    authorAvatarUrl: user?.avatarAssetId && user?.id ? `/api/v1/users/${user.id}/avatar?v=${user.avatarAssetId}` : null,
    itemCount: _count?.items ?? 0,
  };
}
export function cardDto(c: Card) {
  const { userId, deletedAt, ...fields } = c;
  return fields;
}
export function reviewDto(r: ReviewLog) {
  return { id: r.id, cardId: r.cardId, rating: r.rating, reviewedAt: r.reviewedAt, beforeState: r.beforeState, afterState: r.afterState, durationMs: r.durationMs, voidedAt: r.voidedAt, source: r.source };
}
export function settingsDto(s: UserSettings, displayName: string) {
  const { userId, updatedAt, ...fields } = s;
  return { ...fields, displayName };
}

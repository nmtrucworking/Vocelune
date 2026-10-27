import { Card, Deck, ReviewLog, VocabItem, DeckItem, UserSettings } from '@prisma/client';
export function vocabDto(v: VocabItem & { decks: DeckItem[] }) {
  const { userId, lexemeId, deletedAt, senseKey, sourceKind, provenance, decks, ...fields } = v;
  return { ...fields, deckId: decks[0]?.deckId || '', deckIds: decks.map(d => d.deckId), senseKey, sourceKind, provenance };
}
export function deckDto(d: Deck) {
  const { userId, normalizedName, deletedAt, ...fields } = d;
  return fields;
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

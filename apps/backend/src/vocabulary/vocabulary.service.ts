import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { Database, json, Tx } from '../common/db';
import { fail, normalized, pagination, uuid } from '../common/http';
import { cardDto, deckDto, vocabDto } from '../common/serializers';
import { hash } from '../identity/security';

export const pos = z.enum(['noun', 'verb', 'adjective', 'adverb', 'phrase', 'idiom', 'preposition', 'conjunction', 'other']);
export const cefr = z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'unknown']);
export const templates = z.enum(['en_vi', 'vi_en', 'audio_word', 'definition_en']);
export const vocabSchema = z.object({
  word: z.string().trim().min(1).max(100).transform(v => v.normalize('NFC')),
  partOfSpeech: pos, meaningVi: z.string().trim().min(1).max(5000),
  definitionEn: z.string().trim().max(5000).default(''), exampleEn: z.string().trim().max(5000).default(''), exampleVi: z.string().trim().max(5000).default(''),
  phonetic: z.string().trim().max(300).default(''), dialect: z.enum(['en-us', 'en-gb']).default('en-us'),
  cefr: cefr.default('unknown'), cefrSource: z.enum(['manual', 'unknown']).default('manual'),
  deckId: uuid, deckIds: z.array(uuid).max(50).optional(), tags: z.array(z.string().trim().min(1).max(50)).max(30).default([]),
  notes: z.string().max(10000).default(''), templates: z.array(templates).min(1).max(4).default(['en_vi']),
  sourceKind: z.literal('user').default('user'),
}).strict();
export type VocabInput = z.infer<typeof vocabSchema>;
export const deckSchema = z.object({ name: z.string().trim().min(1).max(100), description: z.string().max(2000).default(''), color: z.string().regex(/^#[a-fA-F0-9]{6}$/).default('#4F46E5'), icon: z.string().max(30).default('book') }).strict();
export const vocabularyQuery = pagination.extend({ search: z.string().max(100).optional(), deckId: uuid.optional(), cefr: cefr.optional(), partOfSpeech: pos.optional(), tag: z.string().max(50).optional() });

@Injectable()
export class VocabularyService {
  constructor(@Inject(Database) private db: Database) {}
  async requireDeck(tx: Tx, userId: string, deckId: string) {
    const deck = await tx.deck.findFirst({ where: { id: deckId, userId, deletedAt: null } });
    if (!deck) fail(404, 'NOT_FOUND', 'Không tìm thấy bộ từ.');
    return deck;
  }
  async requireVocab(tx: Tx, userId: string, vocabId: string) {
    const vocab = await tx.vocabItem.findFirst({ where: { id: vocabId, userId, deletedAt: null }, include: { decks: true } });
    if (!vocab) fail(404, 'NOT_FOUND', 'Không tìm thấy từ vựng.');
    return vocab;
  }
  senseKey(input: Pick<VocabInput, 'meaningVi' | 'definitionEn'>) { return hash(normalized(input.meaningVi) + '\0' + normalized(input.definitionEn)); }
  async createInTx(tx: Tx, userId: string, input: VocabInput, allowDuplicate = false) {
    const deckIds = [...new Set([input.deckId, ...(input.deckIds ?? [])])];
    for (const deckId of deckIds) await this.requireDeck(tx, userId, deckId);
    if (input.templates.includes('definition_en') && !input.definitionEn) fail(422, 'MISSING_DEFINITION', 'Thẻ định nghĩa cần định nghĩa tiếng Anh.');
    const normalizedWord = normalized(input.word);
    const lexeme = await tx.lexeme.upsert({ where: { normalized_partOfSpeech_language: { normalized: normalizedWord, partOfSpeech: input.partOfSpeech, language: 'en' } }, create: { lemma: input.word, normalized: normalizedWord, partOfSpeech: input.partOfSpeech }, update: {} });
    const senseKey = this.senseKey(input);
    const existing = await tx.vocabItem.findFirst({ where: { userId, lexemeId: lexeme.id, senseKey, deletedAt: null } });
    if (existing && !allowDuplicate) fail(409, 'DUPLICATE_SENSE', 'Nghĩa này đã có trong kho từ.', { existingId: existing.id });
    const { deckId, deckIds: _, templates: cardTemplates, ...fields } = input;
    const scheduler = await tx.schedulerConfig.findFirstOrThrow({ where: { userId }, orderBy: { version: 'desc' } });
    const item = await tx.vocabItem.create({ data: {
      ...fields, tags: [...new Set(fields.tags.map(normalized))], userId, lexemeId: lexeme.id, senseKey,
      provenance: { kind: 'user', cefrMethod: input.cefr === 'unknown' ? 'unknown' : 'manual' },
      decks: { create: deckIds.map(deckId => ({ deckId })) },
      cards: { create: [...new Set(cardTemplates)].map(template => ({ userId, template, schedulerConfigId: scheduler.id })) },
    }, include: { decks: true } });
    return vocabDto(item);
  }
  create(userId: string, body: unknown) { return this.db.forUser(userId, tx => this.createInTx(tx, userId, vocabSchema.parse(body))); }
  async list(userId: string, query: unknown) {
    const q = vocabularyQuery.parse(query);
    const where: Prisma.VocabItemWhereInput = { userId, deletedAt: null,
      ...(q.search ? { OR: [{ word: { contains: q.search, mode: 'insensitive' } }, { meaningVi: { contains: q.search, mode: 'insensitive' } }] } : {}),
      ...(q.deckId ? { decks: { some: { deckId: q.deckId, deck: { userId, deletedAt: null } } } } : {}),
      ...(q.cefr ? { cefr: q.cefr } : {}), ...(q.partOfSpeech ? { partOfSpeech: q.partOfSpeech } : {}), ...(q.tag ? { tags: { has: q.tag } } : {}),
    };
    const items = await this.db.vocabItem.findMany({ where, include: { decks: true }, orderBy: { id: 'asc' }, take: q.limit + 1, ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}) });
    const hasMore = items.length > q.limit; if (hasMore) items.pop();
    return { items: items.map(vocabDto), nextCursor: hasMore ? items.at(-1)!.id : null, total: await this.db.vocabItem.count({ where }) };
  }
  async get(userId: string, vocabId: string) { return vocabDto(await this.requireVocab(this.db, userId, vocabId)); }
  async update(userId: string, vocabId: string, body: unknown) {
    const parsed = vocabSchema.partial().omit({ templates: true, sourceKind: true }).parse(body);
    const patch = Object.fromEntries(Object.entries(parsed).filter(([key]) => Object.hasOwn(body as object, key))) as typeof parsed;
    return this.db.forUser(userId, async tx => {
      const previous = await this.requireVocab(tx, userId, vocabId);
      const { deckId, deckIds, ...fields } = patch;
      if (deckId || deckIds) {
        const ids = [...new Set([...(deckId ? [deckId] : []), ...(deckIds ?? [])])];
        if (!ids.length) fail(422, 'DECK_REQUIRED', 'Cần ít nhất một bộ từ.');
        for (const d of ids) await this.requireDeck(tx, userId, d);
        await tx.deckItem.deleteMany({ where: { vocabItemId: vocabId } });
        await tx.deckItem.createMany({ data: ids.map(deckId => ({ deckId, vocabItemId: vocabId })) });
      }
      const next = { ...previous, ...fields };
      const lexeme = await tx.lexeme.upsert({ where: { normalized_partOfSpeech_language: { normalized: normalized(next.word), partOfSpeech: next.partOfSpeech, language: 'en' } }, create: { lemma: next.word, normalized: normalized(next.word), partOfSpeech: next.partOfSpeech }, update: {} });
      const senseKey = this.senseKey(next);
      const duplicate = await tx.vocabItem.findFirst({ where: { userId, lexemeId: lexeme.id, senseKey, deletedAt: null, id: { not: vocabId } } });
      if (duplicate) fail(409, 'DUPLICATE_SENSE', 'Nghĩa này đã tồn tại.', { existingId: duplicate.id });
      const item = await tx.vocabItem.update({ where: { id: vocabId }, data: { ...fields, lexemeId: lexeme.id, senseKey, ...(fields.cefr ? { cefrSource: fields.cefr === 'unknown' ? 'unknown' : 'manual' } : {}) }, include: { decks: true } });
      // Invalidate reveal tokens/previews when question content changes.
      await tx.card.updateMany({ where: { vocabItemId: vocabId }, data: { version: { increment: 1 } } });
      return vocabDto(item);
    });
  }
  async remove(userId: string, vocabId: string) {
    return this.db.forUser(userId, async tx => {
      await this.requireVocab(tx, userId, vocabId);
      const now = new Date();
      await tx.vocabItem.update({ where: { id: vocabId }, data: { deletedAt: now } });
      await tx.card.updateMany({ where: { vocabItemId: vocabId }, data: { deletedAt: now, version: { increment: 1 } } });
      return { ok: true };
    });
  }
  async decks(userId: string) { return (await this.db.deck.findMany({ where: { userId, deletedAt: null }, orderBy: { createdAt: 'asc' } })).map(deckDto); }
  async createDeck(userId: string, body: unknown) {
    const data = deckSchema.parse(body);
    return deckDto(await this.db.deck.create({ data: { ...data, userId, normalizedName: normalized(data.name) } }));
  }
  async updateDeck(userId: string, deckId: string, body: unknown) {
    const parsed = deckSchema.partial().parse(body);
    const data = Object.fromEntries(Object.entries(parsed).filter(([key]) => Object.hasOwn(body as object, key))) as typeof parsed;
    return this.db.forUser(userId, async tx => {
      await this.requireDeck(tx, userId, deckId);
      return deckDto(await tx.deck.update({ where: { id: deckId }, data: { ...data, ...(data.name ? { normalizedName: normalized(data.name) } : {}) } }));
    });
  }
  async deleteDeck(userId: string, deckId: string) {
    return this.db.forUser(userId, async tx => {
      await this.requireDeck(tx, userId, deckId);
      const others = await tx.deck.findMany({ where: { userId, deletedAt: null, id: { not: deckId } }, orderBy: { createdAt: 'asc' } });
      if (!others.length) fail(409, 'LAST_DECK', 'Cần giữ lại ít nhất một bộ từ.');
      const orphaned = await tx.vocabItem.findMany({ where: { userId, deletedAt: null, decks: { every: { deckId } } } });
      await tx.deckItem.createMany({ data: orphaned.map(v => ({ deckId: others[0].id, vocabItemId: v.id })), skipDuplicates: true });
      await tx.deckItem.deleteMany({ where: { deckId } });
      await tx.deck.update({ where: { id: deckId }, data: { deletedAt: new Date() } });
      return { ok: true };
    });
  }
  async duplicatePreview(userId: string, body: unknown) {
    const { word, partOfSpeech } = z.object({ word: vocabSchema.shape.word, partOfSpeech: pos }).parse(body);
    return (await this.db.vocabItem.findMany({ where: { userId, deletedAt: null, lexeme: { normalized: normalized(word), partOfSpeech } }, include: { decks: true } })).map(vocabDto);
  }
  async merge(userId: string, body: unknown) {
    const { sourceId, targetId } = z.object({ sourceId: uuid, targetId: uuid }).strict().parse(body);
    if (sourceId === targetId) fail(422, 'INVALID_MERGE', 'Hai từ phải khác nhau.');
    return this.db.forUser(userId, async tx => {
      const source = await this.requireVocab(tx, userId, sourceId), target = await this.requireVocab(tx, userId, targetId);
      if (source.lexemeId !== target.lexemeId) fail(422, 'INVALID_MERGE', 'Chỉ hợp nhất cùng từ và từ loại.');
      await tx.deckItem.createMany({ data: source.decks.map(d => ({ deckId: d.deckId, vocabItemId: targetId })), skipDuplicates: true });
      const sourceCards = await tx.card.findMany({ where: { vocabItemId: sourceId } });
      const targetCards = await tx.card.findMany({ where: { vocabItemId: targetId } });
      for (const card of sourceCards) {
        // Keep every historical log attached to its original card; archive conflicting templates.
        if (targetCards.some(c => c.template === card.template)) await tx.card.update({ where: { id: card.id }, data: { deletedAt: new Date(), version: { increment: 1 } } });
        else await tx.card.update({ where: { id: card.id }, data: { vocabItemId: targetId, version: { increment: 1 } } });
      }
      await tx.vocabItem.update({ where: { id: targetId }, data: { tags: [...new Set([...source.tags, ...target.tags])] } });
      await tx.vocabItem.update({ where: { id: sourceId }, data: { deletedAt: new Date() } });
      await tx.auditLog.create({ data: { actorId: userId, action: 'vocabulary.merge', resourceId: targetId, metadata: json({ sourceId }) } });
      return this.getInTx(tx, userId, targetId);
    });
  }
  private async getInTx(tx: Tx, userId: string, vocabId: string) { return vocabDto(await this.requireVocab(tx, userId, vocabId)); }
  async addCard(userId: string, vocabId: string, body: unknown) {
    const { template } = z.object({ template: templates }).strict().parse(body);
    return this.db.forUser(userId, async tx => {
      const item = await this.requireVocab(tx, userId, vocabId);
      if (template === 'definition_en' && !item.definitionEn) fail(422, 'MISSING_DEFINITION', 'Cần định nghĩa tiếng Anh.');
      const scheduler = await tx.schedulerConfig.findFirstOrThrow({ where: { userId }, orderBy: { version: 'desc' } });
      return cardDto(await tx.card.create({ data: { userId, vocabItemId: vocabId, template, schedulerConfigId: scheduler.id } }));
    });
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { Card } from '@prisma/client';
import { z } from 'zod';
import { Database, json, Tx } from '../common/db';
import { fail, normalized, uuid } from '../common/http';
import { cardDto } from '../common/serializers';
import { hash } from '../identity/security';
import { review, scheduleSnapshot } from './scheduler';
import { nextStudyDay, studyDayStart } from './time';

export const reviewSchema = z.object({ sessionId: uuid, revealId: uuid, rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]), expectedCardVersion: z.number().int().min(1), responseTimeMs: z.number().int().min(0).max(300000) }).strict();
@Injectable()
export class StudyService {
  constructor(@Inject(Database) private db: Database) {}
  async requireCard(tx: Tx, userId: string, cardId: string) {
    const card = await tx.card.findFirst({ where: { id: cardId, userId, deletedAt: null, vocabItem: { deletedAt: null } } });
    if (!card) fail(404, 'NOT_FOUND', 'Không tìm thấy thẻ.');
    return card;
  }
  async queue(userId: string) {
    const now = new Date();
    const settings = await this.db.userSettings.findUniqueOrThrow({ where: { userId } });
    const start = studyDayStart(now, settings.timezone, settings.dayStartHour);
    const learned = await this.db.reviewLog.count({ where: { userId, beforeState: 'new', voidedAt: null, reviewedAt: { gte: start }, source: 'srs_study' } });
    const remaining = Math.max(0, settings.newCardsPerDay - learned);
    const eligible = { userId, deletedAt: null, suspended: false, vocabItem: { deletedAt: null }, OR: [{ buriedUntil: null }, { buriedUntil: { lte: now } }] };
    const due = await this.db.card.findMany({ where: { ...eligible, state: { not: 'new' }, dueAt: { lte: now } }, orderBy: [{ dueAt: 'asc' }, { id: 'asc' }], take: 1000 });
    
    // Fetch fresh new cards, prioritizing newly created vocabulary items and selecting 1 card per distinct vocabItem
    let fresh: Card[] = [];
    if (remaining > 0) {
      const candidateFresh = await this.db.card.findMany({
        where: { ...eligible, state: 'new', dueAt: { lte: now } },
        orderBy: [{ vocabItem: { createdAt: 'desc' } }, { id: 'asc' }],
        take: Math.max(remaining * 4, 100),
      });
      const freshVocabMap = new Map<string, (typeof candidateFresh)[0]>();
      for (const c of candidateFresh) {
        const existing = freshVocabMap.get(c.vocabItemId);
        if (!existing) {
          freshVocabMap.set(c.vocabItemId, c);
        } else if (c.template === 'en_vi' && existing.template !== 'en_vi') {
          freshVocabMap.set(c.vocabItemId, c);
        }
        if (freshVocabMap.size >= remaining) break;
      }
      fresh = Array.from(freshVocabMap.values());
    }

    const ordered = [...due.filter(c => c.state !== 'review'), ...due.filter(c => c.state === 'review'), ...fresh];
    const seen = new Set<string>();
    const cards = ordered.filter(c => {
      if (c.state === 'learning' || c.state === 'relearning') return true;
      if (seen.has(c.vocabItemId)) return false;
      seen.add(c.vocabItemId); return true;
    });
    return { serverNow: now, cards: cards.map(cardDto), counts: { due: due.length, newRemaining: remaining, available: cards.length }, scheduler: { modelVersion: 'FSRS-6', libraryVersion: '5.4.2' } };
  }
  async start(userId: string, body: unknown, kind = 'srs') {
    const { mode } = z.object({ mode: z.enum(['flashcard', 'typed', 'mcq', 'listening', 'sentence']).default('flashcard') }).strict().parse(body);
    const settings = await this.db.userSettings.findUniqueOrThrow({ where: { userId } });
    const session = await this.db.studySession.create({ data: { userId, mode, kind, settingsSnapshot: json(settings) } });
    return { id: session.id, mode, startedAt: session.startedAt };
  }
  async reveal(userId: string, sessionId: string, cardId: string) {
    return this.db.forUser(userId, async tx => {
      const session = await tx.studySession.findFirst({ where: { id: sessionId, userId, kind: 'srs', endedAt: null, startedAt: { gte: new Date(Date.now() - 12 * 3600000) } } });
      if (!session) fail(404, 'SESSION_NOT_FOUND', 'Phiên học không còn hoạt động.');
      const card = await this.requireCard(tx, userId, cardId);
      await this.checkReviewable(tx, userId, card, new Date(), true);
      const token = await tx.reveal.create({ data: { sessionId, cardId, cardVersion: card.version, expiresAt: new Date(Date.now() + 5 * 60000) } });
      const scheduler = await tx.schedulerConfig.findFirstOrThrow({ where: { userId }, orderBy: { version: 'desc' } });
      const weights = Array.isArray(scheduler.parameters)
        ? (scheduler.parameters as number[])
        : (scheduler.parameters as any)?.w;
      return {
        revealId: token.id,
        cardVersion: card.version,
        previews: ([1, 2, 3, 4] as const).map(rating => ({
          rating,
          dueAt: review(card, rating, new Date(), scheduler.retention, weights).dueAt,
        })),
      };
    });
  }
  private async checkReviewable(tx: Tx, userId: string, card: Card, now: Date, allowAhead = true) {
    if (card.suspended) fail(409, 'CARD_SUSPENDED', 'Thẻ đã tạm dừng.');
    if (!allowAhead && card.dueAt > now) fail(409, 'CARD_NOT_DUE', 'Thẻ chưa đến hạn hoặc đã tạm dừng.');
    if (!allowAhead && card.buriedUntil && card.buriedUntil > now) fail(409, 'CARD_BURIED', 'Thẻ đang được tạm ẩn.');
    if (card.state === 'new' && !allowAhead) {
      const settings = await tx.userSettings.findUniqueOrThrow({ where: { userId } });
      const learned = await tx.reviewLog.count({ where: { userId, beforeState: 'new', voidedAt: null, source: 'srs_study', reviewedAt: { gte: studyDayStart(now, settings.timezone, settings.dayStartHour) } } });
      if (learned >= settings.newCardsPerDay) fail(409, 'DAILY_LIMIT', 'Đã đạt giới hạn thẻ mới hôm nay.');
    }
  }
  async grade(userId: string, cardId: string, key: string, body: unknown) {
    const input = reviewSchema.parse(body);
    const requestHash = hash(JSON.stringify({ cardId, ...input }));
    return this.db.forUser(userId, async tx => {
      const previous = await tx.reviewLog.findUnique({ where: { userId_clientRequestId: { userId, clientRequestId: key } } });
      if (previous) {
        if (previous.requestHash !== requestHash) fail(409, 'IDEMPOTENCY_CONFLICT', 'Khóa yêu cầu đã dùng cho dữ liệu khác.');
        return previous.response;
      }
      const session = await tx.studySession.findFirst({ where: { id: input.sessionId, userId, kind: 'srs', endedAt: null, startedAt: { gte: new Date(Date.now() - 12 * 3600000) } } });
      if (!session) fail(404, 'SESSION_NOT_FOUND', 'Phiên học không còn hoạt động.');
      const card = await this.requireCard(tx, userId, cardId);
      if (card.version !== input.expectedCardVersion) fail(409, 'STALE_CARD', 'Thẻ đã thay đổi trên một phiên khác.', { latestCardVersion: card.version });
      const now = new Date();
      await this.checkReviewable(tx, userId, card, now, true);
      const reveal = await tx.reveal.findFirst({ where: { id: input.revealId, sessionId: input.sessionId, cardId, cardVersion: card.version, consumedAt: null, expiresAt: { gt: now } } });
      if (!reveal) fail(409, 'REVEAL_REQUIRED', 'Cần xem đáp án trước khi đánh giá.');
      await tx.reveal.update({ where: { id: reveal.id }, data: { consumedAt: now } });
      return this.recordInTx(tx, userId, card, input.rating, key, requestHash, Math.min(input.responseTimeMs, 120000), 'srs_study', now, session.id);
    });
  }
  async recordInTx(tx: Tx, userId: string, card: Card, rating: 1 | 2 | 3 | 4, key: string, requestHash: string, durationMs: number, source: string, now: Date, sessionId?: string) {
    const scheduler = await tx.schedulerConfig.findFirstOrThrow({ where: { userId }, orderBy: { version: 'desc' } });
    const weights = Array.isArray(scheduler.parameters)
      ? (scheduler.parameters as number[])
      : (scheduler.parameters as any)?.w;
    const next = review(card, rating, now, scheduler.retention, weights);
    const updated = await tx.card.update({ where: { id: card.id }, data: { ...next, version: { increment: 1 }, schedulerConfigId: scheduler.id } });
    const siblings = await tx.card.findMany({ where: { userId, vocabItemId: card.vocabItemId, id: { not: card.id }, state: { in: ['new', 'review'] }, deletedAt: null }, select: { id: true, buriedUntil: true, version: true } });
    const reviewId = crypto.randomUUID();
    const response = { reviewId, card: cardDto(updated), scheduler: { modelVersion: scheduler.modelVersion, libraryVersion: scheduler.libraryVersion, configVersion: scheduler.version } };
    await tx.reviewLog.create({ data: { id: reviewId, userId, cardId: card.id, sessionId, clientRequestId: key, requestHash, rating, source, beforeState: card.state, afterState: next.state, beforeSnapshot: json({ ...scheduleSnapshot(card), siblings }), afterSnapshot: json(scheduleSnapshot(updated)), response: json(response), schedulerConfigId: scheduler.id, durationMs, reviewedAt: now } });
    const settings = await tx.userSettings.findUniqueOrThrow({ where: { userId } });
    await tx.card.updateMany({ where: { userId, vocabItemId: card.vocabItemId, id: { not: card.id }, state: { in: ['new', 'review'] }, deletedAt: null }, data: { buriedUntil: nextStudyDay(now, settings.timezone, settings.dayStartHour), version: { increment: 1 } } });
    return response;
  }
  async undo(userId: string, reviewId: string) {
    return this.db.forUser(userId, async tx => {
      const log = await tx.reviewLog.findFirst({ where: { id: reviewId, userId } });
      if (!log) fail(404, 'NOT_FOUND', 'Không tìm thấy lượt ôn.');
      if (log.voidedAt) return { ok: true, alreadyUndone: true };
      if (Date.now() - log.reviewedAt.getTime() > 30000) fail(409, 'UNDO_EXPIRED', 'Chỉ hoàn tác trong vòng 30 giây.');
      const card = await this.requireCard(tx, userId, log.cardId);
      const after = log.afterSnapshot as Record<string, unknown>;
      if (card.version !== after.version) fail(409, 'UNDO_CONFLICT', 'Thẻ đã thay đổi sau lượt ôn này.');
      const { siblings, ...before } = log.beforeSnapshot as ReturnType<typeof scheduleSnapshot> & { siblings?: { id: string; buriedUntil: string | null; version: number }[] };
      await tx.card.update({ where: { id: card.id }, data: { ...before, dueAt: new Date(before.dueAt), lastReviewedAt: before.lastReviewedAt ? new Date(before.lastReviewedAt) : null, version: card.version + 1 } });
      for (const sibling of siblings ?? []) {
        // Restore only side effects that no later write has touched.
        await tx.card.updateMany({ where: { id: sibling.id, userId, version: sibling.version + 1 }, data: { buriedUntil: sibling.buriedUntil ? new Date(sibling.buriedUntil) : null, version: { increment: 1 } } });
      }
      await tx.reviewLog.update({ where: { id: reviewId }, data: { voidedAt: new Date() } });
      await tx.auditLog.create({ data: { actorId: userId, action: 'review.undo', resourceId: reviewId } });
      return { ok: true };
    });
  }
  async patchCard(userId: string, cardId: string, body: unknown) {
    const data = z.object({ suspended: z.boolean().optional(), reset: z.boolean().optional(), expectedCardVersion: z.number().int().min(1) }).strict().parse(body);
    return this.db.forUser(userId, async tx => {
      const card = await this.requireCard(tx, userId, cardId);
      if (card.version !== data.expectedCardVersion) fail(409, 'STALE_CARD', 'Thẻ đã thay đổi.');
      const updated = await tx.card.update({ where: { id: cardId }, data: { ...(data.suspended !== undefined ? { suspended: data.suspended } : {}), ...(data.reset ? { state: 'new', dueAt: new Date(), lastReviewedAt: null, stability: 0, difficulty: 0, elapsedDays: 0, scheduledDays: 0, learningSteps: 0, reps: 0, lapses: 0, buriedUntil: null } : {}), version: { increment: 1 } } });
      await tx.auditLog.create({ data: { actorId: userId, action: data.reset ? 'card.reset' : 'card.suspend', resourceId: cardId } });
      return cardDto(updated);
    });
  }
  async practiceAnswer(userId: string, sessionId: string, body: unknown) {
    const input = z.object({ vocabId: uuid, answer: z.string().max(5000), durationMs: z.number().int().min(0).max(120000) }).strict().parse(body);
    const session = await this.db.studySession.findFirst({ where: { id: sessionId, userId, kind: 'practice', endedAt: null } });
    if (!session) fail(404, 'NOT_FOUND', 'Không tìm thấy phiên luyện tập.');
    const vocab = await this.db.vocabItem.findFirst({ where: { id: input.vocabId, userId, deletedAt: null } });
    if (!vocab) fail(404, 'NOT_FOUND', 'Không tìm thấy từ.');
    const isCorrect = normalized(input.answer) === normalized(vocab.word);
    return this.db.studyAttempt.create({ data: { sessionId, vocabItemId: vocab.id, mode: session.mode, answer: input.answer, isCorrect, durationMs: input.durationMs } });
  }
}

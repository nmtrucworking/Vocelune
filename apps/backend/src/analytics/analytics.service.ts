import { Inject, Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { fsrs } from 'ts-fsrs';
import { parameters } from '../study/scheduler';
import { Database } from '../common/db';
import { cardDto, deckDto, reviewDto, settingsDto, vocabDto } from '../common/serializers';
import { studyDate, studyDayStart } from '../study/time';
import { StudyService } from '../study/study.service';
import { TestsService } from '../tests/tests.service';
import { fail } from '../common/http';
@Injectable()
export class AnalyticsService {
  constructor(@Inject(Database) private db: Database, @Inject(StudyService) private study: StudyService, @Inject(TestsService) private tests: TestsService) {}
  async overview(userId: string) {
    const settings = await this.db.userSettings.findUniqueOrThrow({ where: { userId } });
    const now = new Date(), today = studyDate(now, settings.timezone, settings.dayStartHour);
    const start = DateTime.fromISO(today, { zone: settings.timezone }).minus({ days: 364 }).toJSDate();
    const logs = await this.db.reviewLog.findMany({ where: { userId, voidedAt: null, source: 'srs_study', reviewedAt: { gte: start } } });
    const daily = new Map<string, { count: number; successCount: number; activeSeconds: number }>();
    for (const log of logs) {
      const date = studyDate(log.reviewedAt, settings.timezone, settings.dayStartHour);
      const item = daily.get(date) || { count: 0, successCount: 0, activeSeconds: 0 };
      item.count++; item.successCount += Number(log.rating >= 3); item.activeSeconds += Math.min(log.durationMs, 120000) / 1000;
      daily.set(date, item);
    }
    const activityHeatmap = Array.from({ length: 365 }, (_, i) => {
      const date = DateTime.fromISO(today, { zone: settings.timezone }).minus({ days: 364 - i }).toISODate()!;
      return { date, ...(daily.get(date) || { count: 0, successCount: 0, activeSeconds: 0 }) };
    });
    let streak = 0, d = DateTime.fromISO(today, { zone: settings.timezone });
    if (!daily.has(d.toISODate()!)) d = d.minus({ days: 1 });
    while (daily.has(d.toISODate()!)) { streak++; d = d.minus({ days: 1 }); }
    const reviewLogs = logs.filter(l => l.beforeState === 'review');
    const success = reviewLogs.filter(l => l.rating >= 3).length;
    const queue = await this.study.queue(userId);
    const cards = await this.db.card.findMany({ where: { userId, deletedAt: null, vocabItem: { deletedAt: null } }, include: { vocabItem: { include: { decks: true } } } });
    const weak = new Map<string, { vocab: ReturnType<typeof vocabDto>; lapses: number; reps: number }>();
    for (const c of cards.filter(c => c.lapses > 0)) {
      const item = weak.get(c.vocabItemId) || { vocab: vocabDto(c.vocabItem), lapses: 0, reps: 0 };
      item.lapses += c.lapses; item.reps += c.reps; weak.set(c.vocabItemId, item);
    }
    const scored = cards.filter(c => c.stability > 0 && c.lastReviewedAt);
    const engine = fsrs(parameters(settings.desiredRetention));
    const forgettingCurveData = scored.length ? Array.from({ length: 16 }, (_, i) => {
      const day = i * 2;
      const average = scored.reduce((sum, card) => {
        const elapsed = Math.max(0, (now.getTime() - card.lastReviewedAt!.getTime()) / 86400000) + day;
        return sum + engine.forgetting_curve(elapsed, card.stability);
      }, 0) / scored.length;
      return { day: `Ngày ${day}`, retrievability: Math.round(average * 100), threshold: settings.desiredRetention * 100 };
    }) : [];
    const forecastData = Array.from({ length: 7 }, (_, i) => {
      const date = DateTime.fromISO(today, { zone: settings.timezone }).plus({ days: i });
      return { day: date.setLocale('vi').toFormat('ccc d/M'), cards: cards.filter(c => !c.suspended && c.state !== 'new' && studyDate(c.dueAt, settings.timezone, settings.dayStartHour) === date.toISODate()).length };
    });
    const testCount = await this.db.testAttempt.count({ where: { userId, status: { not: 'in_progress' } } });
    return { forecastData, forgettingCurveData, averageStability: scored.length ? scored.reduce((sum, c) => sum + c.stability, 0) / scored.length : 0, streak, observedRetention: reviewLogs.length ? Math.round(100 * success / reviewLogs.length) : null, sampleSize: reviewLogs.length,
      todayReviewsCount: daily.get(today)?.count || 0, activityHeatmap, weakWords: [...weak.values()].sort((a, b) => b.lapses - a.lapses).slice(0, 5), dueCount: queue.counts.due, newAvailable: queue.cards.filter(c => c.state === 'new').length,
      counts: { vocabulary: await this.db.vocabItem.count({ where: { userId, deletedAt: null } }), cards: cards.length, tests: testCount, reviews: logs.length },
      metadata: { calculationVersion: 1, successPolicy: 'rating>=3; state_before=review; source=srs_study; voided excluded', sampleSize: reviewLogs.length, timezone: settings.timezone, dayStartHour: settings.dayStartHour, timezonePolicy: 'recompute_history_in_current_profile_timezone', dateRange: { start, end: now }, updatedAt: now } };
  }
  async bootstrap(userId: string) {
    const user = await this.db.user.findUniqueOrThrow({ where: { id: userId }, include: { settings: true, avatarAsset: true } });
    const hasAvatar = !!(user.avatarAsset && user.avatarAsset.status === 'ready' && !user.avatarAsset.deletedAt);
    const [vocabulary, decks, cards, reviewLogs, attempts, overview, queue] = await Promise.all([
      this.db.vocabItem.findMany({ where: { userId, deletedAt: null }, include: { decks: true }, orderBy: { createdAt: 'desc' } }),
      this.db.deck.findMany({ where: { userId, deletedAt: null }, orderBy: { createdAt: 'asc' } }),
      this.db.card.findMany({ where: { userId, deletedAt: null, vocabItem: { deletedAt: null } } }),
      this.db.reviewLog.findMany({ where: { userId }, orderBy: { reviewedAt: 'desc' }, take: 10000 }),
      this.db.testAttempt.findMany({ where: { userId, status: { not: 'in_progress' } }, include: { questions: { orderBy: { ordinal: 'asc' } }, definition: true }, orderBy: { startedAt: 'desc' }, take: 100 }),
      this.overview(userId), this.study.queue(userId),
    ]);
    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarAssetId: hasAvatar ? user.avatarAssetId : null,
        avatarUrl: hasAvatar ? `/api/v1/users/${user.id}/avatar?v=${user.avatarAssetId}` : null,
      },
      vocabItems: vocabulary.map(vocabDto),
      decks: decks.map(deckDto),
      cards: cards.map(cardDto),
      reviewLogs: reviewLogs.map(reviewDto),
      testAttempts: attempts.map(a => this.tests.dto(a)),
      settings: settingsDto(user.settings!, user.displayName),
      overview,
      dueCards: queue.cards,
      historyLimits: { reviewLogs: 10000, testAttempts: 100 },
    };
  }
  async reviews(userId: string) { const overview = await this.overview(userId); return { items: overview.activityHeatmap, metadata: overview.metadata }; }
  async testAnalytics(userId: string) {
    const attempts = await this.db.testAttempt.findMany({ where: { userId, status: { not: 'in_progress' } }, orderBy: { submittedAt: 'asc' } });
    return { items: attempts.map(a => ({ id: a.id, definitionId: a.definitionId, submittedAt: a.submittedAt, score: a.score, maxScore: a.maxScore })), sampleSize: attempts.length, questionCount: attempts.reduce((sum, a) => sum + a.maxScore, 0) };
  }
  async operations(userId: string, role: string) {
    if (role !== 'admin') fail(403, 'FORBIDDEN', 'Chỉ quản trị viên được phép truy cập.');
    await this.db.auditLog.create({ data: { actorId: userId, action: 'admin.operations.read' } });
    return { pendingImports: await this.db.importJob.count({ where: { status: { in: ['queued', 'processing'] } } }), pendingEmails: await this.db.emailOutbox.count({ where: { status: 'pending' } }), providerUsageLast24h: await this.db.providerUsage.groupBy({ by: ['provider', 'status'], where: { occurredAt: { gte: new Date(Date.now() - 86400000) } }, _count: true }) };
  }
}

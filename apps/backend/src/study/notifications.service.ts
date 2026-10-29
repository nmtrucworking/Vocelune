import { HttpException, Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { DateTime } from 'luxon';
import { Database } from '../common/db';
import { config } from '../common/config';
import { encryptEmail } from '../common/crypto';
import { sendEmailDirect } from '../common/mailer';
import { studyReminderEmail, dailySummaryEmail } from '../email/vocelune-email';

@Injectable()
export class NotificationsService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(NotificationsService.name);
  private intervalTimer: NodeJS.Timeout | null = null;

  constructor(@Inject(Database) private db: Database) {}

  onApplicationBootstrap() {
    this.intervalTimer = setInterval(() => {
      void this.processScheduledNotifications().catch(err => {
        this.logger.error(`Error in scheduled notifications ticker: ${(err as Error).message}`);
      });
    }, 60000);
  }

  onApplicationShutdown() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  private getAppOrigin(): string {
    return (config.APP_ORIGIN || (config.NODE_ENV === 'production' ? 'https://vocelune.nguyenminhtruc.site' : 'http://localhost:3000')).replace(/\/+$/, '');
  }

  async sendStudyReminderForUser(
    user: { id: string; email: string; displayName: string; settings?: { timezone?: string; newCardsPerDay?: number } | null },
    targetDate: string,
    appOrigin: string = this.getAppOrigin()
  ): Promise<string> {
    const dueCount = await this.db.card.count({
      where: { userId: user.id, dueAt: { lte: new Date() }, suspended: false, deletedAt: null },
    });
    const targetNew = user.settings?.newCardsPerDay ?? 20;

    const email = studyReminderEmail({
      displayName: user.displayName || 'bạn',
      appOrigin,
      dateLabel: targetDate,
      dueCards: dueCount,
      newCardsAvailable: targetNew,
    });

    const payload = JSON.stringify({ text: email.text, html: email.html });

    const outbox = await this.db.emailOutbox.create({
      data: {
        userId: user.id,
        to: user.email,
        subject: email.subject,
        text: encryptEmail(payload),
        status: 'pending',
      },
    });

    try {
      await sendEmailDirect({
        to: user.email,
        subject: email.subject,
        text: email.text,
        html: email.html,
      });
      await this.db.emailOutbox.update({
        where: { id: outbox.id },
        data: { status: 'sent', sentAt: new Date(), text: '', lockedAt: null },
      });
    } catch (err) {
      await this.db.emailOutbox.update({
        where: { id: outbox.id },
        data: { status: 'failed', lockedAt: null },
      });
      throw err;
    }

    return outbox.id;
  }

  async sendDailySummaryForUser(
    user: { id: string; email: string; displayName: string; settings?: { timezone?: string } | null },
    targetDate: string,
    appOrigin: string = this.getAppOrigin()
  ): Promise<string> {
    const timezone = user.settings?.timezone || 'Asia/Ho_Chi_Minh';
    const dayStart = DateTime.fromISO(targetDate, { zone: timezone }).startOf('day').toJSDate();
    const dayEnd = DateTime.fromISO(targetDate, { zone: timezone }).endOf('day').toJSDate();

    const reviews = await this.db.reviewLog.findMany({
      where: {
        userId: user.id,
        reviewedAt: { gte: dayStart, lte: dayEnd },
      },
      include: {
        card: {
          include: {
            vocabItem: true,
          },
        },
      },
      orderBy: { reviewedAt: 'asc' },
    });

    const addedToday = await this.db.vocabItem.findMany({
      where: {
        userId: user.id,
        createdAt: { gte: dayStart, lte: dayEnd },
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const reviewedVocabMap = new Map<string, typeof reviews[0]['card']['vocabItem']>();
    for (const r of reviews) {
      if (r.card?.vocabItem) {
        reviewedVocabMap.set(r.card.vocabItem.id, r.card.vocabItem);
      }
    }
    const reviewedVocab = Array.from(reviewedVocabMap.values());

    const totalReviews = reviews.length;
    const goodEasyCount = reviews.filter(r => r.rating >= 3).length;

    const email = dailySummaryEmail({
      displayName: user.displayName || 'bạn',
      appOrigin,
      dateLabel: targetDate,
      reviewCount: totalReviews,
      goodEasyCount,
      uniqueWordsReviewed: reviewedVocab.length,
      addedWords: addedToday.length,
      words: reviewedVocab.map(v => v.word),
    });

    const payload = JSON.stringify({ text: email.text, html: email.html });

    const outbox = await this.db.emailOutbox.create({
      data: {
        userId: user.id,
        to: user.email,
        subject: email.subject,
        text: encryptEmail(payload),
        status: 'pending',
      },
    });

    try {
      await sendEmailDirect({
        to: user.email,
        subject: email.subject,
        text: email.text,
        html: email.html,
      });
      await this.db.emailOutbox.update({
        where: { id: outbox.id },
        data: { status: 'sent', sentAt: new Date(), text: '', lockedAt: null },
      });
    } catch (err) {
      await this.db.emailOutbox.update({
        where: { id: outbox.id },
        data: { status: 'failed', lockedAt: null },
      });
      throw err;
    }

    return outbox.id;
  }

  async processScheduledNotifications(now: Date = new Date()): Promise<{ remindersSent: number; summariesSent: number }> {
    let remindersSent = 0;
    let summariesSent = 0;

    const users = await this.db.user.findMany({
      include: { settings: true },
    });

    const appOrigin = this.getAppOrigin();

    for (const user of users) {
      const timezone = user.settings?.timezone || 'Asia/Ho_Chi_Minh';
      let localNow: DateTime;
      try {
        localNow = DateTime.fromJSDate(now).setZone(timezone);
      } catch {
        localNow = DateTime.fromJSDate(now).setZone('Asia/Ho_Chi_Minh');
      }

      const dateStr = localNow.toFormat('yyyy-MM-dd');

      // 1. Check 06:00 AM window (06:00 - 06:15 local time)
      const isMorningWindow = localNow.hour === 6 && localNow.minute >= 0 && localNow.minute <= 15;
      const allowReminder = (user.settings as any)?.emailReminderStudy !== false;

      if (isMorningWindow && allowReminder) {
        const existing = await this.db.emailOutbox.findFirst({
          where: {
            userId: user.id,
            subject: { contains: `[Vocelune] ⏰ Nhắc nhở lịch học hôm nay - ${dateStr}` },
          },
        });

        if (!existing) {
          try {
            await this.sendStudyReminderForUser(user, dateStr, appOrigin);
            remindersSent++;
            this.logger.log(`Queued 06:00 AM study reminder for user ${user.email} (${dateStr})`);
          } catch (err) {
            this.logger.error(`Failed to send 06:00 AM reminder for ${user.email}: ${(err as Error).message}`);
          }
        }
      }

      // 2. Check 11:59 PM (23:59) window (23:50 - 23:59 local time)
      const isEveningWindow = localNow.hour === 23 && localNow.minute >= 50 && localNow.minute <= 59;
      const allowSummary = (user.settings as any)?.emailDailySummary !== false;

      if (isEveningWindow && allowSummary) {
        const existing = await this.db.emailOutbox.findFirst({
          where: {
            userId: user.id,
            subject: { contains: `[Vocelune] 🌙 Tổng kết kiến thức ngày ${dateStr}` },
          },
        });

        if (!existing) {
          try {
            await this.sendDailySummaryForUser(user, dateStr, appOrigin);
            summariesSent++;
            this.logger.log(`Queued 11:59 PM knowledge summary for user ${user.email} (${dateStr})`);
          } catch (err) {
            this.logger.error(`Failed to send 11:59 PM summary for ${user.email}: ${(err as Error).message}`);
          }
        }
      }
    }

    return { remindersSent, summariesSent };
  }

  async triggerTestReminder(userId: string): Promise<{ ok: boolean; emailId: string; subject: string; message: string }> {
    const user = await this.db.user.findUniqueOrThrow({
      where: { id: userId },
      include: { settings: true },
    });
    const timezone = user.settings?.timezone || 'Asia/Ho_Chi_Minh';
    const localNow = DateTime.now().setZone(timezone);
    const dateStr = localNow.toFormat('yyyy-MM-dd');
    try {
      const id = await this.sendStudyReminderForUser(user, dateStr, this.getAppOrigin());
      return { ok: true, emailId: id, subject: `[Vocelune] ⏰ Nhắc nhở lịch học hôm nay - ${dateStr}`, message: 'Đã gửi email nhắc nhở học tập thành công!' };
    } catch (err) {
      this.logger.error(`Failed to trigger test reminder for ${user.email}: ${(err as Error).message}`);
      throw new HttpException((err as Error).message || 'Gửi email nhắc nhở thất bại.', 400);
    }
  }

  async triggerTestSummary(userId: string): Promise<{ ok: boolean; emailId: string; subject: string; message: string }> {
    const user = await this.db.user.findUniqueOrThrow({
      where: { id: userId },
      include: { settings: true },
    });
    const timezone = user.settings?.timezone || 'Asia/Ho_Chi_Minh';
    const localNow = DateTime.now().setZone(timezone);
    const dateStr = localNow.toFormat('yyyy-MM-dd');
    try {
      const id = await this.sendDailySummaryForUser(user, dateStr, this.getAppOrigin());
      return { ok: true, emailId: id, subject: `[Vocelune] 🌙 Tổng kết kiến thức ngày ${dateStr}`, message: 'Đã gửi email tổng kết kiến thức thành công!' };
    } catch (err) {
      this.logger.error(`Failed to trigger test summary for ${user.email}: ${(err as Error).message}`);
      throw new HttpException((err as Error).message || 'Gửi email tổng kết thất bại.', 400);
    }
  }
}

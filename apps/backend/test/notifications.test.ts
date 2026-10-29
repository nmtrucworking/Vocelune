import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DateTime } from 'luxon';
import { NotificationsService } from '../src/study/notifications.service';
import { decryptEmail } from '../src/common/crypto';

test('NotificationsService correctly schedules 06:00 AM study reminder and 11:59 PM summary', async () => {
  const sentEmails: any[] = [];
  const mockDb: any = {
    user: {
      findMany: async () => [
        {
          id: 'user-1',
          email: 'learner@vocelune.local',
          displayName: 'Test Learner',
          settings: {
            timezone: 'Asia/Ho_Chi_Minh',
            newCardsPerDay: 25,
            emailReminderStudy: true,
            emailDailySummary: true,
          },
        },
      ],
      findUniqueOrThrow: async () => ({
        id: 'user-1',
        email: 'learner@vocelune.local',
        displayName: 'Test Learner',
        settings: {
          timezone: 'Asia/Ho_Chi_Minh',
          newCardsPerDay: 25,
        },
      }),
    },
    card: {
      count: async () => 14,
    },
    vocabItem: {
      count: async () => 85,
      findMany: async () => [
        { id: 'v1', word: 'resilient', partOfSpeech: 'adjective', phonetic: '/rɪˈzɪljənt/', meaningVi: 'Kiên cường' },
      ],
    },
    reviewLog: {
      findMany: async () => [
        {
          id: 'r1',
          rating: 3,
          reviewedAt: new Date(),
          card: {
            vocabItem: { id: 'v1', word: 'resilient', partOfSpeech: 'adjective', phonetic: '/rɪˈzɪljənt/', meaningVi: 'Kiên cường' },
          },
        },
        {
          id: 'r2',
          rating: 4,
          reviewedAt: new Date(),
          card: {
            vocabItem: { id: 'v2', word: 'paradigm', partOfSpeech: 'noun', phonetic: '/ˈperədaɪm/', meaningVi: 'Mô hình' },
          },
        },
      ],
    },
    emailOutbox: {
      findFirst: async ({ where }: any) => {
        return sentEmails.find(e => e.userId === where.userId && e.subject.includes(where.subject?.contains || where.subject)) || null;
      },
      create: async ({ data }: any) => {
        const record = { id: `email-${sentEmails.length + 1}`, ...data };
        sentEmails.push(record);
        return record;
      },
    },
  };

  const service = new NotificationsService(mockDb);

  // 1. Test 06:00 AM window (06:05 AM in Asia/Ho_Chi_Minh)
  const morningTime = DateTime.fromISO('2026-10-30T06:05:00', { zone: 'Asia/Ho_Chi_Minh' }).toJSDate();
  const morningResult = await service.processScheduledNotifications(morningTime);
  assert.equal(morningResult.remindersSent, 1);
  assert.equal(morningResult.summariesSent, 0);

  const reminderEmail = sentEmails.find(e => e.subject.includes('06:00 AM') || e.subject.includes('Nhắc nhở lịch học'));
  assert.ok(reminderEmail);
  assert.ok(reminderEmail.subject.includes('2026-10-30'));
  const reminderText = decryptEmail(reminderEmail.text);
  assert.ok(reminderText.includes('14 từ'));
  assert.ok(reminderText.includes('25 từ'));

  // Should not send duplicate reminder on same day
  const secondMorningResult = await service.processScheduledNotifications(morningTime);
  assert.equal(secondMorningResult.remindersSent, 0);

  // 2. Test 11:59 PM window (23:55 PM in Asia/Ho_Chi_Minh)
  const eveningTime = DateTime.fromISO('2026-10-30T23:55:00', { zone: 'Asia/Ho_Chi_Minh' }).toJSDate();
  const eveningResult = await service.processScheduledNotifications(eveningTime);
  assert.equal(eveningResult.remindersSent, 0);
  assert.equal(eveningResult.summariesSent, 1);

  const summaryEmail = sentEmails.find(e => e.subject.includes('Tổng kết kiến thức'));
  assert.ok(summaryEmail);
  assert.ok(summaryEmail.subject.includes('2026-10-30'));
  const summaryText = decryptEmail(summaryEmail.text);
  assert.ok(summaryText.includes('resilient'));
  assert.ok(summaryText.includes('Kiên cường'));
  assert.ok(summaryText.includes('paradigm'));
  assert.ok(summaryText.includes('100%')); // 2 good/easy out of 2 reviews
});

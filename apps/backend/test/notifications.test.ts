process.env.NODE_ENV = 'test';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DateTime } from 'luxon';
import { NotificationsService } from '../src/study/notifications.service';
import { decryptEmail } from '../src/common/crypto';

test('NotificationsService correctly schedules 06:00 AM study reminder and 11:59 PM summary', async () => {
  let currentSimulatedTime: Date = new Date();
  const sentEmails: any[] = [];
  const mockDb: any = {
    user: {
      findMany: async ({ where }: any = {}) => {
        const allUsers = [
          {
            id: 'editorial-1',
            email: 'editorial@vocelune.com',
            displayName: 'Ban Biên Tập Vocelune',
            role: 'admin',
            settings: {
              timezone: 'Asia/Ho_Chi_Minh',
              newCardsPerDay: 20,
              emailReminderStudy: false,
              emailDailySummary: false,
            },
          },
          {
            id: 'user-1',
            email: 'learner@vocelune.local',
            displayName: 'Test Learner',
            role: 'user',
            settings: {
              timezone: 'Asia/Ho_Chi_Minh',
              newCardsPerDay: 25,
              emailReminderStudy: true,
              emailDailySummary: true,
            },
          },
        ];
        let filtered = allUsers;
        if (where?.email?.not) {
          filtered = filtered.filter(u => u.email !== where.email.not);
        }
        if (Array.isArray(where?.AND)) {
          for (const cond of where.AND) {
            if (cond?.email?.not) {
              if (typeof cond.email.not === 'string') {
                filtered = filtered.filter(u => u.email !== cond.email.not);
              } else if (cond.email.not.endsWith) {
                filtered = filtered.filter(u => !u.email.endsWith(cond.email.not.endsWith));
              }
            }
          }
        }
        return filtered;
      },
      findUniqueOrThrow: async () => ({
        id: 'user-1',
        email: 'learner@vocelune.local',
        displayName: 'Test Learner',
        role: 'user',
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
      count: async () => 2,
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
        return sentEmails.find(e => {
          if (e.userId !== where.userId) return false;
          if (where.createdAt) {
            const created = new Date(e.createdAt).getTime();
            if (created < where.createdAt.gte.getTime() || created > where.createdAt.lte.getTime()) return false;
          }
          if (where.OR) {
            return where.OR.some((cond: any) => e.subject.includes(cond.subject?.contains || cond.subject));
          }
          if (where.subject?.contains) {
            return e.subject.includes(where.subject.contains);
          }
          return true;
        }) || null;
      },
      create: async ({ data }: any) => {
        const record = { id: `email-${sentEmails.length + 1}`, createdAt: currentSimulatedTime, ...data, originalText: data.text };
        sentEmails.push(record);
        return record;
      },
      update: async ({ where, data }: any) => {
        const item = sentEmails.find(e => e.id === where.id);
        if (item) Object.assign(item, data);
        return item;
      },
    },
  };

  const service = new NotificationsService(mockDb);

  // 1. Test 06:00 AM window (06:05 AM in Asia/Ho_Chi_Minh)
  const morningTime = DateTime.fromISO('2026-10-30T06:05:00', { zone: 'Asia/Ho_Chi_Minh' }).toJSDate();
  currentSimulatedTime = morningTime;
  const morningResult = await service.processScheduledNotifications(morningTime);
  assert.equal(morningResult.remindersSent, 1);
  assert.equal(morningResult.summariesSent, 0);

  // Ensure NO email was sent to editorial@vocelune.com
  const editorialEmails = sentEmails.filter(e => e.to === 'editorial@vocelune.com');
  assert.equal(editorialEmails.length, 0);

  const reminderEmail = sentEmails.find(e => e.to === 'learner@vocelune.local' && (e.subject.includes('thẻ đến hạn') || e.subject.includes('Kế hoạch học')));
  assert.ok(reminderEmail);
  const reminderDecrypted = decryptEmail(reminderEmail.originalText || reminderEmail.text);
  const reminderPayload = JSON.parse(reminderDecrypted);
  assert.ok(reminderPayload.text.includes('14'));
  assert.ok(reminderPayload.text.includes('25'));

  // Should not send duplicate reminder on same day
  const secondMorningResult = await service.processScheduledNotifications(morningTime);
  assert.equal(secondMorningResult.remindersSent, 0);

  // 2. Test 11:59 PM window (23:55 PM in Asia/Ho_Chi_Minh)
  const eveningTime = DateTime.fromISO('2026-10-30T23:55:00', { zone: 'Asia/Ho_Chi_Minh' }).toJSDate();
  currentSimulatedTime = eveningTime;
  const eveningResult = await service.processScheduledNotifications(eveningTime);
  assert.equal(eveningResult.remindersSent, 0);
  assert.equal(eveningResult.summariesSent, 1);

  const summaryEmail = sentEmails.find(e => e.to === 'learner@vocelune.local' && e.subject.includes('Tổng kết'));
  assert.ok(summaryEmail);
  assert.ok(summaryEmail.subject.includes('2026-10-30'));
  const summaryDecrypted = decryptEmail(summaryEmail.originalText || summaryEmail.text);
  const summaryPayload = JSON.parse(summaryDecrypted);
  assert.ok(summaryPayload.text.includes('resilient'));
  assert.ok(summaryPayload.text.includes('100%')); // 2 good/easy out of 2 reviews

  // Should not send duplicate summary on same day
  const secondEveningResult = await service.processScheduledNotifications(eveningTime);
  assert.equal(secondEveningResult.summariesSent, 0);
});

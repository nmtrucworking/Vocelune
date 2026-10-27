import { test } from 'node:test';
import assert from 'node:assert/strict';
import { review } from '../src/study/scheduler';
import { studyDate, studyDayStart, nextStudyDay } from '../src/study/time';
import type { Card } from '@prisma/client';
const now = new Date('2026-10-28T10:00:00Z');
const card: Card = { id: crypto.randomUUID(), userId: crypto.randomUUID(), vocabItemId: crypto.randomUUID(), template: 'en_vi', state: 'new', dueAt: now, lastReviewedAt: null, stability: 0, difficulty: 0, elapsedDays: 0, scheduledDays: 0, learningSteps: 0, reps: 0, lapses: 0, version: 1, suspended: false, buriedUntil: null, deletedAt: null, schedulerConfigId: crypto.randomUUID() };
test('pinned FSRS fixture: Again/Hard/Good/Easy preserve real learning steps and finite schedules', () => {
  const outcomes = ([1, 2, 3, 4] as const).map(rating => review(card, rating, now, 0.9));
  assert.equal(outcomes[0].dueAt.toISOString(), '2026-10-28T10:01:00.000Z');
  assert.equal(outcomes[2].dueAt.toISOString(), '2026-10-28T10:10:00.000Z');
  assert.equal(outcomes[2].learningSteps, 1);
  assert.equal(outcomes[3].state, 'review');
  for (const result of outcomes) { assert.ok(result.dueAt > now); assert.ok(Number.isFinite(result.stability)); assert.equal(result.reps, 1); }
  const learning = { ...card, ...outcomes[2] };
  const graduated = review(learning, 3, new Date('2026-10-28T10:10:00Z'), 0.9);
  assert.equal(graduated.state, 'review'); assert.equal(graduated.learningSteps, 0);
});
test('study days honor IANA timezone, local rollover and DST', () => {
  assert.equal(studyDate(new Date('2026-10-27T20:59:00Z'), 'Asia/Ho_Chi_Minh', 4), '2026-10-27');
  assert.equal(studyDate(new Date('2026-10-27T21:01:00Z'), 'Asia/Ho_Chi_Minh', 4), '2026-10-28');
  const dst = new Date('2026-03-08T06:00:00Z');
  assert.equal(studyDayStart(dst, 'America/New_York', 4).toISOString(), '2026-03-07T09:00:00.000Z');
  assert.equal(nextStudyDay(dst, 'America/New_York', 4).toISOString(), '2026-03-08T08:00:00.000Z');
});
test('rollover compares local clock hours on the DST transition day', () => {
  assert.equal(studyDate(new Date('2026-03-08T08:30:00Z'), 'America/New_York', 4), '2026-03-08');
  assert.equal(studyDayStart(new Date('2026-03-08T08:30:00Z'), 'America/New_York', 4).toISOString(), '2026-03-08T08:00:00.000Z');
});

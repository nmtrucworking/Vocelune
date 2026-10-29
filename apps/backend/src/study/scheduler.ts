import { Card } from '@prisma/client';
import { createEmptyCard, fsrs, generatorParameters, State, Rating, type Card as EngineCard } from 'ts-fsrs';

// npm ts-fsrs 5.4.2 implements FSRS-6. Do not label it FSRS-7.
export const MODEL_VERSION = 'FSRS-6';
export const LIBRARY_VERSION = '5.4.2';
export const states = ['new', 'learning', 'review', 'relearning'] as const;
export const parameters = (retention: number, customWeights?: number[]) =>
  generatorParameters({
    request_retention: retention,
    ...(Array.isArray(customWeights) && customWeights.length > 0 ? { w: customWeights } : {}),
    enable_fuzz: false,
    learning_steps: ['1m', '10m'],
    relearning_steps: ['10m'],
  });

export function review(card: Card, rating: 1 | 2 | 3 | 4, now: Date, retention: number, customWeights?: number[]) {
  const engine = fsrs(parameters(retention, customWeights));
  const previous: EngineCard = {
    ...createEmptyCard(now), due: card.dueAt, stability: card.stability, difficulty: card.difficulty,
    elapsed_days: card.elapsedDays, scheduled_days: card.scheduledDays, learning_steps: card.learningSteps,
    reps: card.reps, lapses: card.lapses, state: states.indexOf(card.state as typeof states[number]) as State,
    last_review: card.lastReviewedAt ?? undefined,
  };
  const next = engine.next(previous, now, rating as Rating.Again | Rating.Hard | Rating.Good | Rating.Easy).card;
  return {
    state: states[next.state], dueAt: next.due, lastReviewedAt: now,
    stability: next.stability, difficulty: next.difficulty, elapsedDays: next.elapsed_days,
    scheduledDays: next.scheduled_days, learningSteps: next.learning_steps, reps: next.reps, lapses: next.lapses,
  };
}
export function scheduleSnapshot(card: Card) {
  return { state: card.state, dueAt: card.dueAt.toISOString(), lastReviewedAt: card.lastReviewedAt?.toISOString() ?? null,
    stability: card.stability, difficulty: card.difficulty, elapsedDays: card.elapsedDays, scheduledDays: card.scheduledDays,
    learningSteps: card.learningSteps, reps: card.reps, lapses: card.lapses, version: card.version, schedulerConfigId: card.schedulerConfigId };
}

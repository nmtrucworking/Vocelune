import {
  fsrs,
  createEmptyCard,
  Rating,
  State,
  type Card as FSRSCard,
  type RecordLogItem,
  generatorParameters,
} from 'ts-fsrs';
import { Card, CardState, FSRSRating, CardTemplate } from '@/types';

// Map internal FSRS State number to Vocelune CardState string
export function mapStateToString(state: State): CardState {
  switch (state) {
    case State.New:
      return 'new';
    case State.Learning:
      return 'learning';
    case State.Review:
      return 'review';
    case State.Relearning:
      return 'relearning';
    default:
      return 'new';
  }
}

export function mapStringToState(stateStr: CardState): State {
  switch (stateStr) {
    case 'new':
      return State.New;
    case 'learning':
      return State.Learning;
    case 'review':
      return State.Review;
    case 'relearning':
      return State.Relearning;
    default:
      return State.New;
  }
}

// Convert Vocelune Card model to FSRSCard object
export function toFSRSCard(card: Card): FSRSCard {
  return {
    due: new Date(card.dueAt),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsedDays,
    scheduled_days: card.scheduledDays,
    reps: card.reps,
    lapses: card.lapses,
    state: mapStringToState(card.state),
    last_review: card.lastReviewedAt ? new Date(card.lastReviewedAt) : undefined,
    learning_steps: card.learningSteps ?? 0,
  };
}

// Create fresh new card for a vocab item
export function createNewVoceluneCard(vocabItemId: string, template: CardTemplate = 'en_vi'): Card {
  const empty = createEmptyCard(new Date());
  return {
    id: `card_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    vocabItemId,
    template,
    state: 'new',
    dueAt: new Date().toISOString(),
    stability: empty.stability,
    difficulty: empty.difficulty,
    elapsedDays: empty.elapsed_days,
    scheduledDays: empty.scheduled_days,
    reps: empty.reps,
    lapses: empty.lapses,
    version: 1,
  };
}

export interface IntervalPreview {
  rating: FSRSRating;
  label: string;
  intervalText: string;
  description: string;
}

// Format duration diff into friendly label (e.g. "< 1m", "10m", "1d", "4d", "1.2m")
export function formatIntervalDuration(targetDate: Date, now: Date): string {
  const diffMs = targetDate.getTime() - now.getTime();
  const diffSecs = Math.max(0, Math.round(diffMs / 1000));
  if (diffSecs < 60) return '< 1m';
  const mins = Math.round(diffSecs / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d`;
  const months = (days / 30).toFixed(1);
  return `${months}mo`;
}

// Get preview intervals for the 4 FSRS choices
export function getFSRSPreviews(card: Card, desiredRetention: number = 0.9): IntervalPreview[] {
  const now = new Date();
  const params = generatorParameters({ request_retention: desiredRetention, enable_fuzz: false, learning_steps: ['1m', '10m'], relearning_steps: ['10m'] });
  const f = fsrs(params);
  const fCard = toFSRSCard(card);
  const repeated = f.repeat(fCard, now);

  const meta = [
    { rating: 1 as FSRSRating, label: 'Again', desc: 'Chưa nhớ / Quên' },
    { rating: 2 as FSRSRating, label: 'Hard', desc: 'Khó khăn khi nhớ' },
    { rating: 3 as FSRSRating, label: 'Good', desc: 'Nhớ sau gợi ý' },
    { rating: 4 as FSRSRating, label: 'Easy', desc: 'Nhớ tức thì & rất dễ' },
  ];

  return meta.map((m) => {
    const item = (repeated as unknown as Record<number, RecordLogItem>)[m.rating];
    const intervalText = formatIntervalDuration(item.card.due, now);
    return {
      rating: m.rating,
      label: m.label,
      intervalText,
      description: m.desc,
    };
  });
}

// Compute the updated card after grading
export function applyFSRSReview(
  card: Card,
  rating: FSRSRating,
  reviewTime: Date = new Date(),
  desiredRetention: number = 0.9
): { updatedCard: Card; nextState: CardState } {
  const params = generatorParameters({ request_retention: desiredRetention, enable_fuzz: false, learning_steps: ['1m', '10m'], relearning_steps: ['10m'] });
  const f = fsrs(params);
  const fCard = toFSRSCard(card);
  const repeated = f.repeat(fCard, reviewTime);
  const record = (repeated as unknown as Record<number, RecordLogItem>)[rating];

  const nextState = mapStateToString(record.card.state);

  const updatedCard: Card = {
    ...card,
    dueAt: record.card.due.toISOString(),
    lastReviewedAt: reviewTime.toISOString(),
    stability: record.card.stability,
    difficulty: record.card.difficulty,
    elapsedDays: record.card.elapsed_days,
    scheduledDays: record.card.scheduled_days,
    reps: record.card.reps,
    lapses: record.card.lapses,
    state: nextState,
    version: card.version + 1,
  };

  return { updatedCard, nextState };
}

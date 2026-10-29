import type { DictionaryAttribution, DictionaryProvider, LexicalMetadata } from '@/lib/dictionary';

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | 'unknown';

export type PartOfSpeech =
  | 'noun'
  | 'verb'
  | 'adjective'
  | 'adverb'
  | 'phrase'
  | 'idiom'
  | 'preposition'
  | 'conjunction'
  | 'other';

export type Dialect = 'en-gb' | 'en-us';

export type CardState = 'new' | 'learning' | 'review' | 'relearning';

export type FSRSRating = 1 | 2 | 3 | 4; // 1: Again, 2: Hard, 3: Good, 4: Easy

export type CardTemplate = 'en_vi' | 'vi_en' | 'audio_word' | 'definition_en';

export interface Sense {
  id: string;
  partOfSpeech: PartOfSpeech;
  definitionEn: string;
  meaningVi: string;
  exampleEn?: string;
  exampleVi?: string;
  cefr?: CEFRLevel;
}

export interface VocabItem {
  id: string;
  word: string;
  phonetic: string;
  dialect: Dialect;
  partOfSpeech: PartOfSpeech;
  definitionEn: string;
  meaningVi: string;
  exampleEn: string;
  exampleVi: string;
  cefr: CEFRLevel;
  sourceKind?: 'user' | 'licensed';
  provenance?: { provider?: DictionaryProvider; attribution?: DictionaryAttribution[]; persistedFields?: string[]; exportableFields?: string[]; licenseMode?: string } | null;
  lexicalMetadata?: Partial<LexicalMetadata> | null;
  cefrSource?: 'verified_3000' | 'verified_5000' | 'manual' | 'unknown';
  deckId: string;
  tags: string[];
  notes?: string;
  mediaId?: string | null;
  imageUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Deck {
  id: string;
  name: string;
  description: string;
  color?: string;
  icon?: string;
  topicGroup?: string;
  isPublic?: boolean;
  forkCount?: number;
  itemCount?: number;
  authorName?: string;
  authorAvatarUrl?: string | null;
  createdAt: string;
}

export interface PublicDeckPreview extends Deck {
  cefrStats: Record<string, number>;
  sampleWords: Partial<VocabItem>[];
}

export interface Card {
  id: string;
  vocabItemId: string;
  template: CardTemplate;
  state: CardState;
  dueAt: string; // ISO 8601 UTC
  lastReviewedAt?: string;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  version: number;
  suspended?: boolean;
  learningSteps?: number;
}

export interface ReviewLog {
  id: string;
  cardId: string;
  rating: FSRSRating;
  reviewedAt: string;
  beforeState: CardState;
  afterState: CardState;
  durationMs: number;
  voidedAt?: string;
}

export type StudyMode = 'flashcard' | 'typed' | 'mcq' | 'listening';

export interface TestQuestion {
  direction?: CardTemplate;
  audioPrompt?: string;
  id: string;
  vocabId: string;
  mode: 'mcq' | 'typed' | 'listening';
  prompt: string;
  subPrompt?: string;
  options?: string[];
  correctAnswer: string;
  userAnswer?: string;
  answerVersion?: number;
  isCorrect?: boolean;
  explanation: string;
  cefr: CEFRLevel;
  pos: PartOfSpeech;
}

export interface TestAttempt {
  id: string;
  title: string;
  startedAt: string;
  submittedAt?: string;
  deadlineAt?: string;
  durationSeconds: number;
  questions: TestQuestion[];
  score: number;
  maxScore: number;
  deckIds: string[];
  status: 'completed' | 'in_progress';
}

export interface UserSettings {
  displayName: string;
  avatarAssetId?: string | null;
  avatarUrl?: string | null;
  timezone: string;
  englishDialect: Dialect;
  dictionaryProvider: DictionaryProvider;
  dictionaryFallbackEnabled: boolean;
  desiredRetention: number; // 0.85 - 0.95
  newCardsPerDay: number;
  dayStartHour: number;
  soundEnabled: boolean;
  autoPronounce: boolean;
  emailReminderStudy?: boolean;
  emailDailySummary?: boolean;
}

export interface DailyActivity {
  date: string; // YYYY-MM-DD
  count: number;
  successCount: number;
}

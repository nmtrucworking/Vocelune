import { Inject, Injectable } from '@nestjs/common';
import { Prisma, TestAttempt, TestQuestion } from '@prisma/client';
import { z } from 'zod';
import { createHash, randomBytes } from 'node:crypto';
import { Database, json, Tx } from '../common/db';
import { fail, normalized, pagination, uuid } from '../common/http';
import { cefr, pos } from '../vocabulary/vocabulary.service';
import { StudyService } from '../study/study.service';

export const blueprintSchema = z.object({
  title: z.string().trim().min(1).max(200).default('Bài kiểm tra từ vựng'), deckIds: z.array(uuid).max(50).default([]),
  cefr: z.array(cefr).max(7).default([]), partOfSpeech: z.array(pos).max(10).default([]), tags: z.array(z.string().max(50)).max(30).default([]),
  size: z.number().int().min(5).max(100).default(10), mode: z.enum(['typed', 'mcq', 'listening', 'mixed']).default('mixed'),
  durationSeconds: z.number().int().min(60).max(7200).default(300), direction: z.enum(['en_vi', 'vi_en', 'definition_en']).default('en_vi'),
}).strict();
type Blueprint = z.infer<typeof blueprintSchema>;
export function seededShuffle<T>(items: T[], seed: string) {
  const result = [...items]; let counter = 0;
  for (let i = result.length - 1; i > 0; i--) {
    const n = createHash('sha256').update(`${seed}:${counter++}`).digest().readUInt32BE(0);
    const j = n % (i + 1); [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
@Injectable()
export class TestsService {
  constructor(@Inject(Database) private db: Database, @Inject(StudyService) private study: StudyService) {}
  private where(userId: string, b: Blueprint): Prisma.VocabItemWhereInput {
    return { userId, deletedAt: null, ...(b.deckIds.length ? { decks: { some: { deckId: { in: b.deckIds }, deck: { userId, deletedAt: null } } } } : {}),
      ...(b.cefr.length ? { cefr: { in: b.cefr } } : {}), ...(b.partOfSpeech.length ? { partOfSpeech: { in: b.partOfSpeech } } : {}), ...(b.tags.length ? { tags: { hasSome: b.tags } } : {}), ...(b.direction === 'definition_en' ? { definitionEn: { not: '' } } : {}) };
  }
  private async eligible(tx: Tx, userId: string, blueprint: Blueprint) {
    for (const deckId of blueprint.deckIds) {
      if (!await tx.deck.findFirst({ where: { id: deckId, userId, deletedAt: null } })) fail(404, 'NOT_FOUND', 'Không tìm thấy bộ từ.');
    }
    return tx.vocabItem.findMany({ where: this.where(userId, blueprint), orderBy: { id: 'asc' }, include: { cards: { where: { deletedAt: null } } } });
  }
  async preview(userId: string, body: unknown) {
    const blueprint = blueprintSchema.parse(body);
    const eligible = await this.eligible(this.db, userId, blueprint);
    const mcqEligible = eligible.filter(v => new Set(eligible.filter(o => o.id !== v.id && o.partOfSpeech === v.partOfSpeech && normalized(this.expectedAnswer(o, blueprint.direction)) !== normalized(this.expectedAnswer(v, blueprint.direction))).map(o => normalized(this.expectedAnswer(o, blueprint.direction)))).size >= 3).length;
    return { eligibleCount: eligible.length, mcqEligibleCount: mcqEligible, requestedCount: blueprint.size, feasible: eligible.length >= blueprint.size && (blueprint.mode === 'typed' || mcqEligible >= blueprint.size) };
  }
  async create(userId: string, body: unknown) {
    const blueprint = blueprintSchema.parse(body);
    const preview = await this.preview(userId, blueprint);
    if (!preview.feasible) fail(422, 'INSUFFICIENT_QUESTIONS', 'Không đủ từ hoặc đáp án nhiễu cùng từ loại. Hãy điều chỉnh bộ lọc hoặc chọn nhập đáp án.', preview);
    return this.db.testDefinition.create({ data: { userId, title: blueprint.title, blueprint: json(blueprint) } });
  }
  private expectedAnswer(v: { word: string; meaningVi: string; definitionEn: string }, direction: string) {
    return direction === 'vi_en' ? v.word : direction === 'definition_en' ? v.definitionEn : v.meaningVi;
  }
  async start(userId: string, definitionId: string) {
    return this.db.forUser(userId, async tx => {
      const definition = await tx.testDefinition.findFirst({ where: { id: definitionId, userId } });
      if (!definition) fail(404, 'NOT_FOUND', 'Không tìm thấy bài kiểm tra.');
      const blueprint = blueprintSchema.parse(definition.blueprint);
      let pool = await this.eligible(tx, userId, blueprint);
      if (blueprint.mode !== 'typed') pool = pool.filter(v => new Set(pool.filter(o => o.id !== v.id && o.partOfSpeech === v.partOfSpeech && normalized(this.expectedAnswer(o, blueprint.direction)) !== normalized(this.expectedAnswer(v, blueprint.direction))).map(o => normalized(this.expectedAnswer(o, blueprint.direction)))).size >= 3);
      if (pool.length < blueprint.size) fail(422, 'INSUFFICIENT_QUESTIONS', 'Kho từ đã thay đổi, không còn đủ câu hỏi.');
      const seed = randomBytes(16).toString('hex');
      const selected = seededShuffle(pool, seed).slice(0, blueprint.size);
      const now = new Date();
      const attempt = await tx.testAttempt.create({ data: { userId, definitionId, seed, maxScore: selected.length, startedAt: now, deadlineAt: new Date(now.getTime() + blueprint.durationSeconds * 1000), questions: { create: selected.map((v, ordinal) => {
        const mode = blueprint.mode === 'mixed' ? (['mcq', 'typed', 'listening'] as const)[ordinal % 3] : blueprint.mode;
        const direction = mode === 'typed' ? 'vi_en' : blueprint.direction;
        const correctAnswer = this.expectedAnswer(v, direction);
        const distractors = [...new Set(pool.filter(o => o.id !== v.id && o.partOfSpeech === v.partOfSpeech && normalized(this.expectedAnswer(o, direction)) !== normalized(correctAnswer)).map(o => this.expectedAnswer(o, direction)))];
        const options = mode !== 'typed' ? seededShuffle([correctAnswer, ...seededShuffle(distractors, `${seed}:${ordinal}:d`).slice(0, 3)], `${seed}:${ordinal}:o`) : undefined;
        return { ordinal, vocabId: v.id, cardId: v.cards.find(c => c.template === direction)?.id, correctAnswer,
          snapshot: json({ mode, audioPrompt: mode === 'listening' ? v.word : undefined, prompt: mode === 'listening' ? 'Nghe và chọn nghĩa phù hợp' : direction === 'vi_en' ? v.meaningVi : v.word, subPrompt: mode === 'typed' ? 'Nhập từ tiếng Anh' : v.phonetic, options, explanation: `${v.word} (${v.partOfSpeech}): ${v.meaningVi}. ${v.exampleEn}`, cefr: v.cefr, pos: v.partOfSpeech, direction }) };
      }) } }, include: { questions: { orderBy: { ordinal: 'asc' } }, definition: true } });
      return this.dto(attempt);
    });
  }
  dto(attempt: TestAttempt & { questions: TestQuestion[]; definition: { title: string; blueprint: Prisma.JsonValue } }) {
    const completed = attempt.status !== 'in_progress';
    const blueprint = blueprintSchema.parse(attempt.definition.blueprint);
    return { id: attempt.id, title: attempt.definition.title, startedAt: attempt.startedAt, submittedAt: attempt.submittedAt, deadlineAt: attempt.deadlineAt,
      durationSeconds: Math.max(0, Math.round(((attempt.submittedAt ?? new Date()).getTime() - attempt.startedAt.getTime()) / 1000)),
      status: completed ? 'completed' : 'in_progress', timedOut: attempt.status === 'timed_out', score: completed ? attempt.score : 0, maxScore: attempt.maxScore, deckIds: blueprint.deckIds,
      questions: attempt.questions.map(q => {
        const snapshot = q.snapshot as Record<string, unknown>;
        const { explanation, ...safe } = snapshot;
        return { ...safe, id: q.id, vocabId: q.vocabId, userAnswer: q.userAnswer ?? '', answerVersion: q.answerVersion, ...(completed ? { correctAnswer: q.correctAnswer, explanation, isCorrect: q.isCorrect } : {}) };
      }) };
  }
  async requireAttempt(tx: Tx, userId: string, attemptId: string) {
    const attempt = await tx.testAttempt.findFirst({ where: { id: attemptId, userId }, include: { questions: { orderBy: { ordinal: 'asc' } }, definition: true } });
    if (!attempt) fail(404, 'NOT_FOUND', 'Không tìm thấy lượt kiểm tra.');
    return attempt;
  }
  async answer(userId: string, attemptId: string, questionId: string, body: unknown) {
    const { answer, clientSequence } = z.object({ answer: z.string().max(5000), clientSequence: z.number().int().min(1).max(2147483646).optional() }).strict().parse(body);
    return this.db.forUser(userId, async tx => {
      const attempt = await this.requireAttempt(tx, userId, attemptId);
      if (attempt.status !== 'in_progress') fail(409, 'ATTEMPT_FINALIZED', 'Bài kiểm tra đã kết thúc.');
      if (attempt.deadlineAt <= new Date()) fail(409, 'ATTEMPT_EXPIRED', 'Đã hết thời gian làm bài.');
      const q = attempt.questions.find(q => q.id === questionId);
      if (!q) fail(404, 'NOT_FOUND', 'Không tìm thấy câu hỏi.');
      if (clientSequence !== undefined && clientSequence <= q.answerVersion) return { ok: true, staleIgnored: true, answerVersion: q.answerVersion };
      await tx.testQuestion.update({ where: { id: q.id }, data: { userAnswer: answer, answeredAt: new Date(), answerVersion: clientSequence ?? q.answerVersion + 1 } });
      return { ok: true };
    });
  }
  async submit(userId: string, attemptId: string, body: unknown = {}) {
    const { answers } = z.object({ answers: z.record(uuid, z.string().max(5000)).optional() }).strict().parse(body);
    return this.db.forUser(userId, async tx => {
      const attempt = await this.requireAttempt(tx, userId, attemptId);
      if (attempt.status !== 'in_progress') return this.dto(attempt);
      const now = new Date(), timedOut = attempt.deadlineAt <= now;
      if (!timedOut && answers) {
        for (const [qId, answer] of Object.entries(answers)) {
          if (!attempt.questions.some(q => q.id === qId)) fail(422, 'INVALID_QUESTION', 'Câu hỏi không thuộc bài này.');
          await tx.testQuestion.update({ where: { id: qId }, data: { userAnswer: answer, answeredAt: now, answerVersion: { increment: 1 } } });
        }
      }
      const questions = await tx.testQuestion.findMany({ where: { attemptId } });
      let score = 0;
      for (const q of questions) {
        const isCorrect = !!q.userAnswer?.trim() && normalized(q.userAnswer) === normalized(q.correctAnswer);
        if (isCorrect) score++;
        await tx.testQuestion.update({ where: { id: q.id }, data: { isCorrect } });
      }
      await tx.testAttempt.update({ where: { id: attemptId }, data: { status: timedOut ? 'timed_out' : 'submitted', score, submittedAt: timedOut ? attempt.deadlineAt : now } });
      return this.dto(await this.requireAttempt(tx, userId, attemptId));
    });
  }
  async report(userId: string, attemptId: string) {
    const attempt = await this.requireAttempt(this.db, userId, attemptId);
    if (attempt.status === 'in_progress' && attempt.deadlineAt <= new Date()) return this.submit(userId, attemptId);
    return this.dto(attempt);
  }
  async history(userId: string, query: unknown) {
    const q = pagination.parse(query);
    const items = await this.db.testAttempt.findMany({ where: { userId }, include: { questions: { orderBy: { ordinal: 'asc' } }, definition: true }, orderBy: { id: 'asc' }, take: q.limit + 1, ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}) });
    const hasMore = items.length > q.limit; if (hasMore) items.pop();
    return { items: items.map(a => this.dto(a)), nextCursor: hasMore ? items.at(-1)!.id : null };
  }
  async applyToSrs(userId: string, attemptId: string, body: unknown) {
    // No inferred ratings from recognition results. The learner must grade each revealed question explicitly.
    const { ratings, confirmation } = z.object({ confirmation: z.literal(true), ratings: z.array(z.object({ questionId: uuid, rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]), expectedCardVersion: z.number().int().min(1) }).strict()).min(1).max(100) }).strict().parse(body);
    return this.db.forUser(userId, async tx => {
      const attempt = await this.requireAttempt(tx, userId, attemptId);
      if (attempt.status === 'in_progress') fail(409, 'ATTEMPT_RUNNING', 'Cần nộp bài trước khi ghi vào lịch ôn.');
      let applied = 0;
      for (const input of ratings) {
        const question = attempt.questions.find(q => q.id === input.questionId);
        if (!question || !question.cardId) fail(422, 'AMBIGUOUS_CARD', 'Câu hỏi không liên kết một thẻ phù hợp.');
        if (question.srsAppliedAt) continue;
        const card = await this.study.requireCard(tx, userId, question.cardId);
        if (card.suspended || card.version !== input.expectedCardVersion) fail(409, 'STALE_CARD', 'Thẻ đã thay đổi hoặc bị tạm dừng.');
        const key = `test:${question.id}`;
        await this.study.recordInTx(tx, userId, card, input.rating, key, key, 0, 'test_opt_in', new Date());
        await tx.testQuestion.update({ where: { id: question.id }, data: { srsAppliedAt: new Date() } }); applied++;
      }
      return { applied };
    });
  }
}

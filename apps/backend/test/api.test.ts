import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import type { Database } from '../src/common/db';

let app: INestApplication, db: Database, http: ReturnType<typeof request>;
let alice: { cookie: string; csrf: string; userId: string; deckId: string }, bob: typeof alice;
const password = 'A-strong-local-test-password';
const uid = () => crypto.randomUUID();
const auth = (agent: typeof alice) => ({ Cookie: agent.cookie, 'X-CSRF-Token': agent.csrf });
const post = (path: string, agent: typeof alice, body: unknown = {}) => http.post(`/api/v1${path}`).set(auth(agent)).send(body);
const get = (path: string, agent: typeof alice) => http.get(`/api/v1${path}`).set(auth(agent));
async function register(name: string) {
  const response = await http.post('/api/v1/auth/register').send({ email: `${name}@example.test`, password, displayName: name }).expect(201);
  const cookies = response.headers['set-cookie'] as unknown as string[];
  assert.ok(cookies.some(c => c.includes('HttpOnly')));
  const cookie = cookies.map(c => c.split(';')[0]).join('; '), csrf = response.body.csrfToken;
  const snapshot = await http.get('/api/v1/bootstrap').set('Cookie', cookie).expect(200);
  return { cookie, csrf, userId: snapshot.body.user.id, deckId: snapshot.body.decks[0].id };
}
async function createWord(agent: typeof alice, word: string, meaningVi: string, extra = {}) {
  return (await post('/vocabulary', agent, { word, meaningVi, partOfSpeech: 'noun', deckId: agent.deckId, ...extra }).expect(201)).body;
}
before(async () => {
  const { createApp } = await import('../src/app');
  const { Database } = await import('../src/common/db');
  app = await createApp(); db = app.get(Database); http = request(app.getHttpServer());
  alice = await register('alice'); bob = await register('bob');
});
after(async () => { if (app) await app.close(); });

test('health, auth, CSRF, origin checks and private data isolation', async () => {
  await http.get('/api/v1/health/ready').expect(200);
  await http.get('/api/v1/vocabulary').expect(401);
  await http.post('/api/v1/decks').set('Cookie', alice.cookie).send({ name: 'forged' }).expect(403);
  await post('/decks', alice, { name: 'forged' }).set('Origin', 'https://evil.example').expect(403);
  await http.post('/api/v1/auth/login').send({ email: 'alice@example.test', password: 'wrong-long-password' }).expect(401);
  await post('/decks', alice, { name: 'New deck', userId: bob.userId }).expect(422);
  const word = await createWord(alice, 'bank', 'ngân hàng');
  await get(`/vocabulary/${word.id}`, bob).expect(404);
  await post('/vocabulary', bob, { word: 'private', meaningVi: 'riêng tư', partOfSpeech: 'noun', deckId: alice.deckId }).expect(404);
  assert.equal((await get('/vocabulary', bob)).body.total, 0);
  await get('/admin/health/operations', alice).expect(403);
});

test('same spelling supports different POS and senses; duplicate creation and unsafe CEFR claims rejected', async () => {
  const second = await createWord(alice, 'bank', 'bờ sông');
  const verb = await createWord(alice, 'bank', 'gửi tiền', { partOfSpeech: 'verb' });
  assert.notEqual(second.id, verb.id);
  await post('/vocabulary', alice, { word: 'BANK', meaningVi: 'ngân hàng', partOfSpeech: 'noun', deckId: alice.deckId }).expect(409);
  await post('/vocabulary', alice, { word: 'invented', meaningVi: 'tự nhập', partOfSpeech: 'noun', deckId: alice.deckId, cefrSource: 'verified_3000' }).expect(422);
  const item = (await get(`/vocabulary/${second.id}`, alice)).body;
  assert.equal(item.phonetic, ''); assert.equal(item.cefr, 'unknown');
  await http.patch(`/api/v1/vocabulary/${second.id}`).set(auth(alice)).send({ word: 'bank side', notes: 'updated' }).expect(200);
  await http.delete(`/api/v1/decks/${alice.deckId}`).set(auth(alice)).expect(409);
});

test('new account analytics reports null retention without fabricated events', async () => {
  const overview = (await get('/analytics/overview', bob).expect(200)).body;
  assert.equal(overview.observedRetention, null); assert.equal(overview.sampleSize, 0); assert.equal(overview.streak, 0);
});

let reviewCardId: string;
test('FSRS requires reveal, commits atomically, supports retries, rejects concurrent stale versions and audits undo', async () => {
  const word = await createWord(alice, 'memory', 'trí nhớ');
  const card = await db.card.findFirstOrThrow({ where: { vocabItemId: word.id } }); reviewCardId = card.id;
  const session = (await post('/study/sessions', alice).expect(201)).body;
  const base = { sessionId: session.id, rating: 3, expectedCardVersion: card.version, responseTimeMs: 1500 };
  await post(`/cards/${card.id}/reviews`, alice, { ...base, revealId: uid() }).set('Idempotency-Key', uid()).expect(409);
  const reveal = (await post(`/study/sessions/${session.id}/reveal`, alice, { cardId: card.id }).expect(201)).body;
  const input = { ...base, revealId: reveal.revealId }, key = uid();
  const [first, retry] = await Promise.all([
    post(`/cards/${card.id}/reviews`, alice, input).set('Idempotency-Key', key),
    post(`/cards/${card.id}/reviews`, alice, input).set('Idempotency-Key', key),
  ]);
  assert.equal(first.status, 201); assert.equal(retry.status, 201); assert.equal(first.body.reviewId, retry.body.reviewId);
  assert.equal(first.body.card.version, card.version + 1); assert.equal(first.body.card.reps, 1);
  assert.equal(first.body.scheduler.modelVersion, 'FSRS-6');
  assert.equal(await db.reviewLog.count({ where: { cardId: card.id } }), 1);
  await post(`/cards/${card.id}/reviews`, alice, { ...input, rating: 4 }).set('Idempotency-Key', key).expect(409);
  await post(`/cards/${card.id}/reviews`, alice, input).set('Idempotency-Key', uid()).expect(409);
  await post(`/reviews/${first.body.reviewId}/undo`, bob).expect(404);
  await post(`/reviews/${first.body.reviewId}/undo`, alice).expect(201);
  await post(`/reviews/${first.body.reviewId}/undo`, alice).expect(201);
  const restored = await db.card.findUniqueOrThrow({ where: { id: card.id } });
  assert.equal(restored.reps, 0); assert.equal(restored.state, 'new'); assert.ok(restored.version > first.body.card.version);
  assert.ok((await db.reviewLog.findUniqueOrThrow({ where: { id: first.body.reviewId } })).voidedAt);
  await assert.rejects(db.reviewLog.update({ where: { id: first.body.reviewId }, data: { rating: 1 } }));
});

test('daily new limit, suspend and retention versioning preserve existing schedules', async () => {
  await http.patch('/api/v1/me/settings').set(auth(alice)).send({ newCardsPerDay: 0, desiredRetention: 0.92 }).expect(200);
  const queue = (await get('/study/queue', alice)).body;
  assert.equal(queue.cards.filter((c: { state: string }) => c.state === 'new').length, 0);
  assert.equal(await db.schedulerConfig.count({ where: { userId: alice.userId } }), 2);
  const card = await db.card.findUniqueOrThrow({ where: { id: reviewCardId } });
  await http.patch(`/api/v1/cards/${card.id}`).set(auth(alice)).send({ suspended: true, expectedCardVersion: card.version }).expect(200);
  await http.patch(`/api/v1/cards/${card.id}`).set(auth(alice)).send({ suspended: false, expectedCardVersion: card.version }).expect(409);
  await http.patch('/api/v1/me/settings').set(auth(alice)).send({ newCardsPerDay: 20 }).expect(200);
  await http.patch('/api/v1/me/settings').set(auth(alice)).send({ timezone: 'not/a-zone' }).expect(422);
});

test('server snapshots, hides answers, scores and finalizes tests without touching SRS', async () => {
  for (let i = 0; i < 6; i++) await createWord(bob, `word${i}`, `nghĩa ${i}`);
  const before = await db.reviewLog.count({ where: { userId: bob.userId } });
  await post('/tests', bob, { size: 100, mode: 'typed' }).expect(422);
  const definition = (await post('/tests', bob, { size: 5, mode: 'typed', durationSeconds: 60 }).expect(201)).body;
  const attempt = (await post(`/tests/${definition.id}/attempts`, bob).expect(201)).body;
  assert.equal(attempt.questions.length, 5);
  assert.equal(attempt.questions[0].correctAnswer, undefined); assert.equal(attempt.questions[0].explanation, undefined);
  const snapshots = await db.testQuestion.findMany({ where: { attemptId: attempt.id }, orderBy: { ordinal: 'asc' } });
  assert.ok(!attempt.questions[0].prompt.includes(snapshots[0].correctAnswer));
  const answers = Object.fromEntries(snapshots.map((q, i) => [q.id, i < 3 ? `  ${q.correctAnswer.toUpperCase()}  ` : 'incorrect']));
  await http.put(`/api/v1/test-attempts/${attempt.id}/answers/${snapshots[0].id}`).set(auth(bob)).send({ answer: answers[snapshots[0].id] }).expect(200);
  await get(`/test-attempts/${attempt.id}/report`, alice).expect(404);
  const submitted = (await post(`/test-attempts/${attempt.id}/submit`, bob, { answers }).expect(201)).body;
  assert.equal(submitted.score, 3); assert.equal(submitted.status, 'completed'); assert.ok(submitted.questions[0].correctAnswer);
  const retry = (await post(`/test-attempts/${attempt.id}/submit`, bob, { answers: {} }).expect(201)).body;
  assert.equal(retry.score, 3);
  await http.put(`/api/v1/test-attempts/${attempt.id}/answers/${snapshots[0].id}`).set(auth(bob)).send({ answer: 'changed' }).expect(409);
  assert.equal(await db.reviewLog.count({ where: { userId: bob.userId } }), before);
  await post(`/test-attempts/${attempt.id}/apply-srs`, bob, { confirmation: true, ratings: [] }).expect(422);
  const mcq = (await post('/tests', bob, { size: 5, mode: 'mcq' }).expect(201)).body;
  const mcqAttempt = (await post(`/tests/${mcq.id}/attempts`, bob).expect(201)).body;
  assert.equal(mcqAttempt.questions[0].options.length, 4);
});

test('deadline rejects late answers and uses saved answers on timeout', async () => {
  const definition = (await post('/tests', bob, { size: 5, mode: 'typed', durationSeconds: 60 })).body;
  const attempt = (await post(`/tests/${definition.id}/attempts`, bob)).body;
  await db.testAttempt.update({ where: { id: attempt.id }, data: { startedAt: new Date(Date.now() - 120000), deadlineAt: new Date(Date.now() - 1000) } });
  await http.put(`/api/v1/test-attempts/${attempt.id}/answers/${attempt.questions[0].id}`).set(auth(bob)).send({ answer: 'late' }).expect(409);
  const report = (await get(`/test-attempts/${attempt.id}/report`, bob)).body;
  assert.equal(report.timedOut, true); assert.equal(report.score, 0);
});

test('import preview validates rows, keeps senses, skips examples, retries once and exports safely', async () => {
  const rows = [
    { word: 'imported', meaningVi: 'nghĩa thứ nhất', partOfSpeech: 'noun' },
    { word: 'imported', meaningVi: 'nghĩa thứ hai', partOfSpeech: 'noun' },
    { word: 'imported', meaningVi: 'nghĩa thứ nhất', partOfSpeech: 'noun' },
    { word: 'bad', meaningVi: '', partOfSpeech: 'noun' },
    { word: 'example', meaningVi: 'minh họa', partOfSpeech: 'noun', exampleOnly: true },
    { word: '=HYPERLINK("bad")', meaningVi: 'công thức dưới dạng văn bản', partOfSpeech: 'noun' },
  ];
  const key = uid(), payload = { deckId: alice.deckId, rows, policy: 'skip' };
  const preview = (await post('/imports', alice, payload).set('Idempotency-Key', key).expect(201)).body;
  const retry = (await post('/imports', alice, payload).set('Idempotency-Key', key).expect(201)).body;
  assert.equal(preview.id, retry.id);
  await post('/imports', alice, { ...payload, rows: rows.slice(0, 1) }).set('Idempotency-Key', key).expect(409);
  const result = (await post(`/imports/${preview.id}/commit`, alice).expect(201)).body;
  assert.equal(result.status, 'completed'); assert.deepEqual(result.result, { created: 3, updated: 0, skipped: 2, failed: 1 });
  const repeated = (await post(`/imports/${preview.id}/commit`, alice).expect(201)).body;
  assert.deepEqual(repeated.result, result.result);
  await get(`/imports/${preview.id}`, bob).expect(404);
  const csv = await post('/exports', alice, { format: 'csv' }).expect(201);
  assert.ok(csv.text.includes("'=HYPERLINK"));
  const exported = (await post('/exports', alice, { format: 'json' }).expect(201)).body;
  assert.equal(exported.schemaVersion, 1); assert.ok(exported.cards.length); assert.ok(!JSON.stringify(exported).includes('passwordHash'));
  const template = await get('/imports/template?format=xlsx', alice).expect(200);
  assert.ok(template.headers['content-type'].includes('spreadsheetml'));
});

test('CSV quoted newlines, XLSX template, ZIP limits and upload ownership', async () => {
  const csv = 'word,part_of_speech,meaning_vi,example_en\r\nquote,noun,"nghĩa, có dấu phẩy","line one\nline two"';
  const preview = await http.post('/api/v1/imports/upload').set(auth(alice)).set('Idempotency-Key', uid()).field('deckId', alice.deckId).attach('file', Buffer.from(csv), 'vocab.csv').expect(201);
  assert.equal(preview.body.rows[0].data.exampleEn, 'line one\nline two');
  await http.post('/api/v1/imports/upload').set(auth(bob)).set('Idempotency-Key', uid()).field('deckId', alice.deckId).attach('file', Buffer.from(csv), 'vocab.csv').expect(404);
  await http.post('/api/v1/imports/upload').set(auth(alice)).set('Idempotency-Key', uid()).field('deckId', alice.deckId).attach('file', Buffer.from('not zip'), 'vocab.xlsx').expect(422);
});

test('dictionary is explicit about missing credentials and never fabricates CEFR; missing R2 fails clearly', async () => {
  const dictionary = (await post('/dictionary/lookup', alice, { word: 'unknownword', partOfSpeech: 'noun', provider: 'oxford', allowFallback: false }).expect(201)).body;
  assert.deepEqual(dictionary.candidates, []); assert.ok(dictionary.warnings.length);
  await post('/media/upload-intents', alice, { purpose: 'flashcard', mime: 'image/svg+xml', sizeBytes: 50 }).expect(422);
  await post('/media/upload-intents', alice, { purpose: 'flashcard', mime: 'image/png', sizeBytes: 50 }).expect(503);
});

test('password reset tokens are encrypted, single-use, revoke all sessions; account deletion cascades', async () => {
  const charlie = await register('charlie');
  await post('/auth/password/forgot', charlie, { email: 'charlie@example.test' }).expect(201);
  const outbox = await db.emailOutbox.findFirstOrThrow({ where: { userId: charlie.userId } });
  assert.ok(!outbox.text.includes('token='));
  const { decryptEmail } = await import('../src/common/crypto');
  const token = new URL(decryptEmail(outbox.text).split(': ').slice(1).join(': ')).hash.split('token=')[1];
  const newPassword = 'A-new-strong-test-password';
  await http.post('/api/v1/auth/password/reset').send({ token, password: newPassword }).expect(201);
  await get('/me', charlie).expect(401);
  await http.post('/api/v1/auth/password/reset').send({ token, password: newPassword }).expect(422);
  const login = await http.post('/api/v1/auth/login').send({ email: 'charlie@example.test', password: newPassword }).expect(201);
  const cookie = (login.headers['set-cookie'] as unknown as string[]).map(c => c.split(';')[0]).join('; ');
  await http.delete('/api/v1/me').set({ Cookie: cookie, 'X-CSRF-Token': login.body.csrfToken }).send({ password: newPassword, confirmation: 'DELETE' }).expect(200);
  assert.equal(await db.user.findUnique({ where: { id: charlie.userId } }), null);
});

test('R2 adapter verifies ownership, file signatures and immutable object keys before allowing attachment', async () => {
  const { S3Client, HeadObjectCommand, GetObjectCommand, CopyObjectCommand } = await import('@aws-sdk/client-s3');
  const { MediaService } = await import('../src/integrations/media.service');
  const media = app.get(MediaService);
  const client = new S3Client({ region: 'auto', endpoint: 'https://storage.invalid', credentials: { accessKeyId: 'test', secretAccessKey: 'test' } });
  let copied = false;
  const image = Buffer.from([137,80,78,71,13,10,26,10]);
  client.send = (async (command: any) => {
    if (command instanceof HeadObjectCommand) return { ContentLength: image.length, ContentType: 'image/png', ETag: 'etag-version' };
    if (command instanceof GetObjectCommand) return { Body: { transformToByteArray: async () => image } };
    if (command instanceof CopyObjectCommand) { assert.equal(command.input.CopySourceIfMatch, 'etag-version'); copied = true; return {}; }
    throw new Error('Unexpected S3 call');
  }) as any;
  (media as any).client = client;
  const asset = await db.mediaAsset.create({ data: { userId: alice.userId, objectKey: `${alice.userId}/pending/test`, purpose: 'flashcard', mime: 'image/png', sizeBytes: image.length, expiresAt: new Date(Date.now() + 60000) } });
  await post(`/media/${asset.id}/complete`, bob).expect(404);
  await post(`/media/${asset.id}/complete`, alice).expect(201);
  assert.ok(copied);
  const ready = await db.mediaAsset.findUniqueOrThrow({ where: { id: asset.id } });
  assert.equal(ready.status, 'ready'); assert.notEqual(ready.objectKey, asset.objectKey);
  const word = await db.vocabItem.findFirstOrThrow({ where: { userId: alice.userId } });
  await post(`/media/${asset.id}/attach`, bob, { vocabId: word.id }).expect(404);
  await post(`/media/${asset.id}/attach`, alice, { vocabId: word.id }).expect(201);
  (media as any).client = undefined;
});

test('account deletion with cards, review events and tests cascades without breaking immutable history triggers', async () => {
  const dana = await register('dana');
  const word = await createWord(dana, 'privacy', 'quyền riêng tư');
  const card = await db.card.findFirstOrThrow({ where: { vocabItemId: word.id } });
  const session = (await post('/study/sessions', dana)).body;
  const reveal = (await post(`/study/sessions/${session.id}/reveal`, dana, { cardId: card.id })).body;
  await post(`/cards/${card.id}/reviews`, dana, { sessionId: session.id, revealId: reveal.revealId, expectedCardVersion: card.version, rating: 3, responseTimeMs: 1000 }).set('Idempotency-Key', uid()).expect(201);
  await http.delete('/api/v1/me').set(auth(dana)).send({ password, confirmation: 'DELETE' }).expect(200);
  assert.equal(await db.card.count({ where: { userId: dana.userId } }), 0);
  assert.equal(await db.reviewLog.count({ where: { userId: dana.userId } }), 0);
});

test('partial edits preserve omitted fields and licensed exports redact provider fields', async () => {
  const item = await createWord(alice, 'licensed-example', 'nghĩa tự biên soạn', { definitionEn: 'licensed provider text', exampleEn: 'licensed example', phonetic: '/licensed/', tags: ['keep'] });
  await http.patch(`/api/v1/vocabulary/${item.id}`).set(auth(alice)).send({ notes: 'new note' }).expect(200);
  const updated = (await get(`/vocabulary/${item.id}`, alice)).body;
  assert.equal(updated.meaningVi, item.meaningVi); assert.equal(updated.definitionEn, item.definitionEn); assert.deepEqual(updated.tags, ['keep']);
  await db.vocabItem.update({ where: { id: item.id }, data: { sourceKind: 'licensed', provenance: { persistedFields: ['definitionEn', 'exampleEn', 'phonetic'] } } });
  const exported = (await post('/exports', alice, { format: 'json' })).body;
  const row = exported.vocabulary.find((v: { id: string }) => v.id === item.id);
  assert.equal(row.meaningVi, item.meaningVi); assert.equal(row.definitionEn, ''); assert.equal(row.exampleEn, ''); assert.equal(row.phonetic, '');
  await post('/dictionary/vocabulary', alice, {}).expect(403);
});

test('autosave sequence prevents a delayed older answer from overwriting the latest one', async () => {
  const definition = (await post('/tests', bob, { size: 5, mode: 'typed' })).body;
  const attempt = (await post(`/tests/${definition.id}/attempts`, bob)).body;
  const questionId = attempt.questions[0].id;
  await http.put(`/api/v1/test-attempts/${attempt.id}/answers/${questionId}`).set(auth(bob)).send({ answer: 'newest', clientSequence: 3 }).expect(200);
  const delayed = await http.put(`/api/v1/test-attempts/${attempt.id}/answers/${questionId}`).set(auth(bob)).send({ answer: 'older', clientSequence: 2 }).expect(200);
  assert.equal(delayed.body.staleIgnored, true);
  assert.equal((await db.testQuestion.findUniqueOrThrow({ where: { id: questionId } })).userAnswer, 'newest');
});

test('undo restores sibling burial without restoring an old concurrency version', async () => {
  const item = await createWord(alice, 'siblings', 'các thẻ cùng nghĩa', { templates: ['en_vi', 'vi_en'] });
  const cards = await db.card.findMany({ where: { vocabItemId: item.id } });
  const card = cards[0], sibling = cards[1];
  const session = (await post('/study/sessions', alice)).body;
  const reveal = (await post(`/study/sessions/${session.id}/reveal`, alice, { cardId: card.id })).body;
  const graded = (await post(`/cards/${card.id}/reviews`, alice, { sessionId: session.id, revealId: reveal.revealId, expectedCardVersion: card.version, rating: 3, responseTimeMs: 1000 }).set('Idempotency-Key', uid()).expect(201)).body;
  const buried = await db.card.findUniqueOrThrow({ where: { id: sibling.id } }); assert.ok(buried.buriedUntil);
  await post(`/reviews/${graded.reviewId}/undo`, alice).expect(201);
  const restored = await db.card.findUniqueOrThrow({ where: { id: sibling.id } });
  assert.equal(restored.buriedUntil, null); assert.ok(restored.version > buried.version);
});

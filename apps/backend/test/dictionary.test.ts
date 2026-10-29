import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import type { Database } from '../src/common/db';
import type { DictionaryTransport } from '../src/integrations/dictionary/transport';
import { freeEntry, merriamEntry, oxfordEntry } from './fixtures/dictionary';

let app: INestApplication, db: Database, http: ReturnType<typeof request>, transport: DictionaryTransport;
let alice: { cookie: string; csrf: string; id: string; deckId: string }, bob: typeof alice;
let behavior = 'normal';
let calls: { host: string; url: string; headers: Record<string, string> }[] = [];
const password = 'A-strong-dictionary-test-password';
const headers = (user: typeof alice) => ({ Cookie: user.cookie, 'X-CSRF-Token': user.csrf });
const query = { word: 'orbit', partOfSpeech: 'noun', dialect: 'en-gb' };
const post = (path: string, user: typeof alice, body: unknown) => http.post(`/api/v1${path}`).set(headers(user)).send(body);
async function register(name: string) {
  const result = await http.post('/api/v1/auth/register').send({ email: `${name}@example.test`, password, displayName: name }).expect(201);
  const cookie = (result.headers['set-cookie'] as unknown as string[]).map(c => c.split(';')[0]).join('; ');
  const snapshot = (await http.get('/api/v1/bootstrap').set('Cookie', cookie).expect(200)).body;
  return { cookie, csrf: result.body.csrfToken, id: snapshot.user.id, deckId: snapshot.decks[0].id };
}
before(async () => {
  process.env.MERRIAM_WEBSTER_API_KEY = 'fake-test-mw-key-never-exposed';
  process.env.OXFORD_APP_ID = 'fake-test-oxford-id'; process.env.OXFORD_APP_KEY = 'fake-test-oxford-key';
  const { createApp } = await import('../src/app');
  const { Database } = await import('../src/common/db');
  const { DictionaryTransport } = await import('../src/integrations/dictionary/transport');
  const { DictionaryService } = await import('../src/integrations/dictionary.service');
  app = await createApp(); db = app.get(Database); transport = app.get(DictionaryTransport); http = request(app.getHttpServer());
  app.get(DictionaryService).translationFetcher = (async () => new Response(JSON.stringify([[['bản dịch theo nghĩa', 'sense', null, null]]]))) as typeof fetch;
  transport.fetcher = (async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push({ host: url.hostname, url: url.href, headers: init?.headers as Record<string, string> });
    if (behavior === 'all-notfound') return new Response(null, { status: 404 });
    if (url.hostname === 'en.wiktionary.org') return new Response(JSON.stringify({ en: [{ partOfSpeech: 'Noun', definitions: [{ definition: 'A path around another body.', examples: ['A sample orbit.'] }] }] }));
    if (url.hostname === 'www.dictionaryapi.com') {
      if (behavior === 'timeout') throw new Error('fake-test-mw-key-never-exposed in an upstream exception');
      if (behavior === 'rate') return new Response('upstream private error', { status: 429 });
      if (behavior === 'notfound') return new Response(null, { status: 404 });
      if (behavior === 'invalid-key') return new Response(JSON.stringify('Invalid API key: fake-test-mw-key-never-exposed'));
      return new Response(JSON.stringify(merriamEntry));
    }
    if (url.hostname.includes('oxforddictionaries.com')) return new Response(JSON.stringify(oxfordEntry));
    if (url.hostname === 'api.dictionaryapi.dev') {
      if (behavior === 'free-down') return new Response('unavailable', { status: 503 });
      const payload = structuredClone(freeEntry);
      if (behavior === 'no-license') payload[0].license.url = 'https://untrusted.example/license';
      return new Response(JSON.stringify(payload));
    }
    throw new Error('Unexpected provider host');
  }) as typeof fetch;
  alice = await register('dictionary-alice'); bob = await register('dictionary-bob');
});
after(async () => { if (app) await app.close(); });
beforeEach(async () => { behavior = 'normal'; await db.dictionaryProviderHealth.deleteMany(); });

test('provider catalogue exposes local and online sources without any credentials', async () => {
  const response = await http.get('/api/v1/dictionary/providers/status').set(headers(alice)).expect(200);
  assert.equal(response.body.defaultProvider, 'free_dictionary');
  assert.deepEqual(response.body.providers.map((p: { id: string }) => p.id), ['free_dictionary', 'merriam_webster', 'oxford', 'local_kaikki', 'local_wordnet', 'wiktionary', 'wordsapi', 'collins', 'datamuse']);
  assert.equal(response.body.providers.filter((p: { tier: string }) => p.tier === 'local').length, 2);
  assert.ok(!JSON.stringify(response.body).includes('fake-test'));
});
test('default source/fallback preferences persist per account and explicit lookup selection overrides them', async () => {
  await http.patch('/api/v1/me/settings').set(headers(alice)).send({ dictionaryProvider: 'merriam_webster', dictionaryFallbackEnabled: false }).expect(200);
  const lookup = (await post('/dictionary/lookup', alice, query).expect(201)).body;
  assert.equal(lookup.provider, 'merriam_webster'); assert.equal(lookup.candidates[0].senses.length, 3);
  assert.equal((await post('/dictionary/lookup', bob, query).expect(201)).body.provider, 'free_dictionary');
  assert.equal((await post('/dictionary/lookup', alice, { ...query, provider: 'oxford' }).expect(201)).body.provider, 'oxford');
  await post('/dictionary/lookup', alice, { ...query, provider: 'untrusted' }).expect(422);
  assert.ok(calls.some(call => call.host === 'www.dictionaryapi.com' && new URL(call.url).searchParams.get('key') === 'fake-test-mw-key-never-exposed'));
});
test('fallback is opt-in and reports actual source; provider errors never expose credential-bearing URLs', async () => {
  behavior = 'timeout'; calls = [];
  const failure = await post('/dictionary/lookup', alice, { ...query, provider: 'merriam_webster', allowFallback: false }).expect(503);
  assert.ok(!JSON.stringify(failure.body).includes('fake-test')); assert.equal(calls.length, 1);
  const fallback = (await post('/dictionary/lookup', alice, { ...query, provider: 'merriam_webster', allowFallback: true }).expect(201)).body;
  assert.equal(fallback.provider, 'free_dictionary'); assert.equal(fallback.requestedProvider, 'merriam_webster'); assert.equal(fallback.fallbackUsed, true);
  assert.ok(fallback.warnings.some((warning: string) => warning.includes('dự phòng')));
  behavior = 'notfound';
  assert.equal((await post('/dictionary/lookup', alice, { ...query, provider: 'merriam_webster', allowFallback: false })).body.fallbackUsed, false);
  behavior = 'normal';
});
test('upstream quotas and invalid keys produce safe errors without silently switching sources', async () => {
  behavior = 'rate'; await post('/dictionary/lookup', alice, { ...query, provider: 'merriam_webster', allowFallback: false }).expect(429);
  const callCount = calls.length;
  await post('/dictionary/lookup', alice, { ...query, provider: 'merriam_webster', allowFallback: false }).expect(503);
  assert.equal(calls.length, callCount, 'Retry-After cooldown prevents another request');
  await db.dictionaryProviderHealth.deleteMany();
  behavior = 'invalid-key';
  const result = await post('/dictionary/lookup', alice, { ...query, provider: 'merriam_webster', allowFallback: false }).expect(503);
  assert.ok(!JSON.stringify(result.body).includes('fake-test')); behavior = 'normal';
});
test('lookup previews do not persist vendor text; unlicensed sources cannot be saved through the licensed endpoint', async () => {
  const before = await db.vocabItem.count({ where: { userId: alice.id } });
  const lookup = (await post('/dictionary/lookup', alice, { ...query, provider: 'merriam_webster' })).body;
  assert.equal(await db.vocabItem.count({ where: { userId: alice.id } }), before);
  const sense = lookup.candidates[0].senses[0];
  await post('/dictionary/vocabulary', alice, { ...query, provider: 'merriam_webster', providerEntryRef: lookup.candidates[0].providerEntryRef, providerSenseRef: sense.providerSenseRef, meaningVi: 'tự nhập', deckId: alice.deckId }).expect(403);
});
test('open-licensed selected sense is revalidated, saved with attribution and exported with source metadata', async () => {
  const lookup = (await post('/dictionary/lookup', alice, { ...query, provider: 'free_dictionary' })).body;
  const candidate = lookup.candidates[0], sense = candidate.senses[1];
  const payload = { ...query, provider: 'free_dictionary', providerEntryRef: candidate.providerEntryRef, providerSenseRef: sense.providerSenseRef, meaningVi: 'nghĩa tự biên soạn', deckId: alice.deckId };
  const saved = (await post('/dictionary/vocabulary', alice, payload).expect(201)).body;
  assert.equal(saved.definitionEn, sense.definition.value); assert.equal(saved.exampleEn, sense.examples.items[0]); assert.equal(saved.cefr, 'unknown');
  assert.equal(saved.sourceKind, 'licensed'); assert.equal(saved.provenance.provider, 'free_dictionary'); assert.ok(saved.provenance.attribution[0].license.url);
  const exported = (await post('/exports', alice, { format: 'json' })).body.vocabulary.find((item: { id: string }) => item.id === saved.id);
  assert.equal(exported.definitionEn, saved.definitionEn); assert.equal(exported.provenance.provider, 'free_dictionary');
  const csv = await post('/exports', alice, { format: 'csv' }); assert.ok(csv.text.includes('source_note')); assert.ok(csv.text.includes('creativecommons.org'));
  await post('/dictionary/vocabulary', bob, payload).expect(404);
  await post('/dictionary/vocabulary', alice, { ...payload, providerSenseRef: 'forged-sense' }).expect(422);
});
test('absent source license prevents persistence even for the free provider', async () => {
  behavior = 'no-license';
  const lookup = (await post('/dictionary/lookup', bob, { ...query, provider: 'free_dictionary' })).body;
  const candidate = lookup.candidates[0];
  await post('/dictionary/vocabulary', bob, { ...query, provider: 'free_dictionary', providerEntryRef: candidate.providerEntryRef, providerSenseRef: candidate.senses[0].providerSenseRef, meaningVi: 'tự nhập', deckId: bob.deckId }).expect(403);
  behavior = 'normal';
});
test('shared Merriam-Webster quota is reserved atomically and survives account deletion', async () => {
  const user = await register('dictionary-quota-owner');
  const day = new Date().toISOString().slice(0, 10), provider = 'merriam_webster';
  const previous = await db.dictionaryQuota.findUnique({ where: { provider_day: { provider, day } } });
  await db.dictionaryQuota.upsert({ where: { provider_day: { provider, day } }, create: { provider, day, used: 999 }, update: { used: 999 } });
  calls = [];
  const results = await Promise.all([
    post('/dictionary/lookup', user, { ...query, provider, allowFallback: false }),
    post('/dictionary/lookup', bob, { ...query, provider, allowFallback: false }),
  ]);
  assert.deepEqual(results.map(result => result.status).sort(), [201, 429]); assert.equal(calls.length, 1);
  await http.delete('/api/v1/me').set(headers(user)).send({ password, confirmation: 'DELETE' }).expect(200);
  assert.equal((await db.dictionaryQuota.findUniqueOrThrow({ where: { provider_day: { provider, day } } })).used, 1000);
  await db.dictionaryQuota.update({ where: { provider_day: { provider, day } }, data: { used: previous?.used ?? 0 } });
});

test('translation endpoint returns Vietnamese translation and alternatives safely', async () => {
  const res = await post('/dictionary/translate', alice, { text: 'resilient', from: 'en', to: 'vi' });
  assert.equal(res.status, 201);
  assert.ok(typeof res.body.translation === 'string' && res.body.translation.length > 0);
  assert.ok(Array.isArray(res.body.alternatives));
});

test('manual fallback continues beyond Free Dictionary when it is unavailable', async () => {
  behavior = 'free-down'; calls = [];
  const result = (await post('/dictionary/lookup', alice, { ...query, provider: 'free_dictionary', allowFallback: true }).expect(201)).body;
  assert.equal(result.provider, 'wiktionary'); assert.equal(result.requestedProvider, 'free_dictionary');
  assert.equal(result.fallbackUsed, true);
  assert.deepEqual(calls.map(c => c.host), ['api.dictionaryapi.dev', 'en.wiktionary.org']);
  assert.equal(result.candidates[0].senses[0].provider, 'wiktionary');
});

test('AUTO keeps requests bounded and returns a partial empty response for unknown words', async () => {
  behavior = 'all-notfound'; calls = [];
  const result = (await post('/dictionary/lookup', alice, { ...query, word: 'nonexistent-lexical-fixture', provider: 'auto' }).expect(201)).body;
  assert.deepEqual(result.candidates, []); assert.equal(calls.length, 4);
  assert.equal(result.metrics.externalRequests, 4); assert.ok(result.warnings.length);
});

test('AUTO resolves domain senses locally, caches only open data and revalidates metadata on save', async () => {
  const { parseKaikki } = await import('../src/integrations/dictionary/importers');
  const candidate = parseKaikki({ word: 'pipeline', lang_code: 'en', pos: 'noun',
    sounds: [{ ipa: '/ˈpaɪplaɪn/', tags: ['US'] }], senses: [
      { glosses: ['A system of pipes used to transport oil.'], topics: ['engineering'], examples: [{ text: 'Oil flows through this pipeline.' }], synonyms: [{ word: 'conduit' }] },
      { glosses: ['A sequence of stages through which data passes.'], topics: ['computer science'], examples: [{ text: 'Our ETL pipeline processes customer data.' }], synonyms: [{ word: 'processing chain' }] },
    ] })!;
  const record = await db.dictionaryEntry.create({ data: { provider: 'local_kaikki', entryRef: candidate.providerEntryRef, lemma: 'pipeline', normalized: 'pipeline', partOfSpeech: 'noun', datasetVersion: 'test', candidate: JSON.parse(JSON.stringify(candidate)) } });
  try {
    calls = [];
    const input = { word: 'pipeline', partOfSpeech: 'noun', dialect: 'en-us', domain: 'computer_science', contextSentence: 'Our ETL pipeline processes customer data.', provider: 'auto' };
    const result = (await post('/dictionary/lookup', alice, input).expect(201)).body;
    assert.equal(calls.length, 0); assert.equal(result.metrics.externalRequests, 0);
    const selected = result.candidates[0].senses[0];
    assert.equal(selected.ranking.domainMatch, true); assert.equal(selected.ranking.verified, false);
    assert.equal(selected.cefr.value, null); assert.deepEqual(selected.synonyms, ['processing chain']);
    const cached = (await post('/dictionary/lookup', alice, input).expect(201)).body;
    assert.equal(cached.metrics.cacheHit, true);
    const payload = { ...input, provider: 'local_kaikki', strategy: 'auto_enrich', providerEntryRef: candidate.providerEntryRef, providerSenseRef: selected.providerSenseRef,
      meaningVi: 'chuỗi xử lý dữ liệu', deckId: alice.deckId };
    const saved = (await post('/dictionary/vocabulary', alice, payload).expect(201)).body;
    assert.deepEqual(saved.lexicalMetadata.domains, ['computer science']); assert.deepEqual(saved.lexicalMetadata.synonyms, ['processing chain']);
    assert.equal(saved.provenance.fieldSources.synonyms[0].provider, 'local_kaikki');
    assert.ok(saved.provenance.exportableFields.includes('synonyms'));
    const exported = (await post('/exports', alice, { format: 'json' }).expect(201)).body.vocabulary.find((v: { id: string }) => v.id === saved.id);
    assert.deepEqual(exported.lexicalMetadata.synonyms, ['processing chain']);
    await post('/dictionary/vocabulary', alice, { ...payload, lexicalMetadata: { cefr: 'C2' } }).expect(422);
    // Saving must bypass the lookup cache and observe a deleted/changed sense.
    await db.dictionaryEntry.delete({ where: { id: record.id } });
    await post('/dictionary/vocabulary', alice, payload).expect(422);
  } finally { await db.dictionaryEntry.deleteMany({ where: { id: record.id } }); }
});

test('shared monthly quotas prevent concurrent overages and zero quota prevents all network calls', async () => {
  const provider = 'collins', day = new Date().toISOString().slice(0, 7);
  await db.dictionaryQuota.upsert({ where: { provider_day: { provider, day } }, create: { provider, day, used: 1 }, update: { used: 1 } });
  calls = [];
  const req = { url: new URL('https://api.dictionaryapi.dev/api/v2/entries/en/orbit'), headers: {} };
  const results = await Promise.allSettled([transport.get(alice.id, provider, req, { monthly: 2 }), transport.get(bob.id, provider, req, { monthly: 2 })]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1); assert.equal(calls.length, 1);
  calls = [];
  await assert.rejects(transport.get(alice.id, 'wordsapi', req, { daily: 0 }));
  assert.equal(calls.length, 0);
});

test('three upstream failures open a shared circuit and an expired cooldown recovers', async () => {
  behavior = 'timeout'; calls = [];
  for (let i = 0; i < 3; i++) await post('/dictionary/lookup', alice, { ...query, provider: 'merriam_webster', allowFallback: false }).expect(503);
  await post('/dictionary/lookup', bob, { ...query, provider: 'merriam_webster', allowFallback: false }).expect(503);
  assert.equal(calls.length, 3);
  await db.dictionaryProviderHealth.update({ where: { provider: 'merriam_webster' }, data: { blockedUntil: new Date(0) } });
  behavior = 'normal';
  await post('/dictionary/lookup', bob, { ...query, provider: 'merriam_webster', allowFallback: false }).expect(201);
  assert.equal((await transport.health('merriam_webster')).state, 'healthy');
});

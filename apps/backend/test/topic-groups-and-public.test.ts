import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import type { Database } from '../src/common/db';

let app: INestApplication, db: Database, http: ReturnType<typeof request>;
let alice: { cookie: string; csrf: string; userId: string; deckId: string }, bob: typeof alice;
const password = 'A-strong-local-test-password';
const auth = (agent: typeof alice) => ({ Cookie: agent.cookie, 'X-CSRF-Token': agent.csrf });
const post = (path: string, agent: typeof alice, body: unknown = {}) => http.post(`/api/v1${path}`).set(auth(agent)).send(body);
const get = (path: string, agent: typeof alice) => http.get(`/api/v1${path}`).set(auth(agent));

async function register(name: string) {
  const response = await http.post('/api/v1/auth/register').send({ email: `${name}@example.test`, password, displayName: name }).expect(201);
  const cookies = response.headers['set-cookie'] as unknown as string[];
  const cookie = cookies.map(c => c.split(';')[0]).join('; '), csrf = response.body.csrfToken;
  const snapshot = await http.get('/api/v1/bootstrap').set('Cookie', cookie).expect(200);
  return { cookie, csrf, userId: snapshot.body.user.id, deckId: snapshot.body.decks[0].id };
}

before(async () => {
  const { createApp } = await import('../src/app');
  const { Database } = await import('../src/common/db');
  app = await createApp(); db = app.get(Database); http = request(app.getHttpServer());
  alice = await register('alice_topic'); bob = await register('bob_topic');
});

after(async () => { if (app) await app.close(); });

test('topic groups can be created, updated, and listed with aggregations', async () => {
  // Alice creates a deck in "IELTS / Academic"
  const ieltsDeck = (await post('/decks', alice, {
    name: 'IELTS Band 7.5 Vocabulary',
    description: 'High-frequency academic vocabulary for IELTS Writing & Speaking',
    topicGroup: 'IELTS / Academic',
    color: '#0D9488',
    icon: 'target',
    isPublic: true,
  }).expect(201)).body;

  assert.equal(ieltsDeck.name, 'IELTS Band 7.5 Vocabulary');
  assert.equal(ieltsDeck.topicGroup, 'IELTS / Academic');
  assert.equal(ieltsDeck.isPublic, true);

  // Alice adds words to this deck
  await post('/vocabulary', alice, {
    word: 'ubiquitous',
    partOfSpeech: 'adjective',
    meaningVi: 'phổ biến, có mặt ở khắp mọi nơi',
    definitionEn: 'present, appearing, or found everywhere',
    cefr: 'C1',
    deckId: ieltsDeck.id,
  }).expect(201);

  await post('/vocabulary', alice, {
    word: 'ephemeral',
    partOfSpeech: 'adjective',
    meaningVi: 'phù du, chóng tàn',
    definitionEn: 'lasting for a very short time',
    cefr: 'C2',
    deckId: ieltsDeck.id,
  }).expect(201);

  // Fetch topic groups for Alice
  const groupsRes = (await get('/decks/groups', alice).expect(200)).body;
  const ieltsGroup = groupsRes.find((g: { name: string; count: number }) => g.name === 'IELTS / Academic');
  assert.ok(ieltsGroup);
  assert.equal(ieltsGroup.count, 1);

  // Update deck topic group
  const updatedDeck = (await http.patch(`/api/v1/decks/${ieltsDeck.id}`).set(auth(alice)).send({
    topicGroup: 'IELTS / Advanced',
  }).expect(200)).body;
  assert.equal(updatedDeck.topicGroup, 'IELTS / Advanced');

  // Change back to IELTS / Academic
  await http.patch(`/api/v1/decks/${ieltsDeck.id}`).set(auth(alice)).send({
    topicGroup: 'IELTS / Academic',
  }).expect(200);
});

test('public decks can be discovered and previewed without authentication', async () => {
  const publicFeed = (await http.get('/api/v1/decks/public').expect(200)).body;
  assert.ok(Array.isArray(publicFeed.items));
  const deck = publicFeed.items.find((d: { name: string }) => d.name === 'IELTS Band 7.5 Vocabulary');
  assert.ok(deck, 'IELTS Deck must appear in public feed');
  assert.equal(deck.authorName, 'alice_topic');
  assert.equal(deck.itemCount, 2);

  // Filter public decks by topicGroup
  const filtered = (await http.get('/api/v1/decks/public?topicGroup=IELTS%20%2F%20Academic').expect(200)).body;
  assert.ok(filtered.items.some((d: { id: string }) => d.id === deck.id));

  // Search public decks by keyword
  const searchResults = (await http.get('/api/v1/decks/public?search=Band').expect(200)).body;
  assert.ok(searchResults.items.some((d: { id: string }) => d.id === deck.id));

  // Preview public deck
  const preview = (await http.get(`/api/v1/decks/public/${deck.id}`).expect(200)).body;
  assert.equal(preview.id, deck.id);
  assert.equal(preview.sampleWords.length, 2);
  assert.ok(preview.sampleWords.some((w: { word: string }) => w.word === 'ubiquitous'));
  assert.equal(preview.cefrStats['C1'], 1);
  assert.equal(preview.cefrStats['C2'], 1);
});

test('forking a public deck imports words and initial cards cleanly, and tracks fork count', async () => {
  const publicFeed = (await http.get('/api/v1/decks/public').expect(200)).body;
  const sourceDeck = publicFeed.items.find((d: { name: string }) => d.name === 'IELTS Band 7.5 Vocabulary');
  assert.ok(sourceDeck);

  // Bob forks Alice's public deck
  const forkRes = (await post(`/decks/public/${sourceDeck.id}/fork`, bob, {
    targetName: 'Bob IELTS Master',
  }).expect(201)).body;

  assert.equal(forkRes.deck.name, 'Bob IELTS Master');
  assert.equal(forkRes.importedCount, 2);

  // Bob's vocabulary now contains the 2 words with initial cards
  const bobVocab = (await get('/vocabulary', bob).expect(200)).body;
  assert.equal(bobVocab.total, 2);
  const words = bobVocab.items.map((w: { word: string }) => w.word);
  assert.ok(words.includes('ubiquitous'));
  assert.ok(words.includes('ephemeral'));

  // Alice's public deck now shows forkCount = 1
  const updatedPreview = (await http.get(`/api/v1/decks/public/${sourceDeck.id}`).expect(200)).body;
  assert.equal(updatedPreview.forkCount, 1);
});

test('private decks cannot be previewed or forked from public endpoints', async () => {
  const privateDeck = (await post('/decks', alice, {
    name: 'Top Secret Words',
    topicGroup: 'Chung',
    isPublic: false,
  }).expect(201)).body;

  await http.get(`/api/v1/decks/public/${privateDeck.id}`).expect(404);
  await post(`/decks/public/${privateDeck.id}/fork`, bob).expect(404);
});

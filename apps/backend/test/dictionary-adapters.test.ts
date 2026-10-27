import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FreeDictionaryAdapter } from '../src/integrations/dictionary/free.adapter';
import { MerriamWebsterAdapter, merriamAudioUrl, stripMwMarkup } from '../src/integrations/dictionary/merriam-webster.adapter';
import { OxfordAdapter } from '../src/integrations/dictionary/oxford.adapter';
import { freeEntry, merriamEntry, oxfordEntry } from './fixtures/dictionary';
const query = { word: 'orbit', partOfSpeech: 'noun' as const, dialect: 'en-gb' as const };
const mw = () => new MerriamWebsterAdapter({ apiKey: 'fake-private-key', persistenceApproved: false, persistFields: '' });
test('Free Dictionary preserves separate senses/POS, open source attribution and unknown CEFR', () => {
  const adapter = new FreeDictionaryAdapter();
  const result = adapter.parse(freeEntry, query);
  assert.equal(result.candidates.length, 1); assert.equal(result.candidates[0].senses.length, 2);
  const [first, second] = result.candidates[0].senses;
  assert.notEqual(first.providerSenseRef, second.providerSenseRef);
  assert.equal(first.examples.items[0], freeEntry[0].meanings[0].definitions[0].example);
  assert.equal(second.examples.items[0], freeEntry[0].meanings[0].definitions[1].example);
  assert.equal(first.cefr.value, null); assert.equal(first.attribution[0].license?.name, 'CC BY-SA 3.0');
  assert.ok(first.persistFields.includes('definitionEn'));
  assert.equal(first.pronunciations[0].dialect, 'en-us');
  assert.ok(result.warnings.some(w => w.includes('giọng')));
});
test('Free Dictionary does not grant persistence for absent/unrecognized license or unsafe URLs', () => {
  const payload = structuredClone(freeEntry);
  payload[0].license.url = 'https://untrusted.example/license';
  payload[0].phonetics[0].audio = 'javascript:alert(1)';
  const result = new FreeDictionaryAdapter().parse(payload, query);
  const sense = result.candidates[0].senses[0];
  assert.deepEqual(sense.persistFields, []); assert.equal(sense.pronunciations[0].audio.status, 'unavailable');
  assert.equal(sense.pronunciations[0].audio.playbackUrl, undefined);
});
test('Merriam-Webster parses nested sseq/pseq/bs and binds examples to the right sense', () => {
  const result = mw().parse(merriamEntry, query);
  const senses = result.candidates[0].senses;
  assert.equal(senses.length, 3); assert.equal(senses[0].definition.value, 'a synthetic route');
  assert.deepEqual(senses[0].examples.items, ['First sample sentence.']);
  assert.deepEqual(senses[1].examples.items, ['Second sample sentence.']); assert.deepEqual(senses[2].examples.items, []);
  assert.equal(result.candidates[0].lemma, 'orbit'); assert.equal(senses[0].pronunciations[0].dialect, 'en-us');
  assert.deepEqual(senses[0].persistFields, []); assert.ok(result.warnings.some(w => w.includes('giọng Mỹ')));
  assert.equal(senses[0].cefr.value, null);
});
test('Merriam-Webster supports suggestions, malformed/auth responses and official audio path rules', () => {
  assert.deepEqual(mw().parse(['orbit', 'orbital'], query).suggestions, ['orbit', 'orbital']);
  assert.throws(() => mw().parse('Invalid API key', query)); assert.throws(() => mw().parse({ unexpected: true }, query));
  assert.equal(merriamAudioUrl('bix001'), 'https://media.merriam-webster.com/audio/prons/en/us/mp3/bix/bix001.mp3');
  assert.ok(merriamAudioUrl('gg001')?.includes('/gg/')); assert.ok(merriamAudioUrl('3d001')?.includes('/number/'));
  assert.ok(merriamAudioUrl('orbit001')?.includes('/o/')); assert.equal(merriamAudioUrl('../escape'), undefined);
  assert.equal(stripMwMarkup('{bc}{it}sample{/it} {a_link|word} {sx|link||1}'), 'sample word link');
});
test('Oxford sandbox/production credentials stay on the fixed host and live-only text cannot persist', () => {
  const adapter = new OxfordAdapter({ appId: 'fake-id', appKey: 'fake-key', environment: 'sandbox', licenseMode: 'LIVE_ONLY', persistenceApproved: false, persistFields: 'definitionEn' });
  assert.equal(adapter.request(query).url.hostname, 'od-api-sandbox.oxforddictionaries.com');
  const result = adapter.parse(oxfordEntry, query);
  assert.equal(result.candidates[0].senses[0].pronunciations[0].dialect, 'en-gb');
  assert.deepEqual(result.candidates[0].senses[0].persistFields, []);
  assert.equal(adapter.status().persistenceSupported, false);
});
test('key-based sources enable only explicitly approved persistence fields', () => {
  const adapter = new MerriamWebsterAdapter({ apiKey: 'fake-key', persistenceApproved: true, persistFields: 'definitionEn,not_allowed,exampleEn,definitionEn' });
  assert.deepEqual(adapter.status().persistFields, ['definitionEn', 'exampleEn']);
  assert.equal(adapter.status().persistenceSupported, true);
  assert.ok(!JSON.stringify(adapter.status()).includes('fake-key'));
});

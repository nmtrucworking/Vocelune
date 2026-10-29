import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WordsApiAdapter } from '../src/integrations/dictionary/wordsapi.adapter';
import { WiktionaryAdapter } from '../src/integrations/dictionary/wiktionary.adapter';
import { CollinsAdapter } from '../src/integrations/dictionary/collins.adapter';
import { DatamuseAdapter } from '../src/integrations/dictionary/datamuse.adapter';
import { importPos, parseKaikki, parseWordnet, wordnetEntrySchema, wordnetSynsetSchema } from '../src/integrations/dictionary/importers';
import { mergeCandidates, sourceResult } from '../src/integrations/dictionary/lexical';
import { exportableField, hasRestrictedContent, redactForSharing } from '../src/integrations/dictionary/license-policy';
import { retryAfterMs } from '../src/integrations/dictionary/transport';
import { lookupSchema, persistFieldNames } from '../src/integrations/dictionary/contracts';
import type { AdapterResult, DictionaryCandidate, ProviderStatus } from '../src/integrations/dictionary/contracts';

const query = { word: 'pipeline', partOfSpeech: 'noun' as const, dialect: 'en-us' as const, domain: 'computer_science', contextSentence: 'Our ETL pipeline processes customer data.' };
const candidate = () => parseKaikki({ word: 'pipeline', lang_code: 'en', pos: 'noun', sounds: [{ ipa: '/paɪplaɪn/', tags: ['US'] }],
  senses: [{ glosses: ['A series of data processing stages.'], topics: ['computer science'], synonyms: [{ word: 'processing chain' }], examples: [{ text: 'An ETL pipeline processes data.' }] }] })!;
const status = (licenseMode: ProviderStatus['licenseMode'], id: ProviderStatus['id'] = 'local_kaikki'): ProviderStatus => ({ id, name: 'Fixture', configured: true, tier: 'local',
  licenseMode, persistenceSupported: licenseMode !== 'LIVE_ONLY', persistFields: licenseMode === 'LIVE_ONLY' ? [] : [...persistFieldNames], description: 'Fixture', attribution: { name: 'Fixture', url: 'https://example.org/' } });
const result = (c: DictionaryCandidate): AdapterResult => ({ candidates: [c], suggestions: [], warnings: [] });

test('WordsAPI preserves relationships per result and leaves CEFR/frequency unavailable', () => {
  const adapter = new WordsApiAdapter({ apiKey: 'private-key', dailyLimit: 20, persistenceApproved: false, persistFields: '' });
  const response = adapter.parse({ word: 'pipeline', pronunciation: { all: 'paɪplaɪn' }, frequency: 4.2, results: [
    { partOfSpeech: 'noun', definition: 'A data processing sequence.', synonyms: ['processing chain'], inCategory: ['computer science'] },
    { partOfSpeech: 'noun', definition: 'A tube transporting oil.', synonyms: ['conduit'], antonyms: [] },
  ] }, query);
  const senses = response.candidates[0].senses;
  assert.deepEqual(senses[0].synonyms, ['processing chain']); assert.deepEqual(senses[1].synonyms, ['conduit']);
  assert.equal(senses[0].pronunciations[0].dialect, 'unknown'); assert.deepEqual(senses[0].persistFields, []);
  assert.equal(senses[0].cefr.value, null); assert.equal(senses[0].frequency, undefined);
  assert.equal(adapter.request(query).url.hostname, 'wordsapiv1.p.rapidapi.com');
  assert.ok(!JSON.stringify(adapter.status()).includes('private-key'));
  assert.throws(() => adapter.parse({ results: 'changed' }, query));
  assert.equal(new WordsApiAdapter({ apiKey: 'key', dailyLimit: 0, persistenceApproved: false, persistFields: '' }).status().configured, false);
});

test('Wiktionary selects English/POS and converts markup to inert text with attribution', () => {
  const adapter = new WiktionaryAdapter('Vocelune/test (https://example.org)');
  const response = adapter.parse({ fr: [{ partOfSpeech: 'Noun', definitions: [{ definition: 'French only' }] }], en: [
    { partOfSpeech: 'Noun', definitions: [{ definition: 'A <a href="javascript:alert(1)">processing</a> &amp; transport system.<script>danger()</script>', examples: ['A <b>pipeline</b>.'] }] },
    { partOfSpeech: 'Verb', definitions: [{ definition: 'To process in stages.' }] },
  ] }, query);
  assert.equal(response.candidates.length, 1); const sense = response.candidates[0].senses[0];
  assert.equal(sense.definition.value, 'A processing & transport system.');
  assert.deepEqual(sense.examples.items, ['A pipeline .']); assert.ok(sense.attribution[0].url.endsWith('pipeline#English'));
  assert.equal(adapter.request(query).headers['User-Agent'], 'Vocelune/test (https://example.org)');
  assert.throws(() => adapter.parse({}, query));
});

test('Collins parses only explicit sense/POS tags and always remains LIVE_ONLY', () => {
  const adapter = new CollinsAdapter({ apiKey: 'private-collins', dictionary: 'english', monthlyLimit: 100 });
  const response = adapter.parse({ entryId: 'pipeline_1', entryLabel: 'pipeline', entryContent: '<entry><hom><pos>noun</pos><sense><def>A data path.</def><cit><quote>Data flows here.</quote></cit></sense><sense><def>A tube.</def><cit><quote>Oil flows here.</quote></cit></sense></hom><hom><pos>verb</pos><sense><def>To transmit.</def></sense></hom></entry>' }, query);
  assert.equal(response.candidates[0].senses.length, 2);
  assert.deepEqual(response.candidates[0].senses[0].examples.items, ['Data flows here.']);
  assert.deepEqual(response.candidates[0].senses[1].examples.items, ['Oil flows here.']);
  assert.equal(adapter.status().licenseMode, 'LIVE_ONLY'); assert.deepEqual(response.candidates[0].senses[0].persistFields, []);
  assert.equal(adapter.request(query).url.pathname.endsWith('/search/first'), true);
  assert.equal(adapter.request(query).headers.accessKey, 'private-collins');
  assert.deepEqual(adapter.parse({ entryId: 'changed', entryContent: '<div>Unknown markup</div>' }, query).candidates, []);
});

test('Datamuse offers only lexeme suggestions and never creates dictionary senses', () => {
  const adapter = new DatamuseAdapter({ enabled: true, apiKey: 'private' });
  const parsed = adapter.parse([{ word: 'workflow', score: 100 }]);
  assert.deepEqual(parsed.candidates, []); assert.deepEqual(parsed.suggestions, ['workflow']);
  assert.equal(adapter.status().persistenceSupported, false); assert.equal(adapter.request(query).url.searchParams.get('ml'), 'pipeline');
});

test('Kaikki importer binds translated meanings and synonyms to each sense, ignores unverified audio', () => {
  const entry = parseKaikki({ word: 'bank', lang_code: 'en', pos: 'noun', sounds: [{ ipa: '/bæŋk/', tags: ['UK'], audio: 'unlicensed.mp3' }], synonyms: [{ word: 'entry-wide ambiguity' }],
    senses: [{ glosses: ['An institution handling money.'], topics: ['finance'], translations: [{ code: 'vi', word: 'ngân hàng' }], synonyms: [{ word: 'depository' }] },
      { glosses: ['Land alongside a river.'], topics: ['geography'], translations: [{ code: 'vi', word: 'bờ sông' }] }] })!;
  assert.deepEqual(entry.senses[0].synonyms, ['depository']); assert.deepEqual(entry.senses[1].synonyms, []);
  assert.equal(entry.senses[0].meaningVi?.value, 'ngân hàng'); assert.equal(entry.senses[1].meaningVi?.value, 'bờ sông');
  assert.equal(entry.senses[0].pronunciations[0].dialect, 'en-gb'); assert.equal(entry.senses[0].pronunciations[0].audio.status, 'unavailable');
  assert.equal(parseKaikki({ word: 'banque', lang_code: 'fr', pos: 'noun' }), null);
  assert.equal(parseKaikki({ word: 'broken', lang_code: 'en', senses: 'invalid' }), null);
});

test('WordNet importer resolves synonyms/domains/antonyms through identifiers and retains homograph POS', () => {
  const synsets = new Map([
    ['data-n', wordnetSynsetSchema.parse({ definition: ['A data sequence.'], members: ['pipeline', 'processing chain'], partOfSpeech: 'n', domain_topic: ['domain-n'], example: ['An ETL pipeline.'] })],
    ['domain-n', wordnetSynsetSchema.parse({ definition: ['Computing.'], members: ['computer science'], partOfSpeech: 'n' })],
  ]);
  const parsed = parseWordnet('pipeline', 'n-1', wordnetEntrySchema.parse({ pronunciation: [{ value: 'paɪplaɪn' }], sense: [{ id: 'sense-1', synset: 'data-n', antonym: ['opposite-1'] }] }), synsets, new Map([['opposite-1', 'fixture opposite']]))!;
  assert.equal(parsed.partOfSpeech, 'noun'); assert.equal(importPos('v-2'), 'verb');
  assert.deepEqual(parsed.senses[0].synonyms, ['processing chain']); assert.deepEqual(parsed.senses[0].domains, ['computer science']);
  assert.deepEqual(parsed.senses[0].antonyms, ['fixture opposite']); assert.equal(parsed.senses[0].cefr.value, null);
});

test('context ranking prioritizes matching domain without claiming verified semantics or transferring relations', () => {
  const primary = candidate();
  const oil = candidate(); oil.providerEntryRef = 'oil'; oil.senses[0].definition.value = 'A system of tubes transporting oil.';
  oil.senses[0].domains = ['engineering']; oil.senses[0].synonyms = ['conduit'];
  const ranked = mergeCandidates([oil, primary], query);
  assert.equal(ranked[0].senses[0].definition.value, primary.senses[0].definition.value);
  assert.deepEqual(ranked[1].senses[0].synonyms, ['conduit']); assert.equal(ranked[0].senses[0].ranking?.verified, false);
});

test('equal senses can fill missing metadata with donor rights without laundering LIVE_ONLY text', () => {
  const primary = candidate(); primary.senses[0].synonyms = [];
  sourceResult(result(primary), status('OPEN_LICENSE'), query);
  const donor = candidate(); sourceResult(result(donor), status('LIVE_ONLY', 'wordsapi'), query);
  const merged = mergeCandidates([primary, donor], query);
  assert.equal(merged.length, 1); const sense = merged[0].senses[0];
  assert.deepEqual(sense.synonyms, ['processing chain']); assert.ok(!sense.persistFields.includes('synonyms'));
  assert.equal(sense.provenance?.synonyms?.[0].provider, 'wordsapi'); assert.equal(sense.provenance?.synonyms?.[0].persistable, false);
});

test('Retry-After supports seconds, HTTP dates, missing and invalid values', () => {
  const now = Date.UTC(2026, 9, 29);
  assert.equal(retryAfterMs('120', now), 120000);
  assert.equal(retryAfterMs(new Date(now + 90000).toUTCString(), now), 90000);
  assert.equal(retryAfterMs('invalid', now), 60000); assert.equal(retryAfterMs(null, now), 60000);
});

test('lookup accepts context and AUTO but rejects forged providers and unknown metadata', () => {
  assert.equal(lookupSchema.parse({ ...query, provider: 'auto', strategy: 'auto_enrich' }).domain, 'computer_science');
  assert.equal(lookupSchema.safeParse({ ...query, provider: 'forged' }).success, false);
  assert.equal(lookupSchema.safeParse({ ...query, cefr: 'C2' }).success, false);
});

// Cross the license boundary for every persisted field. These are permission
// regression cases, not a claim of semantic accuracy on real dictionary words.
for (const field of persistFieldNames) for (const mode of ['OPEN_LICENSE', 'PERSIST_LICENSED', 'LIVE_ONLY'] as const) for (const claimsExport of [false, true]) {
  test(`export policy: ${field}, ${mode}, export requested=${claimsExport}`, () => {
    const provenance = { provider: 'local_kaikki', licenseMode: mode, persistedFields: [field], exportableFields: claimsExport ? [field] : [],
      fieldSources: { [field]: [{ provider: 'local_kaikki', licenseMode: mode, persistable: mode !== 'LIVE_ONLY', exportable: claimsExport, attribution: [] }] } };
    const allowed = mode === 'OPEN_LICENSE' && claimsExport;
    assert.equal(exportableField(provenance, field), allowed);
    assert.equal(hasRestrictedContent({ sourceKind: 'licensed', provenance }), !allowed);
    const exported = redactForSharing({ sourceKind: 'licensed', provenance, definitionEn: 'definition', lexicalMetadata: { [field]: 'restricted value' } });
    assert.equal(Object.hasOwn(exported.lexicalMetadata, field), allowed);
    if (field === 'definitionEn') assert.equal(exported.definitionEn, allowed ? 'definition' : '');
  });
}

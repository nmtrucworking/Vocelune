import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arpabetToIpa, formatIpa, resolveWordIpa } from '../src/integrations/dictionary/ipa-converter';

test('arpabetToIpa converts CMU Arpabet tokens to standard IPA with accurate stress placement', () => {
  // Syllables with initial stress
  assert.equal(arpabetToIpa('W AO1 T ER0'), '/ˈwɔːtər/');
  assert.equal(arpabetToIpa('AE1 P AH0 L'), '/ˈæpəl/');
  assert.equal(arpabetToIpa('S K EH1 JH UH0 L'), '/ˈskedʒʊl/');

  // Syllables with internal stress
  assert.equal(arpabetToIpa('D IH0 V EH1 L AH0 P ER0'), '/dɪˈveləpər/');
  assert.equal(arpabetToIpa('R IH0 Z IH1 L Y AH0 N T'), '/rɪˈzɪljənt/');
  assert.equal(arpabetToIpa('IH0 F EH1 M ER0 AH0 L'), '/ɪˈfemərəl/');

  // Empty or invalid input
  assert.equal(arpabetToIpa(''), '');
});

test('formatIpa normalizes IPA strings into standard slashes', () => {
  assert.equal(formatIpa('/həˈloʊ/'), '/həˈloʊ/');
  assert.equal(formatIpa('[həˈloʊ]'), '/həˈloʊ/');
  assert.equal(formatIpa('həˈloʊ'), '/həˈloʊ/');
  assert.equal(formatIpa('   '), '');
});

test('resolveWordIpa resolves common words via dictionary or CMU Arpabet fallback', async () => {
  const result = await resolveWordIpa('water', 'en-us');
  assert.ok(result);
  assert.ok(result.ipa.startsWith('/') && result.ipa.endsWith('/'));
  assert.ok(['free_dictionary', 'datamuse_arpabet'].includes(result.source));
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SentenceCheckerService } from '../src/study/sentence-checker.service';

const mockDb: any = {
  vocabItem: {
    findMany: async () => [],
  },
};

test('detectTargetWord detects exact words and morphological inflections', () => {
  const service = new SentenceCheckerService(mockDb);

  // Exact match
  assert.equal(service.detectTargetWord('She showed great perseverance.', 'perseverance').found, true);

  // Inflections: past tense
  assert.equal(service.detectTargetWord('They persevered despite the rain.', 'persevere').found, true);
  assert.equal(service.detectTargetWord('They persevered despite the rain.', 'persevere').matchedWord, 'persevered');

  // Inflections: gerund / ing
  assert.equal(service.detectTargetWord('Keep persevering in your studies.', 'persevere').found, true);

  // Irregular verbs: go -> went, gone
  assert.equal(service.detectTargetWord('Yesterday he went home early.', 'go').found, true);
  assert.equal(service.detectTargetWord('Yesterday he went home early.', 'go').matchedWord, 'went');

  // Multi-word phrases and idioms
  assert.equal(service.detectTargetWord('I am looking forward to hearing from you.', 'look forward to').found, true);

  // Negative case
  assert.equal(service.detectTargetWord('The quick brown fox jumps.', 'perseverance').found, false);
});

test('classifySentenceType distinguishes full sentences from phrases', () => {
  const service = new SentenceCheckerService(mockDb);

  assert.equal(service.classifySentenceType('She persevered through all hardships.'), 'sentence');
  assert.equal(service.classifySentenceType('persevering with great courage'), 'phrase');
  assert.equal(service.classifySentenceType('a remarkable achievement'), 'phrase');
  assert.equal(service.classifySentenceType('I believe in you.'), 'sentence');
});

test('evaluate checks grammar, generates corrections and suggestions for sentences and phrases', async () => {
  const service = new SentenceCheckerService(mockDb);

  // Test correct sentence
  const resValid = await service.evaluate('user-1', {
    sentence: 'She persevered through all hardships.',
    word: 'persevere',
    partOfSpeech: 'verb',
  });

  assert.equal(resValid.hasTargetWord, true);
  assert.equal(resValid.matchedWord, 'persevered');
  assert.equal(resValid.grammarCorrect, true);
  assert.ok(resValid.score >= 85);
  assert.ok(resValid.improvedSentences.length > 0);
  assert.ok(resValid.improvedPhrases.length > 0);

  // Test phrase without terminal punctuation (should not fail for missing period)
  const resPhrase = await service.evaluate('user-1', {
    sentence: 'persevere through difficult times',
    word: 'persevere',
    partOfSpeech: 'verb',
  });

  assert.equal(resPhrase.hasTargetWord, true);
  assert.equal(resPhrase.analysis.sentenceType, 'phrase');
  assert.ok(resPhrase.improvedPhrases.length > 0);

  // Test sentence with deliberate grammar mistake
  const resGrammarError = await service.evaluate('user-1', {
    sentence: 'He persevered and see a apple.',
    word: 'persevere',
    partOfSpeech: 'verb',
  });

  assert.equal(resGrammarError.hasTargetWord, true);
  assert.ok(resGrammarError.errors.length > 0);
  assert.ok(resGrammarError.correctedSentence.includes('an apple'));

  // Test sentence missing target word
  const resMissingWord = await service.evaluate('user-1', {
    sentence: 'This is a completely unrelated sentence.',
    word: 'persevere',
  });

  assert.equal(resMissingWord.hasTargetWord, false);
  assert.equal(resMissingWord.isValid, false);
  assert.ok(resMissingWord.feedback.includes('persevere'));
});

// Synthetic contract fixtures. They describe parser shapes, not real dictionary content.
export const freeEntry = [{
  word: 'orbit', phonetic: '/sample/',
  license: { name: 'CC BY-SA 3.0', url: 'https://creativecommons.org/licenses/by-sa/3.0' },
  sourceUrls: ['https://en.wiktionary.org/wiki/orbit'],
  phonetics: [{ text: '/sample/', audio: 'https://example.test/orbit-us.mp3' }],
  meanings: [{ partOfSpeech: 'noun', definitions: [
    { definition: 'A synthetic route around a sample center.', example: 'The sample follows a circular route.' },
    { definition: 'A second synthetic sense with its own example.', example: 'A second example for the second sense.' },
  ] }, { partOfSpeech: 'verb', definitions: [{ definition: 'To follow a synthetic path.' }] }],
}];
export const merriamEntry = [{
  meta: { id: 'orbit:1', uuid: 'synthetic-mw-entry' },
  hwi: { hw: 'or*bit', prs: [{ ipa: 'sample-ipa', sound: { audio: 'orbit001' } }] }, fl: 'noun',
  def: [{ sseq: [
    [['sense', { sn: '1', dt: [['text', '{bc}a {it}synthetic{/it} route'], ['vis', [{ t: 'First {it}sample{/it} sentence.' }]]] }]],
    [['pseq', [
      ['sense', { sn: '2a', dt: [['text', '{bc}another sample {a_link|path}'], ['vis', [{ t: 'Second sample sentence.' }]]] }],
      ['bs', { sense: { dt: [['text', '{bc}a bound sample sense']] } }],
    ]]],
  ] }], shortdef: ['Summary must not replace the separate detailed senses.'],
}];
export const oxfordEntry = { results: [{ id: 'synthetic-oxford-entry', word: 'orbit', lexicalEntries: [{
  lexicalCategory: { id: 'noun' }, text: 'orbit', entries: [{ pronunciations: [{ phoneticSpelling: '/sample-gb/', audioFile: 'https://example.test/orbit-gb.mp3' }], senses: [
    { id: 'oxford-sense-1', definitions: ['Synthetic Oxford fixture sense.'], examples: [{ text: 'A synthetic example.' }] },
  ] }],
}] }] };

import { z } from 'zod';
import { hash } from '../../identity/security';
import { cefrUnknown, DictionaryCandidate, examplesField, httpsUrl, normalizePos, PersistField, textField } from './contracts';
import { normalizeWord } from './lexical';

const strings = z.array(z.string()).default([]);
const relation = z.object({ word: z.string(), sense: z.string().optional() });
const kaikkiSchema = z.object({ word: z.string().min(1).max(100), lang_code: z.string(), pos: z.string(), etymology_number: z.number().optional(), etymology_text: z.string().optional(),
  sounds: z.array(z.object({ ipa: z.string().optional(), tags: strings })).default([]),
  forms: z.array(z.object({ form: z.string(), tags: strings })).default([]),
  senses: z.array(z.object({ id: z.string().optional(), glosses: strings, topics: strings, tags: strings,
    examples: z.array(z.object({ text: z.string(), translation: z.string().optional() })).default([]),
    synonyms: z.array(relation).default([]), antonyms: z.array(relation).default([]),
    translations: z.array(z.object({ code: z.string().optional(), word: z.string() })).default([]),
  })).default([]),
});
const posMap: Record<string, string> = { adj: 'adjective', adv: 'adverb', prep: 'preposition', conj: 'conjunction', name: 'noun', n: 'noun', v: 'verb', a: 'adjective', s: 'adjective', r: 'adverb' };
export const importPos = (value: string) => { const pos = value.replace(/-\d+$/, ''); return normalizePos(posMap[pos] ?? pos); };

export function parseKaikki(payload: unknown): DictionaryCandidate | null {
  if (!payload || typeof payload !== 'object' || !('lang_code' in payload) || payload.lang_code !== 'en') return null;
  const parsed = kaikkiSchema.safeParse(payload);
  if (!parsed.success) return null;
  const entry = parsed.data, partOfSpeech = importPos(entry.pos);
  const providerEntryRef = hash(`kaikki:${normalizeWord(entry.word)}:${entry.pos}:${entry.etymology_number ?? 0}`);
  const attribution = [{ name: 'Wiktionary contributors / Kaikki', url: `https://en.wiktionary.org/wiki/${encodeURIComponent(entry.word)}#English`,
    license: { name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' } }];
  const pronunciations = entry.sounds.filter(s => !!s.ipa).map(s => ({ ipa: s.ipa, dialect: s.tags.some(t => /^(US|General-American|American)$/i.test(t)) ? 'en-us' as const
    : s.tags.some(t => /^(UK|British|Received-Pronunciation)$/i.test(t)) ? 'en-gb' as const : 'unknown' as const, audio: { status: 'unavailable' as const } }));
  const registers = new Set(['formal', 'informal', 'slang', 'colloquial', 'archaic', 'obsolete', 'vulgar', 'offensive', 'literary', 'dated']);
  const senses = entry.senses.flatMap(sense => {
    const definition = sense.glosses.filter(Boolean).join(' ');
    if (!definition) return [];
    const meaningVi = sense.translations.find(t => t.code === 'vi')?.word;
    const persistFields: PersistField[] = ['definitionEn', 'exampleEn', 'phonetic', 'domains', 'registers', 'synonyms', 'antonyms', 'wordForms', 'etymology', 'pronunciations', 'meaningVi'];
    return [{ providerSenseRef: sense.id || hash(`${providerEntryRef}:${definition}`), definition: textField(definition),
      examples: examplesField(sense.examples.map(e => e.text)), pronunciations, cefr: cefrUnknown, attribution, persistFields,
      domains: sense.topics, registers: sense.tags.filter(t => registers.has(t)), synonyms: sense.synonyms.map(s => s.word), antonyms: sense.antonyms.map(s => s.word),
      wordForms: entry.forms.filter(f => f.form !== entry.word), etymology: entry.etymology_text ?? null, meaningVi: textField(meaningVi),
    }];
  });
  return senses.length ? { lemma: entry.word, partOfSpeech, providerEntryRef, senses } : null;
}

export const wordnetSynsetSchema = z.object({ definition: strings, members: strings, partOfSpeech: z.string(),
  example: z.array(z.union([z.string(), z.object({ text: z.string() })])).default([]), domain_topic: strings });
export type WordnetSynset = z.infer<typeof wordnetSynsetSchema>;
export const wordnetEntrySchema = z.object({ pronunciation: z.array(z.object({ value: z.string(), variety: z.string().optional() })).default([]),
  sense: z.array(z.object({ id: z.string(), synset: z.string(), antonym: strings })).default([]) });
export type WordnetEntry = z.infer<typeof wordnetEntrySchema>;

export function parseWordnet(lemma: string, pos: string, entry: WordnetEntry, synsets: Map<string, WordnetSynset>, senseLemmas: Map<string, string>): DictionaryCandidate | null {
  if (!lemma || lemma.length > 100) return null;
  const providerEntryRef = hash(`wordnet:${lemma}:${pos}`), partOfSpeech = importPos(pos);
  const senses = entry.sense.flatMap(sense => {
    const synset = synsets.get(sense.synset);
    if (!synset?.definition.length) return [];
    return [{ providerSenseRef: sense.id, definition: textField(synset.definition.join(' ')),
      examples: examplesField(synset.example.map(e => typeof e === 'string' ? e : e.text)),
      pronunciations: entry.pronunciation.map(p => ({ ipa: p.value, dialect: /^(US|en-US)$/i.test(p.variety ?? '') ? 'en-us' as const : /^(UK|en-GB)$/i.test(p.variety ?? '') ? 'en-gb' as const : 'unknown' as const, audio: { status: 'unavailable' as const } })),
      cefr: cefrUnknown, synonyms: synset.members.filter(w => normalizeWord(w) !== normalizeWord(lemma)), antonyms: sense.antonym.flatMap(id => senseLemmas.has(id) ? [senseLemmas.get(id)!] : []),
      domains: synset.domain_topic.flatMap(id => synsets.get(id)?.members ?? []),
      attribution: [{ name: 'Princeton WordNet / Open English WordNet contributors', url: `https://en-word.net/id/${encodeURIComponent(sense.synset)}`, license: { name: 'CC BY 4.0 / WordNet License', url: 'https://github.com/globalwordnet/english-wordnet/blob/main/LICENSE.md' } }],
      persistFields: ['definitionEn', 'exampleEn', 'phonetic', 'pronunciations', 'synonyms', 'antonyms', 'domains'] as PersistField[],
    }];
  });
  return senses.length ? { lemma, partOfSpeech, providerEntryRef, senses } : null;
}

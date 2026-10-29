import { z } from 'zod';
import { fail } from '../../common/http';
import { hash } from '../../identity/security';
import { AdapterResult, Attribution, cefrUnknown, DictionaryAdapter, DictionaryQuery, examplesField, httpsUrl, normalizePos, PersistField, ProviderStatus, textField } from './contracts';

const licenseSchema = z.object({ name: z.string(), url: z.string() });
const responseSchema = z.array(z.object({
  word: z.string(), phonetic: z.string().optional(), license: licenseSchema.optional(), sourceUrls: z.array(z.string()).optional(),
  phonetics: z.array(z.object({ text: z.string().optional(), audio: z.string().optional(), sourceUrl: z.string().optional(), license: licenseSchema.optional() })).optional(),
  meanings: z.array(z.object({ partOfSpeech: z.string(), definitions: z.array(z.object({ definition: z.string(), example: z.string().optional(), synonyms: z.array(z.string()).optional(), antonyms: z.array(z.string()).optional() })) })),
}));
// Only accept declared, recognized text licenses with a traceable Wiktionary source.
function textAttribution(license: z.infer<typeof licenseSchema> | undefined, sources: string[]): Attribution[] {
  if (!license) return [];
  const url = httpsUrl(license.url);
  if (!url || !/^https:\/\/creativecommons\.org\/licenses\/by-sa\/(3\.0|4\.0)\/?$/.test(url)) return [];
  return sources.flatMap(source => {
    const sourceUrl = httpsUrl(source);
    if (!sourceUrl || new URL(sourceUrl).hostname !== 'en.wiktionary.org' || !new URL(sourceUrl).pathname.startsWith('/wiki/')) return [];
    return [{ name: 'Wiktionary contributors', url: sourceUrl, license: { name: license.name, url } }];
  });
}
function audioDialect(url?: string): 'en-us' | 'en-gb' | 'unknown' {
  if (url && /(?:[-_]|\/)(?:us|en-us)(?:[-_.\/])/i.test(url)) return 'en-us';
  if (url && /(?:[-_]|\/)(?:uk|gb|en-gb)(?:[-_.\/])/i.test(url)) return 'en-gb';
  return 'unknown';
}
export class FreeDictionaryAdapter implements DictionaryAdapter {
  status(): ProviderStatus {
    return { id: 'free_dictionary', name: 'Free Dictionary API', tier: 'free', configured: true, licenseMode: 'OPEN_LICENSE', persistenceSupported: true,
      persistFields: ['definitionEn', 'exampleEn', 'phonetic', 'synonyms', 'antonyms'], description: 'Không cần API key. Lưu nội dung khi kết quả có nguồn và giấy phép phù hợp.',
      attribution: { name: 'Free Dictionary API', url: 'https://dictionaryapi.dev/' } };
  }
  request(query: DictionaryQuery) {
    return { url: new URL(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(query.word)}`), headers: { Accept: 'application/json' } };
  }
  parse(payload: unknown, query: DictionaryQuery): AdapterResult {
    const parsed = responseSchema.safeParse(payload);
    if (!parsed.success) fail(502, 'PROVIDER_CONTRACT_CHANGED', 'Định dạng Free Dictionary API đã thay đổi.');
    const candidates = parsed.data.flatMap((entry, entryIndex) => entry.meanings
      .filter(meaning => normalizePos(meaning.partOfSpeech) === query.partOfSpeech)
      .map((meaning, meaningIndex) => {
        const attribution = textAttribution(entry.license, entry.sourceUrls ?? []);
        const persistFields: PersistField[] = attribution.length ? ['definitionEn', 'exampleEn', 'phonetic', 'synonyms', 'antonyms'] : [];
        const providerEntryRef = hash(`free:${entry.word}:${entryIndex}:${meaning.partOfSpeech}`);
        const pronunciations = (entry.phonetics ?? []).map(p => {
          const url = httpsUrl(p.audio);
          return { dialect: audioDialect(url), ipa: p.text || entry.phonetic, audio: { status: url ? 'available' as const : 'unavailable' as const, ...(url ? { playbackUrl: url } : {}) } };
        });
        if (entry.phonetic && !pronunciations.some(p => p.ipa === entry.phonetic)) {
          pronunciations.push({ dialect: 'unknown', ipa: entry.phonetic, audio: { status: 'unavailable' } });
        }
        pronunciations.sort((a, b) => Number(b.dialect === query.dialect) - Number(a.dialect === query.dialect));
        return { lemma: entry.word, partOfSpeech: normalizePos(meaning.partOfSpeech), providerEntryRef, senses: meaning.definitions.map((definition, index) => ({
          providerSenseRef: hash(`${providerEntryRef}:${meaningIndex}:${index}:${definition.definition}`), definition: textField(definition.definition), examples: examplesField(definition.example ? [definition.example] : []),
          pronunciations, synonyms: definition.synonyms ?? [], antonyms: definition.antonyms ?? [], cefr: cefrUnknown, attribution, persistFields,
        })) };
      }));
    const warnings: string[] = [];
    if (candidates.some(c => c.senses.some(s => !s.persistFields.length))) warnings.push('Một số nghĩa chưa có nguồn/giấy phép rõ ràng và chỉ được hiển thị tham khảo.');
    if (candidates.length && !candidates.some(c => c.senses.some(s => s.pronunciations.some(p => p.dialect === query.dialect)))) warnings.push('Nguồn chưa xác nhận được audio đúng giọng đã chọn; giọng không rõ được ghi riêng.');
    return { candidates, suggestions: [], warnings };
  }
}

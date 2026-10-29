import { z } from 'zod';
import { fail } from '../../common/http';
import { hash } from '../../identity/security';
import { AdapterResult, cefrUnknown, DictionaryAdapter, DictionaryQuery, examplesField, normalizePos, permittedFields, ProviderStatus, textField } from './contracts';

const strings = z.array(z.string()).default([]);
const schema = z.object({ word: z.string(), pronunciation: z.union([z.string(), z.record(z.string(), z.string())]).optional(),
  results: z.array(z.object({ definition: z.string(), partOfSpeech: z.string(), examples: strings, synonyms: strings, antonyms: strings, inCategory: strings, usageOf: strings })).default([]) });

export class WordsApiAdapter implements DictionaryAdapter {
  constructor(private options: { apiKey?: string; dailyLimit: number; persistenceApproved: boolean; persistFields: string }) {}
  status(): ProviderStatus {
    const persistFields = this.options.persistenceApproved ? permittedFields(this.options.persistFields) : [];
    return { id: 'wordsapi', name: 'WordsAPI', tier: 'api_key', configured: !!this.options.apiKey && this.options.dailyLimit > 0,
      licenseMode: persistFields.length ? 'PERSIST_LICENSED' : 'LIVE_ONLY', persistenceSupported: !!this.options.apiKey && persistFields.length > 0,
      persistFields, description: 'RapidAPI key và hạn mức cứng; quyền lưu cần được cấp riêng.', attribution: { name: 'WordsAPI', url: 'https://www.wordsapi.com/' } };
  }
  request(query: DictionaryQuery) {
    return { url: new URL(`https://wordsapiv1.p.rapidapi.com/words/${encodeURIComponent(query.word)}`),
      headers: { Accept: 'application/json', 'X-RapidAPI-Key': this.options.apiKey!, 'X-RapidAPI-Host': 'wordsapiv1.p.rapidapi.com' } };
  }
  parse(payload: unknown, query: DictionaryQuery): AdapterResult {
    const parsed = schema.safeParse(payload);
    if (!parsed.success) fail(502, 'PROVIDER_CONTRACT_CHANGED', 'Định dạng WordsAPI đã thay đổi.');
    const entry = parsed.data, providerEntryRef = hash(`wordsapi:${entry.word}:${query.partOfSpeech}`);
    const ipa = typeof entry.pronunciation === 'string' ? entry.pronunciation : entry.pronunciation?.[query.partOfSpeech] ?? entry.pronunciation?.all;
    const senses = entry.results.filter(r => normalizePos(r.partOfSpeech) === query.partOfSpeech).map((sense, index) => ({
      providerSenseRef: hash(`${providerEntryRef}:${index}:${sense.definition}`), definition: textField(sense.definition), examples: examplesField(sense.examples),
      pronunciations: ipa ? [{ dialect: 'unknown' as const, ipa, audio: { status: 'unavailable' as const } }] : [],
      synonyms: sense.synonyms, antonyms: sense.antonyms, domains: sense.inCategory, registers: sense.usageOf,
      cefr: cefrUnknown, attribution: [this.status().attribution], persistFields: this.status().persistFields,
    }));
    return { candidates: senses.length ? [{ lemma: entry.word, partOfSpeech: query.partOfSpeech, providerEntryRef, senses }] : [], suggestions: [], warnings: [] };
  }
}

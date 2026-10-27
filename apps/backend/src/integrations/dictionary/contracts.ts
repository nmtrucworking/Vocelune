import { z } from 'zod';

export const dictionaryProvider = z.enum(['free_dictionary', 'merriam_webster', 'oxford']);
export type DictionaryProviderId = z.infer<typeof dictionaryProvider>;
export const dictionaryPos = z.enum(['noun', 'verb', 'adjective', 'adverb', 'phrase', 'idiom', 'preposition', 'conjunction', 'other']);
export type DictionaryPos = z.infer<typeof dictionaryPos>;
export const lookupSchema = z.object({
  word: z.string().trim().min(1).max(100).transform(value => value.normalize('NFC')),
  partOfSpeech: dictionaryPos,
  dialect: z.enum(['en-us', 'en-gb']).default('en-us'),
  provider: dictionaryProvider.optional(),
  allowFallback: z.boolean().optional(),
}).strict();
export type DictionaryQuery = Pick<z.infer<typeof lookupSchema>, 'word' | 'partOfSpeech' | 'dialect'>;
export type PersistField = 'definitionEn' | 'exampleEn' | 'phonetic';
export type LicenseMode = 'LIVE_ONLY' | 'PERSIST_LICENSED' | 'OPEN_LICENSE';
export type Attribution = { name: string; url: string; license?: { name: string; url: string } };
export type Pronunciation = {
  dialect: 'en-us' | 'en-gb' | 'unknown';
  ipa?: string;
  audio: { status: 'available' | 'unavailable'; playbackUrl?: string };
};
export type DictionarySense = {
  providerSenseRef: string;
  definition: { status: 'available' | 'unavailable'; value: string | null };
  examples: { status: 'available' | 'unavailable'; items: string[] };
  pronunciations: Pronunciation[];
  cefr: { status: 'not_verified'; value: null; source: null };
  attribution: Attribution[];
  persistFields: PersistField[];
};
export type DictionaryCandidate = {
  lemma: string;
  partOfSpeech: DictionaryPos;
  providerEntryRef: string;
  senses: DictionarySense[];
};
export type AdapterResult = { candidates: DictionaryCandidate[]; suggestions: string[]; warnings: string[] };
export type ProviderStatus = {
  id: DictionaryProviderId;
  name: string;
  tier: 'free' | 'api_key';
  configured: boolean;
  licenseMode: LicenseMode;
  persistenceSupported: boolean;
  persistFields: PersistField[];
  description: string;
  attribution: Attribution;
};
export interface DictionaryAdapter {
  status(): ProviderStatus;
  request(query: DictionaryQuery): { url: URL; headers: Record<string, string> };
  parse(payload: unknown, query: DictionaryQuery): AdapterResult;
}
export type LookupResult = AdapterResult & {
  query: DictionaryQuery;
  requestedProvider: DictionaryProviderId;
  provider: DictionaryProviderId;
  configured: boolean;
  licenseMode: LicenseMode;
  attribution: Attribution;
  fallbackUsed: boolean;
  persistenceSupported: boolean;
};
export const cefrUnknown = { status: 'not_verified', value: null, source: null } as const;
export const permittedFields = (value: string): PersistField[] => [...new Set(value.split(',').map(v => v.trim()).filter((v): v is PersistField => ['definitionEn', 'exampleEn', 'phonetic'].includes(v)))];
export const textField = (value?: string | null) => ({ status: value ? 'available' as const : 'unavailable' as const, value: value || null });
export const examplesField = (items: string[]) => ({ status: items.length ? 'available' as const : 'unavailable' as const, items });
export function httpsUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try { const url = new URL(value.startsWith('//') ? `https:${value}` : value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined; } catch { return undefined; }
}
export function normalizePos(value: string): DictionaryPos {
  const source = value.toLowerCase().trim();
  if (['auxiliary verb', 'transitive verb', 'intransitive verb', 'modal verb', 'verb phrase'].includes(source)) return 'verb';
  if (source === 'adjective phrase') return 'adjective';
  const parsed = dictionaryPos.safeParse(source);
  return parsed.success ? parsed.data : 'other';
}

import { useEffect, useState } from 'react';
import { api } from './api';
import type { Dialect, PartOfSpeech } from '@/types';
export type DictionaryProvider = 'auto' | 'free_dictionary' | 'merriam_webster' | 'oxford' | 'local_kaikki' | 'local_wordnet' | 'wiktionary' | 'wordsapi' | 'collins' | 'datamuse';
export type DictionaryAttribution = { name: string; url: string; license?: { name: string; url: string } };
export type DictionaryProviderStatus = {
  id: DictionaryProvider; name: string; tier: 'local' | 'free' | 'api_key'; configured: boolean;
  licenseMode: 'LIVE_ONLY' | 'PERSIST_LICENSED' | 'OPEN_LICENSE'; persistenceSupported: boolean;
  persistFields: string[]; description: string; attribution: DictionaryAttribution;
  health?: { state: 'healthy' | 'cooldown'; retryAt: string | null; failures: number }; entryCount?: number;
};
export type DictionaryPronunciation = { dialect: Dialect | 'unknown'; ipa?: string; audio: { status: 'available' | 'unavailable'; playbackUrl?: string } };
export type DictionarySense = {
  provider?: DictionaryProvider;
  providerSenseRef: string; definition: { status: string; value: string | null }; examples: { status: string; items: string[] };
  pronunciations: DictionaryPronunciation[]; cefr: { status: 'not_verified'; value: null; source: null } | { status: 'verified'; value: string; source: string };
  attribution: DictionaryAttribution[]; persistFields: string[];
  domains?: string[]; registers?: string[]; synonyms?: string[]; antonyms?: string[]; collocations?: string[];
  wordForms?: { form: string; tags: string[] }[]; etymology?: string | null;
  frequency?: { value: number; unit: string; source: string } | null;
  meaningVi?: { status: string; value: string | null }; exampleVi?: { status: string; value: string | null };
  ranking?: { score: number; method: 'lexical_overlap'; domainMatch: boolean; verified: false }; missingFields?: string[];
};
export type LexicalMetadata = Pick<DictionarySense, 'domains' | 'registers' | 'synonyms' | 'antonyms' | 'collocations' | 'wordForms' | 'etymology' | 'frequency' | 'pronunciations' | 'cefr'>;
export type DictionaryLookup = {
  query: { word: string; partOfSpeech: PartOfSpeech; dialect: Dialect; domain?: string; contextSentence?: string }; provider: DictionaryProvider; requestedProvider: DictionaryProvider;
  fallbackUsed: boolean; configured: boolean; persistenceSupported: boolean;
  attribution: DictionaryAttribution; warnings: string[]; suggestions: string[];
  candidates: { lemma: string; partOfSpeech: PartOfSpeech; providerEntryRef: string; senses: DictionarySense[] }[];
  translationVi?: { translation: string; alternatives: string[]; source?: string };
  attemptedProviders?: DictionaryProvider[];
  relatedWords?: { word: string; source: 'datamuse'; scope: 'lexeme'; persistable: false }[];
  metrics?: { externalRequests: number; durationMs: number; cacheHit: boolean };
};
export async function translateText(text: string, from = 'en', to = 'vi'): Promise<{ translation: string; alternatives: string[] }> {
  try {
    return await api<{ translation: string; alternatives: string[] }>('/dictionary/translate', {
      method: 'POST',
      body: JSON.stringify({ text, from, to }),
    });
  } catch {
    return { translation: '', alternatives: [] };
  }
}

export async function convertWordToIpa(word: string, dialect: Dialect = 'en-us'): Promise<{ ipa: string; dialect: string; source: string }> {
  try {
    return await api<{ word: string; ipa: string; dialect: string; source: string }>('/dictionary/convert-ipa', {
      method: 'POST',
      body: JSON.stringify({ word: word.trim(), dialect }),
    });
  } catch {
    return { ipa: '', dialect, source: 'none' };
  }
}
export const DICTIONARY_SOURCES: { id: DictionaryProvider; name: string; tier: 'local' | 'free' | 'api_key' }[] = [
  { id: 'local_kaikki', name: 'Kaikki / Wiktionary local', tier: 'local' },
  { id: 'local_wordnet', name: 'Open English WordNet local', tier: 'local' },
  { id: 'free_dictionary', name: 'Free Dictionary API', tier: 'free' },
  { id: 'merriam_webster', name: 'Merriam-Webster', tier: 'api_key' },
  { id: 'oxford', name: 'Oxford Dictionaries', tier: 'api_key' },
  { id: 'wiktionary', name: 'Wiktionary REST', tier: 'free' },
  { id: 'wordsapi', name: 'WordsAPI', tier: 'api_key' },
  { id: 'collins', name: 'Collins Dictionary', tier: 'api_key' },
];
export function useDictionaryProviders(enabled = true) {
  const [providers, setProviders] = useState<DictionaryProviderStatus[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void api<{ providers: DictionaryProviderStatus[] }>('/dictionary/providers/status', { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) { setProviders(data.providers); setError(''); }
    }).catch(() => { if (!controller.signal.aborted) setError('Chưa thể kiểm tra nguồn từ điển. Bạn vẫn có thể nhập thủ công.'); });
    return () => controller.abort();
  }, [enabled]);
  return { providers, error };
}

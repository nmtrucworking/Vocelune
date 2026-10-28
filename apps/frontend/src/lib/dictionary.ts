import { useEffect, useState } from 'react';
import { api } from './api';
import type { Dialect, PartOfSpeech } from '@/types';
export type DictionaryProvider = 'free_dictionary' | 'merriam_webster' | 'oxford';
export type DictionaryAttribution = { name: string; url: string; license?: { name: string; url: string } };
export type DictionaryProviderStatus = {
  id: DictionaryProvider; name: string; tier: 'free' | 'api_key'; configured: boolean;
  licenseMode: 'LIVE_ONLY' | 'PERSIST_LICENSED' | 'OPEN_LICENSE'; persistenceSupported: boolean;
  persistFields: string[]; description: string; attribution: DictionaryAttribution;
};
export type DictionaryPronunciation = { dialect: Dialect | 'unknown'; ipa?: string; audio: { status: 'available' | 'unavailable'; playbackUrl?: string } };
export type DictionarySense = {
  providerSenseRef: string; definition: { status: string; value: string | null }; examples: { status: string; items: string[] };
  pronunciations: DictionaryPronunciation[]; cefr: { status: 'not_verified'; value: null; source: null };
  attribution: DictionaryAttribution[]; persistFields: string[];
};
export type DictionaryLookup = {
  query: { word: string; partOfSpeech: PartOfSpeech; dialect: Dialect }; provider: DictionaryProvider; requestedProvider: DictionaryProvider;
  fallbackUsed: boolean; configured: boolean; persistenceSupported: boolean;
  attribution: DictionaryAttribution; warnings: string[]; suggestions: string[];
  candidates: { lemma: string; partOfSpeech: PartOfSpeech; providerEntryRef: string; senses: DictionarySense[] }[];
  translationVi?: { translation: string; alternatives: string[]; source?: string };
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
export const DICTIONARY_SOURCES: { id: DictionaryProvider; name: string; tier: 'free' | 'api_key' }[] = [
  { id: 'free_dictionary', name: 'Free Dictionary API', tier: 'free' },
  { id: 'merriam_webster', name: 'Merriam-Webster', tier: 'api_key' },
  { id: 'oxford', name: 'Oxford Dictionaries', tier: 'api_key' },
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

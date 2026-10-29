import { z } from 'zod';
import { fail } from '../../common/http';
import { AdapterResult, DictionaryAdapter, DictionaryQuery, ProviderStatus } from './contracts';

export class DatamuseAdapter implements DictionaryAdapter {
  constructor(private options: { enabled: boolean; apiKey?: string }) {}
  status(): ProviderStatus {
    return { id: 'datamuse', name: 'Datamuse · Từ liên quan', tier: 'free', configured: this.options.enabled && (Date.now() < Date.UTC(2027, 1, 1) || !!this.options.apiKey),
      licenseMode: 'LIVE_ONLY', persistenceSupported: false, persistFields: [], description: 'Gợi ý ở cấp từ; không xác nhận synonym cho từng nghĩa.', attribution: { name: 'Datamuse', url: 'https://www.datamuse.com/api/' } };
  }
  request(query: DictionaryQuery) {
    const url = new URL('https://api.datamuse.com/words');
    url.searchParams.set('ml', query.word); url.searchParams.set('max', '12');
    if (query.contextSentence || query.domain) url.searchParams.set('topics', (query.domain || query.contextSentence || '').slice(0, 200));
    if (this.options.apiKey) url.searchParams.set('key', this.options.apiKey);
    return { url, headers: { Accept: 'application/json' } };
  }
  parse(payload: unknown): AdapterResult {
    const parsed = z.array(z.object({ word: z.string() })).safeParse(payload);
    if (!parsed.success) fail(502, 'PROVIDER_CONTRACT_CHANGED', 'Định dạng Datamuse đã thay đổi.');
    return { candidates: [], suggestions: parsed.data.slice(0, 12).map(r => r.word), warnings: [] };
  }
}

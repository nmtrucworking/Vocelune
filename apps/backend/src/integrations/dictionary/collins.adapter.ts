import { z } from 'zod';
import { fail } from '../../common/http';
import { hash } from '../../identity/security';
import { AdapterResult, cefrUnknown, DictionaryAdapter, DictionaryQuery, examplesField, normalizePos, ProviderStatus, textField } from './contracts';
import { plainText } from './wiktionary.adapter';

const schema = z.object({ entryId: z.string(), entryContent: z.string(), entryLabel: z.string().optional() });

// Collins search/first returns a JSON envelope containing XML entry content.
// Parse just explicit POS/homograph/sense/definition tags; do not guess a POS or
// treat the whole HTML entry as one definition if the licensed format changes.
export class CollinsAdapter implements DictionaryAdapter {
  constructor(private options: { apiKey?: string; dictionary: string; monthlyLimit: number }) {}
  status(): ProviderStatus {
    return { id: 'collins', name: 'Collins Dictionary', tier: 'api_key', configured: !!this.options.apiKey && this.options.monthlyLimit > 0,
      licenseMode: 'LIVE_ONLY', persistenceSupported: false, persistFields: [],
      description: 'Tham khảo trực tiếp. Nội dung Collins không được cache hoặc lưu vào thẻ.', attribution: { name: 'Collins / HarperCollins Publishers', url: 'https://www.collinsdictionary.com/' } };
  }
  request(query: DictionaryQuery) {
    const url = new URL(`https://api.collinsdictionary.com/api/v1/dictionaries/${encodeURIComponent(this.options.dictionary)}/search/first`);
    url.searchParams.set('q', query.word); url.searchParams.set('format', 'xml');
    return { url, headers: { Accept: 'application/json', accessKey: this.options.apiKey! } };
  }
  parse(payload: unknown, query: DictionaryQuery): AdapterResult {
    const parsed = schema.safeParse(payload);
    if (!parsed.success) fail(502, 'PROVIDER_CONTRACT_CHANGED', 'Định dạng Collins đã thay đổi.');
    const entry = parsed.data;
    const blocks = [...entry.entryContent.matchAll(/<hom\b[^>]*>([\s\S]*?)<\/hom>/gi)].map(m => m[1]);
    if (!blocks.length) blocks.push(entry.entryContent);
    const senses = blocks.flatMap((block, blockIndex) => {
      const pos = block.match(/<pos\b[^>]*>([\s\S]*?)<\/pos>/i)?.[1];
      if (!pos || normalizePos(plainText(pos)) !== query.partOfSpeech) return [];
      const units = [...block.matchAll(/<sense\b[^>]*>([\s\S]*?)<\/sense>/gi)].map(m => m[1]);
      return (units.length ? units : [block]).flatMap((sense, index) => {
        const definition = plainText(sense.match(/<def\b[^>]*>([\s\S]*?)<\/def>/i)?.[1] ?? '');
        if (!definition) return [];
        return [{ providerSenseRef: hash(`collins:${entry.entryId}:${blockIndex}:${index}:${definition}`), definition: textField(definition),
          examples: examplesField([...sense.matchAll(/<quote\b[^>]*>([\s\S]*?)<\/quote>/gi)].map(m => plainText(m[1]))),
          pronunciations: [], cefr: cefrUnknown, attribution: [this.status().attribution], persistFields: [] }];
      });
    });
    return { candidates: senses.length ? [{ lemma: plainText(entry.entryLabel ?? query.word), partOfSpeech: query.partOfSpeech, providerEntryRef: entry.entryId, senses }] : [], suggestions: [],
      warnings: senses.length ? ['Collins chỉ cho phép xem tham khảo; hãy tự biên soạn nội dung khi lưu.'] : ['Collins chưa trả cấu trúc sense/POS được hỗ trợ.'] };
  }
}

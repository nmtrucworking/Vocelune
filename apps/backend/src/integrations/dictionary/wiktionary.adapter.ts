import { z } from 'zod';
import { fail } from '../../common/http';
import { hash } from '../../identity/security';
import { AdapterResult, cefrUnknown, DictionaryAdapter, DictionaryQuery, examplesField, normalizePos, ProviderStatus, textField } from './contracts';

export function plainText(value: string): string {
  return value.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<[^>]*>/g, ' ')
    .replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (_, code: string) => { const n = code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code); return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ''; })
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g, entity => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ' }[entity]!))
    .replace(/\s+/g, ' ').trim();
}
const schema = z.object({ en: z.array(z.object({ partOfSpeech: z.string(), language: z.string().optional(), definitions: z.array(z.object({ definition: z.string(), examples: z.array(z.string()).optional() })) })).optional() });

export class WiktionaryAdapter implements DictionaryAdapter {
  constructor(private userAgent: string) {}
  status(): ProviderStatus {
    return { id: 'wiktionary', name: 'Wiktionary REST', tier: 'free', configured: true, licenseMode: 'OPEN_LICENSE', persistenceSupported: true,
      persistFields: ['definitionEn', 'exampleEn'], description: 'Nguồn cộng đồng; endpoint thử nghiệm, dữ liệu tiếng Anh có ghi công CC BY-SA.',
      attribution: { name: 'Wiktionary contributors', url: 'https://en.wiktionary.org/', license: { name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' } } };
  }
  request(query: DictionaryQuery) {
    return { url: new URL(`https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(query.word)}`), headers: { Accept: 'application/json', 'User-Agent': this.userAgent } };
  }
  parse(payload: unknown, query: DictionaryQuery): AdapterResult {
    const parsed = schema.safeParse(payload);
    if (!parsed.success || !payload || typeof payload !== 'object' || !Object.keys(payload).length) fail(502, 'PROVIDER_CONTRACT_CHANGED', 'Định dạng Wiktionary đã thay đổi.');
    const candidates = (parsed.data.en ?? []).filter(e => normalizePos(e.partOfSpeech) === query.partOfSpeech).map((entry, entryIndex) => {
      const providerEntryRef = hash(`wiktionary:${query.word}:${entry.partOfSpeech}:${entryIndex}`);
      return { lemma: query.word, partOfSpeech: query.partOfSpeech, providerEntryRef, senses: entry.definitions.map((sense, index) => ({
        providerSenseRef: hash(`${providerEntryRef}:${index}:${plainText(sense.definition)}`), definition: textField(plainText(sense.definition)),
        examples: examplesField((sense.examples ?? []).map(plainText)), pronunciations: [], cefr: cefrUnknown,
        attribution: [{ ...this.status().attribution, url: `https://en.wiktionary.org/wiki/${encodeURIComponent(query.word)}#English` }], persistFields: this.status().persistFields,
      })).filter(s => s.definition.value) };
    }).filter(c => c.senses.length);
    return { candidates, suggestions: [], warnings: [] };
  }
}

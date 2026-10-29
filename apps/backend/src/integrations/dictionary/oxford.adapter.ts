import { z } from 'zod';
import { fail } from '../../common/http';
import { hash } from '../../identity/security';
import { AdapterResult, cefrUnknown, DictionaryAdapter, DictionaryQuery, examplesField, httpsUrl, permittedFields, Pronunciation, ProviderStatus, textField } from './contracts';

const label = z.object({ id: z.string().optional(), text: z.string().optional() });
type OxfordSense = { id?: string; definitions?: string[]; examples?: { text: string }[]; domains?: z.infer<typeof label>[]; registers?: z.infer<typeof label>[]; synonyms?: { text: string }[]; antonyms?: { text: string }[]; subsenses?: OxfordSense[] };
const senseSchema: z.ZodType<OxfordSense> = z.lazy(() => z.object({ id: z.string().optional(), definitions: z.array(z.string()).optional(), examples: z.array(z.object({ text: z.string() })).optional(), domains: z.array(label).optional(), registers: z.array(label).optional(), synonyms: z.array(z.object({ text: z.string() })).optional(), antonyms: z.array(z.object({ text: z.string() })).optional(), subsenses: z.array(senseSchema).optional() }));
function flattenSenses(senses: OxfordSense[], parent: Pick<OxfordSense, 'domains' | 'registers'> = {}): OxfordSense[] {
  return senses.flatMap(s => { const current = { ...s, domains: s.domains ?? parent.domains, registers: s.registers ?? parent.registers }; return [current, ...flattenSenses(s.subsenses ?? [], current)]; });
}
const responseSchema = z.object({ results: z.array(z.object({
  id: z.string().optional(), word: z.string().optional(), lexicalEntries: z.array(z.object({
    lexicalCategory: z.object({ id: z.string() }), text: z.string().optional(), entries: z.array(z.object({
      pronunciations: z.array(z.object({ phoneticSpelling: z.string().optional(), dialects: z.array(z.string()).optional(), audioFile: z.string().optional() })).optional(),
      senses: z.array(senseSchema).optional(),
      etymologies: z.array(z.string()).optional(),
    })).optional(),
  })).optional(),
})).optional() });
export type OxfordOptions = { appId?: string; appKey?: string; environment: 'sandbox' | 'production'; licenseMode: 'LIVE_ONLY' | 'PERSIST_LICENSED'; persistFields: string; persistenceApproved: boolean };
export class OxfordAdapter implements DictionaryAdapter {
  constructor(private options: OxfordOptions) {}
  status(): ProviderStatus {
    const configured = !!(this.options.appId && this.options.appKey);
    const persistFields = this.options.licenseMode === 'PERSIST_LICENSED' && this.options.persistenceApproved ? permittedFields(this.options.persistFields) : [];
    return { id: 'oxford', name: 'Oxford Dictionaries', tier: 'api_key', configured, licenseMode: this.options.licenseMode,
      persistenceSupported: configured && persistFields.length > 0, persistFields,
      description: this.options.environment === 'sandbox' ? 'Sandbox: 500 lượt thử, tiếng Anh chỉ từ bắt đầu bằng a.' : 'API key Oxford; quyền lưu dữ liệu theo giấy phép.',
      attribution: { name: 'Oxford Languages', url: 'https://languages.oup.com/' } };
  }
  request(query: DictionaryQuery) {
    const host = this.options.environment === 'sandbox' ? 'od-api-sandbox.oxforddictionaries.com' : 'od-api.oxforddictionaries.com';
    const url = new URL(`https://${host}/api/v2/words/${query.dialect}`);
    url.searchParams.set('q', query.word); url.searchParams.set('lexicalCategory', query.partOfSpeech); url.searchParams.set('strictMatch', 'false');
    return { url, headers: { app_id: this.options.appId!, app_key: this.options.appKey!, Accept: 'application/json' } };
  }
  parse(payload: unknown, query: DictionaryQuery): AdapterResult {
    const parsed = responseSchema.safeParse(payload);
    if (!parsed.success) fail(502, 'PROVIDER_CONTRACT_CHANGED', 'Định dạng Oxford đã thay đổi.');
    const candidates = (parsed.data.results ?? []).flatMap((result, resultIndex) => (result.lexicalEntries ?? [])
      .filter(entry => entry.lexicalCategory.id.toLowerCase() === query.partOfSpeech)
      .map((entry, entryIndex) => {
        const providerEntryRef = result.id || hash(`${query.word}:${resultIndex}:${entryIndex}`);
        return { lemma: entry.text || result.word || query.word, partOfSpeech: query.partOfSpeech, providerEntryRef,
          senses: (entry.entries ?? []).flatMap((e, eIndex) => flattenSenses(e.senses ?? []).map((sense, senseIndex) => ({
            providerSenseRef: sense.id || hash(`${providerEntryRef}:${eIndex}:${senseIndex}:${sense.definitions?.[0] ?? ''}`),
            definition: textField(sense.definitions?.[0]), examples: examplesField(sense.examples?.map(e => e.text) ?? []),
            domains: (sense.domains ?? []).map(d => d.text || d.id || '').filter(Boolean), registers: (sense.registers ?? []).map(d => d.text || d.id || '').filter(Boolean),
            synonyms: (sense.synonyms ?? []).map(s => s.text), antonyms: (sense.antonyms ?? []).map(s => s.text), etymology: e.etymologies?.join('; ') || null,
            pronunciations: (e.pronunciations ?? []).map(p => {
              const url = httpsUrl(p.audioFile);
              return { dialect: query.dialect, ipa: p.phoneticSpelling, audio: { status: url ? 'available' : 'unavailable', ...(url ? { playbackUrl: url } : {}) } } as Pronunciation;
            }),
            cefr: cefrUnknown, attribution: [this.status().attribution], persistFields: this.status().persistFields,
          }))),
        };
      }));
    return { candidates, suggestions: [], warnings: this.status().persistenceSupported ? [] : ['Oxford hiện chỉ cho phép xem tham khảo; nội dung tra cứu không tự điền vào dữ liệu sẽ lưu.'] };
  }
}

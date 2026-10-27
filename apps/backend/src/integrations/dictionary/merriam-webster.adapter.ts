import { z } from 'zod';
import { fail } from '../../common/http';
import { hash } from '../../identity/security';
import { AdapterResult, cefrUnknown, DictionaryAdapter, DictionaryQuery, examplesField, normalizePos, permittedFields, ProviderStatus, textField } from './contracts';

const pronunciation = z.object({ ipa: z.string().optional(), sound: z.object({ audio: z.string().optional() }).optional() });
const entrySchema = z.object({
  meta: z.object({ id: z.string(), uuid: z.string().optional() }),
  hwi: z.object({ hw: z.string().optional(), prs: z.array(pronunciation).optional() }).optional(),
  fl: z.string().optional(), shortdef: z.array(z.string()).optional(),
  def: z.array(z.object({ sseq: z.array(z.unknown()).optional() })).optional(),
});
export type MerriamWebsterOptions = { apiKey?: string; persistenceApproved: boolean; persistFields: string };
export function stripMwMarkup(value: string): string {
  return value
    .replace(/\{(?:a_link|d_link|i_link|et_link)\|([^|}]+)(?:\|[^}]*)?\}/g, '$1')
    .replace(/\{(?:sx|dxt|mat)\|([^|}]+)(?:\|[^}]*)?\}/g, '$1')
    .replace(/\{bc\}/g, '').replace(/\{ldquo\}/g, '“').replace(/\{rdquo\}/g, '”')
    .replace(/\{[^}]*\}/g, '').replace(/\s+/g, ' ').trim();
}
export function merriamAudioUrl(audio: string): string | undefined {
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(audio)) return undefined;
  const subdirectory = audio.startsWith('bix') ? 'bix' : audio.startsWith('gg') ? 'gg' : !/^[A-Za-z]/.test(audio) ? 'number' : audio[0].toLowerCase();
  return `https://media.merriam-webster.com/audio/prons/en/us/mp3/${subdirectory}/${audio}.mp3`;
}
function object(value: unknown): Record<string, unknown> | undefined { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined; }
function senses(sequence: unknown[], path = 'sseq'): { value: Record<string, unknown>; path: string }[] {
  return sequence.flatMap((node, index) => {
    if (!Array.isArray(node)) return [];
    const nodePath = `${path}.${index}`;
    if (node[0] === 'sense' && object(node[1])) {
      const value = object(node[1])!;
      return [{ value, path: nodePath }, ...(object(value.sdsense) ? [{ value: object(value.sdsense)!, path: `${nodePath}.sdsense` }] : [])];
    }
    if (node[0] === 'bs' && object(node[1]) && object(object(node[1])!.sense)) return [{ value: object(object(node[1])!.sense)!, path: `${nodePath}.bs` }];
    return senses(node, nodePath);
  });
}
function definingText(sense: Record<string, unknown>) {
  const dt = Array.isArray(sense.dt) ? sense.dt : [];
  const definitions: string[] = [], examples: string[] = [];
  for (const part of dt) {
    if (!Array.isArray(part)) continue;
    if (part[0] === 'text' && typeof part[1] === 'string') definitions.push(stripMwMarkup(part[1]));
    if (part[0] === 'vis' && Array.isArray(part[1])) for (const example of part[1]) {
      const value = object(example); if (typeof value?.t === 'string') examples.push(stripMwMarkup(value.t));
    }
  }
  return { definition: definitions.filter(Boolean).join(' '), examples: examples.filter(Boolean) };
}
export class MerriamWebsterAdapter implements DictionaryAdapter {
  constructor(private options: MerriamWebsterOptions) {}
  status(): ProviderStatus {
    const persistFields = this.options.persistenceApproved ? permittedFields(this.options.persistFields) : [];
    return { id: 'merriam_webster', name: "Merriam-Webster's Learner's Dictionary with Audio", tier: 'api_key', configured: !!this.options.apiKey,
      licenseMode: persistFields.length ? 'PERSIST_LICENSED' : 'LIVE_ONLY', persistenceSupported: !!this.options.apiKey && persistFields.length > 0, persistFields,
      description: 'API key Learner’s Dictionary; gói miễn phí phi thương mại có giới hạn lượt tra.',
      attribution: { name: 'Merriam-Webster Inc.', url: 'https://www.merriam-webster.com/' } };
  }
  request(query: DictionaryQuery) {
    const url = new URL(`https://www.dictionaryapi.com/api/v3/references/learners/json/${encodeURIComponent(query.word)}`);
    url.searchParams.set('key', this.options.apiKey!);
    return { url, headers: { Accept: 'application/json' } };
  }
  parse(payload: unknown, query: DictionaryQuery): AdapterResult {
    if (typeof payload === 'string') fail(503, 'DICTIONARY_AUTH_FAILED', 'API key Merriam-Webster chưa được cấp quyền cho Learner’s Dictionary.');
    const suggestions = z.array(z.string()).safeParse(payload);
    if (suggestions.success && suggestions.data.length) return { candidates: [], suggestions: suggestions.data.slice(0, 10), warnings: ['Không tìm thấy từ chính xác. Hãy chọn một gợi ý chính tả.'] };
    const parsed = z.array(entrySchema).safeParse(payload);
    if (!parsed.success) fail(502, 'PROVIDER_CONTRACT_CHANGED', 'Định dạng Merriam-Webster đã thay đổi.');
    const candidates = parsed.data.filter(entry => normalizePos(entry.fl ?? 'other') === query.partOfSpeech).map(entry => {
      const providerEntryRef = entry.meta.uuid || entry.meta.id;
      const extracted = (entry.def ?? []).flatMap((definition, index) => senses(definition.sseq ?? [], `def.${index}`)).map(sense => ({ ...definingText(sense.value), ref: sense.path })).filter(s => !!s.definition);
      const definitions = extracted.length ? extracted : (entry.shortdef ?? []).map((text, index) => ({ definition: stripMwMarkup(text), examples: [], ref: `shortdef.${index}` }));
      const pronunciations = (entry.hwi?.prs ?? []).map(p => {
        const url = p.sound?.audio ? merriamAudioUrl(p.sound.audio) : undefined;
        return { dialect: 'en-us' as const, ipa: p.ipa, audio: { status: url ? 'available' as const : 'unavailable' as const, ...(url ? { playbackUrl: url } : {}) } };
      });
      return { lemma: (entry.hwi?.hw || entry.meta.id.replace(/:\d+$/, '')).replace(/\*/g, ''), partOfSpeech: normalizePos(entry.fl ?? 'other'), providerEntryRef,
        senses: definitions.map(sense => ({ providerSenseRef: hash(`${providerEntryRef}:${sense.ref}:${sense.definition}`), definition: textField(sense.definition), examples: examplesField(sense.examples), pronunciations,
          cefr: cefrUnknown, attribution: [this.status().attribution], persistFields: this.status().persistFields })) };
    }).filter(candidate => candidate.senses.length > 0);
    return { candidates, suggestions: [], warnings: [
      ...(query.dialect === 'en-gb' ? ['Audio Merriam-Webster trả về là giọng Mỹ; chưa có audio giọng Anh từ nguồn này.'] : []),
      ...(this.status().persistenceSupported ? [] : ['Merriam-Webster hiện chỉ cho phép xem tham khảo; lưu nội dung cần được cấu hình quyền riêng.']),
    ] };
  }
}

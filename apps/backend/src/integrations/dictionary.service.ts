import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { Database, json } from '../common/db';
import { config } from '../common/config';
import { fail } from '../common/http';
import { VocabularyService, vocabSchema, pos } from '../vocabulary/vocabulary.service';

const oxfordResponse = z.object({ results: z.array(z.object({ id: z.string().optional(), word: z.string().optional(), lexicalEntries: z.array(z.object({ lexicalCategory: z.object({ id: z.string() }), text: z.string().optional(), entries: z.array(z.object({ pronunciations: z.array(z.object({ phoneticSpelling: z.string().optional(), dialects: z.array(z.string()).optional(), audioFile: z.string().url().optional() })).optional(), senses: z.array(z.object({ id: z.string().optional(), definitions: z.array(z.string()).optional(), examples: z.array(z.object({ text: z.string() })).optional() })).optional() })).optional() })).optional() })).optional() });
@Injectable()
export class DictionaryService {
  constructor(@Inject(Database) private db: Database, @Inject(VocabularyService) private vocabulary: VocabularyService) {}
  private persistFields() { return config.OXFORD_PERSIST_FIELDS.split(',').map(s => s.trim()).filter(s => ['definitionEn', 'exampleEn', 'phonetic'].includes(s)); }
  status() { return { provider: 'oxford', configured: !!(config.OXFORD_APP_ID && config.OXFORD_APP_KEY), licenseMode: config.DICTIONARY_LICENSE_MODE, persistenceSupported: config.DICTIONARY_LICENSE_MODE === 'PERSIST_LICENSED' && this.persistFields().length > 0, persistFields: this.persistFields(), cefr: { status: 'not_verified', value: null }, manualEntryAvailable: true }; }
  async saveLicensed(userId: string, body: unknown) {
    if (!this.status().persistenceSupported) fail(403, 'PERSISTENCE_NOT_LICENSED', 'Chưa có quyền lưu các trường nội dung của nhà cung cấp.');
    const input = z.object({ word: z.string().trim().min(1).max(100), partOfSpeech: pos, dialect: z.enum(['en-us', 'en-gb']), providerEntryRef: z.string().min(1).max(200), providerSenseRef: z.string().min(1).max(200), meaningVi: vocabSchema.shape.meaningVi, deckId: vocabSchema.shape.deckId, tags: vocabSchema.shape.tags, notes: vocabSchema.shape.notes }).strict().parse(body);
    // Fetch again server-side; browser payload cannot attest vendor content or rights.
    const lookup = await this.lookup(userId, { word: input.word, partOfSpeech: input.partOfSpeech, dialect: input.dialect });
    const candidate = lookup.candidates.find(c => c.providerEntryRef === input.providerEntryRef);
    const sense = candidate?.senses.find(s => s.providerSenseRef === input.providerSenseRef);
    if (!candidate || !sense) fail(422, 'SENSE_NOT_FOUND', 'Không tìm thấy nghĩa đã chọn.');
    const fields = this.persistFields();
    const data = vocabSchema.parse({ word: candidate.lemma, partOfSpeech: input.partOfSpeech, dialect: input.dialect, meaningVi: input.meaningVi, deckId: input.deckId, tags: input.tags, notes: input.notes,
      definitionEn: fields.includes('definitionEn') ? sense.definition.value || '' : '', exampleEn: fields.includes('exampleEn') ? sense.examples.items[0] || '' : '', phonetic: fields.includes('phonetic') ? sense.pronunciations[0]?.ipa || '' : '', cefr: 'unknown', cefrSource: 'unknown' });
    return this.db.forUser(userId, async tx => {
      const item = await this.vocabulary.createInTx(tx, userId, data);
      await tx.vocabItem.update({ where: { id: item.id }, data: { sourceKind: 'licensed', provenance: json({ provider: 'oxford', providerEntryRef: input.providerEntryRef, providerSenseRef: input.providerSenseRef, licenseMode: 'PERSIST_LICENSED', persistedFields: fields, exportableFields: [], retrievedAt: new Date() }) } });
      return { ...item, sourceKind: 'licensed' };
    });
  }
  async lookup(userId: string, body: unknown) {
    const input = z.object({ word: z.string().trim().min(1).max(100), partOfSpeech: pos, dialect: z.enum(['en-gb', 'en-us']).default('en-us') }).strict().parse(body);
    if (!this.status().configured) return { ...this.status(), query: input, candidates: [], warnings: ['Chưa cấu hình nhà cung cấp từ điển. Bạn có thể tự nhập nội dung.'] };
    const started = Date.now();
    const url = new URL(`https://od-api.oxforddictionaries.com/api/v2/words/${input.dialect}`);
    url.searchParams.set('q', input.word); url.searchParams.set('lexicalCategory', input.partOfSpeech); url.searchParams.set('strictMatch', 'false');
    let response: globalThis.Response;
    try { response = await fetch(url, { headers: { app_id: config.OXFORD_APP_ID!, app_key: config.OXFORD_APP_KEY!, Accept: 'application/json' }, signal: AbortSignal.timeout(8000), redirect: 'error' }); }
    catch { fail(503, 'DICTIONARY_UNAVAILABLE', 'Từ điển tạm thời không khả dụng. Bạn vẫn có thể nhập thủ công.'); }
    await this.db.providerUsage.create({ data: { provider: 'oxford', userId, status: response.status, latencyMs: Date.now() - started } });
    if (!response.ok) {
      if (response.status === 404) return { ...this.status(), query: input, candidates: [], warnings: ['Không tìm thấy từ phù hợp.'] };
      fail(response.status === 429 ? 429 : 503, 'DICTIONARY_UNAVAILABLE', 'Nhà cung cấp từ điển chưa khả dụng.');
    }
    const parsed = oxfordResponse.safeParse(await response.json());
    if (!parsed.success) fail(502, 'PROVIDER_CONTRACT_CHANGED', 'Định dạng nhà cung cấp đã thay đổi.');
    const candidates = (parsed.data.results ?? []).flatMap(result => (result.lexicalEntries ?? []).filter(entry => entry.lexicalCategory.id === input.partOfSpeech).map(entry => ({
      lemma: entry.text || result.word || input.word, partOfSpeech: entry.lexicalCategory.id, providerEntryRef: result.id,
      senses: (entry.entries ?? []).flatMap(e => (e.senses ?? []).map(sense => ({ providerSenseRef: sense.id,
        definition: { status: sense.definitions?.length ? 'available' : 'unavailable', value: sense.definitions?.[0] ?? null },
        examples: { status: sense.examples?.length ? 'available' : 'unavailable', items: sense.examples?.map(e => e.text) ?? [] },
        pronunciations: (e.pronunciations ?? []).map(p => ({ dialect: input.dialect, ipa: p.phoneticSpelling, audio: { status: p.audioFile ? 'available' : 'unavailable', playbackUrl: p.audioFile } })),
        cefr: { status: 'not_verified', value: null, source: null },
      }))),
    })));
    // Provider text remains in this response only: no DB/cache/queue/log persistence.
    return { query: input, provider: 'oxford', licenseMode: config.DICTIONARY_LICENSE_MODE, candidates, warnings: [this.status().persistenceSupported ? 'Chỉ được lưu các trường đã cấu hình quyền; không bao gồm quyền xuất nội dung nhà cung cấp.' : 'Nội dung tra cứu chỉ dùng để tham khảo trong phiên. Hãy tự biên soạn nghĩa và ví dụ khi lưu từ.'] };
  }
}

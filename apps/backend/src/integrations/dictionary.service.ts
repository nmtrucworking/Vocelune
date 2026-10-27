import { HttpException, Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { Database, json } from '../common/db';
import { config } from '../common/config';
import { fail } from '../common/http';
import { vocabDto } from '../common/serializers';
import { VocabularyService, vocabSchema } from '../vocabulary/vocabulary.service';
import { DictionaryAdapter, DictionaryProviderId, lookupSchema, LookupResult } from './dictionary/contracts';
import { FreeDictionaryAdapter } from './dictionary/free.adapter';
import { MerriamWebsterAdapter } from './dictionary/merriam-webster.adapter';
import { OxfordAdapter } from './dictionary/oxford.adapter';
import { DictionaryTransport } from './dictionary/transport';

export const saveDictionarySchema = lookupSchema.omit({ allowFallback: true }).extend({
  providerEntryRef: z.string().min(1).max(512), providerSenseRef: z.string().min(1).max(512),
  meaningVi: vocabSchema.shape.meaningVi, deckId: vocabSchema.shape.deckId,
  tags: vocabSchema.shape.tags, notes: vocabSchema.shape.notes,
  cefr: vocabSchema.shape.cefr, cefrSource: vocabSchema.shape.cefrSource,
  manualFields: z.object({
    definitionEn: vocabSchema.shape.definitionEn, exampleEn: vocabSchema.shape.exampleEn,
    exampleVi: vocabSchema.shape.exampleVi, phonetic: vocabSchema.shape.phonetic,
  }).strict().default({ definitionEn: '', exampleEn: '', exampleVi: '', phonetic: '' }),
}).strict();

@Injectable()
export class DictionaryService {
  private adapters: Record<DictionaryProviderId, DictionaryAdapter>;
  constructor(@Inject(Database) private db: Database, @Inject(VocabularyService) private vocabulary: VocabularyService, @Inject(DictionaryTransport) private transport: DictionaryTransport) {
    this.adapters = {
      free_dictionary: new FreeDictionaryAdapter(),
      merriam_webster: new MerriamWebsterAdapter({ apiKey: config.MERRIAM_WEBSTER_API_KEY, persistenceApproved: config.MERRIAM_WEBSTER_PERSISTENCE_APPROVED === 'true', persistFields: config.MERRIAM_WEBSTER_PERSIST_FIELDS }),
      oxford: new OxfordAdapter({ appId: config.OXFORD_APP_ID, appKey: config.OXFORD_APP_KEY, environment: config.OXFORD_ENVIRONMENT, licenseMode: config.DICTIONARY_LICENSE_MODE, persistenceApproved: config.OXFORD_PERSISTENCE_APPROVED === 'true', persistFields: config.OXFORD_PERSIST_FIELDS }),
    };
  }
  async status(userId: string) {
    const settings = await this.db.userSettings.findUniqueOrThrow({ where: { userId } });
    return { defaultProvider: settings.dictionaryProvider, allowFallback: settings.dictionaryFallbackEnabled, manualEntryAvailable: true,
      providers: Object.values(this.adapters).map(adapter => adapter.status()) };
  }
  private async fromProvider(userId: string, provider: DictionaryProviderId, query: z.infer<typeof lookupSchema>): Promise<LookupResult> {
    const adapter = this.adapters[provider], status = adapter.status();
    const base = { query: { word: query.word, partOfSpeech: query.partOfSpeech, dialect: query.dialect }, requestedProvider: provider, provider, configured: status.configured, licenseMode: status.licenseMode, attribution: status.attribution, fallbackUsed: false, persistenceSupported: status.persistenceSupported };
    if (!status.configured) return { ...base, candidates: [], suggestions: [], warnings: [`${status.name} chưa được cấu hình API key. Bạn có thể chọn nguồn miễn phí hoặc nhập thủ công.`] };
    const response = await this.transport.get(userId, provider, adapter.request(query), provider === 'merriam_webster' ? config.MERRIAM_WEBSTER_DAILY_LIMIT : undefined);
    if (response === null) return { ...base, candidates: [], suggestions: [], warnings: ['Không tìm thấy từ phù hợp trong nguồn đã chọn.'] };
    const result = adapter.parse(response, query);
    if (!result.candidates.length && !result.suggestions.length) result.warnings.push('Nguồn không có nghĩa phù hợp với từ loại đã chọn. Bạn có thể đổi từ loại hoặc nhập thủ công.');
    return { ...base, ...result };
  }
  async lookup(userId: string, body: unknown): Promise<LookupResult> {
    const input = lookupSchema.parse(body);
    const settings = await this.db.userSettings.findUniqueOrThrow({ where: { userId } });
    const provider = input.provider ?? settings.dictionaryProvider as DictionaryProviderId;
    const allowFallback = input.allowFallback ?? settings.dictionaryFallbackEnabled;
    let failure: unknown;
    let result: LookupResult | undefined;
    try {
      result = await this.fromProvider(userId, provider, input);
      if (result.candidates.length || !allowFallback || provider === 'free_dictionary') return result;
    } catch (error) {
      if (!allowFallback || provider === 'free_dictionary') throw error;
      // Validation, DB failures and implementation errors must not be disguised as provider fallback.
      if (!(error instanceof HttpException)) throw error;
      failure = error;
    }
    try {
      const fallback = await this.fromProvider(userId, 'free_dictionary', input);
      return { ...fallback, requestedProvider: provider, fallbackUsed: true, warnings: [`Nguồn ${this.adapters[provider].status().name} chưa trả được nghĩa phù hợp. Đã dùng Free Dictionary API theo tùy chọn dự phòng của bạn.`, ...fallback.warnings] };
    } catch (fallbackError) {
      if (result) return { ...result, warnings: [...result.warnings, 'Nguồn dự phòng cũng chưa khả dụng. Bạn vẫn có thể nhập thủ công.'] };
      throw failure ?? fallbackError;
    }
  }
  async saveLicensed(userId: string, body: unknown) {
    // Preserve the existing legacy Oxford call without accepting a claim of licensed content.
    if (body && typeof body === 'object' && !('provider' in body) && !this.adapters.oxford.status().persistenceSupported) fail(403, 'PERSISTENCE_NOT_LICENSED', 'Chưa có quyền lưu các trường nội dung của nhà cung cấp.');
    const input = saveDictionarySchema.parse(body);
    const provider = input.provider ?? 'oxford';
    if (!this.adapters[provider].status().persistenceSupported) fail(403, 'PERSISTENCE_NOT_LICENSED', 'Nguồn này chỉ cho phép xem tham khảo. Hãy tự biên soạn nội dung khi lưu.');
    await this.vocabulary.requireDeck(this.db, userId, input.deckId);
    // Refetch from the explicit source, without fallback, to verify selected content/rights server-side.
    const lookup = await this.fromProvider(userId, provider, input);
    const candidate = lookup.candidates.find(c => c.providerEntryRef === input.providerEntryRef);
    const sense = candidate?.senses.find(s => s.providerSenseRef === input.providerSenseRef);
    if (!candidate || !sense) fail(422, 'SENSE_NOT_FOUND', 'Nghĩa đã thay đổi hoặc không còn tồn tại. Vui lòng tra lại.');
    if (!sense.persistFields.length) fail(403, 'PERSISTENCE_NOT_LICENSED', 'Nghĩa đã chọn chưa có nguồn và quyền lưu được xác nhận.');
    const fields = sense.persistFields;
    const pronunciation = sense.pronunciations.find(p => p.dialect === input.dialect && p.ipa) ?? sense.pronunciations.find(p => p.dialect === 'unknown' && p.ipa);
    const providerValues = { definitionEn: sense.definition.value || '', exampleEn: sense.examples.items[0] || '', phonetic: pronunciation?.ipa || '' };
    const persistedFields = fields.filter(field => !!providerValues[field]);
    const data = vocabSchema.parse({
      ...input.manualFields, word: candidate.lemma, partOfSpeech: candidate.partOfSpeech, dialect: input.dialect,
      meaningVi: input.meaningVi, deckId: input.deckId, tags: input.tags, notes: input.notes, cefr: input.cefr, cefrSource: input.cefr === 'unknown' ? 'unknown' : 'manual',
      ...Object.fromEntries(persistedFields.map(field => [field, providerValues[field]])),
    });
    return this.db.forUser(userId, async tx => {
      const item = await this.vocabulary.createInTx(tx, userId, data);
      const saved = await tx.vocabItem.update({ where: { id: item.id }, data: { sourceKind: persistedFields.length ? 'licensed' : 'user', provenance: json({
        provider, providerEntryRef: input.providerEntryRef, providerSenseRef: input.providerSenseRef,
        licenseMode: lookup.licenseMode, persistedFields, exportableFields: provider === 'free_dictionary' ? persistedFields : [],
        attribution: sense.attribution, retrievedAt: new Date(), cefrMethod: input.cefr === 'unknown' ? 'unknown' : 'manual',
      }) }, include: { decks: true } });
      return vocabDto(saved);
    });
  }
}

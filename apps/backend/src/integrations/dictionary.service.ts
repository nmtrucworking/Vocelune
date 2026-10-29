import { HttpException, Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { Database, json } from '../common/db';
import { config } from '../common/config';
import { fail } from '../common/http';
import { vocabDto } from '../common/serializers';
import { VocabularyService, vocabSchema } from '../vocabulary/vocabulary.service';
import { DictionaryAdapter, DictionaryCandidate, DictionaryProviderId, DictionaryQuery, DictionarySelection, dictionarySource, lookupSchema, LookupResult, PersistField } from './dictionary/contracts';
import { FreeDictionaryAdapter } from './dictionary/free.adapter';
import { MerriamWebsterAdapter } from './dictionary/merriam-webster.adapter';
import { OxfordAdapter } from './dictionary/oxford.adapter';
import { DictionaryTransport } from './dictionary/transport';
import { LocalDictionaryAdapter } from './dictionary/local.adapter';
import { WiktionaryAdapter } from './dictionary/wiktionary.adapter';
import { WordsApiAdapter } from './dictionary/wordsapi.adapter';
import { CollinsAdapter } from './dictionary/collins.adapter';
import { DatamuseAdapter } from './dictionary/datamuse.adapter';
import { hasValue, localProviders, mergeCandidates, persistableProvenance, senseValues, sourceResult } from './dictionary/lexical';

export const translateSchema = z.object({
  text: z.string().trim().min(1).max(5000),
  from: z.string().trim().regex(/^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/).default('en'),
  to: z.string().trim().regex(/^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/).default('vi'),
}).strict();

export const saveDictionarySchema = lookupSchema.omit({ allowFallback: true }).extend({
  provider: dictionarySource.optional(),
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
      local_kaikki: new LocalDictionaryAdapter(db, 'local_kaikki'), local_wordnet: new LocalDictionaryAdapter(db, 'local_wordnet'),
      wiktionary: new WiktionaryAdapter(config.DICTIONARY_USER_AGENT),
      wordsapi: new WordsApiAdapter({ apiKey: config.WORDSAPI_API_KEY, dailyLimit: config.WORDSAPI_DAILY_LIMIT, persistenceApproved: config.WORDSAPI_PERSISTENCE_APPROVED === 'true', persistFields: config.WORDSAPI_PERSIST_FIELDS }),
      collins: new CollinsAdapter({ apiKey: config.COLLINS_API_KEY, dictionary: config.COLLINS_DICTIONARY, monthlyLimit: config.COLLINS_MONTHLY_LIMIT }),
      datamuse: new DatamuseAdapter({ enabled: config.DATAMUSE_ENABLED === 'true', apiKey: config.DATAMUSE_API_KEY }),
    };
  }
  async status(userId: string) {
    const settings = await this.db.userSettings.findUniqueOrThrow({ where: { userId } });
    const counts = await this.db.dictionaryEntry.groupBy({ by: ['provider'], _count: true });
    return { defaultProvider: settings.dictionaryProvider, allowFallback: settings.dictionaryFallbackEnabled, manualEntryAvailable: true,
      providers: await Promise.all(Object.values(this.adapters).map(async adapter => ({ ...adapter.status(),
        ...(localProviders.includes(adapter.status().id) ? { entryCount: counts.find(c => c.provider === adapter.status().id)?._count ?? 0 } : {}),
        health: await this.transport.health(adapter.status().id),
      }))) };
  }
  private async fromProvider(userId: string, provider: DictionaryProviderId, query: DictionaryQuery, onRequest?: () => void): Promise<LookupResult> {
    const adapter = this.adapters[provider], status = adapter.status();
    const base = { query, requestedProvider: provider, provider, configured: status.configured, licenseMode: status.licenseMode, attribution: status.attribution, fallbackUsed: false, persistenceSupported: status.persistenceSupported };
    if (!status.configured) return { ...base, candidates: [], suggestions: [], warnings: [`${status.name} chưa được cấu hình API key. Bạn có thể chọn nguồn miễn phí hoặc nhập thủ công.`] };
    if (adapter instanceof LocalDictionaryAdapter) return { ...base, ...sourceResult(await adapter.lookup(query), status, query) };
    const limits = provider === 'merriam_webster' ? { daily: config.MERRIAM_WEBSTER_DAILY_LIMIT } : provider === 'oxford' ? { daily: config.OXFORD_DAILY_LIMIT } : provider === 'wordsapi' ? { daily: config.WORDSAPI_DAILY_LIMIT } : provider === 'collins' ? { monthly: config.COLLINS_MONTHLY_LIMIT } : provider === 'datamuse' ? { daily: config.DATAMUSE_DAILY_LIMIT } : undefined;
    const response = await this.transport.get(userId, provider, adapter.request(query), limits, onRequest);
    if (response === null) return { ...base, candidates: [], suggestions: [], warnings: ['Không tìm thấy từ phù hợp trong nguồn đã chọn.'] };
    let result;
    try { result = sourceResult(adapter.parse(response, query), status, query); }
    catch (error) {
      if (error instanceof HttpException) {
        const response = error.getResponse();
        const auth = typeof response === 'object' && 'code' in response && response.code === 'DICTIONARY_AUTH_FAILED';
        await this.transport.markFailure(provider, auth ? 'auth' : 'contract', auth ? 15 * 60000 : 60000);
      }
      throw error;
    }
    if (!result.candidates.length && !result.suggestions.length) result.warnings.push('Nguồn không có nghĩa phù hợp với từ loại đã chọn. Bạn có thể đổi từ loại hoặc nhập thủ công.');
    return { ...base, ...result };
  }
  private translationCache = new Map<string, { translation: string; alternatives: string[]; source: string; timestamp: number }>();
  translationFetcher: typeof fetch = (...args) => fetch(...args);

  async translateDirect(text: string, from = 'en', to = 'vi'): Promise<{ translation: string; alternatives: string[]; source: string }> {
    const trimmed = text.trim();
    if (!trimmed) return { translation: '', alternatives: [], source: 'none' };
    const cacheKey = `${from}:${to}:${trimmed.toLowerCase()}`;
    const cached = this.translationCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 3600000) {
      return { translation: cached.translation, alternatives: cached.alternatives, source: cached.source };
    }

    // 1. Google Translate gtx
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&dt=bd&q=${encodeURIComponent(trimmed)}`;
      const res = await this.translationFetcher(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        const translation = Array.isArray(data[0]) ? data[0].map((c: any) => c[0]).filter(Boolean).join('') : '';
        let alternatives: string[] = [];
        if (Array.isArray(data[1])) {
          for (const item of data[1]) {
            if (Array.isArray(item[1])) {
              alternatives.push(...item[1].slice(0, 5));
            }
          }
        }
        alternatives = Array.from(new Set(alternatives)).filter(a => a.toLowerCase() !== translation.toLowerCase());
        if (translation) {
          const result = { translation, alternatives: alternatives.slice(0, 6), source: 'google' };
          if (this.translationCache.size >= 500) this.translationCache.delete(this.translationCache.keys().next().value!);
          this.translationCache.set(cacheKey, { ...result, timestamp: Date.now() });
          return result;
        }
      }
    } catch {
      // fallback
    }

    // 2. MyMemory fallback
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trimmed)}&langpair=${from}|${to}`;
      const res = await this.translationFetcher(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        const translation = data.responseData?.translatedText || '';
        const matches = Array.isArray(data.matches)
          ? data.matches.map((m: any) => m.translation).filter((t: string) => t && t.toLowerCase() !== translation.toLowerCase())
          : [];
        const alternatives = Array.from(new Set(matches)).slice(0, 5) as string[];
        if (translation) {
          const result = { translation, alternatives, source: 'mymemory' };
          if (this.translationCache.size >= 500) this.translationCache.delete(this.translationCache.keys().next().value!);
          this.translationCache.set(cacheKey, { ...result, timestamp: Date.now() });
          return result;
        }
      }
    } catch {
      // both failed
    }

    return { translation: '', alternatives: [], source: 'none' };
  }

  private enrichTranslation(result: LookupResult): LookupResult {
    const sense = result.candidates[0]?.senses[0];
    // Translate the ranked definition, not the ambiguous headword. Do not
    // derive storable/cacheable translations from LIVE_ONLY definitions.
    if (!sense?.definition.value || !persistableProvenance(sense, 'definitionEn').length) return result;
    if (sense.meaningVi?.value) return { ...result, translationVi: { translation: sense.meaningVi.value, alternatives: [], source: 'dictionary_sense' } };
    // Machine translation is requested by the UI only after a sense is selected.
    // This keeps lookup's network budget bounded and avoids translating the
    // wrong meaning when the user chooses another sense.
    return result;
  }

  async translate(userId: string, body: unknown) {
    const input = translateSchema.parse(body);
    return this.translateDirect(input.text, input.from, input.to);
  }

  private cache = new Map<string, { expires: number; result: LookupResult }>();
  private cacheable(result: LookupResult) {
    return result.candidates.length > 0 && !result.relatedWords?.length && result.candidates.every(c => c.senses.every(s =>
      Object.values(s.provenance ?? {}).every(sources => sources?.every(p => p.licenseMode === 'OPEN_LICENSE' && p.persistable))));
  }

  private async orchestrate(userId: string, input: z.infer<typeof lookupSchema>, requested: DictionarySelection, allowFallback: boolean, fresh = false): Promise<LookupResult> {
    const started = Date.now();
    const automatic = requested === 'auto' || input.strategy === 'auto_enrich';
    const query: DictionaryQuery = { word: input.word, partOfSpeech: input.partOfSpeech, dialect: input.dialect,
      ...(input.domain ? { domain: input.domain } : {}), ...(input.contextSentence ? { contextSentence: input.contextSentence } : {}) };
    const cacheKey = JSON.stringify([query, requested, allowFallback]);
    if (automatic && !fresh) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expires > Date.now()) return { ...structuredClone(cached.result), metrics: { externalRequests: 0, durationMs: Date.now() - started, cacheHit: true } };
      this.cache.delete(cacheKey);
    }
    const order: DictionaryProviderId[] = [...new Set<DictionaryProviderId>([
      ...(requested === 'auto' ? localProviders : [requested]),
      ...(automatic || allowFallback ? [...localProviders, 'free_dictionary' as const, 'wiktionary' as const, 'wordsapi' as const, 'merriam_webster' as const, 'oxford' as const, 'collins' as const] : []),
    ])];
    const attemptedProviders: DictionaryProviderId[] = [], warnings: string[] = [], suggestions = new Set<string>();
    let externalRequests = 0, externalAttempts = 0, primary: LookupResult | undefined, empty: LookupResult | undefined, firstError: HttpException | undefined;
    const candidates: DictionaryCandidate[] = [];
    let relatedWords: LookupResult['relatedWords'];
    for (const provider of order) {
      if (!this.adapters[provider].status().configured) continue;
      if (!localProviders.includes(provider)) {
        if (externalAttempts >= config.DICTIONARY_MAX_REQUESTS) break;
        // Transport checks again atomically before reserving quota.
        if ((await this.transport.health(provider)).state === 'cooldown' && provider !== requested) continue;
        externalAttempts++;
      }
      attemptedProviders.push(provider);
      try {
        const result = await this.fromProvider(userId, provider, query, () => externalRequests++);
        empty ??= result;
        result.suggestions.forEach(s => suggestions.add(s));
        warnings.push(...result.warnings);
        if (provider === 'datamuse') { relatedWords = result.suggestions.map(word => ({ word, source: 'datamuse', scope: 'lexeme', persistable: false })); continue; }
        if (result.candidates.length) { primary ??= result; candidates.push(...result.candidates); }
        if (primary && !automatic) break;
        const sufficient = candidates.some(c => c.senses.some(s => s.definition.value && s.examples.items.length && s.pronunciations.some(p => p.ipa) && s.synonyms?.length));
        const remainingLocal = order.slice(order.indexOf(provider) + 1).some(p => localProviders.includes(p));
        if (automatic && sufficient && !remainingLocal) break;
      } catch (error) {
        if (!(error instanceof HttpException)) throw error;
        firstError ??= error;
        if (!automatic && !allowFallback) throw error;
        warnings.push(`Nguồn ${this.adapters[provider].status().name} tạm không khả dụng; đã thử nguồn dự phòng.`);
      }
    }
    if (!primary && !empty && firstError && !automatic) throw firstError;
    if (!primary && requested !== 'auto' && !this.adapters[requested].status().configured) empty ??= await this.fromProvider(userId, requested, query);
    const base = primary ?? empty ?? { query, requestedProvider: requested, provider: 'local_kaikki' as const, configured: true,
      licenseMode: 'OPEN_LICENSE' as const, attribution: this.adapters.local_kaikki.status().attribution, fallbackUsed: false, persistenceSupported: true,
      candidates: [], suggestions: [], warnings: [] };
    if (automatic && this.adapters.datamuse.status().configured && externalAttempts < config.DICTIONARY_MAX_REQUESTS) {
      externalAttempts++; attemptedProviders.push('datamuse');
      try {
        const related = await this.fromProvider(userId, 'datamuse', query, () => externalRequests++);
        relatedWords = related.suggestions.map(word => ({ word, source: 'datamuse', scope: 'lexeme', persistable: false }));
      } catch (error) { if (!(error instanceof HttpException)) throw error; warnings.push('Chưa thể bổ sung từ liên quan từ Datamuse.'); }
    }
    const fallbackUsed = requested !== 'auto' && base.provider !== requested;
    if (fallbackUsed) warnings.unshift(`Đã dùng nguồn dự phòng ${this.adapters[base.provider].status().name}.`);
    if (!candidates.length) warnings.push('Chưa tìm thấy nghĩa phù hợp. Bạn vẫn có thể nhập thủ công.');
    const result: LookupResult = { ...base, query, requestedProvider: requested, fallbackUsed, candidates: mergeCandidates(candidates, query),
      suggestions: [...suggestions].slice(0, 10), warnings: [...new Set([...base.warnings, ...warnings])], attemptedProviders, relatedWords,
      metrics: { externalRequests, durationMs: Date.now() - started, cacheHit: false } };
    // Store only complete open-licensed responses. No LIVE_ONLY text or derived
    // field enters this cache; manual comparisons always fetch fresh content.
    if (automatic && !fresh && config.DICTIONARY_CACHE_TTL_SECONDS > 0 && this.cacheable(result)) {
      if (this.cache.size >= 500) this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(cacheKey, { expires: Date.now() + config.DICTIONARY_CACHE_TTL_SECONDS * 1000, result: structuredClone(result) });
    }
    return result;
  }

  async lookup(userId: string, body: unknown): Promise<LookupResult> {
    const input = lookupSchema.parse(body);
    const settings = await this.db.userSettings.findUniqueOrThrow({ where: { userId } });
    const requested = input.provider ?? settings.dictionaryProvider as DictionarySelection;
    const result = await this.orchestrate(userId, input, requested, input.allowFallback ?? settings.dictionaryFallbackEnabled);
    return this.enrichTranslation(result);
  }
  async saveLicensed(userId: string, body: unknown) {
    // Preserve the existing legacy Oxford call without accepting a claim of licensed content.
    if (body && typeof body === 'object' && !('provider' in body) && !this.adapters.oxford.status().persistenceSupported) fail(403, 'PERSISTENCE_NOT_LICENSED', 'Chưa có quyền lưu các trường nội dung của nhà cung cấp.');
    const input = saveDictionarySchema.parse(body);
    const provider = input.provider ?? 'oxford';
    if (!this.adapters[provider].status().persistenceSupported) fail(403, 'PERSISTENCE_NOT_LICENSED', 'Nguồn này chỉ cho phép xem tham khảo. Hãy tự biên soạn nội dung khi lưu.');
    await this.vocabulary.requireDeck(this.db, userId, input.deckId);
    // Refetch from the explicit source, without fallback, to verify selected content/rights server-side.
    const lookup = input.strategy === 'auto_enrich'
      ? await this.orchestrate(userId, input, provider, true, true)
      : await this.fromProvider(userId, provider, input);
    const candidate = lookup.candidates.find(c => c.providerEntryRef === input.providerEntryRef);
    const sense = candidate?.senses.find(s => s.providerSenseRef === input.providerSenseRef);
    if (!candidate || !sense) fail(422, 'SENSE_NOT_FOUND', 'Nghĩa đã thay đổi hoặc không còn tồn tại. Vui lòng tra lại.');
    if (!sense.persistFields.length) fail(403, 'PERSISTENCE_NOT_LICENSED', 'Nghĩa đã chọn chưa có nguồn và quyền lưu được xác nhận.');
    const values = senseValues(sense, input);
    const persistedFields = sense.persistFields.filter(field => hasValue(values[field]) && persistableProvenance(sense, field).length > 0
      && (field !== 'meaningVi' || values[field] === input.meaningVi) && (field !== 'exampleVi' || values[field] === input.manualFields.exampleVi));
    const textFields = ['definitionEn', 'exampleEn', 'phonetic'] as const;
    const providerValues = Object.fromEntries(textFields.filter(field => persistedFields.includes(field)).map(field => [field, values[field]]));
    const metadataFields = persistedFields.filter(field => !textFields.includes(field as typeof textFields[number]) && !['meaningVi', 'exampleVi', 'cefr'].includes(field));
    const lexicalMetadata = { ...Object.fromEntries(metadataFields.map(field => [field, values[field]])),
      ...(sense.cefr.status === 'verified' && persistedFields.includes('cefr') ? { cefr: sense.cefr } : {}),
      provenance: Object.fromEntries(persistedFields.map(field => [field, persistableProvenance(sense, field)])) };
    const exportableFields = persistedFields.filter(field => persistableProvenance(sense, field).every(p => p.exportable));
    const data = vocabSchema.parse({
      ...input.manualFields, word: candidate.lemma, partOfSpeech: candidate.partOfSpeech, dialect: input.dialect,
      meaningVi: input.meaningVi, deckId: input.deckId, tags: input.tags, notes: input.notes, cefr: input.cefr, cefrSource: input.cefr === 'unknown' ? 'unknown' : 'manual',
      ...providerValues,
    });
    return this.db.forUser(userId, async tx => {
      const item = await this.vocabulary.createInTx(tx, userId, data);
      const saved = await tx.vocabItem.update({ where: { id: item.id }, data: { sourceKind: persistedFields.length ? 'licensed' : 'user', lexicalMetadata: json(lexicalMetadata), provenance: json({
        provider, providerEntryRef: input.providerEntryRef, providerSenseRef: input.providerSenseRef,
        licenseMode: lookup.licenseMode, persistedFields, exportableFields, fieldSources: lexicalMetadata.provenance,
        attribution: sense.attribution, retrievedAt: new Date(), cefrMethod: input.cefr === 'unknown' ? 'unknown' : 'manual',
      }) }, include: { decks: true } });
      return vocabDto(saved);
    });
  }
}

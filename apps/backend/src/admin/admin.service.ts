import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { Database, json } from '../common/db';
import { fail, normalized, pagination, patchFields } from '../common/http';
import { VocabularyService } from '../vocabulary/vocabulary.service';
import { OFFICIAL_DECKS } from '../vocabulary/official-decks';
import { DictionaryService } from '../integrations/dictionary.service';
import {
  DictionaryCandidate,
  dictionaryPos,
  dictionarySource,
  examplesField,
  persistFieldNames,
  textField,
} from '../integrations/dictionary/contracts';
import { normalizeWord } from '../integrations/dictionary/lexical';
import { hash, passwordHash, secret } from '../identity/security';
import { LIBRARY_VERSION, MODEL_VERSION, parameters } from '../study/scheduler';

export const ROLES = ['learner', 'admin', 'editorial'] as const;
const userQuery = pagination.extend({
  q: z.string().trim().max(100).optional(),
  role: z.enum(ROLES).optional(),
  status: z.enum(['active', 'disabled']).optional(),
});
const userPatch = z.object({ role: z.enum(ROLES), disabled: z.boolean() }).partial().strict();
const deckQuery = pagination.extend({
  q: z.string().trim().max(100).optional(),
  status: z.enum(['public', 'hidden']).default('public'),
});
const deckPatch = z
  .object({
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(500),
    topicGroup: z.string().trim().min(1).max(60),
    isPublic: z.boolean(),
  })
  .partial()
  .strict();
const auditQuery = pagination.extend({
  action: z.string().trim().max(100).optional(),
  actorId: z.string().uuid().optional(),
});
const dictEntryQuery = pagination.extend({
  q: z.string().trim().max(100).optional(),
  provider: z.enum(['local_kaikki', 'local_wordnet']).optional(),
  partOfSpeech: dictionaryPos.optional(),
});
const dictEntryUpsertSchema = z
  .object({
    provider: z.enum(['local_kaikki', 'local_wordnet']).default('local_kaikki'),
    lemma: z.string().trim().min(1).max(100),
    partOfSpeech: dictionaryPos,
    definitionEn: z.string().trim().min(1).max(2000),
    meaningVi: z.string().trim().max(500).optional(),
    ipa: z.string().trim().max(120).optional(),
    dialect: z.enum(['en-us', 'en-gb', 'unknown']).default('en-us'),
    examples: z.array(z.string().trim().min(1).max(500)).max(10).default([]),
    exampleVi: z.string().trim().max(500).optional(),
    synonyms: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
    antonyms: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
    domains: z.array(z.string().trim().min(1).max(60)).max(10).default([]),
    cefr: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'unknown']).default('unknown'),
    etymology: z.string().trim().max(1000).optional(),
    datasetVersion: z.string().trim().min(1).max(40).default('admin-curated-v1'),
  })
  .strict();

@Injectable()
export class AdminService {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(VocabularyService) private vocabulary: VocabularyService,
    @Inject(DictionaryService) private dictionary: DictionaryService
  ) {}

  private audit(actorId: string, action: string, resourceId: string, metadata?: unknown) {
    return this.db.auditLog.create({
      data: { actorId, action, resourceId, ...(metadata ? { metadata: json(metadata) } : {}) },
    });
  }

  async stats(actorId: string) {
    const since = new Date(Date.now() - 7 * 86400000);
    const since24h = new Date(Date.now() - 86400000);
    const [
      users,
      disabled,
      admins,
      newUsers,
      activeUsers,
      decks,
      publicDecks,
      vocab,
      reviews7d,
      pendingImports,
      pendingEmails,
      localDictionaryEntries,
      dictionaryRequests24h,
    ] = await Promise.all([
      this.db.user.count(),
      this.db.user.count({ where: { disabledAt: { not: null } } }),
      this.db.user.count({ where: { role: 'admin' } }),
      this.db.user.count({ where: { createdAt: { gte: since } } }),
      this.db.authSession.groupBy({ by: ['userId'], where: { createdAt: { gte: since } } }).then(r => r.length),
      this.db.deck.count({ where: { deletedAt: null } }),
      this.db.deck.count({ where: { deletedAt: null, isPublic: true } }),
      this.db.vocabItem.count({ where: { deletedAt: null } }),
      this.db.reviewLog.count({ where: { reviewedAt: { gte: since } } }),
      this.db.importJob.count({ where: { status: { in: ['queued', 'processing'] } } }),
      this.db.emailOutbox.count({ where: { status: 'pending' } }),
      this.db.dictionaryEntry.count(),
      this.db.providerUsage.count({ where: { occurredAt: { gte: since24h } } }),
    ]);
    await this.audit(actorId, 'admin.stats.read', actorId);
    return {
      users,
      disabledUsers: disabled,
      admins,
      newUsers7d: newUsers,
      activeUsers7d: activeUsers,
      decks,
      publicDecks,
      vocabulary: vocab,
      reviews7d,
      pendingImports,
      pendingEmails,
      localDictionaryEntries,
      dictionaryRequests24h,
    };
  }

  async users(actorId: string, query: unknown) {
    const q = userQuery.parse(query);
    const where = {
      ...(q.role ? { role: q.role } : {}),
      ...(q.status ? { disabledAt: q.status === 'disabled' ? { not: null } : null } : {}),
      ...(q.q
        ? {
            OR: [
              { email: { contains: q.q, mode: 'insensitive' as const } },
              { displayName: { contains: q.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const rows = await this.db.user.findMany({
      where,
      take: q.limit + 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        disabledAt: true,
        createdAt: true,
        _count: { select: { vocabulary: true, decks: true, reviews: true, sessions: { where: { revokedAt: null } } } },
      },
    });
    const items = rows.slice(0, q.limit);
    return {
      items: items.map(({ _count, ...u }) => ({
        ...u,
        vocabularyCount: _count.vocabulary,
        deckCount: _count.decks,
        reviewCount: _count.reviews,
        activeSessionsCount: _count.sessions,
      })),
      nextCursor: rows.length > q.limit ? items[items.length - 1].id : null,
    };
  }

  async updateUser(actorId: string, userId: string, body: unknown) {
    const data = patchFields(userPatch.parse(body), body);
    if (!Object.keys(data).length) fail(422, 'VALIDATION_ERROR', 'Không có thay đổi nào.');
    if (userId === actorId) fail(409, 'SELF_MODIFICATION', 'Không thể tự thay đổi vai trò hoặc khóa tài khoản của mình.');
    return this.db.forUser(userId, async tx => {
      const target = await tx.user.findUnique({ where: { id: userId } });
      if (!target) fail(404, 'NOT_FOUND', 'Không tìm thấy người dùng.');
      const demoting = target.role === 'admin' && ((data.role && data.role !== 'admin') || data.disabled === true);
      if (demoting) {
        const others = await tx.user.count({ where: { role: 'admin', disabledAt: null, id: { not: userId } } });
        if (!others) fail(409, 'LAST_ADMIN', 'Phải còn ít nhất một quản trị viên đang hoạt động.');
      }
      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          ...(data.role ? { role: data.role } : {}),
          ...(data.disabled !== undefined ? { disabledAt: data.disabled ? new Date() : null } : {}),
        },
        select: { id: true, email: true, displayName: true, role: true, disabledAt: true, createdAt: true },
      });
      if (data.disabled === true || (data.role && data.role !== target.role)) {
        await tx.authSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'admin.user.update',
          resourceId: userId,
          metadata: json({ from: { role: target.role, disabled: !!target.disabledAt }, to: data }),
        },
      });
      return updated;
    });
  }

  async revokeUserSessions(actorId: string, userId: string) {
    const target = await this.db.user.findUnique({ where: { id: userId }, select: { id: true, email: true } });
    if (!target) fail(404, 'NOT_FOUND', 'Không tìm thấy người dùng.');
    const res = await this.db.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit(actorId, 'admin.user.revoke_sessions', userId, {
      email: target.email,
      revokedCount: res.count,
    });
    return { ok: true, revokedCount: res.count };
  }

  async decks(actorId: string, query: unknown) {
    const q = deckQuery.parse(query);
    const where = {
      deletedAt: null,
      isPublic: q.status === 'public',
      ...(q.q ? { name: { contains: q.q, mode: 'insensitive' as const } } : {}),
    };
    const rows = await this.db.deck.findMany({
      where,
      take: q.limit + 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      include: { _count: { select: { items: true } }, user: { select: { id: true, email: true, displayName: true } } },
    });
    const items = rows.slice(0, q.limit);
    return {
      items: items.map(d => ({
        id: d.id,
        name: d.name,
        description: d.description,
        topicGroup: d.topicGroup,
        isPublic: d.isPublic,
        forkCount: d.forkCount,
        itemCount: d._count.items,
        createdAt: d.createdAt,
        author: d.user,
      })),
      nextCursor: rows.length > q.limit ? items[items.length - 1].id : null,
    };
  }

  async updateDeck(actorId: string, deckId: string, body: unknown) {
    const data = patchFields(deckPatch.parse(body), body);
    if (!Object.keys(data).length) fail(422, 'VALIDATION_ERROR', 'Không có thay đổi nào.');
    const deck = await this.db.deck.findFirst({ where: { id: deckId, deletedAt: null } });
    if (!deck) fail(404, 'NOT_FOUND', 'Không tìm thấy bộ từ vựng.');
    const updated = await this.db.deck.update({
      where: { id: deckId },
      data: { ...data, ...(data.name ? { normalizedName: normalized(data.name) } : {}) },
    });
    await this.audit(actorId, 'admin.deck.update', deckId, {
      from: { name: deck.name, isPublic: deck.isPublic, topicGroup: deck.topicGroup },
      to: data,
    });
    this.vocabulary.invalidatePublicCache();
    return {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      topicGroup: updated.topicGroup,
      isPublic: updated.isPublic,
    };
  }

  async removeDeck(actorId: string, deckId: string) {
    const deck = await this.db.deck.findFirst({ where: { id: deckId, deletedAt: null } });
    if (!deck) fail(404, 'NOT_FOUND', 'Không tìm thấy bộ từ vựng.');
    await this.db.deck.update({ where: { id: deckId }, data: { deletedAt: new Date(), isPublic: false } });
    await this.audit(actorId, 'admin.deck.delete', deckId, { name: deck.name, ownerId: deck.userId });
    this.vocabulary.invalidatePublicCache();
    return { ok: true };
  }

  async seedOfficialDecks(actorId: string) {
    const email = 'editorial@vocelune.com';
    let author = await this.db.user.findUnique({ where: { email }, include: { settings: true } });
    if (!author) {
      author = await this.db.user.create({
        data: {
          email,
          displayName: 'Ban Biên Tập Vocelune',
          passwordHash: await passwordHash(secret()),
          role: 'editorial',
          settings: {
            create: {
              emailReminderStudy: false,
              emailDailySummary: false,
            },
          },
        },
        include: { settings: true },
      });
      await this.db.schedulerConfig.create({
        data: {
          userId: author.id,
          version: 1,
          modelVersion: MODEL_VERSION,
          libraryVersion: LIBRARY_VERSION,
          retention: 0.9,
          parameters: json(parameters(0.9)),
        },
      });
    }

    let decksSynced = 0;
    let wordsSynced = 0;

    for (const deckData of OFFICIAL_DECKS) {
      let deck = await this.db.deck.findFirst({
        where: {
          userId: author.id,
          normalizedName: normalized(deckData.name),
          deletedAt: null,
        },
      });

      if (!deck) {
        deck = await this.db.deck.create({
          data: {
            userId: author.id,
            name: deckData.name,
            normalizedName: normalized(deckData.name),
            description: deckData.description,
            color: deckData.color,
            icon: deckData.icon,
            topicGroup: deckData.topicGroup,
            isPublic: true,
            forkCount: 25,
          },
        });
      } else {
        deck = await this.db.deck.update({
          where: { id: deck.id },
          data: {
            isPublic: true,
            topicGroup: deckData.topicGroup,
            description: deckData.description,
            color: deckData.color,
            icon: deckData.icon,
          },
        });
      }
      decksSynced++;

      for (const w of deckData.words) {
        const normalizedWord = normalized(w.word);
        const lexeme = await this.db.lexeme.upsert({
          where: {
            normalized_partOfSpeech_language: {
              normalized: normalizedWord,
              partOfSpeech: w.partOfSpeech,
              language: 'en',
            },
          },
          create: {
            lemma: w.word,
            normalized: normalizedWord,
            partOfSpeech: w.partOfSpeech,
          },
          update: {},
        });

        const senseKey = hash(normalized(w.meaningVi) + '\0' + normalized(w.definitionEn));
        let vocabItem = await this.db.vocabItem.findFirst({
          where: {
            userId: author.id,
            lexemeId: lexeme.id,
            senseKey,
            deletedAt: null,
          },
        });

        if (!vocabItem) {
          vocabItem = await this.db.vocabItem.create({
            data: {
              userId: author.id,
              lexemeId: lexeme.id,
              senseKey,
              word: w.word,
              partOfSpeech: w.partOfSpeech,
              meaningVi: w.meaningVi,
              definitionEn: w.definitionEn,
              exampleEn: w.exampleEn,
              exampleVi: w.exampleVi,
              phonetic: w.phonetic,
              cefr: w.cefr,
              cefrSource: 'verified_3000',
              tags: [normalized(deckData.topicGroup), normalized(w.partOfSpeech)],
            },
          });
        }

        await this.db.deckItem.upsert({
          where: {
            deckId_vocabItemId: {
              deckId: deck.id,
              vocabItemId: vocabItem.id,
            },
          },
          create: {
            deckId: deck.id,
            vocabItemId: vocabItem.id,
          },
          update: {},
        });
        wordsSynced++;
      }
    }

    this.vocabulary.invalidatePublicCache();
    await this.audit(actorId, 'admin.deck.seed_official', actorId, { decksSynced, wordsSynced });
    return { ok: true, decksSynced, wordsSynced };
  }

  async dictionaryOverview(actorId: string) {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const monthStr = now.toISOString().slice(0, 7);
    const since24h = new Date(now.getTime() - 86400000);

    const [adapters, healthRows, quotaRows, entryByProvider, entryByPos, usageRows] = await Promise.all([
      Promise.resolve(this.dictionary.getAdaptersStatus()),
      this.db.dictionaryProviderHealth.findMany(),
      this.db.dictionaryQuota.findMany({
        where: { day: { in: [todayStr, monthStr] } },
      }),
      this.db.dictionaryEntry.groupBy({ by: ['provider'], _count: true }),
      this.db.dictionaryEntry.groupBy({ by: ['partOfSpeech'], _count: true }),
      this.db.providerUsage.findMany({
        where: { occurredAt: { gte: since24h } },
        select: { provider: true, status: true, latencyMs: true },
      }),
    ]);

    const healthMap = new Map(healthRows.map(h => [h.provider, h]));
    const entryCountMap = new Map(entryByProvider.map(e => [e.provider, e._count]));

    const providers = adapters.map(adapter => {
      const h = healthMap.get(adapter.id);
      const blocked = !!h?.blockedUntil && h.blockedUntil.getTime() > Date.now();
      const dailyUsed = quotaRows.find(q => q.provider === adapter.id && q.day === todayStr)?.used ?? 0;
      const monthlyUsed = quotaRows.find(q => q.provider === adapter.id && q.day === monthStr)?.used ?? 0;

      const logs = usageRows.filter(u => u.provider === adapter.id);
      const totalRequests = logs.length;
      const successCount = logs.filter(u => u.status >= 200 && u.status < 300 || u.status === 404).length;
      const rateLimitCount = logs.filter(u => u.status === 429).length;
      const errorCount = logs.filter(u => u.status === 0 || (u.status >= 400 && u.status !== 404)).length;
      const avgLatencyMs = totalRequests
        ? Math.round(logs.reduce((s, u) => s + u.latencyMs, 0) / totalRequests)
        : 0;
      const maxLatencyMs = totalRequests ? Math.max(...logs.map(u => u.latencyMs)) : 0;

      return {
        ...adapter,
        entryCount: entryCountMap.get(adapter.id) ?? null,
        health: {
          state: blocked ? ('cooldown' as const) : ('healthy' as const),
          retryAt: blocked && h?.blockedUntil ? h.blockedUntil.toISOString() : null,
          failures: h?.failures ?? 0,
          reason: h?.reason ?? null,
          updatedAt: h?.updatedAt ? h.updatedAt.toISOString() : null,
        },
        quota: {
          dailyUsed,
          dailyLimit: adapter.dailyLimit,
          monthlyUsed,
          monthlyLimit: adapter.monthlyLimit,
        },
        telemetry24h: {
          totalRequests,
          successCount,
          errorCount,
          rateLimitCount,
          avgLatencyMs,
          maxLatencyMs,
        },
      };
    });

    const totalLocalEntries = entryByProvider.reduce((sum, r) => sum + r._count, 0);

    return {
      config: this.dictionary.getCacheStats(),
      providers,
      localCorpus: {
        totalEntries: totalLocalEntries,
        byProvider: Object.fromEntries(entryByProvider.map(e => [e.provider, e._count])),
        byPos: entryByPos.map(p => ({ partOfSpeech: p.partOfSpeech, count: p._count })),
      },
    };
  }

  async resetProviderHealth(actorId: string, providerParam: string) {
    if (providerParam === 'all') {
      await this.db.dictionaryProviderHealth.updateMany({
        data: { failures: 0, blockedUntil: null, reason: null },
      });
    } else {
      const parsed = dictionarySource.safeParse(providerParam);
      if (!parsed.success) fail(422, 'INVALID_PROVIDER', 'Nguồn từ điển không hợp lệ.');
      await this.db.dictionaryProviderHealth.upsert({
        where: { provider: parsed.data },
        create: { provider: parsed.data, failures: 0, blockedUntil: null, reason: null },
        update: { failures: 0, blockedUntil: null, reason: null },
      });
    }
    await this.audit(actorId, 'admin.dictionary.reset_health', providerParam);
    return { ok: true, provider: providerParam };
  }

  async resetProviderQuota(actorId: string, providerParam: string) {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const monthStr = now.toISOString().slice(0, 7);
    if (providerParam === 'all') {
      await this.db.dictionaryQuota.updateMany({
        where: { day: { in: [todayStr, monthStr] } },
        data: { used: 0 },
      });
    } else {
      const parsed = dictionarySource.safeParse(providerParam);
      if (!parsed.success) fail(422, 'INVALID_PROVIDER', 'Nguồn từ điển không hợp lệ.');
      await this.db.dictionaryQuota.updateMany({
        where: { provider: parsed.data, day: { in: [todayStr, monthStr] } },
        data: { used: 0 },
      });
    }
    await this.audit(actorId, 'admin.dictionary.reset_quota', providerParam);
    return { ok: true, provider: providerParam };
  }

  async clearDictionaryCache(actorId: string) {
    const stats = this.dictionary.clearCaches();
    await this.audit(actorId, 'admin.dictionary.clear_cache', actorId, stats);
    return stats;
  }

  async probeDictionary(actorId: string, body: unknown) {
    const result = await this.dictionary.probe(actorId, body);
    await this.audit(actorId, 'admin.dictionary.probe', result.lookup.query.word, {
      provider: result.lookup.requestedProvider,
      candidates: result.lookup.candidates.length,
      durationMs: result.lookup.metrics?.durationMs ?? 0,
    });
    return result;
  }

  async dictionaryEntries(actorId: string, query: unknown) {
    const q = dictEntryQuery.parse(query);
    const where = {
      ...(q.provider ? { provider: q.provider } : {}),
      ...(q.partOfSpeech ? { partOfSpeech: q.partOfSpeech } : {}),
      ...(q.q
        ? {
            OR: [
              { lemma: { contains: q.q, mode: 'insensitive' as const } },
              { normalized: { contains: normalizeWord(q.q) } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.db.dictionaryEntry.findMany({
        where,
        take: q.limit + 1,
        orderBy: [{ importedAt: 'desc' }, { id: 'desc' }],
        ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      }),
      this.db.dictionaryEntry.count({ where }),
    ]);
    const items = rows.slice(0, q.limit);
    return {
      items,
      total,
      nextCursor: rows.length > q.limit ? items[items.length - 1].id : null,
    };
  }

  async upsertDictionaryEntry(actorId: string, body: unknown) {
    const input = dictEntryUpsertSchema.parse(body);
    const norm = normalizeWord(input.lemma);
    if (!norm) fail(422, 'INVALID_WORD', 'Từ vựng không hợp lệ.');

    const entryRef = `${input.provider}:${norm}:${input.partOfSpeech}`;
    const senseRef = `${entryRef}:sense:1`;
    const attribution =
      input.provider === 'local_kaikki'
        ? [
            {
              name: 'Wiktionary contributors / Kaikki (Curated)',
              url: `https://en.wiktionary.org/wiki/${encodeURIComponent(input.lemma)}`,
              license: { name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' },
            },
          ]
        : [
            {
              name: 'Open English WordNet (Curated)',
              url: 'https://en-word.net/',
              license: {
                name: 'CC BY 4.0 / WordNet License',
                url: 'https://github.com/globalwordnet/english-wordnet/blob/main/LICENSE.md',
              },
            },
          ];

    const candidate: DictionaryCandidate = {
      lemma: input.lemma,
      partOfSpeech: input.partOfSpeech,
      providerEntryRef: entryRef,
      senses: [
        {
          provider: input.provider,
          providerSenseRef: senseRef,
          definition: textField(input.definitionEn),
          examples: examplesField(input.examples),
          pronunciations: input.ipa
            ? [{ dialect: input.dialect, ipa: input.ipa, audio: { status: 'unavailable' } }]
            : [],
          cefr:
            input.cefr !== 'unknown'
              ? { status: 'verified', value: input.cefr, source: 'admin_curated' }
              : { status: 'not_verified', value: null, source: null },
          ...(input.meaningVi ? { meaningVi: textField(input.meaningVi) } : {}),
          ...(input.exampleVi ? { exampleVi: textField(input.exampleVi) } : {}),
          ...(input.domains.length ? { domains: input.domains } : {}),
          ...(input.synonyms.length ? { synonyms: input.synonyms } : {}),
          ...(input.antonyms.length ? { antonyms: input.antonyms } : {}),
          ...(input.etymology ? { etymology: input.etymology } : {}),
          attribution,
          persistFields: [...persistFieldNames],
        },
      ],
    };

    const saved = await this.db.dictionaryEntry.upsert({
      where: { provider_entryRef: { provider: input.provider, entryRef } },
      create: {
        provider: input.provider,
        entryRef,
        lemma: input.lemma,
        normalized: norm,
        partOfSpeech: input.partOfSpeech,
        datasetVersion: input.datasetVersion,
        candidate: json(candidate),
      },
      update: {
        lemma: input.lemma,
        normalized: norm,
        partOfSpeech: input.partOfSpeech,
        datasetVersion: input.datasetVersion,
        candidate: json(candidate),
        importedAt: new Date(),
      },
    });

    this.dictionary.clearCaches();
    await this.audit(actorId, 'admin.dictionary.entry_upsert', saved.id, {
      provider: input.provider,
      lemma: input.lemma,
      partOfSpeech: input.partOfSpeech,
    });
    return saved;
  }

  async deleteDictionaryEntry(actorId: string, entryId: string) {
    const existing = await this.db.dictionaryEntry.findUnique({ where: { id: entryId } });
    if (!existing) fail(404, 'NOT_FOUND', 'Không tìm thấy mục từ điển nội bộ.');
    await this.db.dictionaryEntry.delete({ where: { id: entryId } });
    this.dictionary.clearCaches();
    await this.audit(actorId, 'admin.dictionary.entry_delete', entryId, {
      provider: existing.provider,
      lemma: existing.lemma,
      partOfSpeech: existing.partOfSpeech,
    });
    return { ok: true };
  }

  async operationsOverview(actorId: string) {
    const since24h = new Date(Date.now() - 86400000);
    const [
      importCounts,
      recentImports,
      emailCounts,
      recentEmails,
      activeSessions,
      mediaReadyCount,
      providerUsageLast24h,
    ] = await Promise.all([
      this.db.importJob.groupBy({ by: ['status'], _count: true }),
      this.db.importJob.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          policy: true,
          result: true,
          createdAt: true,
          completedAt: true,
          user: { select: { email: true, displayName: true } },
        },
      }),
      this.db.emailOutbox.groupBy({ by: ['status'], _count: true }),
      this.db.emailOutbox.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          to: true,
          subject: true,
          status: true,
          attempts: true,
          createdAt: true,
          sentAt: true,
        },
      }),
      this.db.authSession.count({ where: { revokedAt: null, expiresAt: { gt: new Date() } } }),
      this.db.mediaAsset.count({ where: { status: 'ready', deletedAt: null } }),
      this.db.providerUsage.groupBy({
        by: ['provider', 'status'],
        where: { occurredAt: { gte: since24h } },
        _count: true,
        _avg: { latencyMs: true },
      }),
    ]);

    return {
      imports: {
        byStatus: Object.fromEntries(importCounts.map(c => [c.status, c._count])),
        recent: recentImports,
      },
      emails: {
        byStatus: Object.fromEntries(emailCounts.map(c => [c.status, c._count])),
        recent: recentEmails,
      },
      activeSessions,
      mediaReadyCount,
      providerUsageLast24h: providerUsageLast24h.map(p => ({
        provider: p.provider,
        status: p.status,
        count: p._count,
        avgLatencyMs: Math.round(p._avg.latencyMs ?? 0),
      })),
    };
  }

  async retryFailedEmails(actorId: string) {
    const res = await this.db.emailOutbox.updateMany({
      where: { status: 'failed' },
      data: { status: 'pending', attempts: 0, lockedAt: null },
    });
    await this.audit(actorId, 'admin.operations.retry_emails', actorId, { retriedCount: res.count });
    return { ok: true, retriedCount: res.count };
  }

  async auditLogs(actorId: string, query: unknown) {
    const q = auditQuery.parse(query);
    const rows = await this.db.auditLog.findMany({
      where: {
        action: { not: 'auth.login_failed' },
        ...(q.action ? { action: { startsWith: q.action } } : {}),
        ...(q.actorId ? { actorId: q.actorId } : {}),
      },
      take: q.limit + 1,
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });
    const items = rows.slice(0, q.limit);
    const actors = await this.db.user.findMany({
      where: { id: { in: [...new Set(items.map(i => i.actorId).filter((v): v is string => !!v))] } },
      select: { id: true, email: true, displayName: true },
    });
    const byId = new Map(actors.map(a => [a.id, a]));
    return {
      items: items.map(i => ({ ...i, actor: i.actorId ? byId.get(i.actorId) ?? null : null })),
      nextCursor: rows.length > q.limit ? items[items.length - 1].id : null,
    };
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { Database, json } from '../common/db';
import { fail, normalized, pagination, patchFields } from '../common/http';
import { VocabularyService } from '../vocabulary/vocabulary.service';

export const ROLES = ['learner', 'admin', 'editorial'] as const;
const userQuery = pagination.extend({ q: z.string().trim().max(100).optional(), role: z.enum(ROLES).optional(), status: z.enum(['active', 'disabled']).optional() });
const userPatch = z.object({ role: z.enum(ROLES), disabled: z.boolean() }).partial().strict();
const deckQuery = pagination.extend({ q: z.string().trim().max(100).optional(), status: z.enum(['public', 'hidden']).default('public') });
const deckPatch = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500),
  topicGroup: z.string().trim().min(1).max(60),
  isPublic: z.boolean(),
}).partial().strict();
const auditQuery = pagination.extend({ action: z.string().trim().max(100).optional(), actorId: z.string().uuid().optional() });

@Injectable()
export class AdminService {
  constructor(@Inject(Database) private db: Database, @Inject(VocabularyService) private vocabulary: VocabularyService) {}

  private audit(actorId: string, action: string, resourceId: string, metadata?: unknown) {
    return this.db.auditLog.create({ data: { actorId, action, resourceId, ...(metadata ? { metadata: json(metadata) } : {}) } });
  }

  async stats(actorId: string) {
    const since = new Date(Date.now() - 7 * 86400000);
    const [users, disabled, admins, newUsers, activeUsers, decks, publicDecks, vocab, reviews7d, pendingImports, pendingEmails] = await Promise.all([
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
    ]);
    await this.audit(actorId, 'admin.stats.read', actorId);
    return { users, disabledUsers: disabled, admins, newUsers7d: newUsers, activeUsers7d: activeUsers, decks, publicDecks, vocabulary: vocab, reviews7d, pendingImports, pendingEmails };
  }

  async users(actorId: string, query: unknown) {
    const q = userQuery.parse(query);
    const where = {
      ...(q.role ? { role: q.role } : {}),
      ...(q.status ? { disabledAt: q.status === 'disabled' ? { not: null } : null } : {}),
      ...(q.q ? { OR: [{ email: { contains: q.q, mode: 'insensitive' as const } }, { displayName: { contains: q.q, mode: 'insensitive' as const } }] } : {}),
    };
    const rows = await this.db.user.findMany({
      where, take: q.limit + 1, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      select: { id: true, email: true, displayName: true, role: true, disabledAt: true, createdAt: true, _count: { select: { vocabulary: true, decks: true, reviews: true } } },
    });
    const items = rows.slice(0, q.limit);
    return { items: items.map(({ _count, ...u }) => ({ ...u, vocabularyCount: _count.vocabulary, deckCount: _count.decks, reviewCount: _count.reviews })), nextCursor: rows.length > q.limit ? items[items.length - 1].id : null };
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
        data: { ...(data.role ? { role: data.role } : {}), ...(data.disabled !== undefined ? { disabledAt: data.disabled ? new Date() : null } : {}) },
        select: { id: true, email: true, displayName: true, role: true, disabledAt: true, createdAt: true },
      });
      if (data.disabled === true || (data.role && data.role !== target.role)) {
        await tx.authSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      await tx.auditLog.create({ data: { actorId, action: 'admin.user.update', resourceId: userId, metadata: json({ from: { role: target.role, disabled: !!target.disabledAt }, to: data }) } });
      return updated;
    });
  }

  async decks(actorId: string, query: unknown) {
    const q = deckQuery.parse(query);
    const where = {
      deletedAt: null,
      isPublic: q.status === 'public',
      ...(q.q ? { name: { contains: q.q, mode: 'insensitive' as const } } : {}),
    };
    const rows = await this.db.deck.findMany({
      where, take: q.limit + 1, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      include: { _count: { select: { items: true } }, user: { select: { id: true, email: true, displayName: true } } },
    });
    const items = rows.slice(0, q.limit);
    return {
      items: items.map(d => ({ id: d.id, name: d.name, description: d.description, topicGroup: d.topicGroup, isPublic: d.isPublic, forkCount: d.forkCount, itemCount: d._count.items, createdAt: d.createdAt, author: d.user })),
      nextCursor: rows.length > q.limit ? items[items.length - 1].id : null,
    };
  }

  async updateDeck(actorId: string, deckId: string, body: unknown) {
    const data = patchFields(deckPatch.parse(body), body);
    if (!Object.keys(data).length) fail(422, 'VALIDATION_ERROR', 'Không có thay đổi nào.');
    const deck = await this.db.deck.findFirst({ where: { id: deckId, deletedAt: null } });
    if (!deck) fail(404, 'NOT_FOUND', 'Không tìm thấy bộ từ vựng.');
    const updated = await this.db.deck.update({ where: { id: deckId }, data: { ...data, ...(data.name ? { normalizedName: normalized(data.name) } : {}) } });
    await this.audit(actorId, 'admin.deck.update', deckId, { from: { name: deck.name, isPublic: deck.isPublic, topicGroup: deck.topicGroup }, to: data });
    this.vocabulary.invalidatePublicCache();
    return { id: updated.id, name: updated.name, description: updated.description, topicGroup: updated.topicGroup, isPublic: updated.isPublic };
  }

  async removeDeck(actorId: string, deckId: string) {
    const deck = await this.db.deck.findFirst({ where: { id: deckId, deletedAt: null } });
    if (!deck) fail(404, 'NOT_FOUND', 'Không tìm thấy bộ từ vựng.');
    await this.db.deck.update({ where: { id: deckId }, data: { deletedAt: new Date(), isPublic: false } });
    await this.audit(actorId, 'admin.deck.delete', deckId, { name: deck.name, ownerId: deck.userId });
    this.vocabulary.invalidatePublicCache();
    return { ok: true };
  }

  async auditLogs(actorId: string, query: unknown) {
    const q = auditQuery.parse(query);
    const rows = await this.db.auditLog.findMany({
      where: { action: { not: 'auth.login_failed' }, ...(q.action ? { action: { startsWith: q.action } } : {}), ...(q.actorId ? { actorId: q.actorId } : {}) },
      take: q.limit + 1, orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });
    const items = rows.slice(0, q.limit);
    const actors = await this.db.user.findMany({ where: { id: { in: [...new Set(items.map(i => i.actorId).filter((v): v is string => !!v))] } }, select: { id: true, email: true, displayName: true } });
    const byId = new Map(actors.map(a => [a.id, a]));
    return { items: items.map(i => ({ ...i, actor: i.actorId ? byId.get(i.actorId) ?? null : null })), nextCursor: rows.length > q.limit ? items[items.length - 1].id : null };
  }
}

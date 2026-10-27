import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { DateTime } from 'luxon';
import { dictionaryProvider } from '../integrations/dictionary/contracts';
import { Database, json } from '../common/db';
import { fail, normalized } from '../common/http';
import { settingsDto } from '../common/serializers';
import { encryptEmail } from '../common/crypto';
import { config } from '../common/config';
import { hash, passwordHash, passwordMatches, secret } from './security';
import { LIBRARY_VERSION, MODEL_VERSION, parameters } from '../study/scheduler';

export const credentials = z.object({ email: z.string().trim().email().max(254).transform(normalized), password: z.string().min(12).max(128) }).strict();
export const settingsSchema = z.object({
  displayName: z.string().trim().min(1).max(100).optional(),
  timezone: z.string().refine(zone => DateTime.now().setZone(zone).isValid, 'Invalid IANA timezone').optional(),
  dictionaryProvider: dictionaryProvider.optional(), dictionaryFallbackEnabled: z.boolean().optional(),
  englishDialect: z.enum(['en-us', 'en-gb']).optional(), desiredRetention: z.number().min(0.85).max(0.95).optional(),
  newCardsPerDay: z.number().int().min(0).max(1000).optional(), dayStartHour: z.number().int().min(0).max(23).optional(),
  soundEnabled: z.boolean().optional(), autoPronounce: z.boolean().optional(), language: z.enum(['vi', 'en']).optional(), theme: z.enum(['light', 'dark', 'system']).optional(),
}).strict();
@Injectable()
export class IdentityService {
  constructor(@Inject(Database) private db: Database) {}
  async createSession(userId: string) {
    const token = secret(), csrf = secret();
    await this.db.authSession.create({ data: { userId, tokenHash: hash(token), csrfHash: hash(csrf), expiresAt: new Date(Date.now() + config.SESSION_DAYS * 86400000) } });
    return { token, csrf };
  }
  async register(body: unknown) {
    const data = credentials.extend({ displayName: z.string().trim().min(1).max(100) }).parse(body);
    const encrypted = await passwordHash(data.password);
    const user = await this.db.$transaction(async tx => {
      const user = await tx.user.create({ data: { email: data.email, displayName: data.displayName, passwordHash: encrypted, settings: { create: {} } } });
      await tx.schedulerConfig.create({ data: { userId: user.id, version: 1, retention: 0.9, modelVersion: MODEL_VERSION, libraryVersion: LIBRARY_VERSION, parameters: json(parameters(0.9)) } });
      await tx.deck.create({ data: { userId: user.id, name: 'Từ vựng của tôi', normalizedName: normalized('Từ vựng của tôi') } });
      return user;
    });
    return this.createSession(user.id);
  }
  async login(body: unknown) {
    const data = credentials.parse(body);
    const user = await this.db.user.findUnique({ where: { email: data.email } });
    // Run KDF for unknown users too, avoiding the fast account-enumeration path.
    const ok = await passwordMatches(data.password, user?.passwordHash ?? 'scrypt:00000000000000000000000000000000:' + '00'.repeat(64));
    if (!user || !ok) fail(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không chính xác.');
    return this.createSession(user.id);
  }
  async me(userId: string) {
    const user = await this.db.user.findUniqueOrThrow({ where: { id: userId }, include: { settings: true } });
    return { id: user.id, email: user.email, displayName: user.displayName, role: user.role, createdAt: user.createdAt, settings: settingsDto(user.settings!, user.displayName) };
  }
  async update(userId: string, body: unknown) {
    const { displayName, ...data } = settingsSchema.parse(body);
    await this.db.forUser(userId, async tx => {
      if (displayName) await tx.user.update({ where: { id: userId }, data: { displayName } });
      const previous = await tx.userSettings.findUniqueOrThrow({ where: { userId } });
      await tx.userSettings.update({ where: { userId }, data });
      if (data.desiredRetention !== undefined && data.desiredRetention !== previous.desiredRetention) {
        const latest = await tx.schedulerConfig.findFirstOrThrow({ where: { userId }, orderBy: { version: 'desc' } });
        await tx.schedulerConfig.create({ data: { userId, version: latest.version + 1, retention: data.desiredRetention, parameters: json(parameters(data.desiredRetention)), modelVersion: MODEL_VERSION, libraryVersion: LIBRARY_VERSION } });
      }
    });
    return (await this.me(userId)).settings;
  }
  async forgot(body: unknown) {
    const { email } = credentials.pick({ email: true }).parse(body);
    if (!config.EMAIL_ENCRYPTION_KEY || !config.SMTP_HOST) fail(503, 'EMAIL_NOT_CONFIGURED', 'Chưa cấu hình dịch vụ gửi email.');
    const user = await this.db.user.findUnique({ where: { email } });
    if (user) {
      const token = secret();
      await this.db.forUser(user.id, async tx => {
        await tx.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
        await tx.passwordResetToken.create({ data: { userId: user.id, tokenHash: hash(token), expiresAt: new Date(Date.now() + 30 * 60000) } });
        await tx.emailOutbox.create({ data: { userId: user.id, to: user.email, subject: 'Đặt lại mật khẩu Vocelune', text: encryptEmail(`Đặt lại mật khẩu trong 30 phút: ${config.APP_ORIGIN}/reset-password#token=${token}`) } });
      });
    }
    return { message: 'Nếu email tồn tại, hướng dẫn đặt lại mật khẩu sẽ được gửi.' };
  }
  async resetPassword(body: unknown) {
    const { token, password } = z.object({ token: z.string().min(32).max(128), password: credentials.shape.password }).strict().parse(body);
    const tokenRow = await this.db.passwordResetToken.findUnique({ where: { tokenHash: hash(token) } });
    if (!tokenRow) fail(422, 'INVALID_TOKEN', 'Liên kết không hợp lệ hoặc đã hết hạn.');
    const encrypted = await passwordHash(password);
    await this.db.forUser(tokenRow.userId, async tx => {
      const current = await tx.passwordResetToken.findUniqueOrThrow({ where: { id: tokenRow.id } });
      if (current.usedAt || current.expiresAt <= new Date()) fail(422, 'INVALID_TOKEN', 'Liên kết không hợp lệ hoặc đã hết hạn.');
      await tx.user.update({ where: { id: current.userId }, data: { passwordHash: encrypted } });
      await tx.passwordResetToken.updateMany({ where: { userId: current.userId, usedAt: null }, data: { usedAt: new Date() } });
      await tx.authSession.updateMany({ where: { userId: current.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.emailOutbox.updateMany({ where: { userId: current.userId, status: 'pending' }, data: { text: '', status: 'cancelled' } });
    });
    return { ok: true };
  }
  async deleteAccount(userId: string, body: unknown) {
    const { password, confirmation } = z.object({ password: z.string(), confirmation: z.literal('DELETE') }).strict().parse(body);
    const user = await this.db.user.findUniqueOrThrow({ where: { id: userId } });
    if (!await passwordMatches(password, user.passwordHash)) fail(403, 'INVALID_PASSWORD', 'Mật khẩu không chính xác.');
    await this.db.forUser(userId, async tx => {
      // Preserve media cleanup keys without keeping user content or identifying data.
      const assets = await tx.mediaAsset.findMany({ where: { userId } });
      for (const asset of assets) await tx.auditLog.create({ data: { action: 'media.cleanup', resourceId: asset.objectKey } });
      await tx.auditLog.deleteMany({ where: { actorId: userId } });
      await tx.providerUsage.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
      await tx.lexeme.deleteMany({ where: { vocabulary: { none: {} } } });
    });
    return { ok: true };
  }
}

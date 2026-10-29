import { Inject, Injectable } from '@nestjs/common';
import { Database } from '../../common/db';
import { fail } from '../../common/http';
import { DictionaryProviderId } from './contracts';

export function retryAfterMs(value: string | null, now = Date.now()): number {
  if (value && /^\d+(?:\.\d+)?$/.test(value.trim())) return Math.max(1000, Number(value) * 1000);
  const date = value ? Date.parse(value) : NaN;
  return Number.isFinite(date) ? Math.max(1000, date - now) : 60000;
}
export type QuotaLimits = { daily?: number; monthly?: number };

@Injectable()
export class DictionaryTransport {
  // Injectable boundary for contract tests: no real credentials/network required.
  fetcher: typeof fetch = (...args) => fetch(...args);
  constructor(@Inject(Database) private db: Database) {}

  async health(provider: DictionaryProviderId) {
    const record = await this.db.dictionaryProviderHealth.findUnique({ where: { provider } });
    const blocked = !!record?.blockedUntil && record.blockedUntil.getTime() > Date.now();
    return { state: blocked ? 'cooldown' as const : 'healthy' as const, retryAt: blocked ? record!.blockedUntil!.toISOString() : null, failures: record?.failures ?? 0 };
  }

  async markFailure(provider: DictionaryProviderId, reason: string, cooldown?: number) {
    await this.db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`dictionary:${provider}`}))`;
      const previous = await tx.dictionaryProviderHealth.findUnique({ where: { provider } });
      const failures = (previous?.failures ?? 0) + 1;
      const until = cooldown !== undefined ? Date.now() + cooldown : failures >= 3 ? Date.now() + 60000 : 0;
      const blockedUntil = new Date(Math.max(until, previous?.blockedUntil?.getTime() ?? 0));
      await tx.dictionaryProviderHealth.upsert({ where: { provider }, create: { provider, failures, reason, blockedUntil: until ? blockedUntil : null }, update: { failures, reason, ...(until ? { blockedUntil } : {}) } });
    });
  }

  private async markSuccess(provider: DictionaryProviderId, started: number) {
    // Preserve a concurrent request's Retry-After/auth cooldown.
    await this.db.dictionaryProviderHealth.updateMany({ where: { provider, OR: [{ blockedUntil: null }, { blockedUntil: { lte: new Date(started) } }] }, data: { failures: 0, blockedUntil: null, reason: null } });
  }

  async get(userId: string, provider: DictionaryProviderId, request: { url: URL; headers: Record<string, string> }, limits?: number | QuotaLimits, onRequest?: () => void) {
    const started = Date.now();
    const usage = await this.db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`dictionary:${provider}`}))`;
      const health = await tx.dictionaryProviderHealth.findUnique({ where: { provider } });
      if (health?.blockedUntil && health.blockedUntil.getTime() > Date.now()) fail(503, 'DICTIONARY_COOLDOWN', 'Nguồn đang tạm nghỉ sau lỗi hoặc giới hạn API. Vui lòng chọn nguồn khác.');
      const quotaLimits = typeof limits === 'number' ? { daily: limits } : limits;
      const now = new Date().toISOString();
      const periods = [{ day: now.slice(0, 10), limit: quotaLimits?.daily }, { day: now.slice(0, 7), limit: quotaLimits?.monthly }];
      for (const { day, limit } of periods) if (limit !== undefined) {
        const quota = await tx.dictionaryQuota.findUnique({ where: { provider_day: { provider, day } } });
        if ((quota?.used ?? 0) >= limit) fail(429, 'DICTIONARY_QUOTA_EXCEEDED', 'Nguồn từ điển đã đạt hạn mức dùng chung đã cấu hình. Bạn có thể chọn nguồn khác.');
        await tx.dictionaryQuota.upsert({ where: { provider_day: { provider, day } }, create: { provider, day, used: 1 }, update: { used: { increment: 1 } } });
      }
      // Reserve before sending so parallel users cannot exceed the shared quota.
      return tx.providerUsage.create({ data: { provider, userId, status: 0, latencyMs: 0 } });
    });
    let status = 0;
    try {
      let response: Response;
      try {
        onRequest?.();
        response = await this.fetcher(request.url, { headers: request.headers, redirect: 'error', signal: AbortSignal.timeout(8000) });
      } catch {
        // Credential-bearing URLs/provider error bodies never leave transport.
        await this.markFailure(provider, 'network');
        fail(503, 'DICTIONARY_UNAVAILABLE', 'Không thể kết nối nguồn từ điển. Bạn vẫn có thể nhập thủ công.');
      }
      status = response.status;
      if (status === 404) { await response.body?.cancel(); await this.markSuccess(provider, started); return null; }
      if (status === 401 || status === 403) {
        await response.body?.cancel(); await this.markFailure(provider, 'auth', 15 * 60000);
        fail(503, 'DICTIONARY_AUTH_FAILED', 'Nguồn từ điển chưa được cấp quyền. Vui lòng chọn nguồn khác.');
      }
      if (status === 429) {
        await response.body?.cancel(); await this.markFailure(provider, 'rate_limit', retryAfterMs(response.headers.get('retry-after')));
        fail(429, 'DICTIONARY_RATE_LIMITED', 'Nguồn từ điển tạm hết hạn mức. Vui lòng chọn nguồn khác hoặc thử lại sau.');
      }
      if (!response.ok) { await response.body?.cancel(); await this.markFailure(provider, 'upstream'); fail(503, 'DICTIONARY_UNAVAILABLE', 'Nguồn từ điển tạm thời không khả dụng.'); }
      const limit = 2 * 1024 * 1024;
      if (Number(response.headers.get('content-length')) > limit || !response.body) { await response.body?.cancel(); await this.markFailure(provider, 'contract', 60000); fail(502, 'PROVIDER_CONTRACT_CHANGED', 'Phản hồi từ điển vượt giới hạn.'); }
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = []; let length = 0;
      try {
        while (true) {
          const part = await reader.read(); if (part.done) break;
          length += part.value.length;
          if (length > limit) { await reader.cancel(); fail(502, 'PROVIDER_CONTRACT_CHANGED', 'Phản hồi từ điển vượt giới hạn.'); }
          chunks.push(part.value);
        }
      } catch (error) {
        if (error && typeof error === 'object' && 'getStatus' in error) { await this.markFailure(provider, 'contract', 60000); throw error; }
        await this.markFailure(provider, 'network'); fail(503, 'DICTIONARY_UNAVAILABLE', 'Không thể đọc phản hồi từ điển.');
      } finally { reader.releaseLock(); }
      let payload: unknown;
      try { payload = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch {
        await this.markFailure(provider, 'contract', 60000);
        fail(502, 'PROVIDER_CONTRACT_CHANGED', 'Nguồn từ điển trả dữ liệu không hợp lệ.');
      }
      await this.markSuccess(provider, started);
      return payload;
    } finally {
      await this.db.providerUsage.update({ where: { id: usage.id }, data: { status, latencyMs: Date.now() - started } });
    }
  }
}

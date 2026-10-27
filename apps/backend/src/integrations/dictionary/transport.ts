import { Inject, Injectable } from '@nestjs/common';
import { Database } from '../../common/db';
import { fail } from '../../common/http';
import { DictionaryProviderId } from './contracts';

@Injectable()
export class DictionaryTransport {
  // Injectable boundary for contract tests: no real credentials/network required.
  fetcher: typeof fetch = (...args) => fetch(...args);
  constructor(@Inject(Database) private db: Database) {}

  async get(userId: string, provider: DictionaryProviderId, request: { url: URL; headers: Record<string, string> }, dailyLimit?: number) {
    const started = Date.now();
    const usage = await this.db.$transaction(async tx => {
      if (dailyLimit !== undefined) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`dictionary:${provider}`}))`;
        const day = new Date().toISOString().slice(0, 10);
        const quota = await tx.dictionaryQuota.findUnique({ where: { provider_day: { provider, day } } });
        if ((quota?.used ?? 0) >= dailyLimit) fail(429, 'DICTIONARY_QUOTA_EXCEEDED', 'Nguồn từ điển đã đạt hạn mức dùng chung hôm nay. Bạn có thể chọn nguồn miễn phí.');
        await tx.dictionaryQuota.upsert({ where: { provider_day: { provider, day } }, create: { provider, day, used: 1 }, update: { used: { increment: 1 } } });
      }
      // Reserve before sending so parallel users cannot exceed the shared quota.
      return tx.providerUsage.create({ data: { provider, userId, status: 0, latencyMs: 0 } });
    });
    let status = 0;
    try {
      const response = await this.fetcher(request.url, { headers: request.headers, redirect: 'error', signal: AbortSignal.timeout(8000) });
      status = response.status;
      if (status === 404) return null;
      if (status === 401 || status === 403) fail(503, 'DICTIONARY_AUTH_FAILED', 'Nguồn từ điển chưa được cấp quyền. Vui lòng chọn nguồn khác.');
      if (status === 429) fail(429, 'DICTIONARY_RATE_LIMITED', 'Nguồn từ điển tạm hết hạn mức. Vui lòng chọn nguồn khác hoặc thử lại sau.');
      if (!response.ok) fail(503, 'DICTIONARY_UNAVAILABLE', 'Nguồn từ điển tạm thời không khả dụng.');
      const limit = 2 * 1024 * 1024;
      if (Number(response.headers.get('content-length')) > limit || !response.body) fail(502, 'PROVIDER_CONTRACT_CHANGED', 'Phản hồi từ điển vượt giới hạn.');
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = []; let length = 0;
      try {
        while (true) {
          const part = await reader.read(); if (part.done) break;
          length += part.value.length;
          if (length > limit) { await reader.cancel(); fail(502, 'PROVIDER_CONTRACT_CHANGED', 'Phản hồi từ điển vượt giới hạn.'); }
          chunks.push(part.value);
        }
      } finally { reader.releaseLock(); }
      try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown; }
      catch { fail(502, 'PROVIDER_CONTRACT_CHANGED', 'Nguồn từ điển trả dữ liệu không hợp lệ.'); }
    } catch (error) {
      // Never propagate provider error bodies/URLs: MW includes a credential in its query string.
      if (error && typeof error === 'object' && 'getStatus' in error) throw error;
      fail(503, 'DICTIONARY_UNAVAILABLE', 'Không thể kết nối nguồn từ điển. Bạn vẫn có thể nhập thủ công.');
    } finally {
      await this.db.providerUsage.update({ where: { id: usage.id }, data: { status, latencyMs: Date.now() - started } });
    }
  }
}

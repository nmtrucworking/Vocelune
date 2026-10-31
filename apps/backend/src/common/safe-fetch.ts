import { request } from 'node:https';
import { lookup } from 'node:dns';
import { isIP } from 'node:net';
import { fail } from './http';

/** True for loopback, private, link-local, CGNAT, multicast, reserved and mapped-private addresses. */
export function isPrivateAddress(address: string): boolean {
  const mapped = address.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) address = mapped[1];
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0)) || (a === 198 && (b === 18 || b === 19));
  }
  const v6 = address.toLowerCase();
  return v6 === '::' || v6 === '::1' || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6) || v6.startsWith('ff') || v6.startsWith('2001:db8');
}

// DNS lookup that refuses internal targets; the validated address is the one actually connected to (no rebinding gap).
const guardedLookup = ((hostname: string, options: unknown, callback: (...args: any[]) => void) => {
  lookup(hostname, { all: true, verbatim: true }, (err, addresses) => {
    if (err) return callback(err);
    const list = addresses as { address: string; family: number }[];
    if (!list.length || list.some(a => isPrivateAddress(a.address))) return callback(new Error('BLOCKED_ADDRESS'));
    const wantsAll = typeof options === 'object' && options !== null && (options as { all?: boolean }).all;
    return wantsAll ? callback(null, list) : callback(null, list[0].address, list[0].family);
  });
}) as typeof lookup;

export interface SafeFetchResult { buffer: Buffer; contentType: string }

/** GET an https URL with SSRF protection, manual redirect re-validation, timeout and a hard body-size cap. */
export async function safeFetch(rawUrl: string, opts: { maxBytes: number; timeoutMs?: number; maxRedirects?: number; headers?: Record<string, string> }): Promise<SafeFetchResult> {
  let url: URL;
  try { url = new URL(rawUrl); } catch { fail(400, 'INVALID_URL', 'URL không hợp lệ.'); }
  for (let hop = 0; hop <= (opts.maxRedirects ?? 3); hop++) {
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) fail(400, 'INVALID_URL', 'Chỉ cho phép URL https hợp lệ.');
    if (isIP(url.hostname.replace(/^\[|\]$/g, '')) && isPrivateAddress(url.hostname.replace(/^\[|\]$/g, ''))) fail(400, 'INVALID_URL', 'URL không được phép.');
    const result = await new Promise<{ redirect?: string; buffer?: Buffer; contentType?: string }>((resolve, reject) => {
      const req = request(url, { method: 'GET', lookup: guardedLookup, headers: opts.headers, timeout: opts.timeoutMs ?? 8000 }, res => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) { res.resume(); return resolve({ redirect: res.headers.location }); }
        if (status !== 200) { res.resume(); return reject(new Error('BAD_STATUS')); }
        const chunks: Buffer[] = []; let size = 0;
        res.on('data', (c: Buffer) => { size += c.length; if (size > opts.maxBytes) { req.destroy(new Error('TOO_LARGE')); return; } chunks.push(c); });
        res.on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType: String(res.headers['content-type'] ?? '') }));
        res.on('error', reject);
      });
      req.on('timeout', () => req.destroy(new Error('TIMEOUT')));
      req.on('error', reject);
      req.end();
    }).catch((e: Error) => {
      if (e.message === 'TOO_LARGE') fail(422, 'FILE_TOO_LARGE', 'Ảnh vượt quá kích thước cho phép.');
      fail(400, 'FETCH_FAILED', 'Không thể tải ảnh từ liên kết.');
    });
    if (result.buffer) return { buffer: result.buffer, contentType: result.contentType ?? '' };
    try { url = new URL(result.redirect!, url); } catch { fail(400, 'INVALID_URL', 'URL không hợp lệ.'); }
  }
  fail(400, 'FETCH_FAILED', 'Quá nhiều lần chuyển hướng.');
}

/** Detect the real image type from magic bytes; never trust the remote Content-Type. */
export function sniffImageMime(b: Buffer): 'image/png' | 'image/jpeg' | 'image/webp' | null {
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255) return 'image/jpeg';
  if (b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

import { CanActivate, ExecutionContext, Inject, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { Database } from '../common/db';
import { AuthRequest, fail } from '../common/http';
import { config, getAllowedOrigins } from '../common/config';

export const Public = () => SetMetadata('public', true);
export const secret = () => randomBytes(32).toString('base64url');
export const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const derive = promisify(scrypt);
export async function passwordHash(password: string) {
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt, 64) as Buffer;
  return `scrypt:${salt}:${key.toString('hex')}`;
}
export async function passwordMatches(password: string, stored: string) {
  const [, salt, hex] = stored.split(':');
  if (!salt || !hex) return false;
  const actual = await derive(password, salt, 64) as Buffer;
  const expected = Buffer.from(hex, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export const COOKIE = config.NODE_ENV === 'production'
  ? (config.COOKIE_DOMAIN ? '__Secure-vocelune_session' : '__Host-vocelune_session')
  : 'vocelune_session';
export const CSRF_COOKIE = config.NODE_ENV === 'production'
  ? (config.COOKIE_DOMAIN ? '__Secure-vocelune_csrf' : '__Host-vocelune_csrf')
  : 'vocelune_csrf';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(Database) private db: Database, @Inject(Reflector) private reflector: Reflector) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const publicRoute = this.reflector.getAllAndOverride<boolean>('public', [context.getHandler(), context.getClass()]);
    const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    if (mutating && req.headers.origin && !getAllowedOrigins().includes(req.headers.origin)) {
      fail(403, 'ORIGIN_DENIED', 'Nguồn yêu cầu không được phép.');
    }
    if (publicRoute || req.method === 'OPTIONS') return true;
    const token = req.cookies?.[COOKIE] || req.cookies?.['__Secure-vocelune_session'] || req.cookies?.['__Host-vocelune_session'] || req.cookies?.['vocelune_session'];
    if (typeof token !== 'string') fail(401, 'UNAUTHENTICATED', 'Vui lòng đăng nhập.');
    const session = await this.db.authSession.findUnique({ where: { tokenHash: hash(token) }, include: { user: true } });
    if (!session || session.revokedAt || session.expiresAt <= new Date()) fail(401, 'UNAUTHENTICATED', 'Phiên đăng nhập đã hết hạn.');
    if (mutating) {
      const csrf = req.headers['x-csrf-token'];
      if (typeof csrf !== 'string' || hash(csrf) !== session.csrfHash) fail(403, 'CSRF_INVALID', 'Mã bảo vệ phiên không hợp lệ.');
    }
    req.auth = { userId: session.userId, sessionId: session.id, role: session.user.role };
    return true;
  }
}

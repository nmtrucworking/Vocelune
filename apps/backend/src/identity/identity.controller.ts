import { Body, Controller, Delete, Get, Inject, Patch, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { Database } from '../common/db';
import { AuthRequest } from '../common/http';
import { config } from '../common/config';
import { IdentityService } from './identity.service';
import { COOKIE, CSRF_COOKIE, Public } from './security';

@ApiTags('Identity')
@Controller()
export class IdentityController {
  constructor(@Inject(IdentityService) private identity: IdentityService, @Inject(Database) private db: Database) {}
  private cookies(res: Response, session: { token: string; csrf: string }) {
    const options = { secure: config.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: config.SESSION_DAYS * 86400000 };
    res.cookie(COOKIE, session.token, { ...options, httpOnly: true });
    res.cookie(CSRF_COOKIE, session.csrf, { ...options, httpOnly: false });
    return { ok: true, csrfToken: session.csrf };
  }
  @Public() @Throttle({ default: { limit: 8, ttl: 60000 } }) @Post('auth/register')
  async register(@Body() body: unknown, @Res({ passthrough: true }) res: Response) { return this.cookies(res, await this.identity.register(body)); }
  @Public() @Throttle({ default: { limit: 10, ttl: 60000 } }) @Post('auth/login')
  async login(@Body() body: unknown, @Res({ passthrough: true }) res: Response) { return this.cookies(res, await this.identity.login(body)); }
  @Post('auth/logout')
  async logout(@Req() req: AuthRequest, @Res({ passthrough: true }) res: Response) {
    await this.db.authSession.update({ where: { id: req.auth.sessionId }, data: { revokedAt: new Date() } });
    res.clearCookie(COOKIE, { path: '/' }); res.clearCookie(CSRF_COOKIE, { path: '/' }); return { ok: true };
  }
  @Public() @Throttle({ default: { limit: 5, ttl: 60000 } }) @Post('auth/password/forgot')
  forgot(@Body() body: unknown) { return this.identity.forgot(body); }
  @Public() @Throttle({ default: { limit: 5, ttl: 60000 } }) @Post('auth/password/reset')
  reset(@Body() body: unknown) { return this.identity.resetPassword(body); }
  @Get('me') me(@Req() req: AuthRequest) { return this.identity.me(req.auth.userId); }
  @Get('me/settings') async settings(@Req() req: AuthRequest) { return (await this.identity.me(req.auth.userId)).settings; }
  @Patch(['me', 'me/settings'])
  update(@Req() req: AuthRequest, @Body() body: unknown) { return this.identity.update(req.auth.userId, body); }
  @Delete('me') async remove(@Req() req: AuthRequest, @Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const result = await this.identity.deleteAccount(req.auth.userId, body);
    res.clearCookie(COOKIE, { path: '/' }); res.clearCookie(CSRF_COOKIE, { path: '/' }); return result;
  }
}

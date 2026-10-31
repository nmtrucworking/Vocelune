import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthRequest, fail, id } from '../common/http';
import { AdminService } from './admin.service';

function admin(r: AuthRequest) {
  if (r.auth.role !== 'admin') fail(403, 'FORBIDDEN', 'Chỉ quản trị viên được phép truy cập.');
  return r.auth.userId;
}

@ApiTags('Admin')
@Controller('admin')
export class AdminController {
  constructor(@Inject(AdminService) private service: AdminService) {}

  @Get('stats')
  stats(@Req() r: AuthRequest) {
    return this.service.stats(admin(r));
  }

  @Get('users')
  users(@Req() r: AuthRequest, @Query() q: unknown) {
    return this.service.users(admin(r), q);
  }

  @Patch('users/:id')
  updateUser(@Req() r: AuthRequest, @Param('id') v: string, @Body() b: unknown) {
    return this.service.updateUser(admin(r), id(v), b);
  }

  @Post('users/:id/revoke-sessions')
  revokeUserSessions(@Req() r: AuthRequest, @Param('id') v: string) {
    return this.service.revokeUserSessions(admin(r), id(v));
  }

  @Get('decks')
  decks(@Req() r: AuthRequest, @Query() q: unknown) {
    return this.service.decks(admin(r), q);
  }

  @Patch('decks/:id')
  updateDeck(@Req() r: AuthRequest, @Param('id') v: string, @Body() b: unknown) {
    return this.service.updateDeck(admin(r), id(v), b);
  }

  @Delete('decks/:id')
  removeDeck(@Req() r: AuthRequest, @Param('id') v: string) {
    return this.service.removeDeck(admin(r), id(v));
  }

  @Post('decks/seed-official')
  seedOfficialDecks(@Req() r: AuthRequest) {
    return this.service.seedOfficialDecks(admin(r));
  }

  @Get('dictionary/overview')
  dictionaryOverview(@Req() r: AuthRequest) {
    return this.service.dictionaryOverview(admin(r));
  }

  @Post('dictionary/providers/:provider/reset-health')
  resetProviderHealth(@Req() r: AuthRequest, @Param('provider') provider: string) {
    return this.service.resetProviderHealth(admin(r), provider);
  }

  @Post('dictionary/providers/:provider/reset-quota')
  resetProviderQuota(@Req() r: AuthRequest, @Param('provider') provider: string) {
    return this.service.resetProviderQuota(admin(r), provider);
  }

  @Post('dictionary/cache/clear')
  clearDictionaryCache(@Req() r: AuthRequest) {
    return this.service.clearDictionaryCache(admin(r));
  }

  @Post('dictionary/probe')
  probeDictionary(@Req() r: AuthRequest, @Body() b: unknown) {
    return this.service.probeDictionary(admin(r), b);
  }

  @Get('dictionary/entries')
  dictionaryEntries(@Req() r: AuthRequest, @Query() q: unknown) {
    return this.service.dictionaryEntries(admin(r), q);
  }

  @Post('dictionary/entries')
  upsertDictionaryEntry(@Req() r: AuthRequest, @Body() b: unknown) {
    return this.service.upsertDictionaryEntry(admin(r), b);
  }

  @Delete('dictionary/entries/:id')
  deleteDictionaryEntry(@Req() r: AuthRequest, @Param('id') v: string) {
    return this.service.deleteDictionaryEntry(admin(r), id(v));
  }

  @Get('operations/overview')
  operationsOverview(@Req() r: AuthRequest) {
    return this.service.operationsOverview(admin(r));
  }

  @Post('operations/retry-emails')
  retryFailedEmails(@Req() r: AuthRequest) {
    return this.service.retryFailedEmails(admin(r));
  }

  @Get('audit-logs')
  audit(@Req() r: AuthRequest, @Query() q: unknown) {
    return this.service.auditLogs(admin(r), q);
  }
}

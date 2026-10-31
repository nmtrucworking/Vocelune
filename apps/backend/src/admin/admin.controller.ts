import { Body, Controller, Delete, Get, Inject, Param, Patch, Query, Req } from '@nestjs/common';
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
  @Get('stats') stats(@Req() r: AuthRequest) { return this.service.stats(admin(r)); }
  @Get('users') users(@Req() r: AuthRequest, @Query() q: unknown) { return this.service.users(admin(r), q); }
  @Patch('users/:id') updateUser(@Req() r: AuthRequest, @Param('id') v: string, @Body() b: unknown) { return this.service.updateUser(admin(r), id(v), b); }
  @Get('decks') decks(@Req() r: AuthRequest, @Query() q: unknown) { return this.service.decks(admin(r), q); }
  @Patch('decks/:id') updateDeck(@Req() r: AuthRequest, @Param('id') v: string, @Body() b: unknown) { return this.service.updateDeck(admin(r), id(v), b); }
  @Delete('decks/:id') removeDeck(@Req() r: AuthRequest, @Param('id') v: string) { return this.service.removeDeck(admin(r), id(v)); }
  @Get('audit-logs') audit(@Req() r: AuthRequest, @Query() q: unknown) { return this.service.auditLogs(admin(r), q); }
}

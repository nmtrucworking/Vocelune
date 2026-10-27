import { Body, Controller, Get, Inject, Param, Post, Put, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthRequest, id } from '../common/http';
import { TestsService } from './tests.service';
@ApiTags('Tests')
@Controller()
export class TestsController {
  constructor(@Inject(TestsService) private tests: TestsService) {}
  @Post('tests/preview') preview(@Req() r: AuthRequest, @Body() b: unknown) { return this.tests.preview(r.auth.userId, b); }
  @Post('tests') create(@Req() r: AuthRequest, @Body() b: unknown) { return this.tests.create(r.auth.userId, b); }
  @Post('tests/:id/attempts') start(@Req() r: AuthRequest, @Param('id') t: string) { return this.tests.start(r.auth.userId, id(t)); }
  @Put('test-attempts/:id/answers/:questionId') answer(@Req() r: AuthRequest, @Param('id') a: string, @Param('questionId') q: string, @Body() b: unknown) { return this.tests.answer(r.auth.userId, id(a), id(q), b); }
  @Post('test-attempts/:id/submit') submit(@Req() r: AuthRequest, @Param('id') a: string, @Body() b: unknown) { return this.tests.submit(r.auth.userId, id(a), b); }
  @Get('test-attempts/:id/report') report(@Req() r: AuthRequest, @Param('id') a: string) { return this.tests.report(r.auth.userId, id(a)); }
  @Get('test-attempts') history(@Req() r: AuthRequest, @Query() q: unknown) { return this.tests.history(r.auth.userId, q); }
  @Post('test-attempts/:id/apply-srs') apply(@Req() r: AuthRequest, @Param('id') a: string, @Body() b: unknown) { return this.tests.applyToSrs(r.auth.userId, id(a), b); }
}

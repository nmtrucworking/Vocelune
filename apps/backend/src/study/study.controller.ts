import { Body, Controller, Get, Headers, Inject, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthRequest, id, requestKey, uuid } from '../common/http';
import { z } from 'zod';
import { StudyService } from './study.service';
import { SentenceCheckerService } from './sentence-checker.service';

@ApiTags('Study & scheduler')
@Controller()
export class StudyController {
  constructor(
    @Inject(StudyService) private study: StudyService,
    @Inject(SentenceCheckerService) private sentenceChecker: SentenceCheckerService
  ) {}
  @Get('study/queue') queue(@Req() r: AuthRequest) { return this.study.queue(r.auth.userId); }
  @Post('study/sessions') start(@Req() r: AuthRequest, @Body() b: unknown) { return this.study.start(r.auth.userId, b); }
  @Post('study/sessions/:id/reveal') reveal(@Req() r: AuthRequest, @Param('id') s: string, @Body() b: unknown) { return this.study.reveal(r.auth.userId, id(s), z.object({ cardId: uuid }).strict().parse(b).cardId); }
  @Post('cards/:id/reviews') grade(@Req() r: AuthRequest, @Param('id') c: string, @Headers('idempotency-key') key: string, @Body() b: unknown) { return this.study.grade(r.auth.userId, id(c), requestKey(key), b); }
  @Post('reviews/:id/undo') undo(@Req() r: AuthRequest, @Param('id') v: string) { return this.study.undo(r.auth.userId, id(v)); }
  @Patch('cards/:id') card(@Req() r: AuthRequest, @Param('id') c: string, @Body() b: unknown) { return this.study.patchCard(r.auth.userId, id(c), b); }
  @Post('practice/sessions') practice(@Req() r: AuthRequest, @Body() b: unknown) { return this.study.start(r.auth.userId, b, 'practice'); }
  @Post('practice/sessions/:id/answers') answer(@Req() r: AuthRequest, @Param('id') s: string, @Body() b: unknown) { return this.study.practiceAnswer(r.auth.userId, id(s), b); }
  @Post('study/sentence-check')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  sentenceCheck(@Req() r: AuthRequest, @Body() b: unknown) {
    return this.sentenceChecker.evaluate(r.auth.userId, b);
  }
}

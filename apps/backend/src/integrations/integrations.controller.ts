import { Body, Controller, Get, Inject, Param, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthRequest, id } from '../common/http';
import { DictionaryService } from './dictionary.service';
import { MediaService } from './media.service';
@ApiTags('Dictionary & media')
@Controller()
export class IntegrationsController {
  constructor(@Inject(DictionaryService) private dictionary: DictionaryService, @Inject(MediaService) private media: MediaService) {}
  @Get('dictionary/providers/status') status() { return this.dictionary.status(); }
  @Post('dictionary/lookup') @Throttle({ default: { limit: 20, ttl: 60000 } }) lookup(@Req() r: AuthRequest, @Body() b: unknown) { return this.dictionary.lookup(r.auth.userId, b); }
  @Post('dictionary/vocabulary') @Throttle({ default: { limit: 20, ttl: 60000 } }) save(@Req() r: AuthRequest, @Body() b: unknown) { return this.dictionary.saveLicensed(r.auth.userId, b); }
  @Post('media/upload-intents') intent(@Req() r: AuthRequest, @Body() b: unknown) { return this.media.intent(r.auth.userId, b); }
  @Post('media/:id/complete') complete(@Req() r: AuthRequest, @Param('id') a: string) { return this.media.complete(r.auth.userId, id(a)); }
  @Get('media/:id/access') access(@Req() r: AuthRequest, @Param('id') a: string) { return this.media.access(r.auth.userId, id(a)); }
  @Post('media/:id/attach') attach(@Req() r: AuthRequest, @Param('id') a: string, @Body() b: unknown) { return this.media.attach(r.auth.userId, id(a), b); }
}

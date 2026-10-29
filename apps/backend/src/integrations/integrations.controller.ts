import { Body, Controller, Get, Inject, Param, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { AuthRequest, fail, id } from '../common/http';
import { DictionaryService } from './dictionary.service';
import { MediaService } from './media.service';
@ApiTags('Dictionary & media')
@Controller()
export class IntegrationsController {
  constructor(@Inject(DictionaryService) private dictionary: DictionaryService, @Inject(MediaService) private media: MediaService) {}
  @Get('dictionary/providers/status') status(@Req() r: AuthRequest) { return this.dictionary.status(r.auth.userId); }
  @Post('dictionary/lookup') @Throttle({ default: { limit: 20, ttl: 60000 } }) lookup(@Req() r: AuthRequest, @Body() b: unknown) { return this.dictionary.lookup(r.auth.userId, b); }
  @Post('dictionary/convert-ipa') @Throttle({ default: { limit: 60, ttl: 60000 } }) convertIpa(@Req() r: AuthRequest, @Body() b: unknown) { return this.dictionary.convertIpa(r.auth.userId, b); }
  @Post('dictionary/translate') @Throttle({ default: { limit: 60, ttl: 60000 } }) translate(@Req() r: AuthRequest, @Body() b: unknown) { return this.dictionary.translate(r.auth.userId, b); }
  @Post('dictionary/vocabulary') @Throttle({ default: { limit: 20, ttl: 60000 } }) save(@Req() r: AuthRequest, @Body() b: unknown) { return this.dictionary.saveLicensed(r.auth.userId, b); }
  @Post('media/upload-intents') intent(@Req() r: AuthRequest, @Body() b: unknown) { return this.media.intent(r.auth.userId, b); }
  @Post('media/:id/complete') complete(@Req() r: AuthRequest, @Param('id') a: string) { return this.media.complete(r.auth.userId, id(a)); }
  @Get('media/:id/access') access(@Req() r: AuthRequest, @Param('id') a: string) { return this.media.access(r.auth.userId, id(a)); }
  @Get('media/:id/content') content(@Req() r: AuthRequest, @Param('id') a: string, @Res() res: Response) { return this.media.streamAsset(r.auth.userId, id(a), res, r.headers?.['if-none-match']); }
  @Post('media/:id/attach') attach(@Req() r: AuthRequest, @Param('id') a: string, @Body() b: unknown) { return this.media.attach(r.auth.userId, id(a), b); }
  @Post('media/:id/detach') detach(@Req() r: AuthRequest, @Param('id') a: string, @Body() b: { vocabId: string }) { return this.media.detach(r.auth.userId, id(a), id(b.vocabId)); }
  @Post('media/:id/upload-direct') uploadDirect(@Req() r: AuthRequest, @Param('id') a: string, @Body() b: { dataUrl: string }) {
    if (!b?.dataUrl || typeof b.dataUrl !== 'string') fail(422, 'DATA_URL_REQUIRED', 'Thiếu dữ liệu ảnh.');
    return this.media.uploadDirect(r.auth.userId, id(a), b.dataUrl);
  }
}

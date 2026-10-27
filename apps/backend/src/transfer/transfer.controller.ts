import { Body, Controller, Get, Headers, Inject, Param, Post, Query, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest, fail, id, requestKey, uuid } from '../common/http';
import { TransferService } from './transfer.service';
@ApiTags('Import & export')
@Controller()
export class TransferController {
  constructor(@Inject(TransferService) private transfer: TransferService) {}
  @Get('imports/template') async template(@Query('format') format = 'csv', @Res() res: Response) { const file = await this.transfer.template(format); res.type(file.mime).attachment(`vocelune-template.${file.ext}`).send(file.buffer); }
  @Get('imports') history(@Req() r: AuthRequest) { return this.transfer.history(r.auth.userId); }
  @Get('imports/:id/errors.csv') async errors(@Req() r: AuthRequest, @Param('id') j: string, @Res() res: Response) { res.type('text/csv; charset=utf-8').attachment('vocelune-import-errors.csv').send(await this.transfer.errors(r.auth.userId, id(j))); }
  @Post('imports') create(@Req() r: AuthRequest, @Headers('idempotency-key') key: string, @Body() b: unknown) { return this.transfer.preview(r.auth.userId, requestKey(key), b); }
  @Post('imports/upload') @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 3, fieldSize: 16384 } }))
  async upload(@Req() r: AuthRequest, @Headers('idempotency-key') key: string, @UploadedFile() file: { originalname: string; buffer: Buffer }, @Body() b: Record<string, string>) {
    if (!file) fail(422, 'FILE_REQUIRED', 'Cần chọn tệp.');
    const deckId = uuid.parse(b.deckId);
    let mapping: Record<string, string> = {};
    if (b.mapping) { try { mapping = z.record(z.string().max(100), z.string().max(100)).parse(JSON.parse(b.mapping)); } catch { fail(422, 'INVALID_MAPPING', 'Ánh xạ cột không hợp lệ.'); } }
    return this.transfer.preview(r.auth.userId, requestKey(key), { deckId, rows: await this.transfer.parseFile(file, mapping), policy: b.policy || 'skip' });
  }
  @Post('imports/:id/preview') preview(@Req() r: AuthRequest, @Param('id') j: string) { return this.transfer.get(r.auth.userId, id(j)); }
  @Get('imports/:id') get(@Req() r: AuthRequest, @Param('id') j: string) { return this.transfer.get(r.auth.userId, id(j)); }
  @Post('imports/:id/commit') commit(@Req() r: AuthRequest, @Param('id') j: string) { return this.transfer.commit(r.auth.userId, id(j)); }
  @Post('exports') async export(@Req() r: AuthRequest, @Body() b: unknown, @Res() res: Response) {
    const { format } = z.object({ format: z.enum(['csv', 'xlsx', 'json']).default('json') }).strict().parse(b);
    const file = await this.transfer.export(r.auth.userId, format);
    res.type(file.mime).attachment(`vocelune-export.${file.ext}`).send(file.buffer);
  }
}

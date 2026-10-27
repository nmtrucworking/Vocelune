import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { z, ZodError } from 'zod';
import { randomUUID } from 'node:crypto';

export function fail(status: number, code: string, message: string, details?: unknown): never {
  throw new HttpException({ code, message, details }, status);
}
export const uuid = z.string().uuid();
export const id = (value: string) => uuid.parse(value);
export const normalized = (value: string) => value.normalize('NFC').trim().toLocaleLowerCase('en-US');
export const requestKey = (value?: string) => z.string().min(8).max(128).parse(value);
export function patchFields<T extends object>(parsed: T, body: unknown): T { return Object.fromEntries(Object.entries(parsed).filter(([key]) => Object.hasOwn(body as object, key))) as T; }
export const pagination = z.object({ cursor: uuid.optional(), limit: z.coerce.number().int().min(1).max(200).default(50) });
export type AuthRequest = Request & { auth: { userId: string; sessionId: string; role: string }; requestId: string };

@Catch()
export class ErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const req = host.switchToHttp().getRequest<AuthRequest>();
    const res = host.switchToHttp().getResponse<Response>();
    let status = 500;
    let body: Record<string, unknown> = { code: 'INTERNAL_ERROR', message: 'Không thể xử lý yêu cầu.' };
    if (error instanceof ZodError) {
      status = 422; body = { code: 'VALIDATION_ERROR', message: 'Dữ liệu không hợp lệ.', details: error.flatten() };
    } else if (error instanceof HttpException) {
      status = error.getStatus();
      const response = error.getResponse();
      body = typeof response === 'object' ? { ...response } : { message: response };
      body.code ??= status === 429 ? 'RATE_LIMITED' : 'REQUEST_ERROR';
    } else if (error && typeof error === 'object' && 'type' in error && ['entity.parse.failed', 'entity.too.large'].includes(String(error.type))) {
      status = error.type === 'entity.too.large' ? 413 : 400;
      body = { code: status === 413 ? 'PAYLOAD_TOO_LARGE' : 'INVALID_JSON', message: status === 413 ? 'Yêu cầu vượt giới hạn kích thước.' : 'JSON không hợp lệ.' };
    } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') { status = 409; body = { code: 'DUPLICATE', message: 'Dữ liệu đã tồn tại.' }; }
      if (error.code === 'P2025') { status = 404; body = { code: 'NOT_FOUND', message: 'Không tìm thấy dữ liệu.' }; }
      if (error.code === 'P2003') { status = 422; body = { code: 'INVALID_REFERENCE', message: 'Liên kết dữ liệu không hợp lệ.' }; }
    }
    // Never log request bodies, cookies, credentials, dictionary content or reset tokens.
    if (status === 500) process.stderr.write(JSON.stringify({ level: 'error', requestId: req.requestId, errorType: error instanceof Error ? error.name : 'unknown' }) + '\n');
    res.status(status).json({ error: { ...body, requestId: req.requestId || randomUUID() } });
  }
}

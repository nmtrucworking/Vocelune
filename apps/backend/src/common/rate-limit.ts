import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthRequest } from './http';
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: AuthRequest) { return req.auth?.userId ?? req.ip ?? 'unknown'; }
}

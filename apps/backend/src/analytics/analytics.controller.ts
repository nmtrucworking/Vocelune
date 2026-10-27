import { Controller, Get, Inject, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthRequest } from '../common/http';
import { AnalyticsService } from './analytics.service';
@ApiTags('Analytics')
@Controller()
export class AnalyticsController {
  constructor(@Inject(AnalyticsService) private analytics: AnalyticsService) {}
  @Get('bootstrap') bootstrap(@Req() r: AuthRequest) { return this.analytics.bootstrap(r.auth.userId); }
  @Get('analytics/overview') overview(@Req() r: AuthRequest) { return this.analytics.overview(r.auth.userId); }
  @Get('analytics/reviews') reviews(@Req() r: AuthRequest) { return this.analytics.reviews(r.auth.userId); }
  @Get('analytics/tests') tests(@Req() r: AuthRequest) { return this.analytics.testAnalytics(r.auth.userId); }
  @Get('admin/health/operations') operations(@Req() r: AuthRequest) { return this.analytics.operations(r.auth.userId, r.auth.role); }
}

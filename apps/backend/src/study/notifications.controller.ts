import { Controller, Get, Inject, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthRequest } from '../common/http';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(@Inject(NotificationsService) private notifications: NotificationsService) {}

  @Get('schedule')
  async getSchedule(@Req() r: AuthRequest) {
    return {
      morningReminderTime: '06:00',
      eveningSummaryTime: '23:59',
      activeChannels: ['email'],
      description: 'Nhắc nhở học tập lúc 06:00 AM và Tổng kết kiến thức lúc 11:59 PM mỗi ngày qua email.',
    };
  }

  @Post('test-reminder')
  async triggerTestReminder(@Req() r: AuthRequest) {
    return this.notifications.triggerTestReminder(r.auth.userId);
  }

  @Post('test-summary')
  async triggerTestSummary(@Req() r: AuthRequest) {
    return this.notifications.triggerTestSummary(r.auth.userId);
  }
}

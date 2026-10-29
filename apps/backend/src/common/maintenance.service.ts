import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { Database } from './db';
import { config } from './config';
import { TransferService } from '../transfer/transfer.service';
import { TestsService } from '../tests/tests.service';
import { MediaService } from '../integrations/media.service';
import { decryptEmail } from './crypto';
import { sendEmailDirect } from './mailer';

@Injectable()
export class MaintenanceService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(MaintenanceService.name);
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    @Inject(Database) private db: Database,
    @Inject(TransferService) private transfer: TransferService,
    @Inject(TestsService) private tests: TestsService,
    @Inject(MediaService) private media: MediaService,
  ) {}

  onApplicationBootstrap() {
    this.timer = setInterval(() => {
      void this.runTick().catch(err => {
        this.logger.error(`Maintenance tick error: ${(err as Error).message}`);
      });
    }, 60000);

    setTimeout(() => {
      void this.runTick().catch(() => {});
    }, 3000);
  }

  onApplicationShutdown() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async runTick() {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      // 1. Process queued or processing import jobs
      const jobs = await this.db.importJob.findMany({
        where: { status: { in: ['queued', 'processing'] } },
        take: 5,
        orderBy: { createdAt: 'asc' },
      });
      for (const job of jobs) {
        try {
          await this.transfer.process(job.userId, job.id);
        } catch (err) {
          this.logger.error(`Failed to process import job ${job.id}: ${(err as Error).message}`);
          await this.db.importJob.updateMany({
            where: { id: job.id },
            data: {
              status: 'failed',
              result: { error: 'IMPORT_FAILED', message: (err as Error).message || 'Không thể xử lý import.' },
            },
          });
        }
      }

      // 2. Expired tests auto-submit
      const expired = await this.db.testAttempt.findMany({
        where: { status: 'in_progress', deadlineAt: { lte: new Date() } },
        take: 50,
      });
      for (const attempt of expired) {
        try {
          await this.tests.submit(attempt.userId, attempt.id);
        } catch (err) {
          this.logger.warn(`Failed to auto-submit test ${attempt.id}: ${(err as Error).message}`);
        }
      }

      // 3. Email outbox processing via Mailer (Resend REST API or SMTP)
      const hasResend = !!(config.RESEND_API_KEY || (config.SMTP_PASSWORD?.startsWith('re_')) || process.env.RESEND_API_KEY);
      if (hasResend || config.SMTP_HOST) {
        await this.db.emailOutbox.updateMany({
          where: { status: 'sending', lockedAt: { lt: new Date(Date.now() - 5 * 60000) } },
          data: { status: 'pending' },
        });
        const emails = await this.db.emailOutbox.findMany({
          where: { status: 'pending', attempts: { lt: 5 } },
          take: 10,
        });
        if (emails.length > 0) {
          for (const email of emails) {
            const claim = await this.db.emailOutbox.updateMany({
              where: { id: email.id, status: 'pending' },
              data: { status: 'sending', lockedAt: new Date(), attempts: { increment: 1 } },
            });
            if (!claim.count) continue;
            try {
              const decrypted = decryptEmail(email.text);
              let emailText = decrypted;
              let emailHtml: string | undefined = undefined;
              try {
                if (decrypted.startsWith('{') && decrypted.endsWith('}')) {
                  const parsed = JSON.parse(decrypted);
                  if (parsed.text) emailText = parsed.text;
                  if (parsed.html) emailHtml = parsed.html;
                }
              } catch {}
              await sendEmailDirect({
                to: email.to,
                subject: email.subject,
                text: emailText,
                html: emailHtml,
              });
              await this.db.emailOutbox.update({
                where: { id: email.id },
                data: { status: 'sent', sentAt: new Date(), text: '', lockedAt: null },
              });
              this.logger.log(`Outbox email ${email.id} successfully delivered to ${email.to}`);
            } catch (err) {
              this.logger.error(`Outbox email ${email.id} delivery failed: ${(err as Error).message}`);
              await this.db.emailOutbox.update({
                where: { id: email.id },
                data: { status: email.attempts + 1 >= 5 ? 'failed' : 'pending', lockedAt: null },
              });
            }
          }
        }
      }

      // 4. Housekeeping cleanup
      await this.media.cleanup();
      await this.db.reveal.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 86400000) } } });
      await this.db.passwordResetToken.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 86400000) } } });
      await this.db.emailOutbox.updateMany({
        where: { createdAt: { lt: new Date(Date.now() - 86400000) }, status: { in: ['pending', 'failed'] } },
        data: { text: '', status: 'expired' },
      });
    } catch (e) {
      this.logger.error(`Maintenance loop error: ${(e as Error).message}`);
    } finally {
      this.isRunning = false;
    }
  }
}

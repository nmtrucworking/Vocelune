import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Queue, Worker } from 'bullmq';
import nodemailer from 'nodemailer';
import { AppModule } from './app.module';
import { Database } from './common/db';
import { config } from './common/config';
import { TransferService } from './transfer/transfer.service';
import { TestsService } from './tests/tests.service';
import { MediaService } from './integrations/media.service';
import { NotificationsService } from './study/notifications.service';
import { decryptEmail } from './common/crypto';

async function main() {
  if (!config.REDIS_URL) throw new Error('REDIS_URL is required for the worker');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['warn', 'error'] });
  const db = app.get(Database), transfer = app.get(TransferService), tests = app.get(TestsService), media = app.get(MediaService), notifications = app.get(NotificationsService);
  const url = new URL(config.REDIS_URL);
  const connection = { host: url.hostname, port: Number(url.port || 6379), username: url.username || undefined, password: url.password || undefined, ...(url.protocol === 'rediss:' ? { tls: {} } : {}), maxRetriesPerRequest: null };
  const queue = new Queue('vocelune-maintenance-v1', { connection });
  const smtp = config.SMTP_HOST ? nodemailer.createTransport({ host: config.SMTP_HOST, port: config.SMTP_PORT, secure: config.SMTP_PORT === 465, ...(config.SMTP_USER ? { auth: { user: config.SMTP_USER, pass: config.SMTP_PASSWORD } } : {}), connectionTimeout: 10000 }) : null;
  const worker = new Worker('vocelune-maintenance-v1', async () => {
    const jobs = await db.importJob.findMany({ where: { status: { in: ['queued', 'processing'] } }, take: 10 });
    for (const job of jobs) {
      try { await transfer.process(job.userId, job.id); }
      catch { await db.importJob.updateMany({ where: { id: job.id }, data: { status: 'failed', result: { error: 'IMPORT_FAILED', message: 'Không thể xử lý import. Kiểm tra bộ từ đích trước khi thử lại.' } } }); }
    }
    const expired = await db.testAttempt.findMany({ where: { status: 'in_progress', deadlineAt: { lte: new Date() } }, take: 100 });
    for (const attempt of expired) await tests.submit(attempt.userId, attempt.id);
    try {
      await notifications.processScheduledNotifications();
    } catch (err) {
      process.stderr.write(`Notification scheduling tick error: ${(err as Error).message}\n`);
    }
    if (smtp) {
      await db.emailOutbox.updateMany({ where: { status: 'sending', lockedAt: { lt: new Date(Date.now() - 5 * 60000) } }, data: { status: 'pending' } });
      const emails = await db.emailOutbox.findMany({ where: { status: 'pending', attempts: { lt: 5 } }, take: 20 });
      for (const email of emails) {
        const claim = await db.emailOutbox.updateMany({ where: { id: email.id, status: 'pending' }, data: { status: 'sending', lockedAt: new Date(), attempts: { increment: 1 } } });
        if (!claim.count) continue;
        try {
          await smtp.sendMail({ from: config.SMTP_FROM, to: email.to, subject: email.subject, text: decryptEmail(email.text) });
          await db.emailOutbox.update({ where: { id: email.id }, data: { status: 'sent', sentAt: new Date(), text: '', lockedAt: null } });
        } catch { await db.emailOutbox.update({ where: { id: email.id }, data: { status: email.attempts + 1 >= 5 ? 'failed' : 'pending', lockedAt: null } }); }
      }
    }
    await media.cleanup();
    await db.reveal.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 86400000) } } });
    await db.authSession.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 7 * 86400000) } } });
    await db.passwordResetToken.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 86400000) } } });
    await db.emailOutbox.updateMany({ where: { createdAt: { lt: new Date(Date.now() - 86400000) }, status: { in: ['pending', 'failed'] } }, data: { text: '', status: 'expired' } });
  }, { connection, concurrency: 1 });
  worker.on('error', () => process.stderr.write('Worker connection error\n'));
  worker.on('failed', job => process.stderr.write(`Maintenance job failed: ${job?.id}\n`));
  await queue.upsertJobScheduler('maintenance-tick', { every: 5000 }, { name: 'tick', data: {}, opts: { removeOnComplete: 20, removeOnFail: 50, attempts: 3, backoff: { type: 'exponential', delay: 1000 } } });
  const stop = async () => { await worker.close(); await queue.close(); await app.close(); };
  process.once('SIGTERM', stop); process.once('SIGINT', stop);
  process.stdout.write('Vocelune worker ready\n');
}
main().catch(error => { process.stderr.write(`Worker startup failed: ${error.message}\n`); process.exitCode = 1; });

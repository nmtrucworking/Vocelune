import { Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { config } from './config';

const logger = new Logger('Mailer');

export interface SendMailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  from?: string;
}

function sanitizeResendFrom(raw?: string): string {
  if (!raw) return 'Vocelune <onboarding@resend.dev>';
  const str = raw.trim().replace(/^["']|["']$/g, '').trim();

  // If malformed, missing @ or contains local domains, fallback safely
  if (!str.includes('@') || str.includes('vocelune.local') || str.includes('localhost')) {
    return 'Vocelune <onboarding@resend.dev>';
  }

  // Match "Display Name <email@domain.com>"
  const nameEmailMatch = str.match(/^(.+?)\s*<([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)>$/);
  if (nameEmailMatch) {
    const name = nameEmailMatch[1].replace(/["']/g, '').trim();
    const email = nameEmailMatch[2].trim();
    return `${name || 'Vocelune'} <${email}>`;
  }

  // Match bare email "email@domain.com"
  const bareEmailMatch = str.match(/^([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)$/);
  if (bareEmailMatch) {
    return `Vocelune <${bareEmailMatch[1]}>`;
  }

  return 'Vocelune <onboarding@resend.dev>';
}

export async function sendEmailDirect(options: SendMailOptions): Promise<{ success: boolean; messageId?: string }> {
  const rawKey = config.RESEND_API_KEY || (config.SMTP_PASSWORD?.startsWith('re_') ? config.SMTP_PASSWORD : undefined) || process.env.RESEND_API_KEY;
  const resendApiKey = rawKey ? rawKey.trim() : undefined;

  // 1. Resend REST API Mode (Preferred if Resend key is provided)
  if (resendApiKey) {
    const rawFrom = options.from || config.RESEND_FROM || config.SMTP_FROM;
    const from = sanitizeResendFrom(rawFrom);

    logger.log(`Dispatching email to ${options.to} via Resend REST API (From: "${from}", Subject: "${options.subject}")...`);

    const payload: Record<string, unknown> = {
      from,
      to: [options.to],
      subject: options.subject,
      text: options.text,
    };
    if (options.html) payload.html = options.html;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const resData = (await res.json().catch(() => null)) as { id?: string; message?: string; name?: string; statusCode?: number } | null;

    if (!res.ok) {
      const errMsg = resData?.message || JSON.stringify(resData) || `HTTP status ${res.status}`;
      logger.error(`Resend API call failed (${res.status}): ${errMsg}`);
      throw new Error(`Lỗi Resend API (${res.status}): ${errMsg}`);
    }

    logger.log(`Email delivered to Resend API successfully! Message ID: ${resData?.id || 'ok'}`);
    return { success: true, messageId: resData?.id };
  }

  // 2. SMTP Mode (Nodemailer)
  if (config.SMTP_HOST) {
    logger.log(`Dispatching email to ${options.to} via SMTP (${config.SMTP_HOST}:${config.SMTP_PORT})...`);
    const smtp = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_PORT === 465,
      ...(config.SMTP_USER ? { auth: { user: config.SMTP_USER, pass: config.SMTP_PASSWORD } } : {}),
      connectionTimeout: 10000,
    });

    try {
      const info = await smtp.sendMail({
        from: options.from || config.SMTP_FROM,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      logger.log(`Email sent via SMTP successfully! Message ID: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      logger.error(`SMTP delivery failed: ${(err as Error).message}`);
      throw err;
    }
  }

  // 3. Neither configured
  const msg = 'Chưa cấu hình dịch vụ gửi email (thiếu RESEND_API_KEY hoặc SMTP_HOST). Vui lòng thêm RESEND_API_KEY trong Environment Variables trên Render.';
  logger.warn(`No email provider configured. Failed to send email to ${options.to}.`);
  throw new Error(msg);
}

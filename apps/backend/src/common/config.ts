import { config as loadEnv } from 'dotenv';
if (process.env.NODE_ENV !== 'test') loadEnv({ quiet: true });
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().url(),
  APP_ORIGIN: z.string().url().default('http://localhost:3000'),
  SESSION_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  REDIS_URL: z.preprocess(value => value === '' ? undefined : value, z.string().url().optional()),
  EMAIL_ENCRYPTION_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/).optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().default('Vocelune <noreply@vocelune.local>'),
  DICTIONARY_LICENSE_MODE: z.enum(['LIVE_ONLY', 'PERSIST_LICENSED']).default('LIVE_ONLY'),
  OXFORD_APP_ID: z.string().optional(),
  OXFORD_APP_KEY: z.string().optional(),
  OXFORD_PERSIST_FIELDS: z.string().default(''),
  OXFORD_PERSISTENCE_APPROVED: z.enum(['true', 'false']).default('false'),
  R2_ENDPOINT: z.string().url().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
});
export const config = schema.parse(process.env);
if (config.NODE_ENV === 'production' && !config.APP_ORIGIN.startsWith('https://')) {
  throw new Error('Production APP_ORIGIN must use HTTPS');
}
if (config.DICTIONARY_LICENSE_MODE === 'PERSIST_LICENSED' && config.OXFORD_PERSISTENCE_APPROVED !== 'true') {
  throw new Error('PERSIST_LICENSED requires explicit OXFORD_PERSISTENCE_APPROVED=true');
}

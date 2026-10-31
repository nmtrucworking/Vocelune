import { config as loadEnv } from 'dotenv';
if (process.env.NODE_ENV !== 'test') loadEnv({ quiet: true });
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().url(),
  APP_ORIGIN: z.string().url().optional(),
  ALLOWED_ORIGINS: z.string().optional(),
  COOKIE_DOMAIN: z.string().optional(),
  SESSION_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  REDIS_URL: z.preprocess(value => value === '' ? undefined : value, z.string().url().optional()),
  EMAIL_ENCRYPTION_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/).optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().default('Vocelune <noreply@vocelune.local>'),
  DICTIONARY_LICENSE_MODE: z.enum(['LIVE_ONLY', 'PERSIST_LICENSED']).default('LIVE_ONLY'),
  DICTIONARY_MAX_REQUESTS: z.coerce.number().int().min(1).max(8).default(4),
  DICTIONARY_CACHE_TTL_SECONDS: z.coerce.number().int().min(0).max(86400).default(3600),
  DICTIONARY_USER_AGENT: z.string().min(10).default('Vocelune/1.0 (https://github.com/nmtrucworking/Vocelune)'),
  WORDSAPI_API_KEY: z.string().optional(),
  WORDSAPI_DAILY_LIMIT: z.coerce.number().int().min(0).default(0),
  WORDSAPI_PERSISTENCE_APPROVED: z.enum(['true', 'false']).default('false'),
  WORDSAPI_PERSIST_FIELDS: z.string().default(''),
  COLLINS_API_KEY: z.string().optional(),
  COLLINS_DICTIONARY: z.string().regex(/^[a-zA-Z0-9_-]+$/).default('english'),
  COLLINS_MONTHLY_LIMIT: z.coerce.number().int().min(0).default(0),
  DATAMUSE_ENABLED: z.enum(['true', 'false']).default('false'),
  DATAMUSE_API_KEY: z.string().optional(),
  DATAMUSE_DAILY_LIMIT: z.coerce.number().int().min(0).max(100000).default(10000),
  MERRIAM_WEBSTER_API_KEY: z.string().optional(),
  MERRIAM_WEBSTER_DAILY_LIMIT: z.coerce.number().int().min(1).max(1000).default(1000),
  MERRIAM_WEBSTER_PERSISTENCE_APPROVED: z.enum(['true', 'false']).default('false'),
  MERRIAM_WEBSTER_PERSIST_FIELDS: z.string().default(''),
  OXFORD_ENVIRONMENT: z.enum(['sandbox', 'production']).default('production'),
  OXFORD_APP_ID: z.string().optional(),
  OXFORD_DAILY_LIMIT: z.coerce.number().int().min(0).default(500),
  OXFORD_APP_KEY: z.string().optional(),
  OXFORD_PERSIST_FIELDS: z.string().default(''),
  OXFORD_PERSISTENCE_APPROVED: z.enum(['true', 'false']).default('false'),
  R2_ENDPOINT: z.string().url().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  LANGUAGETOOL_API_URL: z.string().url().default('https://api.languagetool.org/v2/check'),
});
export const config = schema.parse(process.env);

export function getAllowedOrigins(): string[] {
  const origins = new Set<string>();
  const defaultOrigin = config.NODE_ENV === 'production'
    ? 'https://vocelune.nguyenminhtruc.site'
    : 'http://localhost:3000';
  origins.add((config.APP_ORIGIN || defaultOrigin).replace(/\/+$/, ''));
  if (config.ALLOWED_ORIGINS) {
    config.ALLOWED_ORIGINS.split(',')
      .map(s => s.trim().replace(/\/+$/, ''))
      .filter(Boolean)
      .forEach(o => origins.add(o));
  }
  origins.add('https://vocelune.nguyenminhtruc.site');
  return Array.from(origins);
}

export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  const normalized = origin.replace(/\/+$/, '');
  const allowed = getAllowedOrigins();
  if (allowed.includes(normalized)) return true;

  try {
    const parsed = new URL(normalized);
    // Allow localhost/127.0.0.1 on any port
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') return true;
    // Allow production custom domain and subdomains
    if (parsed.hostname === 'vocelune.nguyenminhtruc.site' || parsed.hostname.endsWith('.nguyenminhtruc.site')) return true;
    // Allow onrender and pages.dev subdomains
    if (parsed.hostname.endsWith('.onrender.com') || parsed.hostname.endsWith('.pages.dev')) return true;
  } catch {
    return false;
  }
  return false;
}

if (config.NODE_ENV === 'production') {
  for (const origin of getAllowedOrigins()) {
    if (!origin.startsWith('https://')) {
      throw new Error(`Production origin must use HTTPS: ${origin}`);
    }
  }
}
if (config.DICTIONARY_LICENSE_MODE === 'PERSIST_LICENSED' && config.OXFORD_PERSISTENCE_APPROVED !== 'true') {
  throw new Error('PERSIST_LICENSED requires explicit OXFORD_PERSISTENCE_APPROVED=true');
}

import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
loadEnv({ path: new URL('../apps/backend/.env', import.meta.url), quiet: true });
const base = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (!base) throw new Error('Run npm run setup or set TEST_DATABASE_URL first. Tests require PostgreSQL and CREATE DATABASE permission.');
const databaseName = `vocelune_test_${randomUUID().replaceAll('-', '')}`;
const url = new URL(base); url.pathname = `/${databaseName}`;
const admin = new PrismaClient({ datasources: { db: { url: base } } });
try {
  await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
  const env = { ...process.env, DATABASE_URL: url.toString(), NODE_ENV: 'test', APP_ORIGIN: 'http://localhost:3000', SMTP_HOST: '127.0.0.1', SMTP_PORT: '1025', OXFORD_APP_ID: '', OXFORD_APP_KEY: '', MERRIAM_WEBSTER_API_KEY: '', DICTIONARY_LICENSE_MODE: 'LIVE_ONLY', OXFORD_PERSISTENCE_APPROVED: 'false', OXFORD_PERSIST_FIELDS: '', MERRIAM_WEBSTER_PERSISTENCE_APPROVED: 'false', MERRIAM_WEBSTER_PERSIST_FIELDS: '', REDIS_URL: '', EMAIL_ENCRYPTION_KEY: 'a'.repeat(64) };
  for (const args of [['run', 'db:migrate', '--workspace=@vocelune/backend'], ['run', 'test:api', '--workspace=@vocelune/backend']]) {
    const result = spawnSync('npm', args, { cwd: new URL('..', import.meta.url), stdio: 'inherit', env });
    if (result.status !== 0) { process.exitCode = result.status || 1; break; }
  }
} finally {
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
  await admin.$disconnect();
}

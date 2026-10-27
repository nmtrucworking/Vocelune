import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
loadEnv({ path: new URL('../apps/backend/.env', import.meta.url), quiet: true });
if (!['localhost', '127.0.0.1'].includes(process.env.SMTP_HOST)) throw new Error('This smoke test is restricted to local SMTP/Mailpit.');
const db = new PrismaClient();
const base = 'http://localhost:4000/api/v1';
const email = `worker-smoke-${randomUUID()}@example.test`, password = `test-${randomUUID()}`;
let cookie = '', csrf = '', userId = '';
async function call(path, method = 'GET', body, extra = {}) {
  const result = await fetch(base + path, { method, headers: { Cookie: cookie, 'X-CSRF-Token': csrf, ...(body ? { 'Content-Type': 'application/json' } : {}), ...extra }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await result.json();
  assert.ok(result.ok, `${method} ${path}: ${result.status} ${data.error?.code || ''}`);
  return { result, data };
}
try {
  const registered = await call('/auth/register', 'POST', { email, password, displayName: 'Disposable worker smoke test' });
  cookie = registered.result.headers.getSetCookie().map(c => c.split(';')[0]).join('; '); csrf = registered.data.csrfToken;
  const { data: snapshot } = await call('/bootstrap'); userId = snapshot.user.id;
  const { data: job } = await call('/imports', 'POST', { deckId: snapshot.decks[0].id, rows: [{ word: 'smoketest', partOfSpeech: 'noun', meaningVi: 'Dữ liệu thử nghiệm sẽ được dọn tự động' }] }, { 'Idempotency-Key': randomUUID() });
  await call(`/imports/${job.id}/commit`, 'POST', {});
  await call('/auth/password/forgot', 'POST', { email });
  const deadline = Date.now() + 30000;
  let complete = false;
  while (Date.now() < deadline) {
    const imported = await db.importJob.findUniqueOrThrow({ where: { id: job.id } });
    const mail = await db.emailOutbox.findFirst({ where: { userId } });
    if (imported.status === 'completed' && mail?.status === 'sent') { assert.equal(mail.text, ''); complete = true; break; }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(complete, 'Worker did not finish import and email within 30 seconds');
  console.log('Worker smoke passed: BullMQ tick, persisted import, encrypted outbox and SMTP delivery.');
} finally {
  if (userId) await call('/me', 'DELETE', { password, confirmation: 'DELETE' });
  await db.$disconnect();
}

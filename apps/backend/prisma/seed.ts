import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { passwordHash } from '../src/identity/security';
import { parameters, MODEL_VERSION, LIBRARY_VERSION } from '../src/study/scheduler';
import { json } from '../src/common/db';
import { credentials } from '../src/identity/identity.service';
const db = new PrismaClient();
async function main() {
  if (!process.env.SEED_EMAIL || !process.env.SEED_PASSWORD) throw new Error('Set explicit SEED_EMAIL and SEED_PASSWORD in apps/backend/.env before seeding.');
  const input = credentials.parse({ email: process.env.SEED_EMAIL, password: process.env.SEED_PASSWORD });
  const user = await db.user.upsert({ where: { email: input.email }, update: {}, create: { email: input.email, passwordHash: await passwordHash(input.password), displayName: 'Người học', settings: { create: {} } } });
  if (!await db.schedulerConfig.count({ where: { userId: user.id } })) await db.schedulerConfig.create({ data: { userId: user.id, version: 1, modelVersion: MODEL_VERSION, libraryVersion: LIBRARY_VERSION, retention: 0.9, parameters: json(parameters(0.9)) } });
  if (!await db.deck.count({ where: { userId: user.id } })) await db.deck.create({ data: { userId: user.id, name: 'Từ vựng của tôi', normalizedName: 'từ vựng của tôi' } });
  console.log('Seed account ready. No fabricated vocabulary, reviews or scores were added.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.$disconnect());

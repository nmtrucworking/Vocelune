import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const path = new URL('../apps/backend/.env', import.meta.url);
if (!existsSync(path)) {
  const sample = readFileSync(new URL('../apps/backend/.env.example', import.meta.url), 'utf8');
  writeFileSync(path, sample + `\nEMAIL_ENCRYPTION_KEY=${randomBytes(32).toString('hex')}\n`, { mode: 0o600 });
}
for (const [command, args] of [['docker', ['compose', 'up', '-d', '--wait']], ['npm', ['run', 'db:generate']], ['npm', ['run', 'db:migrate']]]) {
  const result = spawnSync(command, args, { stdio: 'inherit', cwd: new URL('..', import.meta.url) });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log('Database ready. Start the frontend, API and worker with npm run dev.');

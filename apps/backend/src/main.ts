import { config } from './common/config';
import { createApp } from './app';
async function main() {
  const app = await createApp();
  const host = process.env.HOST || '0.0.0.0';
  await app.listen(config.PORT, host);
  process.stdout.write(`API listening on http://${host}:${config.PORT}\n`);
}
main().catch(error => { process.stderr.write(`API startup failed: ${error.message}\n`); process.exitCode = 1; });

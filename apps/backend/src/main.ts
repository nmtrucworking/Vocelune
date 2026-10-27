import { config } from './common/config';
import { createApp } from './app';
async function main() {
  const app = await createApp();
  await app.listen(config.PORT, config.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');
}
main().catch(error => { process.stderr.write(`API startup failed: ${error.message}\n`); process.exitCode = 1; });

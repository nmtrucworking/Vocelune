import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const target = process.env.API_PROXY_TARGET || 'https://vocelune-api.onrender.com';
const cleanTarget = target.replace(/\/+$/, '');

const redirectsPath = path.resolve('apps/frontend/public/_redirects');
fs.mkdirSync(path.dirname(redirectsPath), { recursive: true });
fs.writeFileSync(redirectsPath, `# Cloudflare Pages Reverse Proxy (200 = Rewrite)\n/api/v1/*  ${cleanTarget}/api/v1/:splat  200\n`);

console.log(`[Cloudflare Pages] Configured _redirects -> ${cleanTarget}/api/v1/:splat`);
execSync('npm run build:frontend', { stdio: 'inherit', env: { ...process.env, OUTPUT_MODE: 'export' } });

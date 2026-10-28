import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const target = process.env.API_PROXY_TARGET || 'https://vocelune-api.onrender.com';
const cleanTarget = target.replace(/\/+$/, '');

// Detect whether running in apps/frontend or root
const isInFrontend = fs.existsSync(path.resolve('next.config.mjs'));
const publicDir = isInFrontend ? path.resolve('public') : path.resolve('apps/frontend/public');
const redirectsPath = path.join(publicDir, '_redirects');

fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(redirectsPath, `# Cloudflare Pages Reverse Proxy (200 = Rewrite)\n/api/v1/*  ${cleanTarget}/api/v1/:splat  200\n`);

console.log(`[Cloudflare Pages] Configured _redirects -> ${cleanTarget}/api/v1/:splat`);

const buildCmd = isInFrontend ? 'npx next build' : 'npm run build:frontend';
execSync(buildCmd, { stdio: 'inherit', env: { ...process.env, OUTPUT_MODE: 'export' } });

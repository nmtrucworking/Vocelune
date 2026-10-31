import { fileURLToPath } from 'node:url';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';

const isExport = process.env.OUTPUT_MODE === 'export';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
];

/** @type {import('next').NextConfig} */
const nextConfig = (phase) => ({
  // Keep builds from replacing the assets of a running development server.
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',
  output: isExport ? 'export' : 'standalone',
  reactStrictMode: true,
  ...(isExport
    ? {
        images: { unoptimized: true },
      }
    : {
        outputFileTracingRoot: fileURLToPath(new URL('../..', import.meta.url)),
        async headers() {
          return [{ source: '/:path*', headers: securityHeaders }];
        },
        async redirects() {
          return [
            {
              source: '/app/:path*',
              destination: '/:path*',
              permanent: true,
            },
            {
              source: '/app',
              destination: '/dashboard',
              permanent: true,
            },
          ];
        },
        async rewrites() {
          return [
            {
              source: '/api/v1/:path*',
              destination: `${process.env.API_PROXY_TARGET || 'http://127.0.0.1:4000'}/api/v1/:path*`,
            },
          ];
        },
      }),
});

export default nextConfig;

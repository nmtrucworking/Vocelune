import { fileURLToPath } from 'node:url';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';

const isExport = process.env.OUTPUT_MODE === 'export';

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

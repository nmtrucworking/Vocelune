import { fileURLToPath } from 'node:url';

const isExport = process.env.OUTPUT_MODE === 'export';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: isExport ? 'export' : 'standalone',
  reactStrictMode: true,
  ...(isExport
    ? {
        images: { unoptimized: true },
      }
    : {
        outputFileTracingRoot: fileURLToPath(new URL('../..', import.meta.url)),
        async rewrites() {
          return [
            {
              source: '/api/v1/:path*',
              destination: `${process.env.API_PROXY_TARGET || 'http://127.0.0.1:4000'}/api/v1/:path*`,
            },
          ];
        },
      }),
};

export default nextConfig;

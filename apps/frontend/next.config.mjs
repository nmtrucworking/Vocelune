import { fileURLToPath } from 'node:url';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: fileURLToPath(new URL('../..', import.meta.url)),
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${process.env.API_PROXY_TARGET || 'http://127.0.0.1:4000'}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;

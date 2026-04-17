import type { NextConfig } from 'next';

const API_REWRITE_TARGET =
  process.env.API_REWRITE_TARGET ?? 'http://localhost:3001';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@metanoia/types', '@metanoia/ui'],
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${API_REWRITE_TARGET}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;

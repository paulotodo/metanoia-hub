import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@metanoia/types', '@metanoia/ui'],
};

export default nextConfig;

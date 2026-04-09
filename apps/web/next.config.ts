import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@metanoia/types', '@metanoia/ui'],
};

export default nextConfig;

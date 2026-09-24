import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // モノレポ内の共通パッケージはソースのまま読む
  transpilePackages: ['@pos/core'],
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
};

export default nextConfig;

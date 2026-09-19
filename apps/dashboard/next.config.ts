import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // antd は ESM/CJS が混在するためサーバー側でトランスパイルする
  transpilePackages: ['antd', '@ant-design/icons', 'rc-util', 'rc-picker', 'rc-table'],
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**.supabase.co' }],
  },
};

export default nextConfig;

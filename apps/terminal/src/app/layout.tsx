import type { Metadata, Viewport } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'POS + モバイルオーダー',
    template: '%s | POS + モバイルオーダー',
  },
  description: '飲食店向けの POS レジとモバイルオーダーを 1 つにまとめたシステム',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // POS / KDS をタブレットで使うとき、誤ってピンチズームしないようにする
  maximumScale: 1,
  themeColor: '#1f1b18',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="bg-charcoal-50 text-charcoal-900 antialiased">{children}</body>
    </html>
  );
}

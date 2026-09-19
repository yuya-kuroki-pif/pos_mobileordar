import '@ant-design/v5-patch-for-react-19';

import { AntdRegistry } from '@ant-design/nextjs-registry';
import { App as AntdApp, ConfigProvider } from 'antd';
import jaJP from 'antd/locale/ja_JP';
import viVN from 'antd/locale/vi_VN';
import type { Metadata, Viewport } from 'next';

import { currentUiLocale } from '@/lib/localeServer';
import { theme } from '@/styles/theme';

import './globals.css';

export const metadata: Metadata = {
  title: { default: '管理ダッシュボード', template: '%s - 管理ダッシュボード' },
  description: '飲食店向け POS / モバイルオーダーの本部・店舗向け管理ダッシュボード',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // 日付ピッカーなど antd 側の文言も一緒に切り替える
  const locale = await currentUiLocale();

  return (
    <html lang={locale}>
      <body>
        <AntdRegistry>
          <ConfigProvider locale={locale === 'vi' ? viVN : jaJP} theme={theme}>
            <AntdApp>{children}</AntdApp>
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}

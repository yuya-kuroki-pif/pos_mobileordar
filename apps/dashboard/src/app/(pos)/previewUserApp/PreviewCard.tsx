'use client';

import { Card, Space, Typography } from 'antd';
import Image from 'next/image';

/**
 * プレビュー用の QR と URL。
 * antd の Typography.Text はサーバーコンポーネントから触れないので分けている。
 */
export function PreviewCard({ image, url }: { image: string | null; url: string | null }) {
  return (
    <Card>
      {image && url ? (
        <Space direction="vertical" align="center" style={{ width: '100%' }}>
          <Image src={image} alt="プレビュー用 QR コード" width={240} height={240} unoptimized />
          <Typography.Text copyable={{ text: url }} type="secondary">
            {url}
          </Typography.Text>
        </Space>
      ) : (
        <Typography.Text type="secondary">この業態には店舗がありません。</Typography.Text>
      )}
    </Card>
  );
}

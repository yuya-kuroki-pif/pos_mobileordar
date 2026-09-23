'use client';

import { Typography } from 'antd';

/**
 * 編集画面の横に置く、お客様の画面の見え方。
 * 実機そのものではなく「だいたいこう出る」を確かめるためのもの。
 */
export function PhonePreview({
  title = 'プレビュー',
  /** 長いフォームの横に置くとき、スクロールしても付いてくるようにする */
  sticky = false,
  children,
}: {
  title?: string;
  sticky?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={
        sticky ? { width: 260, position: 'sticky', top: 16, alignSelf: 'flex-start' } : { width: 260 }
      }
    >
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {title}
      </Typography.Text>
      <div
        style={{
          marginTop: 8,
          border: '8px solid #262626',
          borderRadius: 24,
          overflow: 'hidden',
          background: '#fff',
          height: 440,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            height: 22,
            background: '#262626',
            borderBottomLeftRadius: 10,
            borderBottomRightRadius: 10,
            margin: '0 auto',
            width: 110,
          }}
        />
        <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>{children}</div>
      </div>
    </div>
  );
}

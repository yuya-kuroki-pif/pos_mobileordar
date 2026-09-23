'use client';

import { Card, Flex, Progress, Space, Typography } from 'antd';

import { GENDER_LABELS, type CustomerGender } from '@/lib/types';

const GENDERS: CustomerGender[] = ['male', 'female', 'other', 'unknown'];

const BAR_COLORS: Record<CustomerGender, string> = {
  male: '#1677ff',
  female: '#eb2f96',
  other: '#52c41a',
  unknown: '#bfbfbf',
};

export interface GenderRow {
  shop_id: string;
  shop_name: string;
  total: number;
  counts: Record<CustomerGender, number>;
}

/**
 * 店舗別の性別構成（仕様書 §6.9）。
 * antd の Typography.Text などはサーバーコンポーネントから触れないので、
 * この部分だけクライアントに置いている。
 */
export function GenderBars({ rows }: { rows: GenderRow[] }) {
  return (
    <Card title="店舗別の性別構成">
      {rows.length === 0 ? (
        <Typography.Text type="secondary">店舗がありません。</Typography.Text>
      ) : (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {rows.map((row) => (
            <div key={row.shop_id}>
              <Flex justify="space-between">
                <Typography.Text strong>{row.shop_name}</Typography.Text>
                <Typography.Text type="secondary">回答 {row.total} 件</Typography.Text>
              </Flex>

              {row.total === 0 ? (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  回答がありません
                </Typography.Text>
              ) : (
                <>
                  <Flex style={{ height: 12, borderRadius: 6, overflow: 'hidden', marginTop: 6 }}>
                    {GENDERS.map((gender) =>
                      row.counts[gender] > 0 ? (
                        <div
                          key={gender}
                          style={{
                            width: `${(row.counts[gender] / row.total) * 100}%`,
                            background: BAR_COLORS[gender],
                          }}
                        />
                      ) : null
                    )}
                  </Flex>

                  <Space size="large" wrap style={{ fontSize: 12, marginTop: 6 }}>
                    {GENDERS.map((gender) => (
                      <Typography.Text key={gender} type="secondary">
                        <span style={{ color: BAR_COLORS[gender] }}>■</span>{' '}
                        {GENDER_LABELS[gender]} {row.counts[gender]}（
                        {Math.round((row.counts[gender] / row.total) * 100)}%）
                      </Typography.Text>
                    ))}
                  </Space>
                </>
              )}
            </div>
          ))}
        </Space>
      )}
    </Card>
  );
}

'use client';

import { Alert, Card, Space, Table, Tag } from 'antd';

import { PageHeader } from '@/components/PageHeader';
import type { ShopGroup } from '@/lib/types';

/** 店舗グループ。分析や予約で店舗をまとめて扱うための任意グループ */
export function ShopGroupView({
  groups,
  shopNames,
}: {
  groups: ShopGroup[];
  shopNames: Record<string, string>;
}) {
  return (
    <>
      <PageHeader
        title="店舗グループ"
        description="分析や予約で店舗をまとめて扱うためのグループ"
        breadcrumb={[{ label: '設定' }, { label: '店舗グループ' }]}
      />

      <Alert
        type="info"
        showIcon
        message="グループの作成・編集は P1 で実装します"
        description="P0 では一覧の表示のみです。"
        style={{ marginBottom: 16 }}
      />

      <Card styles={{ body: { padding: 0 } }}>
        <Table<ShopGroup>
          rowKey="id"
          dataSource={groups}
          size="middle"
          scroll={{ x: 'max-content' }}
          pagination={false}
          columns={[
            { title: 'グループ名', dataIndex: 'name', width: 240 },
            {
              title: '所属店舗',
              key: 'shops',
              render: (_, group) => (
                <Space size={4} wrap>
                  {group.shop_ids.map((id) => (
                    <Tag key={id}>{shopNames[id] ?? id}</Tag>
                  ))}
                  {group.shop_ids.length === 0 && <span style={{ color: '#bfbfbf' }}>—</span>}
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}

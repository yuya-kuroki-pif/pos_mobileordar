'use client';

import { Card, Table, Tag } from 'antd';

import { PageHeader } from '@/components/PageHeader';
import type { Shop } from '@/lib/types';

/**
 * 店舗一覧（仕様書 §5.12 / 画像 12_shop_list.jpg）。
 * 店舗編集（レジ設定を含む 40 以上の項目）は P1 で実装する。
 */
export function ShopListView({ shops, companyName }: { shops: Shop[]; companyName: string }) {
  return (
    <>
      <PageHeader
        title="店舗一覧"
        description="業態に属する店舗。編集画面は P1 で実装します"
        breadcrumb={[{ label: companyName }, { label: '店舗管理' }, { label: '店舗一覧' }]}
      />

      <Card styles={{ body: { padding: 0 } }}>
        <Table<Shop>
          rowKey="id"
          dataSource={shops}
          size="middle"
          scroll={{ x: 'max-content' }}
          pagination={false}
          columns={[
            { title: '店舗名', dataIndex: 'name' },
            { title: '店舗コード', dataIndex: 'slug', width: 140 },
            {
              title: '営業時間',
              key: 'hours',
              width: 160,
              render: (_, shop) =>
                shop.open_time && shop.close_time
                  ? `${shop.open_time.slice(0, 5)} 〜 ${shop.close_time.slice(0, 5)}`
                  : '—',
            },
            {
              title: '税率',
              key: 'tax',
              width: 180,
              render: (_, shop) => (
                <>
                  <Tag>標準 {(shop.standard_tax_rate * 100).toFixed(0)}%</Tag>
                  <Tag color="blue">軽減 {(shop.reduced_tax_rate * 100).toFixed(0)}%</Tag>
                </>
              ),
            },
            {
              title: '登録番号',
              dataIndex: 'invoice_registration_number',
              width: 180,
              render: (value: string | null) =>
                value ?? <span style={{ color: '#bfbfbf' }}>未設定</span>,
            },
          ]}
        />
      </Card>
    </>
  );
}

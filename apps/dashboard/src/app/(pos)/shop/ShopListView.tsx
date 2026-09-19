'use client';

import { EditOutlined } from '@ant-design/icons';
import { Button, Card, Table, Tag } from 'antd';
import Link from 'next/link';

import { PageHeader } from '@/components/PageHeader';
import { canEdit, type PermissionMap } from '@/lib/permissions';
import { minToLabel } from '@/lib/time';
import type { Shop } from '@/lib/types';

/** 店舗一覧（仕様書 §5.12 / 画像 12_shop_list.jpg） */
export function ShopListView({
  shops,
  companyName,
  permissions,
}: {
  shops: Shop[];
  companyName: string;
  permissions: PermissionMap;
}) {
  const editable = canEdit(permissions, 'shop_management');

  return (
    <>
      <PageHeader
        title="店舗"
        description="営業時間・レジ設定など、店舗ごとの設定をまとめています"
        breadcrumb={[{ label: companyName }, { label: '店舗管理' }, { label: '店舗' }]}
      />

      <Card styles={{ body: { padding: 0 } }}>
        <Table<Shop>
          rowKey="id"
          dataSource={shops}
          size="middle"
          scroll={{ x: 'max-content' }}
          pagination={false}
          columns={[
            {
              title: '店舗名',
              dataIndex: 'name',
              fixed: 'left',
              width: 260,
              render: (value: string, shop) => <Link href={`/shop/${shop.id}/edit`}>{value}</Link>,
            },
            { title: '店舗コード', dataIndex: 'slug', width: 140 },
            {
              title: '開店',
              dataIndex: 'open_time_min',
              width: 90,
              render: (value: number | null) =>
                value === null ? <span style={{ color: '#bfbfbf' }}>—</span> : minToLabel(value),
            },
            {
              title: '閉店',
              dataIndex: 'close_time_min',
              width: 90,
              // 24 時超は 31:00 のように見せる（＝翌 7:00）
              render: (value: number | null) =>
                value === null ? <span style={{ color: '#bfbfbf' }}>—</span> : minToLabel(value),
            },
            {
              title: '1人あたり注文上限数',
              key: 'orderLimit',
              width: 170,
              align: 'right',
              render: (_, shop) =>
                shop.order_limit_enabled && shop.order_limit_per_person ? (
                  <span className="tabular">{shop.order_limit_per_person}</span>
                ) : (
                  <Tag>上限なし</Tag>
                ),
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
            {
              title: '',
              key: 'actions',
              width: 70,
              fixed: 'right',
              render: (_, shop) => (
                <Link href={`/shop/${shop.id}/edit`}>
                  <Button type="text" size="small" icon={<EditOutlined />} disabled={!editable} />
                </Link>
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}

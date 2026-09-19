'use client';

import { Card, DatePicker, Flex, Select, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';

import { PageHeader } from '@/components/PageHeader';
import type { TableUsageRow } from '@/lib/transactionQueries';
import type { Shop } from '@/lib/types';

const yen = new Intl.NumberFormat('ja-JP');

/** テーブル利用履歴（仕様書 §5.25） */
export function TableUsageView({
  rows,
  shops,
  shopId,
  yearMonth,
  companyName,
}: {
  rows: TableUsageRow[];
  shops: Shop[];
  shopId?: string;
  yearMonth: string;
  companyName: string;
}) {
  const router = useRouter();

  function go(next: { shop?: string; month?: string }) {
    const params = new URLSearchParams();
    params.set('shop', next.shop ?? shopId ?? '');
    params.set('month', next.month ?? yearMonth);
    router.push(`/tableUsageHistory?${params.toString()}`);
  }

  return (
    <>
      <PageHeader
        title="テーブル利用履歴"
        description="卓ごとの立ち上げから会計までの記録"
        breadcrumb={[{ label: companyName }, { label: '本部機能' }, { label: 'テーブル利用履歴' }]}
      />

      <Card styles={{ body: { padding: 0 } }}>
        <Flex gap={8} wrap style={{ padding: 16, borderBottom: '1px solid #f0f0f0' }}>
          <Select
            value={shopId}
            style={{ width: 220 }}
            onChange={(value) => go({ shop: value })}
            options={shops.map((s) => ({ value: s.id, label: s.name }))}
          />
          <DatePicker
            picker="month"
            value={dayjs(yearMonth)}
            allowClear={false}
            onChange={(value) => go({ month: value.format('YYYY-MM') })}
          />
        </Flex>

        <Table<TableUsageRow>
          rowKey="id"
          dataSource={rows}
          size="middle"
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 20, showSizeChanger: false, showTotal: (t) => `${t} 件` }}
          columns={[
            {
              title: 'テーブル名',
              dataIndex: 'table_name',
              width: 150,
              fixed: 'left',
              render: (value: string | null) => value ?? <span style={{ color: '#bfbfbf' }}>—</span>,
            },
            {
              title: '親テーブル名',
              dataIndex: 'parent_table_name',
              width: 150,
              render: (value: string | null) => value ?? <span style={{ color: '#bfbfbf' }}>—</span>,
            },
            {
              title: '立ち上げ日時',
              dataIndex: 'opened_at',
              width: 170,
              render: (value: string) => dayjs(value).format('YYYY/MM/DD HH:mm'),
            },
            {
              title: '人数',
              dataIndex: 'guest_count',
              width: 90,
              align: 'right',
              render: (value: number) => <span className="tabular">{value}</span>,
            },
            {
              title: '注文金額',
              dataIndex: 'order_total',
              width: 130,
              align: 'right',
              render: (value: number) => <span className="tabular">¥{yen.format(value)}</span>,
            },
            {
              title: '状態',
              dataIndex: 'status',
              width: 110,
              render: (value: string) =>
                value === 'open' ? (
                  <Tag color="blue">利用中</Tag>
                ) : value === 'cleared' ? (
                  <Tag color="orange">クリア</Tag>
                ) : (
                  <Tag>会計済み</Tag>
                ),
            },
            {
              title: 'テーブルクリア理由',
              dataIndex: 'clear_reason',
              render: (value: string | null) => value ?? <span style={{ color: '#bfbfbf' }}>—</span>,
            },
          ]}
        />
      </Card>
    </>
  );
}

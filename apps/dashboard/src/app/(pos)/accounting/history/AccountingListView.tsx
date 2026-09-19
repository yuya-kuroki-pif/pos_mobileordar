'use client';

import { Card, DatePicker, Flex, Input, Select, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import type { AccountingRow } from '@/lib/transactionQueries';
import type { PaymentMethod, Shop } from '@/lib/types';

const yen = new Intl.NumberFormat('ja-JP');

/** 会計履歴一覧（仕様書 §5.23） */
export function AccountingListView({
  rows,
  shops,
  shopId,
  methods,
  filter,
  companyName,
}: {
  rows: AccountingRow[];
  shops: Shop[];
  shopId?: string;
  methods: PaymentMethod[];
  filter: { date?: string; receipt?: string; method?: string };
  companyName: string;
}) {
  const router = useRouter();
  const [receipt, setReceipt] = useState(filter.receipt ?? '');

  function go(next: Partial<{ shop: string; date: string; receipt: string; method: string }>) {
    const params = new URLSearchParams();
    const merged = {
      shop: shopId,
      date: filter.date,
      receipt: filter.receipt,
      method: filter.method,
      ...next,
    };
    for (const [key, value] of Object.entries(merged)) {
      if (value) params.set(key, String(value));
    }
    router.push(`/accounting/history?${params.toString()}`);
  }

  return (
    <>
      <PageHeader
        title="会計履歴一覧"
        description="レシート番号や支払方法から、過去の会計を探せます"
        breadcrumb={[{ label: companyName }, { label: '本部機能' }, { label: '会計履歴一覧' }]}
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
            value={filter.date ? dayjs(filter.date) : null}
            placeholder="日付"
            onChange={(value) => go({ date: value ? value.format('YYYY-MM-DD') : '' })}
          />
          <Input.Search
            placeholder="レシート番号"
            allowClear
            value={receipt}
            style={{ width: 180 }}
            onChange={(e) => setReceipt(e.target.value)}
            onSearch={(value) => go({ receipt: value })}
          />
          <Select
            placeholder="支払方法"
            allowClear
            value={filter.method}
            style={{ width: 180 }}
            onChange={(value) => go({ method: value ?? '' })}
            options={methods.map((m) => ({ value: m.id, label: m.name }))}
          />
        </Flex>

        <Table<AccountingRow>
          rowKey="id"
          dataSource={rows}
          size="middle"
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 20, showSizeChanger: false, showTotal: (t) => `${t} 件` }}
          columns={[
            {
              title: 'レシート番号',
              dataIndex: 'receipt_number',
              width: 140,
              fixed: 'left',
              render: (value: number | null) => <span className="tabular">{value ?? '—'}</span>,
            },
            {
              title: '会計日時',
              dataIndex: 'paid_at',
              width: 170,
              render: (value: string, row) => (
                <Link href={`/accounting/history/${row.id}`}>
                  {dayjs(value).format('YYYY/MM/DD HH:mm')}
                </Link>
              ),
            },
            {
              title: 'テーブル',
              dataIndex: 'table_name',
              width: 140,
              render: (value: string | null) => value ?? <span style={{ color: '#bfbfbf' }}>—</span>,
            },
            {
              title: '支払方法',
              dataIndex: 'method_name',
              width: 150,
              render: (value: string) => <Tag color="blue">{value}</Tag>,
            },
            {
              title: '割引',
              dataIndex: 'discount',
              width: 130,
              align: 'right',
              render: (value: number) =>
                value > 0 ? (
                  <Tag color="orange" className="tabular">
                    ¥{yen.format(value)}
                  </Tag>
                ) : (
                  <span style={{ color: '#bfbfbf' }}>—</span>
                ),
            },
            {
              title: '会計金額',
              dataIndex: 'total',
              width: 140,
              align: 'right',
              render: (value: number) => <span className="tabular">¥{yen.format(value)}</span>,
            },
            {
              title: '状態',
              key: 'status',
              width: 120,
              render: (_, row) =>
                row.voided_at ? (
                  <Tag color="red">取消済み</Tag>
                ) : row.modified_at ? (
                  <Tag color="orange">修正済み</Tag>
                ) : (
                  <Tag color="green">完了</Tag>
                ),
            },
            {
              title: '担当',
              dataIndex: 'clerk_name',
              width: 120,
              render: (value: string | null) => value ?? <span style={{ color: '#bfbfbf' }}>—</span>,
            },
          ]}
        />
      </Card>
    </>
  );
}

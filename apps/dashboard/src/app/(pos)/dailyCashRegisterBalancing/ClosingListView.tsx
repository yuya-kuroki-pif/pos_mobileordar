'use client';

import { Card, DatePicker, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { PageHeader } from '@/components/PageHeader';
import type { CashClosing } from '@/lib/types';

const yen = new Intl.NumberFormat('ja-JP');

/** 日次処理一覧（仕様書 §5.22） */
export function ClosingListView({
  closings,
  shopNames,
  businessDay,
  companyName,
}: {
  closings: CashClosing[];
  shopNames: Record<string, string>;
  businessDay: string;
  companyName: string;
}) {
  const router = useRouter();

  return (
    <>
      <PageHeader
        title="日次処理一覧"
        description="店舗ごとのレジ締め。現金過不足が出ている日はここで気づけます"
        breadcrumb={[{ label: companyName }, { label: '本部機能' }, { label: '日次処理一覧' }]}
        extra={
          <DatePicker
            value={dayjs(businessDay)}
            allowClear={false}
            onChange={(value) =>
              router.push(`/dailyCashRegisterBalancing?date=${value.format('YYYY-MM-DD')}`)
            }
          />
        }
      />

      <Card styles={{ body: { padding: 0 } }}>
        <Table<CashClosing>
          rowKey="id"
          dataSource={closings}
          size="middle"
          pagination={false}
          locale={{ emptyText: 'この日の精算はありません' }}
          columns={[
            {
              title: '店舗名',
              dataIndex: 'store_id',
              render: (value: string) => shopNames[value] ?? value,
            },
            {
              title: '精算時刻',
              dataIndex: 'closed_at',
              width: 160,
              render: (value: string, row) => (
                <Link
                  href={`/dailyCashRegisterBalancing/${row.store_id}/${row.business_day}?index=${row.closing_index}`}
                >
                  {dayjs(value).format('HH:mm')}
                </Link>
              ),
            },
            {
              title: '総売上',
              dataIndex: 'total_sales',
              width: 140,
              align: 'right',
              render: (value: number) => <span className="tabular">¥{yen.format(value)}</span>,
            },
            {
              title: '銀行預入金',
              dataIndex: 'bank_deposit',
              width: 140,
              align: 'right',
              render: (value: number) => <span className="tabular">¥{yen.format(value)}</span>,
            },
            {
              title: '現金過不足',
              dataIndex: 'difference',
              width: 140,
              align: 'right',
              sorter: (a, b) => a.difference - b.difference,
              render: (value: number) =>
                value === 0 ? (
                  <Tag>0</Tag>
                ) : (
                  <Tag color={value > 0 ? 'blue' : 'red'} className="tabular">
                    {value > 0 ? '+' : ''}
                    {yen.format(value)}
                  </Tag>
                ),
            },
          ]}
        />
      </Card>
    </>
  );
}

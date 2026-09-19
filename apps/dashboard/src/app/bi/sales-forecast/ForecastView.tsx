'use client';

import { Alert, Card, DatePicker, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';

import { PageHeader } from '@/components/PageHeader';

const yen = new Intl.NumberFormat('ja-JP');

export interface ForecastRow {
  shop_id: string;
  shop_name: string;
  actual: number;
  forecast: number;
  target: number;
  remaining_days: number;
}

/** 売上予測（仕様書 §6.9） */
export function ForecastView({
  yearMonth,
  rows,
  companyName,
}: {
  yearMonth: string;
  rows: ForecastRow[];
  companyName: string;
}) {
  const router = useRouter();
  const sorted = [...rows].sort((a, b) => b.forecast - a.forecast);

  return (
    <>
      <PageHeader
        title="売上予測"
        description="今月の着地がどのあたりになりそうかを見ます"
        breadcrumb={[{ label: companyName }, { label: '経営管理' }, { label: '売上予測' }]}
        extra={
          <DatePicker
            picker="month"
            value={dayjs(yearMonth)}
            allowClear={false}
            onChange={(value) => router.push(`/bi/sales-forecast?month=${value.format('YYYY-MM')}`)}
          />
        }
      />

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="予測の出し方"
        description="今日までの実績に、残りの日を「同じ曜日の平均売上」で埋めて足しています。天候や予約は見ていません。"
      />

      <Card styles={{ body: { padding: 0 } }}>
        <Table<ForecastRow>
          rowKey="shop_id"
          dataSource={sorted}
          size="middle"
          scroll={{ x: 'max-content' }}
          pagination={false}
          columns={[
            {
              title: '順位',
              key: 'rank',
              width: 70,
              render: (_, __, index) => <span className="tabular">{index + 1}</span>,
            },
            { title: '店舗名', dataIndex: 'shop_name', width: 220 },
            {
              title: '実績',
              dataIndex: 'actual',
              width: 150,
              align: 'right',
              render: (value: number) => <span className="tabular">¥{yen.format(value)}</span>,
            },
            {
              title: '残り日数',
              dataIndex: 'remaining_days',
              width: 110,
              align: 'right',
              render: (value: number) => <span className="tabular">{value} 日</span>,
            },
            {
              title: '売上着地見込',
              dataIndex: 'forecast',
              width: 160,
              align: 'right',
              render: (value: number) => <span className="tabular">¥{yen.format(value)}</span>,
            },
            {
              title: '売上目標',
              dataIndex: 'target',
              width: 150,
              align: 'right',
              render: (value: number) =>
                value > 0 ? (
                  <span className="tabular">¥{yen.format(value)}</span>
                ) : (
                  <span style={{ color: '#bfbfbf' }}>未設定</span>
                ),
            },
            {
              title: '達成率着地見込',
              key: 'rate',
              width: 160,
              align: 'right',
              render: (_, row) => {
                if (row.target === 0) return <span style={{ color: '#bfbfbf' }}>—</span>;
                const rate = row.forecast / row.target;
                return (
                  <Tag color={rate >= 1 ? 'green' : rate >= 0.9 ? 'orange' : 'red'} className="tabular">
                    {(rate * 100).toFixed(1)}%
                  </Tag>
                );
              },
            },
          ]}
        />
      </Card>
    </>
  );
}

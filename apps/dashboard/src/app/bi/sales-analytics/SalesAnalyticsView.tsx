'use client';

import { DownloadOutlined } from '@ant-design/icons';
import { Alert, Button, Card, DatePicker, Flex, Select, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';

import { SalesChart } from '@/components/charts/SalesChart';
import { PageHeader } from '@/components/PageHeader';
import type { DailySummary, Shop } from '@/lib/types';

const yen = new Intl.NumberFormat('ja-JP');
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

/** 売上分析（仕様書 §6.4）。土は青、日は赤で出す */
export function SalesAnalyticsView({
  daily,
  shops,
  shopId,
  yearMonth,
  companyName,
}: {
  daily: DailySummary[];
  shops: Shop[];
  shopId?: string;
  yearMonth: string;
  companyName: string;
}) {
  const router = useRouter();

  function go(next: { shop?: string; month?: string }) {
    const params = new URLSearchParams();
    const shopValue = next.shop ?? shopId;
    if (shopValue) params.set('shop', shopValue);
    params.set('month', next.month ?? yearMonth);
    router.push(`/bi/sales-analytics?${params.toString()}`);
  }

  const total = daily.reduce(
    (acc, d) => ({
      sales: acc.sales + d.sales,
      target: acc.target + d.target,
      guest_count: acc.guest_count + d.guest_count,
      group_count: acc.group_count + d.group_count,
    }),
    { sales: 0, target: 0, guest_count: 0, group_count: 0 }
  );

  const chart = daily.map((d) => ({
    label: `${dayjs(d.business_date).format('D')}(${WEEKDAYS[dayjs(d.business_date).day()]})`,
    sales: d.sales,
    target: d.target > 0 ? d.target : undefined,
  }));

  function downloadCsv() {
    const header = ['日付', '売上', '売上目標', '達成率', '客数', '組数', '客単価'];
    const body = daily.map((d) =>
      [
        d.business_date,
        d.sales,
        d.target,
        d.target > 0 ? ((d.sales / d.target) * 100).toFixed(1) : '',
        d.guest_count,
        d.group_count,
        d.guest_count > 0 ? Math.round(d.sales / d.guest_count) : 0,
      ].join(',')
    );

    const blob = new Blob(['\ufeff' + [header.join(','), ...body].join('\r\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sales-${yearMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        title="売上分析"
        description="日別の売上を、目標と並べて見ます"
        breadcrumb={[{ label: companyName }, { label: '経営管理' }, { label: '売上分析' }]}
        extra={
          <Button icon={<DownloadOutlined />} onClick={downloadCsv}>
            CSV
          </Button>
        }
      />

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="POS 売上のみを集計しています"
        description="デリバリーなど POS を通らない売上は含みません。"
      />

      <Card style={{ marginBottom: 16 }}>
        <Flex gap={8} wrap style={{ marginBottom: 16 }}>
          <Select
            placeholder="全店舗"
            allowClear
            value={shopId}
            style={{ width: 220 }}
            onChange={(value) => go({ shop: value ?? '' })}
            options={shops.map((s) => ({ value: s.id, label: s.name }))}
          />
          <DatePicker
            picker="month"
            value={dayjs(yearMonth)}
            allowClear={false}
            onChange={(value) => go({ month: value.format('YYYY-MM') })}
          />
        </Flex>

        <SalesChart data={chart} height={320} />
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table<DailySummary>
          rowKey="business_date"
          dataSource={daily}
          size="middle"
          scroll={{ x: 'max-content' }}
          pagination={false}
          summary={() => (
            <Table.Summary fixed="top">
              <Table.Summary.Row style={{ fontWeight: 600, background: '#fafafa' }}>
                <Table.Summary.Cell index={0}>合計</Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right">
                  <span className="tabular">¥{yen.format(total.sales)}</span>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2} align="right">
                  <span className="tabular">¥{yen.format(total.target)}</span>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={3} align="right">
                  {total.target > 0 ? `${((total.sales / total.target) * 100).toFixed(1)}%` : '—'}
                </Table.Summary.Cell>
                <Table.Summary.Cell index={4} align="right">
                  <span className="tabular">{yen.format(total.guest_count)}</span>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={5} align="right">
                  <span className="tabular">{yen.format(total.group_count)}</span>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={6} align="right">
                  <span className="tabular">
                    ¥
                    {yen.format(
                      total.guest_count > 0 ? Math.round(total.sales / total.guest_count) : 0
                    )}
                  </span>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          )}
          columns={[
            {
              title: '日付',
              dataIndex: 'business_date',
              width: 130,
              fixed: 'left',
              render: (value: string) => {
                const day = dayjs(value).day();
                const color = day === 0 ? '#f5222d' : day === 6 ? '#1677ff' : undefined;
                return (
                  <span style={{ color }}>
                    {dayjs(value).format('MM/DD')}（{WEEKDAYS[day]}）
                  </span>
                );
              },
            },
            {
              title: '売上',
              dataIndex: 'sales',
              width: 140,
              align: 'right',
              render: (value: number) => <span className="tabular">¥{yen.format(value)}</span>,
            },
            {
              title: '売上目標',
              dataIndex: 'target',
              width: 140,
              align: 'right',
              render: (value: number) =>
                value > 0 ? (
                  <span className="tabular">¥{yen.format(value)}</span>
                ) : (
                  <span style={{ color: '#bfbfbf' }}>—</span>
                ),
            },
            {
              title: '目標達成率',
              key: 'rate',
              width: 120,
              align: 'right',
              render: (_, row) => {
                if (row.target === 0) return <span style={{ color: '#bfbfbf' }}>—</span>;
                const rate = row.sales / row.target;
                return (
                  <Tag color={rate >= 1 ? 'green' : 'red'} className="tabular">
                    {(rate * 100).toFixed(1)}%
                  </Tag>
                );
              },
            },
            {
              title: '客数',
              dataIndex: 'guest_count',
              width: 100,
              align: 'right',
              render: (value: number) => <span className="tabular">{value}</span>,
            },
            {
              title: '組数',
              dataIndex: 'group_count',
              width: 100,
              align: 'right',
              render: (value: number) => <span className="tabular">{value}</span>,
            },
            {
              title: '客単価',
              key: 'avg',
              width: 120,
              align: 'right',
              render: (_, row) => (
                <span className="tabular">
                  ¥{yen.format(row.guest_count > 0 ? Math.round(row.sales / row.guest_count) : 0)}
                </span>
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}

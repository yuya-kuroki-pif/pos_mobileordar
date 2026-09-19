'use client';

import { DownloadOutlined } from '@ant-design/icons';
import { Button, Card, Col, DatePicker, Radio, Row, Statistic, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { PageHeader } from '@/components/PageHeader';
import { CHART_COLORS } from '@/styles/theme';

const yen = new Intl.NumberFormat('ja-JP');

export interface PlRow {
  shop_id: string;
  shop_name: string;
  sales: number;
  sales_target: number;
  food_cost: number;
  drink_cost: number;
  labor: number;
  sga: number;
}

/**
 * 月次 PL（仕様書 §6.2）。
 *
 * 原価は仕入れ登録の実績を使い、未登録なら目標の金額で埋める。
 * 人件費は勤怠の取り込みがまだなので目標の金額を使う。
 */
export function MonthlyPlView({
  yearMonth,
  rows,
  companyName,
}: {
  yearMonth: string;
  rows: PlRow[];
  companyName: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<'amount' | 'ratio'>('amount');

  const totals = rows.reduce(
    (acc, r) => ({
      sales: acc.sales + r.sales,
      target: acc.target + r.sales_target,
      cost: acc.cost + r.food_cost + r.drink_cost,
      labor: acc.labor + r.labor,
      sga: acc.sga + r.sga,
    }),
    { sales: 0, target: 0, cost: 0, labor: 0, sga: 0 }
  );

  const profit = totals.sales - totals.cost - totals.labor - totals.sga;
  const grossProfit = totals.sales - totals.cost;
  const targetProfit = totals.target - totals.cost - totals.labor - totals.sga;

  const chart = rows.map((row) => {
    const rowProfit = row.sales - row.food_cost - row.drink_cost - row.labor - row.sga;
    const base = mode === 'ratio' && row.sales > 0 ? row.sales / 100 : 1;

    return {
      name: row.shop_name,
      売上原価: Math.round((row.food_cost + row.drink_cost) / base),
      人件費: Math.round(row.labor / base),
      販売管理費: Math.round(row.sga / base),
      営業利益: Math.round(rowProfit / base),
    };
  });

  function downloadCsv() {
    const header = ['店舗', '売上', '売上目標', '原価', '人件費', '販売管理費', '営業利益'];
    const body = rows.map((row) =>
      [
        row.shop_name,
        row.sales,
        row.sales_target,
        row.food_cost + row.drink_cost,
        row.labor,
        row.sga,
        row.sales - row.food_cost - row.drink_cost - row.labor - row.sga,
      ].join(',')
    );

    const blob = new Blob(['\ufeff' + [header.join(','), ...body].join('\r\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pl-${yearMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        title="月次 PL"
        description="店舗ごとの損益を並べます"
        breadcrumb={[{ label: companyName }, { label: '経営管理' }, { label: '月次 PL' }]}
        extra={
          <>
            <DatePicker
              picker="month"
              value={dayjs(yearMonth)}
              allowClear={false}
              style={{ marginRight: 8 }}
              onChange={(value) => router.push(`/bi/monthlyPl?month=${value.format('YYYY-MM')}`)}
            />
            <Button icon={<DownloadOutlined />} onClick={downloadCsv}>
              CSV
            </Button>
          </>
        }
      />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="営業利益"
              value={profit}
              prefix="¥"
              valueStyle={{ color: profit < 0 ? '#f5222d' : undefined }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="粗利益" value={grossProfit} prefix="¥" />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="営業利益率"
              value={totals.sales > 0 ? (profit / totals.sales) * 100 : 0}
              precision={1}
              suffix="%"
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="予実差異" value={profit - targetProfit} prefix="¥" />
            <Tag color={profit >= targetProfit ? 'green' : 'red'}>
              {profit >= targetProfit ? '達成' : '未達'}
            </Tag>
          </Card>
        </Col>
      </Row>

      <Card
        title="収支の内訳"
        style={{ marginBottom: 16 }}
        extra={
          <Radio.Group
            value={mode}
            optionType="button"
            size="small"
            onChange={(e) => setMode(e.target.value as typeof mode)}
            options={[
              { value: 'amount', label: '金額' },
              { value: 'ratio', label: '構成比' },
            ]}
          />
        }
      >
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value: number) =>
                mode === 'ratio'
                  ? `${value}%`
                  : value >= 10000
                    ? `${Math.round(value / 10000)}万`
                    : String(value)
              }
            />
            <Tooltip
              formatter={(value: number) =>
                mode === 'ratio' ? `${value}%` : `¥${yen.format(value)}`
              }
              contentStyle={{ fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="売上原価" stackId="a" fill={CHART_COLORS.secondary} />
            <Bar dataKey="人件費" stackId="a" fill={CHART_COLORS.quaternary} />
            <Bar dataKey="販売管理費" stackId="a" fill={CHART_COLORS.muted} />
            <Bar dataKey="営業利益" stackId="a" fill={CHART_COLORS.tertiary} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card title="損益計算書" styles={{ body: { padding: 0 } }}>
        <Table<PlRow>
          rowKey="shop_id"
          dataSource={rows}
          size="middle"
          scroll={{ x: 'max-content' }}
          pagination={false}
          columns={[
            { title: '店舗', dataIndex: 'shop_name', width: 200, fixed: 'left' },
            {
              title: '売上',
              dataIndex: 'sales',
              width: 140,
              align: 'right',
              render: (value: number) => <span className="tabular">¥{yen.format(value)}</span>,
            },
            {
              title: '売上目標',
              dataIndex: 'sales_target',
              width: 140,
              align: 'right',
              render: (value: number) => <span className="tabular">¥{yen.format(value)}</span>,
            },
            {
              title: '達成率',
              key: 'rate',
              width: 100,
              align: 'right',
              render: (_, row) =>
                row.sales_target > 0 ? (
                  <Tag color={row.sales >= row.sales_target ? 'green' : 'red'} className="tabular">
                    {((row.sales / row.sales_target) * 100).toFixed(1)}%
                  </Tag>
                ) : (
                  <span style={{ color: '#bfbfbf' }}>—</span>
                ),
            },
            {
              title: '売上原価',
              key: 'cost',
              width: 140,
              align: 'right',
              render: (_, row) => (
                <span className="tabular">¥{yen.format(row.food_cost + row.drink_cost)}</span>
              ),
            },
            {
              title: '人件費',
              dataIndex: 'labor',
              width: 140,
              align: 'right',
              render: (value: number) => <span className="tabular">¥{yen.format(value)}</span>,
            },
            {
              title: '販売管理費',
              dataIndex: 'sga',
              width: 140,
              align: 'right',
              render: (value: number) => <span className="tabular">¥{yen.format(value)}</span>,
            },
            {
              title: '営業利益',
              key: 'profit',
              width: 150,
              align: 'right',
              render: (_, row) => {
                const value = row.sales - row.food_cost - row.drink_cost - row.labor - row.sga;
                return (
                  <span className="tabular" style={{ color: value < 0 ? '#f5222d' : undefined }}>
                    ¥{yen.format(value)}
                  </span>
                );
              },
            },
          ]}
        />
      </Card>
    </>
  );
}

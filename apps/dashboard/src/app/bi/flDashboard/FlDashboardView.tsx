'use client';

import { Card, Col, DatePicker, Progress, Row, Statistic, Table, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';

import { SalesChart } from '@/components/charts/SalesChart';
import { PageHeader } from '@/components/PageHeader';
import type { DailySummary } from '@/lib/types';

const yen = new Intl.NumberFormat('ja-JP');
const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

export interface FlRow {
  shop_id: string;
  shop_name: string;
  sales: number;
  guest_count: number;
  group_count: number;
  sales_target: number;
  food_cost_target: number;
  drink_cost_target: number;
  labor_target: number;
  sga_target: number;
}

/**
 * 店舗管理ダッシュボード（仕様書 §6.1）。
 *
 * 原価と人件費は、いまのところ目標設定で入れた金額を実績の代わりに使う。
 * 仕入れ登録と勤怠の取り込みが揃ったら、そちらの実績へ差し替える。
 */
export function FlDashboardView({
  yearMonth,
  daily,
  rows,
  companyName,
}: {
  yearMonth: string;
  daily: DailySummary[];
  rows: FlRow[];
  companyName: string;
}) {
  const router = useRouter();

  const sales = rows.reduce((sum, r) => sum + r.sales, 0);
  const target = rows.reduce((sum, r) => sum + r.sales_target, 0);
  const guests = rows.reduce((sum, r) => sum + r.guest_count, 0);
  const cost = rows.reduce((sum, r) => sum + r.food_cost_target + r.drink_cost_target, 0);
  const labor = rows.reduce((sum, r) => sum + r.labor_target, 0);
  const sga = rows.reduce((sum, r) => sum + r.sga_target, 0);
  const profit = sales - cost - labor - sga;

  // 今日までのペースで見た達成率（月の途中でも見られるように）
  const today = dayjs().format('YYYY-MM-DD');
  const elapsed = daily.filter((d) => d.business_date <= today).length;
  const paceTarget = daily.length > 0 ? (target * elapsed) / daily.length : 0;

  const chart = daily.map((d) => ({
    label: dayjs(d.business_date).format('D'),
    sales: d.sales,
    target: d.target > 0 ? d.target : undefined,
  }));

  return (
    <>
      <PageHeader
        title="店舗管理ダッシュボード"
        description="売上・原価・人件費・営業利益を、当月の目標と並べて見ます"
        breadcrumb={[{ label: companyName }, { label: '経営管理' }, { label: '店舗管理ダッシュボード' }]}
        extra={
          <DatePicker
            picker="month"
            value={dayjs(yearMonth)}
            allowClear={false}
            onChange={(value) => router.push(`/bi/flDashboard?month=${value.format('YYYY-MM')}`)}
          />
        }
      />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} md={12}>
          <Card>
            <Statistic title="売上" value={sales} prefix="¥" />
            <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
              客単価 ¥{yen.format(guests > 0 ? Math.round(sales / guests) : 0)} / 客数{' '}
              {yen.format(guests)} 人
            </Typography.Paragraph>

            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              本日時点達成率
            </Typography.Text>
            <Progress
              percent={paceTarget > 0 ? Math.round((sales / paceTarget) * 100) : 0}
              strokeColor={sales >= paceTarget ? '#52c41a' : '#fa8c16'}
            />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              月次目標
            </Typography.Text>
            <Progress percent={target > 0 ? Math.round((sales / target) * 100) : 0} />
          </Card>
        </Col>

        <Col xs={8} md={4}>
          <Card>
            <Statistic
              title="原価率"
              value={sales > 0 ? (cost / sales) * 100 : 0}
              precision={1}
              suffix="%"
            />
          </Card>
        </Col>
        <Col xs={8} md={4}>
          <Card>
            <Statistic
              title="人件費率"
              value={sales > 0 ? (labor / sales) * 100 : 0}
              precision={1}
              suffix="%"
            />
          </Card>
        </Col>
        <Col xs={8} md={4}>
          <Card>
            <Statistic title="営業利益" value={profit} prefix="¥" />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {sales > 0 ? pct(profit / sales) : '—'}
            </Typography.Text>
          </Card>
        </Col>
      </Row>

      <Card title="日別の売上" style={{ marginBottom: 16 }}>
        <SalesChart data={chart} />
      </Card>

      <Card title="店舗別 KPI" styles={{ body: { padding: 0 } }}>
        <Table<FlRow>
          rowKey="shop_id"
          dataSource={rows}
          size="middle"
          scroll={{ x: 'max-content' }}
          pagination={false}
          columns={[
            { title: '店舗名', dataIndex: 'shop_name', width: 220, fixed: 'left' },
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
              width: 110,
              align: 'right',
              render: (_, row) => {
                if (row.sales_target === 0) return <span style={{ color: '#bfbfbf' }}>—</span>;
                const rate = row.sales / row.sales_target;
                return (
                  <Tag color={rate >= 1 ? 'green' : 'red'} className="tabular">
                    {pct(rate)}
                  </Tag>
                );
              },
            },
            {
              title: '原価率',
              key: 'cost',
              width: 100,
              align: 'right',
              render: (_, row) => (
                <span className="tabular">
                  {row.sales > 0
                    ? pct((row.food_cost_target + row.drink_cost_target) / row.sales)
                    : '—'}
                </span>
              ),
            },
            {
              title: '人件費率',
              key: 'labor',
              width: 110,
              align: 'right',
              render: (_, row) => (
                <span className="tabular">
                  {row.sales > 0 ? pct(row.labor_target / row.sales) : '—'}
                </span>
              ),
            },
            {
              title: '営業利益',
              key: 'profit',
              width: 140,
              align: 'right',
              render: (_, row) => {
                const value =
                  row.sales -
                  row.food_cost_target -
                  row.drink_cost_target -
                  row.labor_target -
                  row.sga_target;
                return (
                  <span className="tabular" style={{ color: value < 0 ? '#f5222d' : undefined }}>
                    ¥{yen.format(value)}
                  </span>
                );
              },
            },
            {
              title: '客数',
              dataIndex: 'guest_count',
              width: 100,
              align: 'right',
              render: (value: number) => <span className="tabular">{yen.format(value)}</span>,
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

      <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
        原価と人件費は、いまは目標設定で入れた金額を実績の代わりに使っています。
        仕入れ登録と勤怠の取り込みが揃ったら、そちらの実績に差し替えます。
      </Typography.Paragraph>
    </>
  );
}

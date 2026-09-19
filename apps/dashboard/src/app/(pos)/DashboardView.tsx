'use client';

import { Card, Col, DatePicker, Row, Statistic, Table, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';

import { SalesChart } from '@/components/charts/SalesChart';
import { PageHeader } from '@/components/PageHeader';
import type { DailySummary, MenuSummary } from '@/lib/types';

const yen = new Intl.NumberFormat('ja-JP');

interface ShopRow {
  shop_id: string;
  shop_name: string;
  sales: number;
  guest_count: number;
  group_count: number;
}

/** ダッシュボード（仕様書 §5.1）。当月の売上と、店舗・商品の並びを一望する */
export function DashboardView({
  companyName,
  yearMonth,
  daily,
  byShop,
  topMenus,
  accountName,
  roleName,
}: {
  companyName: string;
  yearMonth: string;
  daily: DailySummary[];
  byShop: ShopRow[];
  topMenus: MenuSummary[];
  accountName: string;
  roleName: string | null;
}) {
  const router = useRouter();

  const sales = daily.reduce((sum, d) => sum + d.sales, 0);
  const guests = daily.reduce((sum, d) => sum + d.guest_count, 0);
  const groups = daily.reduce((sum, d) => sum + d.group_count, 0);
  const average = guests > 0 ? Math.round(sales / guests) : 0;

  // 売上のあった日だけで平均を出す（休業日に引っ張られないように）
  const openDays = daily.filter((d) => d.sales > 0).length;
  const dailyAverage = openDays > 0 ? Math.round(sales / openDays) : 0;

  const chart = daily.map((d) => ({
    label: dayjs(d.business_date).format('D'),
    sales: d.sales,
    target: d.target > 0 ? d.target : undefined,
  }));

  return (
    <>
      <PageHeader
        title="ダッシュボード"
        description={`${accountName} さん（${roleName ?? '権限未設定'}）`}
        breadcrumb={[{ label: companyName }, { label: 'ダッシュボード' }]}
        extra={
          <DatePicker
            picker="month"
            value={dayjs(yearMonth)}
            allowClear={false}
            onChange={(value) => router.push(`/?month=${value.format('YYYY-MM')}`)}
          />
        }
      />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="当月売上" value={sales} prefix="¥" />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="客数" value={guests} suffix="人" />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="客単価" value={average} prefix="¥" />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="1 日あたり売上" value={dailyAverage} prefix="¥" />
          </Card>
        </Col>
      </Row>

      <Card title="日別の売上" style={{ marginBottom: 16 }}>
        <SalesChart data={chart} />
      </Card>

      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <Card title="店舗別" styles={{ body: { padding: 0 } }} style={{ marginBottom: 16 }}>
            <Table<ShopRow>
              rowKey="shop_id"
              dataSource={byShop}
              size="small"
              pagination={false}
              columns={[
                { title: '店舗名', dataIndex: 'shop_name' },
                {
                  title: '売上',
                  dataIndex: 'sales',
                  align: 'right',
                  render: (value: number) => <span className="tabular">¥{yen.format(value)}</span>,
                },
                {
                  title: '客数',
                  dataIndex: 'guest_count',
                  align: 'right',
                  render: (value: number) => <span className="tabular">{value}</span>,
                },
                {
                  title: '客単価',
                  key: 'avg',
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
        </Col>

        <Col xs={24} lg={12}>
          <Card title="売れ筋メニュー（上位 10 品）" styles={{ body: { padding: 0 } }}>
            <Table<MenuSummary>
              rowKey={(row) => row.menu_id ?? row.name}
              dataSource={topMenus}
              size="small"
              pagination={false}
              columns={[
                {
                  title: '#',
                  key: 'rank',
                  width: 50,
                  render: (_, __, index) => <span className="tabular">{index + 1}</span>,
                },
                { title: 'メニュー名', dataIndex: 'name' },
                {
                  title: 'カテゴリ',
                  dataIndex: 'category_name',
                  render: (value: string | null) =>
                    value ? <Tag>{value}</Tag> : <span style={{ color: '#bfbfbf' }}>—</span>,
                },
                {
                  title: '出数',
                  dataIndex: 'qty',
                  align: 'right',
                  render: (value: number) => <span className="tabular">{value}</span>,
                },
                {
                  title: '売上',
                  dataIndex: 'sales',
                  align: 'right',
                  render: (value: number) => <span className="tabular">¥{yen.format(value)}</span>,
                },
              ]}
            />
          </Card>
        </Col>
      </Row>

      <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
        売上は会計の合計です。目標を入れると、グラフに破線で重なります（経営管理 → 目標設定）。
      </Typography.Paragraph>
    </>
  );
}

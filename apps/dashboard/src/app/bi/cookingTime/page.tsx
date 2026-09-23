import { Alert, Card, Col, Row, Space, Statistic } from 'antd';

import { DataTable, TableNote, type DataRow } from '@/components/DataTable';
import { MonthPicker } from '@/components/MonthPicker';
import { PageHeader } from '@/components/PageHeader';
import { ShopPicker } from '@/components/ShopPicker';
import { getCookingTimes, monthRange } from '@/lib/analyticsQueries';
import { requireSession } from '@/lib/auth';
import { getCategoryRows } from '@/lib/menuQueries';

export const dynamic = 'force-dynamic';
export const metadata = { title: '調理・配膳時間分析' };

/** 調理・配膳時間分析（仕様書 §6.9）。KDS の打刻が入っている店舗だけ数字が出る */
export default async function CookingTimePage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string; month?: string }>;
}) {
  const session = await requireSession();
  const { shop, month } = await searchParams;

  const shops = session.shops.filter((s) => s.company_id === session.currentCompanyId);
  const target = shops.find((s) => s.id === shop);
  const scope = target ? [target.id] : shops.map((s) => s.id);
  const yearMonth = month ?? new Date().toISOString().slice(0, 7);

  // メニュー → カテゴリ名。1 メニューが複数カテゴリに居るときは先頭を使う
  const categories = await getCategoryRows(session.currentCompanyId);
  const categoryByMenu = new Map<string, string>();
  for (const category of categories) {
    for (const menuId of category.menu_ids) {
      if (!categoryByMenu.has(menuId)) categoryByMenu.set(menuId, category.name);
    }
  }

  const times = await getCookingTimes(scope, monthRange(yearMonth), categoryByMenu);

  const rows: DataRow[] = times.map((row) => ({
    key: row.menu_id,
    name: row.name,
    category: row.category,
    orders: row.orders,
    cook_min: row.cook_min,
    pickup_min: row.pickup_min,
    serve_min: row.serve_min,
    total_min: row.total_min,
  }));

  const totalOrders = times.reduce((sum, row) => sum + row.orders, 0);
  const weighted = (pick: (row: (typeof times)[number]) => number) =>
    totalOrders === 0
      ? 0
      : Math.round((times.reduce((sum, row) => sum + pick(row) * row.orders, 0) / totalOrders) * 10) / 10;

  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <>
      <PageHeader
        title="調理・配膳時間分析"
        description="注文が入ってからお客様に出すまで、どこに時間がかかっているかを見ます"
        breadcrumb={[{ label: companyName }, { label: '経営管理' }, { label: '調理・配膳時間分析' }]}
        extra={
          <Space>
            <ShopPicker shops={shops} shopId={target?.id} allowAll basePath="/bi/cookingTime" />
            <MonthPicker yearMonth={yearMonth} basePath="/bi/cookingTime" />
          </Space>
        }
      />

      {times.length === 0 && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="この期間の打刻がありません"
          description="この画面は KDS（キッチンディスプレイ）を使っている店舗でだけ数字が出ます。"
        />
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card><Statistic title="対象の注文明細" value={totalOrders} suffix="件" /></Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="平均調理時間" value={weighted((r) => r.cook_min)} suffix="分" precision={1} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="平均受け渡し時間" value={weighted((r) => r.pickup_min)} suffix="分" precision={1} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="平均配膳時間" value={weighted((r) => r.serve_min)} suffix="分" precision={1} />
          </Card>
        </Col>
      </Row>

      <DataTable
        title={`${yearMonth.replace('-', '年')}月`}
        rows={rows}
        pageSize={50}
        emptyText="打刻された注文がありません"
        columns={[
          { title: '商品名', key: 'name', width: 260, fixed: 'left' },
          { title: 'カテゴリ', key: 'category', width: 160 },
          { title: '注文数', key: 'orders', width: 110, align: 'right', format: { type: 'number' } },
          { title: '平均調理時間', key: 'cook_min', width: 140, align: 'right', format: { type: 'unit', unit: '分', digits: 1 } },
          { title: '平均受け渡し時間', key: 'pickup_min', width: 160, align: 'right', format: { type: 'unit', unit: '分', digits: 1 } },
          { title: '平均配膳時間', key: 'serve_min', width: 140, align: 'right', format: { type: 'unit', unit: '分', digits: 1 } },
          { title: '合計', key: 'total_min', width: 120, align: 'right', format: { type: 'unit', unit: '分', digits: 1 } },
        ]}
      />

      <TableNote>
        調理時間 = 注文 → 調理完了、受け渡し時間 = 調理完了 → スタッフが受け取る、
        配膳時間 = 受け取り → お客様にお出しする。単位は分です。
      </TableNote>
    </>
  );
}

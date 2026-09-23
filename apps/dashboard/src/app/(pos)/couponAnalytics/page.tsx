import { Card, Col, Row, Statistic } from 'antd';

import { DataTable, TableNote, type DataRow } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { ShopPicker } from '@/components/ShopPicker';
import { requireSession } from '@/lib/auth';
import { getCoupons } from '@/lib/crmQueries';
import { getCustomerCoupons } from '@/lib/extrasQueries';
import { COUPON_KIND_LABELS } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'クーポン利用分析' };

/** クーポン利用分析（仕様書 §5.32） */
export default async function CouponAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string }>;
}) {
  const session = await requireSession();
  const { shop } = await searchParams;

  const shops = session.shops.filter((s) => s.company_id === session.currentCompanyId);
  const target = shops.find((s) => s.id === shop);

  const coupons = await getCoupons(session.currentCompanyId);
  const issued = await getCustomerCoupons(coupons.map((c) => c.id));

  // 利用実績だけを見る。店舗を選んでいればその店舗で使われたものに絞る
  const used = issued.filter(
    (row) => row.used_at && (!target || row.used_shop_id === target.id)
  );

  const total = {
    used: used.length,
    issued: target
      ? issued.filter((row) => row.used_shop_id === target.id || !row.used_at).length
      : issued.length,
    groups: new Set(used.map((row) => `${row.customer_id}|${row.used_at?.slice(0, 10)}`)).size,
    sales: used.reduce((sum, row) => sum + row.effect_sales, 0),
  };

  const group = <K extends string>(keyOf: (row: (typeof used)[number]) => K, label: (key: K) => string) => {
    const acc = new Map<K, { used: number; sales: number; customers: Set<string> }>();
    for (const row of used) {
      const key = keyOf(row);
      const current = acc.get(key) ?? { used: 0, sales: 0, customers: new Set<string>() };
      current.used += 1;
      current.sales += row.effect_sales;
      current.customers.add(`${row.customer_id}|${row.used_at?.slice(0, 10)}`);
      acc.set(key, current);
    }
    return [...acc.entries()]
      .map(([key, value]): DataRow => ({
        key: String(key),
        label: label(key),
        used: value.used,
        groups: value.customers.size,
        sales: value.sales,
        avg: value.customers.size === 0 ? 0 : Math.round(value.sales / value.customers.size),
      }))
      .sort((a, b) => (b.sales as number) - (a.sales as number));
  };

  const shopName = new Map(shops.map((s) => [s.id, s.name]));
  const couponById = new Map(coupons.map((c) => [c.id, c]));

  const byShop = group(
    (row) => row.used_shop_id ?? '',
    (key) => shopName.get(key) ?? '（店舗不明）'
  );
  const byCoupon = group(
    (row) => row.coupon_id,
    (key) => {
      const coupon = couponById.get(key);
      return coupon ? `${coupon.name}（${COUPON_KIND_LABELS[coupon.kind]}）` : key;
    }
  );

  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  const columns = (first: string) => [
    { title: first, key: 'label', width: 300, fixed: 'left' as const },
    { title: '利用数', key: 'used', width: 110, align: 'right' as const, format: { type: 'number' as const } },
    { title: '来店組客数', key: 'groups', width: 130, align: 'right' as const, format: { type: 'number' as const } },
    { title: 'クーポン効果売上', key: 'sales', width: 170, align: 'right' as const, format: { type: 'money' as const } },
    { title: '組単価', key: 'avg', width: 120, align: 'right' as const, format: { type: 'money' as const } },
  ];

  return (
    <>
      <PageHeader
        title="クーポン利用分析"
        description="配ったクーポンが使われ、いくらの売上につながったかを見ます"
        breadcrumb={[{ label: companyName }, { label: 'アンケート分析' }, { label: 'クーポン利用分析' }]}
        extra={<ShopPicker shops={shops} shopId={target?.id} allowAll basePath="/couponAnalytics" />}
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card><Statistic title="利用数" value={total.used} /></Card>
        </Col>
        <Col xs={12} md={6}>
          <Card><Statistic title="来店組客数" value={total.groups} /></Card>
        </Col>
        <Col xs={12} md={6}>
          <Card><Statistic title="クーポン効果売上" value={total.sales} prefix="¥" /></Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="利用率"
              value={total.issued === 0 ? 0 : Math.round((total.used / total.issued) * 1000) / 10}
              suffix="%"
            />
          </Card>
        </Col>
      </Row>

      <DataTable title="店舗別" rows={byShop} emptyText="クーポンの利用がありません" columns={columns('店舗名')} style={{ marginBottom: 16 }} />
      <DataTable title="クーポン別" rows={byCoupon} emptyText="クーポンの利用がありません" columns={columns('クーポン名')} />

      <TableNote>
        クーポン効果売上は、クーポンが使われた会計の金額の合計です。クーポン分の値引き額ではありません。
      </TableNote>
    </>
  );
}

import { Card, Col, Row, Statistic } from 'antd';

import { DataTable, TableNote, type DataRow } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { ShopPicker } from '@/components/ShopPicker';
import { requireSession } from '@/lib/auth';
import { getMessageDeliveries } from '@/lib/crmQueries';
import { getDeliveryJobs } from '@/lib/extrasQueries';
import { CHANNEL_LABELS } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'メッセージ配信分析' };

const pct = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10);

/** メッセージ配信分析（仕様書 §5.32） */
export default async function MessageDeliveryAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string }>;
}) {
  const session = await requireSession();
  const { shop } = await searchParams;

  const shops = session.shops.filter((s) => s.company_id === session.currentCompanyId);
  const target = shops.find((s) => s.id === shop);
  const scope = target ? [target.id] : shops.map((s) => s.id);

  const [deliveries, jobs] = await Promise.all([
    getMessageDeliveries(session.currentCompanyId),
    getDeliveryJobs(scope),
  ]);

  const deliveryById = new Map(deliveries.map((d) => [d.id, d]));
  // 業態をまたいだ配信が混ざらないよう、この業態の配信だけ見る
  const mine = jobs.filter((job) => deliveryById.has(job.delivery_id));

  const total = mine.reduce(
    (sum, job) => ({
      sent: sum.sent + job.sent_count,
      opened: sum.opened + job.opened_count,
      visited: sum.visited + job.visited_count,
      groups: sum.groups + job.visited_group_count,
      sales: sum.sales + job.effect_sales,
    }),
    { sent: 0, opened: 0, visited: 0, groups: 0, sales: 0 }
  );

  const sum = <K extends string>(keyOf: (job: (typeof mine)[number]) => K, label: (key: K) => string) => {
    const acc = new Map<K, { sent: number; opened: number; visited: number; groups: number; sales: number }>();
    for (const job of mine) {
      const key = keyOf(job);
      const current = acc.get(key) ?? { sent: 0, opened: 0, visited: 0, groups: 0, sales: 0 };
      acc.set(key, {
        sent: current.sent + job.sent_count,
        opened: current.opened + job.opened_count,
        visited: current.visited + job.visited_count,
        groups: current.groups + job.visited_group_count,
        sales: current.sales + job.effect_sales,
      });
    }
    return [...acc.entries()]
      .map(([key, value]): DataRow => ({
        key: String(key),
        label: label(key),
        sent: value.sent,
        opened: value.opened,
        open_rate: pct(value.opened, value.sent),
        visited: value.visited,
        visit_rate: pct(value.visited, value.sent),
        groups: value.groups,
        sales: value.sales,
      }))
      .sort((a, b) => (b.sales as number) - (a.sales as number));
  };

  const shopName = new Map(shops.map((s) => [s.id, s.name]));
  const byShop = sum(
    (job) => job.shop_id ?? '',
    (key) => shopName.get(key) ?? '（店舗不明）'
  );
  const byDelivery = sum(
    (job) => job.delivery_id,
    (key) => {
      const delivery = deliveryById.get(key);
      return delivery ? `${delivery.name}（${CHANNEL_LABELS[delivery.channel]}）` : key;
    }
  );

  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  const columns = (first: string) => [
    { title: first, key: 'label', width: 300, fixed: 'left' as const },
    { title: '配信数', key: 'sent', width: 110, align: 'right' as const, format: { type: 'number' as const } },
    { title: '開封数', key: 'opened', width: 110, align: 'right' as const, format: { type: 'number' as const } },
    { title: '開封率', key: 'open_rate', width: 100, align: 'right' as const, format: { type: 'percent' as const, digits: 1 } },
    { title: '来店客数', key: 'visited', width: 110, align: 'right' as const, format: { type: 'number' as const } },
    { title: '来店率', key: 'visit_rate', width: 100, align: 'right' as const, format: { type: 'percent' as const, digits: 1 } },
    { title: '来店組数', key: 'groups', width: 110, align: 'right' as const, format: { type: 'number' as const } },
    { title: '配信効果売上', key: 'sales', width: 150, align: 'right' as const, format: { type: 'money' as const } },
  ];

  return (
    <>
      <PageHeader
        title="メッセージ配信分析"
        description="配信が開封され、来店につながったかを見ます"
        breadcrumb={[{ label: companyName }, { label: 'アンケート分析' }, { label: 'メッセージ配信分析' }]}
        extra={<ShopPicker shops={shops} shopId={target?.id} allowAll basePath="/messageDeliveryAnalytics" />}
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={8} lg={5}>
          <Card><Statistic title="配信数" value={total.sent} /></Card>
        </Col>
        <Col xs={12} md={8} lg={5}>
          <Card>
            <Statistic title="開封数" value={total.opened} suffix={`（${pct(total.opened, total.sent)}%）`} />
          </Card>
        </Col>
        <Col xs={12} md={8} lg={5}>
          <Card>
            <Statistic title="来店客数" value={total.visited} suffix={`（${pct(total.visited, total.sent)}%）`} />
          </Card>
        </Col>
        <Col xs={12} md={8} lg={4}>
          <Card><Statistic title="来店組数" value={total.groups} /></Card>
        </Col>
        <Col xs={24} md={8} lg={5}>
          <Card><Statistic title="配信効果売上" value={total.sales} prefix="¥" /></Card>
        </Col>
      </Row>

      <DataTable title="店舗別" rows={byShop} emptyText="配信の実績がありません" columns={columns('店舗名')} style={{ marginBottom: 16 }} />
      <DataTable title="メッセージ別" rows={byDelivery} emptyText="配信の実績がありません" columns={columns('配信管理名')} />

      <TableNote>
        来店は、配信を開封したお客様がその後 7 日以内に来店したものを数えています。
        配信効果売上は、その来店の会計金額の合計です。
      </TableNote>
    </>
  );
}

import { Space } from 'antd';
import dayjs from 'dayjs';

import { MonthPicker } from '@/components/MonthPicker';
import { PageHeader } from '@/components/PageHeader';
import { PlTreeTable } from '@/components/PlTreeTable';
import { ShopPicker } from '@/components/ShopPicker';
import { monthRange } from '@/lib/analyticsQueries';
import { requireSession } from '@/lib/auth';
import { loadPlTree } from '@/lib/plPage';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'PL 店舗 月別' };

/** 店舗 月別 PL（仕様書 §6.2）。1 店舗を 12 ヶ月ぶん横に並べる */
export default async function MonthlyPlShopPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string; month?: string }>;
}) {
  const session = await requireSession();
  const { shop, month } = await searchParams;

  const shops = session.shops.filter((s) => s.company_id === session.currentCompanyId);
  const target = shops.find((s) => s.id === shop) ?? shops[0];
  const last = dayjs(`${month ?? new Date().toISOString().slice(0, 7)}-01`);

  // 選んだ月を右端にして、そこから 12 ヶ月さかのぼる
  const months = Array.from({ length: 12 }, (_, i) => last.subtract(11 - i, 'month'));
  const columns = months.map((m) => ({ key: m.format('YYYY-MM'), label: m.format('YYYY/MM') }));

  const { nodes } = target
    ? await loadPlTree({
        corporationId: session.corporation.id,
        columns,
        slices: months.map((m) => ({
          column: m.format('YYYY-MM'),
          shopIds: [target.id],
          range: monthRange(m.format('YYYY-MM')),
        })),
      })
    : { nodes: [] };

  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <>
      <PageHeader
        title="PL 店舗 月別"
        description="1 店舗の損益を月ごとに並べます"
        breadcrumb={[
          { label: companyName },
          { label: '経営管理' },
          { label: 'PL', href: '/bi/monthlyPl' },
          { label: '店舗 月別' },
        ]}
        extra={
          <Space>
            <ShopPicker shops={shops} shopId={target?.id} basePath="/bi/monthlyPlShop" />
            <MonthPicker yearMonth={last.format('YYYY-MM')} basePath="/bi/monthlyPlShop" />
          </Space>
        }
      />

      <PlTreeTable
        title={target?.name ?? '店舗がありません'}
        nodes={nodes}
        columns={columns}
        csvName={`monthlyPlShop_${target?.id ?? 'none'}.csv`}
      />
    </>
  );
}

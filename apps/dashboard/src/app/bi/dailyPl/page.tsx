import { Space } from 'antd';
import dayjs from 'dayjs';

import { MonthPicker } from '@/components/MonthPicker';
import { PageHeader } from '@/components/PageHeader';
import { PlTreeTable } from '@/components/PlTreeTable';
import { ShopPicker } from '@/components/ShopPicker';
import { requireSession } from '@/lib/auth';
import { loadPlTree } from '@/lib/plPage';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'PL 店舗 日別' };

/** 店舗 日別 PL（仕様書 §6.2）。1 店舗を 1 ヶ月ぶん、日ごとに横に並べる */
export default async function DailyPlPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string; month?: string }>;
}) {
  const session = await requireSession();
  const { shop, month } = await searchParams;

  const shops = session.shops.filter((s) => s.company_id === session.currentCompanyId);
  const target = shops.find((s) => s.id === shop) ?? shops[0];
  const yearMonth = month ?? new Date().toISOString().slice(0, 7);
  const first = dayjs(`${yearMonth}-01`);

  const days = Array.from({ length: first.daysInMonth() }, (_, i) => first.add(i, 'day'));
  // dayjs の既定は英語の曜日なので、他の画面に合わせて日本語で出す
  const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
  const columns = days.map((d) => ({
    key: d.format('YYYY-MM-DD'),
    label: `${d.date()}(${WEEKDAYS[d.day()]})`,
  }));

  const { nodes } = target
    ? await loadPlTree({
        corporationId: session.corporation.id,
        columns,
        slices: days.map((d) => ({
          column: d.format('YYYY-MM-DD'),
          shopIds: [target.id],
          range: { from: d.format('YYYY-MM-DD'), to: d.format('YYYY-MM-DD') },
        })),
      })
    : { nodes: [] };

  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <>
      <PageHeader
        title="PL 店舗 日別"
        description="1 店舗の損益を日ごとに並べます"
        breadcrumb={[
          { label: companyName },
          { label: '経営管理' },
          { label: 'PL', href: '/bi/monthlyPl' },
          { label: '店舗 日別' },
        ]}
        extra={
          <Space>
            <ShopPicker shops={shops} shopId={target?.id} basePath="/bi/dailyPl" />
            <MonthPicker yearMonth={yearMonth} basePath="/bi/dailyPl" />
          </Space>
        }
      />

      <PlTreeTable
        title={`${target?.name ?? '店舗がありません'} — ${yearMonth.replace('-', '年')}月`}
        nodes={nodes}
        columns={columns}
        csvName={`dailyPl_${target?.id ?? 'none'}_${yearMonth}.csv`}
      />
    </>
  );
}

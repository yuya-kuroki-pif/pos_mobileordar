import { PageHeader } from '@/components/PageHeader';
import { ShopPicker } from '@/components/ShopPicker';
import { requireSession } from '@/lib/auth';
import { getDailySummaries, monthRange } from '@/lib/analyticsQueries';

import { SalesCalendar } from './SalesCalendar';

export const dynamic = 'force-dynamic';
export const metadata = { title: '営業カレンダー' };

/** 営業カレンダー（仕様書 §6.1）。1 ヶ月ぶんの売上を日めくりで見る */
export default async function SalesCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string; month?: string }>;
}) {
  const session = await requireSession();
  const { shop, month } = await searchParams;

  const shops = session.shops.filter((s) => s.company_id === session.currentCompanyId);
  const target = shops.find((s) => s.id === shop) ?? shops[0];
  const yearMonth = month ?? new Date().toISOString().slice(0, 7);

  const days = target
    ? await getDailySummaries([target.id], monthRange(yearMonth))
    : [];

  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <>
      <PageHeader
        title="営業カレンダー"
        description="1 日ごとの売上と目標達成率をカレンダーで見ます"
        breadcrumb={[{ label: companyName }, { label: '経営管理' }, { label: '営業カレンダー' }]}
        extra={<ShopPicker shops={shops} shopId={target?.id} basePath="/bi/salesCalendar" />}
      />

      <SalesCalendar
        yearMonth={yearMonth}
        shopName={target?.name ?? ''}
        days={days.map((day) => ({
          date: day.business_date,
          sales: day.sales,
          target: day.target,
          guests: day.guest_count,
          groups: day.group_count,
        }))}
      />
    </>
  );
}

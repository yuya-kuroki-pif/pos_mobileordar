import { requireSession } from '@/lib/auth';
import { getDailySummaries, monthRange } from '@/lib/analyticsQueries';

import { SalesAnalyticsView } from './SalesAnalyticsView';

export const dynamic = 'force-dynamic';
export const metadata = { title: '売上分析' };

/** 売上分析（仕様書 §6.4） */
export default async function SalesAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string; month?: string }>;
}) {
  const session = await requireSession();
  const { shop, month } = await searchParams;

  const yearMonth = month ?? new Date().toISOString().slice(0, 7);
  const shops = session.shops.filter((s) => s.company_id === session.currentCompanyId);
  const shopIds = shop ? [shop] : shops.map((s) => s.id);

  const daily = await getDailySummaries(shopIds, monthRange(yearMonth));
  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <SalesAnalyticsView
      daily={daily}
      shops={shops}
      shopId={shop}
      yearMonth={yearMonth}
      companyName={companyName}
    />
  );
}

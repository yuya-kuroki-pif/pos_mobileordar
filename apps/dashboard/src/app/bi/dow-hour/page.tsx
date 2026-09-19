import { requireSession } from '@/lib/auth';
import { getHourlySummaries, monthRange } from '@/lib/analyticsQueries';

import { DowHourView } from './DowHourView';

export const dynamic = 'force-dynamic';
export const metadata = { title: '曜日・時間帯別' };

/** 曜日・時間別分析（仕様書 §6.9） */
export default async function DowHourPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string; month?: string }>;
}) {
  const session = await requireSession();
  const { shop, month } = await searchParams;

  const yearMonth = month ?? new Date().toISOString().slice(0, 7);
  const shops = session.shops.filter((s) => s.company_id === session.currentCompanyId);
  const shopIds = shop ? [shop] : shops.map((s) => s.id);

  const hourly = await getHourlySummaries(shopIds, monthRange(yearMonth));
  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <DowHourView
      hourly={hourly}
      shops={shops}
      shopId={shop}
      yearMonth={yearMonth}
      companyName={companyName}
    />
  );
}

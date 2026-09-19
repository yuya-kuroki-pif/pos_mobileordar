import { requireSession } from '@/lib/auth';
import { getDailySummaries, monthRange } from '@/lib/analyticsQueries';
import { getKpiTargets } from '@/lib/biQueries';

import { ForecastView } from './ForecastView';

export const dynamic = 'force-dynamic';
export const metadata = { title: '売上予測' };

/** 売上予測（仕様書 §6.9） */
export default async function ForecastPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await requireSession();
  const { month } = await searchParams;

  const yearMonth = month ?? new Date().toISOString().slice(0, 7);
  const range = monthRange(yearMonth);
  const today = new Date().toISOString().slice(0, 10);

  const shops = session.shops.filter((s) => s.company_id === session.currentCompanyId);
  const targets = await getKpiTargets(shops.map((s) => s.id), yearMonth);

  // 店舗ごとに、曜日別の平均から残り日数ぶんを見込む
  const rows = await Promise.all(
    shops.map(async (shop) => {
      const daily = await getDailySummaries([shop.id], range);
      const past = daily.filter((d) => d.business_date <= today);
      const future = daily.filter((d) => d.business_date > today);

      const byWeekday = new Map<number, number[]>();
      for (const day of past) {
        if (day.sales === 0) continue;
        const weekday = new Date(`${day.business_date}T00:00:00+09:00`).getDay();
        byWeekday.set(weekday, [...(byWeekday.get(weekday) ?? []), day.sales]);
      }

      const averageFor = (weekday: number) => {
        const list = byWeekday.get(weekday);
        if (!list || list.length === 0) return 0;
        return list.reduce((sum, v) => sum + v, 0) / list.length;
      };

      const actual = past.reduce((sum, d) => sum + d.sales, 0);
      const expected = future.reduce(
        (sum, d) => sum + averageFor(new Date(`${d.business_date}T00:00:00+09:00`).getDay()),
        0
      );

      return {
        shop_id: shop.id,
        shop_name: shop.name,
        actual,
        forecast: Math.round(actual + expected),
        target: targets.find((t) => t.shop_id === shop.id)?.sales_target ?? 0,
        remaining_days: future.length,
      };
    })
  );

  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return <ForecastView yearMonth={yearMonth} rows={rows} companyName={companyName} />;
}

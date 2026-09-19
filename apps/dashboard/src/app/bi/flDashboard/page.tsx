import { requireSession } from '@/lib/auth';
import { getDailySummaries, getShopSummaries, monthRange } from '@/lib/analyticsQueries';
import { getKpiTargets } from '@/lib/biQueries';

import { FlDashboardView } from './FlDashboardView';

export const dynamic = 'force-dynamic';
export const metadata = { title: '店舗管理ダッシュボード' };

/** 店舗管理ダッシュボード（仕様書 §6.1） */
export default async function FlDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await requireSession();
  const { month } = await searchParams;

  const yearMonth = month ?? new Date().toISOString().slice(0, 7);
  const range = monthRange(yearMonth);

  const shops = session.shops.filter((s) => s.company_id === session.currentCompanyId);
  const shopIds = shops.map((s) => s.id);

  const [daily, byShop, targets] = await Promise.all([
    getDailySummaries(shopIds, range),
    getShopSummaries(shopIds, range),
    getKpiTargets(shopIds, yearMonth),
  ]);

  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <FlDashboardView
      yearMonth={yearMonth}
      daily={daily}
      rows={byShop.map((row) => {
        const target = targets.find((t) => t.shop_id === row.shop_id);
        return {
          ...row,
          shop_name: shops.find((s) => s.id === row.shop_id)?.name ?? row.shop_id,
          sales_target: target?.sales_target ?? 0,
          food_cost_target: target?.food_cost_target ?? 0,
          drink_cost_target: target?.drink_cost_target ?? 0,
          labor_target: target?.labor_target ?? 0,
          sga_target: target?.sga_target ?? 0,
        };
      })}
      companyName={companyName}
    />
  );
}

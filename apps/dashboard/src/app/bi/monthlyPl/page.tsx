import { requireSession } from '@/lib/auth';
import { getShopSummaries, monthRange } from '@/lib/analyticsQueries';
import { getKpiTargets, getPurchases } from '@/lib/biQueries';

import { MonthlyPlView } from './MonthlyPlView';

export const dynamic = 'force-dynamic';
export const metadata = { title: '月次 PL' };

/** 月次 PL（仕様書 §6.2） */
export default async function MonthlyPlPage({
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

  const [summaries, targets, purchases] = await Promise.all([
    getShopSummaries(shopIds, range),
    getKpiTargets(shopIds, yearMonth),
    getPurchases(shopIds, range.from, range.to),
  ]);

  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <MonthlyPlView
      yearMonth={yearMonth}
      rows={shops.map((shop) => {
        const summary = summaries.find((s) => s.shop_id === shop.id);
        const target = targets.find((t) => t.shop_id === shop.id);
        const shopPurchases = purchases.filter((p) => p.shop_id === shop.id);

        return {
          shop_id: shop.id,
          shop_name: shop.name,
          sales: summary?.sales ?? 0,
          sales_target: target?.sales_target ?? 0,
          // 原価は仕入れの実績から拾う。無ければ目標を置く
          food_cost:
            shopPurchases
              .filter((p) => p.product_type === 'food')
              .reduce((sum, p) => sum + p.amount, 0) || (target?.food_cost_target ?? 0),
          drink_cost:
            shopPurchases
              .filter((p) => p.product_type === 'drink')
              .reduce((sum, p) => sum + p.amount, 0) || (target?.drink_cost_target ?? 0),
          labor: target?.labor_target ?? 0,
          sga: target?.sga_target ?? 0,
        };
      })}
      companyName={companyName}
    />
  );
}

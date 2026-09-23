import { requireSession } from '@/lib/auth';
import { getShopSummaries, monthRange } from '@/lib/analyticsQueries';
import { getKpiTargets, getPurchases } from '@/lib/biQueries';
import { loadPlTree } from '@/lib/plPage';

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

  // 損益計算書は店舗を列にした科目ツリー（§6.2）
  const plColumns = shops.map((shop) => ({ key: shop.id, label: shop.name }));

  const [summaries, targets, purchases, plTree] = await Promise.all([
    getShopSummaries(shopIds, range),
    getKpiTargets(shopIds, yearMonth),
    getPurchases(shopIds, range.from, range.to),
    loadPlTree({
      corporationId: session.corporation.id,
      columns: plColumns,
      slices: shops.map((shop) => ({ column: shop.id, shopIds: [shop.id], range })),
    }),
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
      plNodes={plTree.nodes}
      plColumns={plColumns}
    />
  );
}

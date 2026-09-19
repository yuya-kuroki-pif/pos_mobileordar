import { requireSession } from '@/lib/auth';
import { getDailySummaries, monthRange } from '@/lib/analyticsQueries';
import { getDailyTargetRows, getKpiTargets } from '@/lib/biQueries';
import { canEdit } from '@/lib/permissions';

import { KpiTargetView } from './KpiTargetView';

export const dynamic = 'force-dynamic';
export const metadata = { title: '目標設定' };

/** 目標設定（仕様書 §6.7） */
export default async function KpiTargetPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string; month?: string }>;
}) {
  const session = await requireSession();
  const { shop, month } = await searchParams;

  const yearMonth = month ?? new Date().toISOString().slice(0, 7);
  const shops = session.shops.filter((s) => s.company_id === session.currentCompanyId);
  const currentShop = shops.find((s) => s.id === shop) ?? shops[0];

  const shopIds = currentShop ? [currentShop.id] : [];
  const [targets, dailyTargets, lastMonth] = await Promise.all([
    getKpiTargets(shopIds, yearMonth),
    currentShop ? getDailyTargetRows(currentShop.id, yearMonth) : Promise.resolve([]),
    // 前月の実績を、目標を決めるときの目安にする
    getDailySummaries(
      shopIds,
      monthRange(
        new Date(new Date(`${yearMonth}-01`).setMonth(new Date(`${yearMonth}-01`).getMonth() - 1))
          .toISOString()
          .slice(0, 7)
      )
    ),
  ]);

  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <KpiTargetView
      shops={shops}
      shopId={currentShop?.id}
      yearMonth={yearMonth}
      target={targets[0] ?? null}
      dailyTargets={dailyTargets}
      lastMonthSales={lastMonth.reduce((sum, d) => sum + d.sales, 0)}
      companyName={companyName}
      editable={canEdit(session.permissions, 'target_management')}
    />
  );
}

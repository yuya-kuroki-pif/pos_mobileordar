import { requireSession } from '@/lib/auth';
import {
  getDailySummaries,
  getMenuSummaries,
  getShopSummaries,
  monthRange,
} from '@/lib/analyticsQueries';

import { DashboardView } from './DashboardView';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'ダッシュボード' };

/** ダッシュボード（仕様書 §5.1） */
export default async function DashboardPage({
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

  const [daily, byShop, menus] = await Promise.all([
    getDailySummaries(shopIds, range),
    getShopSummaries(shopIds, range),
    getMenuSummaries(shopIds, range, session.currentCompanyId),
  ]);

  const currentCompany = session.companies.find((c) => c.id === session.currentCompanyId);

  return (
    <DashboardView
      companyName={currentCompany?.name ?? '業態'}
      yearMonth={yearMonth}
      daily={daily}
      byShop={byShop.map((row) => ({
        ...row,
        shop_name: shops.find((s) => s.id === row.shop_id)?.name ?? row.shop_id,
      }))}
      topMenus={menus.slice(0, 10)}
      accountName={session.account.name}
      roleName={session.roleName}
    />
  );
}

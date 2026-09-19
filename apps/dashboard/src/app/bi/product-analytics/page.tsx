import { requireSession } from '@/lib/auth';
import { getMenuSummaries, monthRange } from '@/lib/analyticsQueries';

import { ProductAnalyticsView } from './ProductAnalyticsView';

export const dynamic = 'force-dynamic';
export const metadata = { title: '商品分析' };

/** 商品分析（仕様書 §6.5） */
export default async function ProductAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string; month?: string }>;
}) {
  const session = await requireSession();
  const { shop, month } = await searchParams;

  const yearMonth = month ?? new Date().toISOString().slice(0, 7);
  const shops = session.shops.filter((s) => s.company_id === session.currentCompanyId);
  const shopIds = shop ? [shop] : shops.map((s) => s.id);

  const menus = await getMenuSummaries(shopIds, monthRange(yearMonth), session.currentCompanyId);
  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <ProductAnalyticsView
      menus={menus}
      shops={shops}
      shopId={shop}
      yearMonth={yearMonth}
      companyName={companyName}
    />
  );
}

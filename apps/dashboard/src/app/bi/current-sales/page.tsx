import { requireSession } from '@/lib/auth';
import { getDailySummaries, monthRange } from '@/lib/analyticsQueries';
import { getTableBoard } from '@/lib/tableQueries';

import { CurrentSalesView } from './CurrentSalesView';

export const dynamic = 'force-dynamic';
export const metadata = { title: '売上速報' };

/** 売上速報（仕様書 §6.6） */
export default async function CurrentSalesPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string }>;
}) {
  const session = await requireSession();
  const { shop } = await searchParams;

  const shops = session.shops.filter((s) => s.company_id === session.currentCompanyId);
  const currentShop = shops.find((s) => s.id === shop) ?? shops[0];

  const today = new Date().toISOString().slice(0, 10);
  const yearMonth = today.slice(0, 7);
  const shopIds = currentShop ? [currentShop.id] : [];

  const [monthly, board] = await Promise.all([
    getDailySummaries(shopIds, monthRange(yearMonth)),
    currentShop ? getTableBoard(currentShop.id) : Promise.resolve({ areas: [], tables: [] }),
  ]);

  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <CurrentSalesView
      shops={shops}
      shopId={currentShop?.id}
      today={today}
      monthly={monthly}
      areas={board.areas}
      tables={board.tables}
      companyName={companyName}
    />
  );
}

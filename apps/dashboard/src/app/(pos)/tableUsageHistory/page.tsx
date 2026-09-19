import { requireSession } from '@/lib/auth';
import { getTableUsageRows } from '@/lib/transactionQueries';

import { TableUsageView } from './TableUsageView';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'テーブル利用履歴' };

/** テーブル利用履歴（仕様書 §5.25） */
export default async function TableUsagePage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string; month?: string }>;
}) {
  const session = await requireSession();
  const { shop, month } = await searchParams;

  const shops = session.shops.filter((s) => s.company_id === session.currentCompanyId);
  const currentShop = shops.find((s) => s.id === shop) ?? shops[0];
  const yearMonth = month ?? new Date().toISOString().slice(0, 7);

  const rows = currentShop ? await getTableUsageRows(currentShop.id, yearMonth) : [];
  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <TableUsageView
      rows={rows}
      shops={shops}
      shopId={currentShop?.id}
      yearMonth={yearMonth}
      companyName={companyName}
    />
  );
}

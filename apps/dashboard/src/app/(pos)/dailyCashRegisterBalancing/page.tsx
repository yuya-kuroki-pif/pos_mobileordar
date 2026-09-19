import { requireSession } from '@/lib/auth';
import { getCashClosings } from '@/lib/transactionQueries';

import { ClosingListView } from './ClosingListView';

export const dynamic = 'force-dynamic';
export const metadata = { title: '日次処理一覧' };

/** 日次処理一覧（仕様書 §5.22） */
export default async function ClosingListPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await requireSession();
  const { date } = await searchParams;

  const shops = session.shops.filter((s) => s.company_id === session.currentCompanyId);
  const businessDay = date ?? new Date().toISOString().slice(0, 10);
  const closings = await getCashClosings(shops.map((s) => s.id), businessDay);

  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <ClosingListView
      closings={closings}
      shopNames={Object.fromEntries(shops.map((s) => [s.id, s.name]))}
      businessDay={businessDay}
      companyName={companyName}
    />
  );
}

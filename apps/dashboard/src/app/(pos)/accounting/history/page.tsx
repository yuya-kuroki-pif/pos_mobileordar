import { requireSession } from '@/lib/auth';
import { getPaymentSettings } from '@/lib/paymentQueries';
import { getAccountingRows } from '@/lib/transactionQueries';

import { AccountingListView } from './AccountingListView';

export const dynamic = 'force-dynamic';
export const metadata = { title: '会計履歴一覧' };

/** 会計履歴一覧（仕様書 §5.23） */
export default async function AccountingHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string; date?: string; receipt?: string; method?: string }>;
}) {
  const session = await requireSession();
  const { shop, date, receipt, method } = await searchParams;

  const shops = session.shops.filter((s) => s.company_id === session.currentCompanyId);
  const currentShop = shops.find((s) => s.id === shop) ?? shops[0];
  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  const [rows, settings] = await Promise.all([
    currentShop
      ? getAccountingRows({
          shopId: currentShop.id,
          businessDay: date,
          receiptNumber: receipt,
          methodId: method,
        })
      : Promise.resolve([]),
    getPaymentSettings(session.currentCompanyId),
  ]);

  return (
    <AccountingListView
      rows={rows}
      shops={shops}
      shopId={currentShop?.id}
      methods={settings.methods}
      filter={{ date, receipt, method }}
      companyName={companyName}
    />
  );
}

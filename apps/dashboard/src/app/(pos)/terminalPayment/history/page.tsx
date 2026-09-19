import { requireSession } from '@/lib/auth';
import { getTerminalPayments } from '@/lib/transactionQueries';

import { TerminalPaymentView } from './TerminalPaymentView';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'キャッシュレス決済履歴' };

/** キャッシュレス決済履歴（仕様書 §5.24） */
export default async function TerminalPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string }>;
}) {
  const session = await requireSession();
  const { shop } = await searchParams;

  const shops = session.shops.filter((s) => s.company_id === session.currentCompanyId);
  const currentShop = shops.find((s) => s.id === shop) ?? shops[0];
  const payments = currentShop ? await getTerminalPayments(currentShop.id) : [];

  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <TerminalPaymentView
      payments={payments}
      shops={shops}
      shopId={currentShop?.id}
      companyName={companyName}
    />
  );
}

import { requireSession } from '@/lib/auth';

import { OnlinePaymentCsvView } from './OnlinePaymentCsvView';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'モバイル決済取引CSV' };

/** モバイル決済取引一覧 CSV（仕様書 §5.28） */
export default async function OnlinePaymentCsvPage() {
  const session = await requireSession();
  const shops = session.shops.filter((s) => s.company_id === session.currentCompanyId);
  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <OnlinePaymentCsvView
      companyName={companyName}
      shops={shops.map((s) => ({ id: s.id, name: s.name }))}
    />
  );
}

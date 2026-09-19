import { requireSession } from '@/lib/auth';
import { getLineAccounts, getMessageDeliveries } from '@/lib/crmQueries';

import { MessageDeliveryView } from './MessageDeliveryView';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'メッセージ配信' };

/** メッセージ配信（仕様書 §5.29） */
export default async function MessageDeliveryPage() {
  const session = await requireSession();

  const [deliveries, accounts] = await Promise.all([
    getMessageDeliveries(session.currentCompanyId),
    getLineAccounts(session.currentCompanyId),
  ]);

  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <MessageDeliveryView
      deliveries={deliveries}
      accounts={accounts}
      companyName={companyName}
    />
  );
}

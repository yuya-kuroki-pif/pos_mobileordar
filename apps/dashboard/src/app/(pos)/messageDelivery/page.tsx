import { requireSession } from '@/lib/auth';
import { canEdit } from '@/lib/permissions';
import { getMessagingAccounts, getMessageDeliveries } from '@/lib/crmQueries';

import { MessageDeliveryView } from './MessageDeliveryView';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'メッセージ配信' };

/** メッセージ配信（仕様書 §5.29） */
export default async function MessageDeliveryPage() {
  const session = await requireSession();

  const [deliveries, accounts] = await Promise.all([
    getMessageDeliveries(session.currentCompanyId),
    getMessagingAccounts(session.currentCompanyId),
  ]);

  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <MessageDeliveryView
      deliveries={deliveries}
      accounts={accounts}
      companyName={companyName}
      editable={canEdit(session.permissions, 'crm')}
    />
  );
}

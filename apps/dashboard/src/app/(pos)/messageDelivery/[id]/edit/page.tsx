import { notFound } from 'next/navigation';

import { requireSession } from '@/lib/auth';
import { getMessageDeliveries, getMessagingAccounts } from '@/lib/crmQueries';
import { isMessagingConfigured } from '@/lib/messaging';
import { canEdit } from '@/lib/permissions';

import { DeliveryEditView } from './DeliveryEditView';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'メッセージ配信の編集' };

/** メッセージ配信の編集（仕様書 §5.29）。id が "new" なら新規作成 */
export default async function DeliveryEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();

  const [deliveries, accounts] = await Promise.all([
    getMessageDeliveries(session.currentCompanyId),
    getMessagingAccounts(session.currentCompanyId),
  ]);

  const delivery = id === 'new' ? null : deliveries.find((row) => row.id === id);
  if (id !== 'new' && !delivery) notFound();

  const shops = session.shops.filter((s) => s.company_id === session.currentCompanyId);
  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <DeliveryEditView
      companyName={companyName}
      delivery={delivery ?? null}
      accounts={accounts}
      shops={shops.map((s) => ({ id: s.id, name: s.name }))}
      editable={canEdit(session.permissions, 'crm')}
      messagingReady={{
        line: isMessagingConfigured('line'),
        zalo: isMessagingConfigured('zalo'),
      }}
    />
  );
}

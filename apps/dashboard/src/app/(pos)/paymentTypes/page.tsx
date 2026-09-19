import { requireSession } from '@/lib/auth';
import { getPaymentSettings } from '@/lib/paymentQueries';

import { PaymentSettingsView } from './PaymentSettingsView';

export const dynamic = 'force-dynamic';
export const metadata = { title: '支払方法等設定' };

/** 支払方法等設定（仕様書 §5.10） */
export default async function PaymentTypesPage() {
  const session = await requireSession();
  const settings = await getPaymentSettings(session.currentCompanyId);

  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <PaymentSettingsView
      settings={settings}
      companyName={companyName}
      permissions={session.permissions}
    />
  );
}

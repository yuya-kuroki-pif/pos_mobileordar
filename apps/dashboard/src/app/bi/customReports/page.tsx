import { requireSession } from '@/lib/auth';
import { getCustomReports } from '@/lib/extrasQueries';
import { canEdit } from '@/lib/permissions';

import { CustomReportsView } from './CustomReportsView';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'カスタムレポート' };

/** カスタムレポート（仕様書 §6.9） */
export default async function CustomReportsPage() {
  const session = await requireSession();
  const reports = await getCustomReports(session.corporation.id);

  const shops = session.shops.filter((s) => s.company_id === session.currentCompanyId);
  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <CustomReportsView
      companyName={companyName}
      reports={reports}
      shops={shops.map((s) => ({ id: s.id, name: s.name }))}
      myAccountId={session.account.id}
      editable={canEdit(session.permissions, 'analytics')}
    />
  );
}

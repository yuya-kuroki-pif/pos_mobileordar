import { requireSession } from '@/lib/auth';

import { DashboardView } from './DashboardView';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'ダッシュボード' };

export default async function DashboardPage() {
  const session = await requireSession();

  const currentCompany = session.companies.find((c) => c.id === session.currentCompanyId);
  const shopsInCompany = session.shops.filter((s) => s.company_id === session.currentCompanyId);

  return (
    <DashboardView
      companyName={currentCompany?.name ?? '業態'}
      companyCount={session.companies.length}
      shopCount={session.shops.length}
      shopCountInCompany={shopsInCompany.length}
      accountName={session.account.name}
      accountEmail={session.account.email}
      roleName={session.roleName}
      corporationName={session.corporation.name}
    />
  );
}

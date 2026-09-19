import { requireSession } from '@/lib/auth';
import { canEdit } from '@/lib/permissions';

import { CompanyListView } from './CompanyListView';

export const dynamic = 'force-dynamic';
export const metadata = { title: '業態一覧' };

/** 業態一覧（仕様書 §5.9） */
export default async function CompanyListPage() {
  const session = await requireSession();

  return (
    <CompanyListView
      companies={session.companies}
      corporationName={session.corporation.name}
      shopCounts={Object.fromEntries(
        session.companies.map((company) => [
          company.id,
          session.shops.filter((shop) => shop.company_id === company.id).length,
        ])
      )}
      editable={canEdit(session.permissions, 'company_management')}
    />
  );
}

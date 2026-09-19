import { requireSession } from '@/lib/auth';
import { getCashChangerSettings } from '@/lib/companyQueries';
import { canEdit } from '@/lib/permissions';

import { CashChangerView } from './CashChangerView';

export const dynamic = 'force-dynamic';
export const metadata = { title: '自動釣銭機設定' };

/** 自動釣銭機設定（仕様書 §5.9） */
export default async function CashChangerPage() {
  const session = await requireSession();

  const shops = session.shops.filter((s) => s.company_id === session.currentCompanyId);
  const settings = await getCashChangerSettings(shops.map((s) => s.id));

  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <CashChangerView
      shops={shops}
      settings={settings}
      companyName={companyName}
      editable={canEdit(session.permissions, 'shop_management')}
    />
  );
}

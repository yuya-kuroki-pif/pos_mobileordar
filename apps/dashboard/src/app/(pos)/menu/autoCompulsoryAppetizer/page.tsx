import { requireSession } from '@/lib/auth';
import { getAppetizerBoard } from '@/lib/companyQueries';
import { getMenuRows } from '@/lib/menuQueries';
import { canEdit } from '@/lib/permissions';

import { AppetizerView } from './AppetizerView';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'お通し自動設定' };

/** お通し自動設定（仕様書 §5.9） */
export default async function AppetizerPage() {
  const session = await requireSession();

  const shops = session.shops.filter((s) => s.company_id === session.currentCompanyId);
  const [board, menus] = await Promise.all([
    getAppetizerBoard(session.currentCompanyId, shops.map((s) => s.id)),
    getMenuRows(session.currentCompanyId),
  ]);

  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <AppetizerView
      board={board}
      shops={shops}
      menus={menus.map((m) => ({ id: m.id, name: m.name, price: m.price }))}
      companyName={companyName}
      editable={canEdit(session.permissions, 'company_management')}
    />
  );
}

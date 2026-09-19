import { requireSession } from '@/lib/auth';
import { canEdit } from '@/lib/permissions';

import { MenuCsvView } from './MenuCsvView';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'メニュー一括編集' };

/** メニュー一括編集（仕様書 §5.8） */
export default async function MenuCsvPage() {
  const session = await requireSession();
  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <MenuCsvView
      companyName={companyName}
      editable={canEdit(session.permissions, 'menu_master')}
    />
  );
}

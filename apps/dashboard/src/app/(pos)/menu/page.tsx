import { requireSession } from '@/lib/auth';
import { getMenuRows } from '@/lib/menuQueries';

import { MenuListView } from './MenuListView';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'メニュー' };

/** メニュー一覧（仕様書 §5.2 / 画像 02_menu_list.jpg） */
export default async function MenuListPage() {
  const session = await requireSession();
  const menus = await getMenuRows(session.currentCompanyId);

  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <MenuListView menus={menus} companyName={companyName} permissions={session.permissions} />
  );
}

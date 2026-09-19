import { requireSession } from '@/lib/auth';
import { getMenuRows, getOptionRows } from '@/lib/menuQueries';

import { OptionListView } from './OptionListView';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'オプション' };

/** オプション一覧（仕様書 §5.5 / 画像 05_option_list.jpg） */
export default async function OptionListPage() {
  const session = await requireSession();

  const [options, menus] = await Promise.all([
    getOptionRows(session.currentCompanyId),
    getMenuRows(session.currentCompanyId),
  ]);

  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <OptionListView
      options={options}
      menus={menus}
      companyName={companyName}
      permissions={session.permissions}
    />
  );
}

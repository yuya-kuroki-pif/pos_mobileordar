import { requireSession } from '@/lib/auth';
import { getAccountRows, getRoles } from '@/lib/queries';

import { AccountTable } from './AccountTable';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'アカウント' };

/** アカウント一覧（仕様書 §7.3 / 画像 52_setting_accounts.jpg） */
export default async function AccountSettingPage() {
  const session = await requireSession();

  const [accounts, roles] = await Promise.all([
    getAccountRows(session.corporation.id),
    getRoles(session.corporation.id),
  ]);

  return (
    <AccountTable
        accounts={accounts}
        roles={roles}
        companies={session.companies}
        shops={session.shops}
      permissions={session.permissions}
    />
  );
}

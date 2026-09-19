import { requireSession } from '@/lib/auth';
import { getRoles } from '@/lib/queries';

import { RoleMatrix } from './RoleMatrix';

export const dynamic = 'force-dynamic';
export const metadata = { title: '権限設定' };

/** 権限設定（仕様書 §10.2 / 画像 53_setting_roles.jpg） */
export default async function RoleSettingPage() {
  const session = await requireSession();
  const roles = await getRoles(session.corporation.id);

  return <RoleMatrix roles={roles} permissions={session.permissions} />;
}

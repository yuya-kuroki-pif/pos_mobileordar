import { requireSession } from '@/lib/auth';
import { getCoupons, getZaloConnectSettings } from '@/lib/crmQueries';
import { canEdit } from '@/lib/permissions';

import { ZaloConnectForm } from './ZaloConnectForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Zalo ログイン連携' };

/**
 * Zalo ログイン連携の設定（案A）。
 * モバイルオーダーを開いたお客様を Zalo で特定し、配信につなげる。
 */
export default async function ZaloConnectPage() {
  const session = await requireSession();

  const [settings, coupons] = await Promise.all([
    getZaloConnectSettings(session.currentCompanyId),
    getCoupons(session.currentCompanyId),
  ]);

  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <ZaloConnectForm
      companyName={companyName}
      settings={settings}
      coupons={coupons.map((c) => ({ id: c.id, name: c.display_name ?? c.name }))}
      editable={canEdit(session.permissions, 'crm')}
      loginConfigured={Boolean(process.env.ZALO_APP_ID && process.env.ZALO_APP_SECRET)}
      znsConfigured={Boolean(process.env.ZALO_OA_ACCESS_TOKEN)}
    />
  );
}

import { requireSession } from '@/lib/auth';
import { getCouponPresets, getCoupons } from '@/lib/crmQueries';
import { canEdit } from '@/lib/permissions';

import { CouponPresetView } from './CouponPresetView';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'クーポン自動配信' };

/** クーポン自動配信（仕様書 §5.31） */
export default async function CouponPresetPage() {
  const session = await requireSession();

  const [presets, coupons] = await Promise.all([
    getCouponPresets(session.currentCompanyId),
    getCoupons(session.currentCompanyId),
  ]);

  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <CouponPresetView
      presets={presets}
      coupons={coupons}
      companyName={companyName}
      editable={canEdit(session.permissions, 'crm')}
    />
  );
}

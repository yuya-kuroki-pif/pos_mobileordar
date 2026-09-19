import { requireSession } from '@/lib/auth';
import { getCoupons } from '@/lib/crmQueries';
import { canEdit } from '@/lib/permissions';

import { CouponListView } from './CouponListView';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'クーポン' };

/** クーポン（仕様書 §5.30） */
export default async function CouponPage() {
  const session = await requireSession();
  const coupons = await getCoupons(session.currentCompanyId);

  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <CouponListView
      coupons={coupons}
      companyName={companyName}
      editable={canEdit(session.permissions, 'crm')}
    />
  );
}

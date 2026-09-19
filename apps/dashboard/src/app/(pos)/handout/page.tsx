import { requireSession } from '@/lib/auth';
import { canEdit } from '@/lib/permissions';

import { HandoutView } from './HandoutView';

export const dynamic = 'force-dynamic';
export const metadata = { title: '配布物' };

/** 配布物（仕様書 §5.21）。店舗へ渡すログイン情報をまとめる */
export default async function HandoutPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string }>;
}) {
  const session = await requireSession();
  const { shop } = await searchParams;

  const shops = session.shops.filter((s) => s.company_id === session.currentCompanyId);
  const currentShop = shops.find((s) => s.id === shop) ?? shops[0];
  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <HandoutView
      shops={shops}
      shop={currentShop}
      dashboardEmail={session.account.email}
      companyName={companyName}
      editable={canEdit(session.permissions, 'shop_management')}
    />
  );
}

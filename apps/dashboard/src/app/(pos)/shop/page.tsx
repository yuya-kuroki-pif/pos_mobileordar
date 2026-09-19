import { requireSession } from '@/lib/auth';

import { ShopListView } from './ShopListView';

export const dynamic = 'force-dynamic';
export const metadata = { title: '店舗一覧' };

export default async function ShopListPage() {
  const session = await requireSession();

  // 業態セレクタで選んでいる業態の店舗だけを出す
  const shops = session.shops.filter((shop) => shop.company_id === session.currentCompanyId);
  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return <ShopListView shops={shops} companyName={companyName} permissions={session.permissions} />;
}

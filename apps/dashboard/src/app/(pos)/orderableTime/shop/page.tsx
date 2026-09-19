import { requireSession } from '@/lib/auth';
import { getOrderableTimeBoard } from '@/lib/orderableTimeQueries';
import { canEdit } from '@/lib/permissions';

import { OrderableTimeView } from './OrderableTimeView';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'アプリ表示時間設定' };

/** アプリ表示時間設定（仕様書 §5.14） */
export default async function OrderableTimePage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string }>;
}) {
  const session = await requireSession();
  const { shop } = await searchParams;

  const shops = session.shops.filter((s) => s.company_id === session.currentCompanyId);
  const currentShop = shops.find((s) => s.id === shop) ?? shops[0];
  const board = await getOrderableTimeBoard(
    session.currentCompanyId,
    shops.map((s) => s.id)
  );

  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <OrderableTimeView
      board={board}
      shops={shops}
      shopId={currentShop?.id}
      companyName={companyName}
      editable={canEdit(session.permissions, 'shop_management')}
    />
  );
}

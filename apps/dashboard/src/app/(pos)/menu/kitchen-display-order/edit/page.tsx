import { requireSession } from '@/lib/auth';
import { canEdit } from '@/lib/permissions';
import { getKitchenOrderRows } from '@/lib/printingQueries';

import { KitchenOrderView } from './KitchenOrderView';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'キッチン表示・印刷順' };

/** キッチン表示・印刷順（仕様書 §5.16） */
export default async function KitchenOrderPage({
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

  const rows = currentShop
    ? await getKitchenOrderRows(currentShop.id, session.currentCompanyId)
    : [];

  return (
    <KitchenOrderView
      rows={rows}
      shops={shops}
      shopId={currentShop?.id}
      companyName={companyName}
      editable={canEdit(session.permissions, 'shop_management')}
    />
  );
}

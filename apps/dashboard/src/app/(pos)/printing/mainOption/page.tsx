import { requireSession } from '@/lib/auth';
import { canEdit } from '@/lib/permissions';
import { getPlanOptionPrinterBoard } from '@/lib/printingQueries';

import { PlanOptionPrinterView } from './PlanOptionPrinterView';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'プランオプション印刷設定' };

/** プランオプション印刷設定（仕様書 §5.16） */
export default async function PlanOptionPrinterPage({
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

  const board = currentShop
    ? await getPlanOptionPrinterBoard(currentShop.id, session.currentCompanyId)
    : { rows: [], printers: [] };

  return (
    <PlanOptionPrinterView
      board={board}
      shops={shops}
      shopId={currentShop?.id}
      companyName={companyName}
      editable={canEdit(session.permissions, 'shop_management')}
    />
  );
}

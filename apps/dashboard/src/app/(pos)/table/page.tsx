import { requireSession } from '@/lib/auth';
import { canEdit } from '@/lib/permissions';
import { getTableBoard, moUrl, qrDataUrl } from '@/lib/tableQueries';

import { TableView } from './TableView';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'テーブル' };

/** テーブル（仕様書 §5.19） */
export default async function TablePage({
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

  if (!currentShop) {
    return (
      <TableView
        shops={[]}
        companyName={companyName}
        board={{ areas: [], tables: [] }}
        qrByTable={{}}
        editable={false}
      />
    );
  }

  const board = await getTableBoard(currentShop.id);

  // QR はサーバーで作って data URL で渡す
  const qrByTable: Record<string, { url: string; image: string }> = {};
  for (const table of board.tables) {
    const url = moUrl(currentShop.id, table.id, table.qr_token);
    qrByTable[table.id] = { url, image: await qrDataUrl(url) };
  }

  return (
    <TableView
      shops={shops}
      shopId={currentShop.id}
      companyName={companyName}
      board={board}
      qrByTable={qrByTable}
      editable={canEdit(session.permissions, 'shop_management')}
    />
  );
}

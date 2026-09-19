import { requireSession } from '@/lib/auth';
import { getShopMenuBoard } from '@/lib/shopMenuQueries';

import { ShopMenuView } from './ShopMenuView';

export const dynamic = 'force-dynamic';
export const metadata = { title: '取扱メニュー一覧' };

/** 取扱メニュー一覧（仕様書 §5.13 / 画像 13_shop_menu_list.jpg） */
export default async function ShopMenuPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string }>;
}) {
  const session = await requireSession();
  const { shop } = await searchParams;

  // 業態セレクタで選んでいる業態の店舗から選ぶ
  const shops = session.shops.filter((s) => s.company_id === session.currentCompanyId);
  const currentShop = shops.find((s) => s.id === shop) ?? shops[0];

  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  if (!currentShop) {
    return <ShopMenuView shops={[]} companyName={companyName} permissions={session.permissions} />;
  }

  const board = await getShopMenuBoard(currentShop.id, session.currentCompanyId);

  return (
    <ShopMenuView
      shops={shops}
      shopId={currentShop.id}
      board={board}
      companyName={companyName}
      permissions={session.permissions}
    />
  );
}

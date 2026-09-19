import { notFound } from 'next/navigation';

import { requireSession } from '@/lib/auth';
import { getMenuDetail } from '@/lib/menuQueries';
import { canEdit } from '@/lib/permissions';

import { MenuEditFrame } from '../MenuEditFrame';
import { MenuDealerTable } from './MenuDealerTable';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'メニューの取扱設定' };

/** メニュー編集 — 取扱設定タブ（仕様書 §5.3 / 画像 03_menu_edit_dealer.jpg） */
export default async function MenuDealerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();

  const detail = await getMenuDetail(id);
  if (!detail) notFound();

  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <MenuEditFrame
      menuId={id}
      title={detail.menu.name}
      companyName={companyName}
      dealingShopNames={detail.dealers.filter((d) => d.is_dealing).map((d) => d.shop_name)}
      tab="dealer"
    >
      <MenuDealerTable
        menuId={id}
        dealers={detail.dealers}
        editable={canEdit(session.permissions, 'menu_master')}
      />
    </MenuEditFrame>
  );
}

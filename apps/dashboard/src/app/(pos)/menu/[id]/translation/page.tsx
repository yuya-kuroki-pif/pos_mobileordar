import { notFound } from 'next/navigation';

import { requireSession } from '@/lib/auth';
import { getMenuDetail } from '@/lib/menuQueries';
import { canEdit } from '@/lib/permissions';

import { MenuEditFrame } from '../MenuEditFrame';
import { MenuTranslationForm } from './MenuTranslationForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'メニューの多言語設定' };

/** メニュー編集 — 多言語設定タブ（仕様書 §5.3） */
export default async function MenuTranslationPage({ params }: { params: Promise<{ id: string }> }) {
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
      tab="translation"
    >
      <MenuTranslationForm
        menuId={id}
        menu={detail.menu}
        translations={detail.translations}
        editable={canEdit(session.permissions, 'menu_master')}
      />
    </MenuEditFrame>
  );
}

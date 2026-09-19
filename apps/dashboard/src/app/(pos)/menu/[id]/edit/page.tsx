import { notFound } from 'next/navigation';

import { requireSession } from '@/lib/auth';
import { getCategoryRows, getMenuDetail } from '@/lib/menuQueries';
import { canEdit } from '@/lib/permissions';

import { MenuEditFrame } from '../MenuEditFrame';
import { MenuBasicForm } from './MenuBasicForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'メニュー編集' };

/** メニュー編集 — 基本情報タブ（仕様書 §5.3） */
export default async function MenuEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();

  const isNew = id === 'new';
  const detail = isNew ? null : await getMenuDetail(id);
  if (!isNew && !detail) notFound();

  const categories = await getCategoryRows(session.currentCompanyId);
  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <MenuEditFrame
      menuId={id}
      title={detail?.menu.name ?? 'メニューを新規作成'}
      companyName={companyName}
      dealingShopNames={
        detail?.dealers.filter((d) => d.is_dealing).map((d) => d.shop_name) ?? []
      }
      tab="edit"
    >
      <MenuBasicForm
        detail={detail}
        categories={categories}
        editable={canEdit(session.permissions, 'menu_master')}
      />
    </MenuEditFrame>
  );
}

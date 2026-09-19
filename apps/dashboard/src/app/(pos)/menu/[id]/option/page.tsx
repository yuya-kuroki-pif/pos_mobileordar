import { notFound } from 'next/navigation';

import { requireSession } from '@/lib/auth';
import { getMenuDetail, getOptionRows } from '@/lib/menuQueries';
import { canEdit } from '@/lib/permissions';

import { MenuEditFrame } from '../MenuEditFrame';
import { MenuOptionForm } from './MenuOptionForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'メニューのオプション' };

/** メニュー編集 — オプションタブ（仕様書 §5.3） */
export default async function MenuOptionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();

  const detail = await getMenuDetail(id);
  if (!detail) notFound();

  const options = await getOptionRows(session.currentCompanyId);
  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <MenuEditFrame
      menuId={id}
      title={detail.menu.name}
      companyName={companyName}
      dealingShopNames={detail.dealers.filter((d) => d.is_dealing).map((d) => d.shop_name)}
      tab="option"
    >
      <MenuOptionForm
        menuId={id}
        options={options}
        selectedIds={detail.optionIds}
        editable={canEdit(session.permissions, 'menu_master')}
      />
    </MenuEditFrame>
  );
}

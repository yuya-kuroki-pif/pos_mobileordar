import { notFound } from 'next/navigation';

import { requireSession } from '@/lib/auth';
import { getMenuRows } from '@/lib/menuQueries';
import { canEdit } from '@/lib/permissions';
import { getPlanDetail } from '@/lib/planQueries';

import { PlanEditFrame } from '../PlanEditFrame';
import { PlanFirstOrderForm } from './PlanFirstOrderForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: '自動注文設定' };

/** プラン編集 — 自動注文設定タブ（仕様書 §5.4） */
export default async function PlanFirstOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();

  const detail = await getPlanDetail(id);
  if (!detail) notFound();

  const menus = await getMenuRows(session.currentCompanyId);
  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <PlanEditFrame
      planId={id}
      title={detail.plan.name}
      companyName={companyName}
      dealingShopNames={detail.dealers.filter((d) => d.is_dealing).map((d) => d.shop_name)}
      tab="firstOrder"
    >
      <PlanFirstOrderForm
        planId={id}
        menus={menus}
        selectedIds={detail.firstOrderMenuIds}
        editable={canEdit(session.permissions, 'menu_master')}
      />
    </PlanEditFrame>
  );
}

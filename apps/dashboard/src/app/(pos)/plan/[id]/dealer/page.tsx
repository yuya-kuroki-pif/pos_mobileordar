import { notFound } from 'next/navigation';

import { requireSession } from '@/lib/auth';
import { canEdit } from '@/lib/permissions';
import { getPlanDetail } from '@/lib/planQueries';

import { PlanEditFrame } from '../PlanEditFrame';
import { PlanDealerTable } from './PlanDealerTable';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'プランの取扱設定' };

/** プラン編集 — 取扱設定タブ（仕様書 §5.4） */
export default async function PlanDealerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();

  const detail = await getPlanDetail(id);
  if (!detail) notFound();

  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <PlanEditFrame
      planId={id}
      title={detail.plan.name}
      companyName={companyName}
      dealingShopNames={detail.dealers.filter((d) => d.is_dealing).map((d) => d.shop_name)}
      tab="dealer"
    >
      <PlanDealerTable
        planId={id}
        dealers={detail.dealers}
        editable={canEdit(session.permissions, 'menu_master')}
      />
    </PlanEditFrame>
  );
}

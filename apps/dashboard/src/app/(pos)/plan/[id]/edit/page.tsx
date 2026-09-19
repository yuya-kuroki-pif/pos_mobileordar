import { notFound } from 'next/navigation';

import { requireSession } from '@/lib/auth';
import { getCategoryRows } from '@/lib/menuQueries';
import { canEdit } from '@/lib/permissions';
import { getPlanDetail, getPlanGroups } from '@/lib/planQueries';

import { PlanEditFrame } from '../PlanEditFrame';
import { PlanBasicForm } from './PlanBasicForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'プラン編集' };

/** プラン編集 — 基本情報タブ（仕様書 §5.4） */
export default async function PlanEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();

  const isNew = id === 'new';
  const detail = isNew ? null : await getPlanDetail(id);
  if (!isNew && !detail) notFound();

  const [categories, groups] = await Promise.all([
    getCategoryRows(session.currentCompanyId),
    getPlanGroups(session.currentCompanyId),
  ]);

  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <PlanEditFrame
      planId={id}
      title={detail?.plan.name ?? 'プランを新規作成'}
      companyName={companyName}
      dealingShopNames={detail?.dealers.filter((d) => d.is_dealing).map((d) => d.shop_name) ?? []}
      tab="edit"
    >
      <PlanBasicForm
        detail={detail}
        categories={categories}
        groups={groups}
        editable={canEdit(session.permissions, 'menu_master')}
      />
    </PlanEditFrame>
  );
}

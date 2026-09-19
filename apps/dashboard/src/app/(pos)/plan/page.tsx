import { requireSession } from '@/lib/auth';
import { getPlanGroups, getPlanRows } from '@/lib/planQueries';

import { PlanListView } from './PlanListView';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'プラン' };

/** プラン一覧（仕様書 §5.4 / 画像 04_plan_list.jpg） */
export default async function PlanListPage() {
  const session = await requireSession();

  const [plans, groups] = await Promise.all([
    getPlanRows(session.currentCompanyId),
    getPlanGroups(session.currentCompanyId),
  ]);

  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <PlanListView
      plans={plans}
      groups={groups}
      companyName={companyName}
      permissions={session.permissions}
    />
  );
}

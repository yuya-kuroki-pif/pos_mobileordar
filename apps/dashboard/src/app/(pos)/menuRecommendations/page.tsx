import { requireSession } from '@/lib/auth';
import { getMenuRows } from '@/lib/menuQueries';
import { canEdit } from '@/lib/permissions';
import { getRecommendationBoard } from '@/lib/recommendationQueries';

import { RecommendationView } from './RecommendationView';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'おすすめメニュー' };

/** おすすめメニュー（仕様書 §5.7） */
export default async function RecommendationPage() {
  const session = await requireSession();

  const shops = session.shops.filter((s) => s.company_id === session.currentCompanyId);
  const [board, menus] = await Promise.all([
    getRecommendationBoard(session.currentCompanyId, shops.map((s) => s.id)),
    getMenuRows(session.currentCompanyId),
  ]);

  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <RecommendationView
      board={board}
      shops={shops}
      menus={menus.map((m) => ({ id: m.id, name: m.name }))}
      companyName={companyName}
      editable={canEdit(session.permissions, 'recommendation_menu')}
    />
  );
}

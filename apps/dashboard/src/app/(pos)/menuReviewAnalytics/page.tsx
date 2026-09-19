import { DataTable, TableNote, type DataRow } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { requireSession } from '@/lib/auth';
import { getMenuReviews } from '@/lib/crmQueries';
import { getMenuRows } from '@/lib/menuQueries';
import { scoreMenus } from '@/lib/surveyAnalytics';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'メニュー評価分析' };

/** メニュー評価分析（仕様書 §5.32） */
export default async function MenuReviewPage() {
  const session = await requireSession();

  const shops = session.shops.filter((s) => s.company_id === session.currentCompanyId);
  const [reviews, menus] = await Promise.all([
    getMenuReviews(shops.map((s) => s.id)),
    getMenuRows(session.currentCompanyId),
  ]);

  const menuName = new Map(menus.map((m) => [m.id, m.name]));

  const rows: DataRow[] = scoreMenus(reviews)
    .filter((row) => menuName.has(row.menu_id))
    .map((row) => ({
      key: row.menu_id,
      name: menuName.get(row.menu_id) ?? row.menu_id,
      average: row.average,
      count: row.count,
      tags: row.tags.slice(0, 4).map(([tag, count]) => `${tag} ${count}`),
      comment: row.comments[0]?.comment ?? null,
    }));

  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <>
      <PageHeader
        title="メニュー評価分析"
        description="お客様が付けた点数とコメントを、メニューごとに集計します"
        breadcrumb={[{ label: companyName }, { label: 'アンケート分析' }, { label: 'メニュー評価分析' }]}
      />

      <DataTable
        rows={rows}
        pageSize={20}
        emptyText="評価がありません"
        columns={[
          { title: '順位', key: 'rank', width: 70, fixed: 'left', format: { type: 'index' } },
          { title: '商品名', key: 'name', width: 220, fixed: 'left' },
          { title: '評価', key: 'average', width: 200, format: { type: 'rate' } },
          { title: '件数', key: 'count', width: 90, align: 'right', format: { type: 'number' } },
          { title: 'よく付くタグ', key: 'tags', width: 280, format: { type: 'tags' } },
          { title: 'コメント', key: 'comment' },
        ]}
      />

      <TableNote>コメントは最新の 1 件を出しています。</TableNote>
    </>
  );
}

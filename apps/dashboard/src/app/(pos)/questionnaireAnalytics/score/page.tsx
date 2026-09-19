import { PageHeader } from '@/components/PageHeader';
import { DataTable, TableNote, type DataRow } from '@/components/DataTable';
import { requireSession } from '@/lib/auth';
import { getQuestionnaireAnswers } from '@/lib/crmQueries';
import { scoreByShop } from '@/lib/surveyAnalytics';

export const dynamic = 'force-dynamic';
export const metadata = { title: '店舗スコア一覧' };

/** 店舗スコア一覧（仕様書 §5.32） */
export default async function ScorePage() {
  const session = await requireSession();

  const shops = session.shops.filter((s) => s.company_id === session.currentCompanyId);
  const answers = await getQuestionnaireAnswers(shops.map((s) => s.id));
  const shopName = new Map(shops.map((s) => [s.id, s.name]));

  const rows: DataRow[] = scoreByShop(answers).map((row) => ({
    key: row.shop_id,
    shop_name: shopName.get(row.shop_id) ?? row.shop_id,
    answers: row.answers,
    average: row.average,
    revisit: row.revisit,
    service: row.service,
    food: row.food,
    speed: row.speed,
    clean: row.clean,
  }));

  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <>
      <PageHeader
        title="店舗スコア一覧"
        description="アンケートの点数を店舗ごとに並べます（100 点換算）"
        breadcrumb={[{ label: companyName }, { label: 'アンケート分析' }, { label: '店舗スコア一覧' }]}
      />

      <DataTable
        rows={rows}
        emptyText="アンケートの回答がありません"
        columns={[
          { title: '順位', key: 'rank', width: 70, fixed: 'left', format: { type: 'index' } },
          { title: '店舗名', key: 'shop_name', width: 220, fixed: 'left' },
          { title: '回答数', key: 'answers', width: 100, align: 'right', format: { type: 'number' } },
          { title: '総合', key: 'average', width: 130, align: 'right', format: { type: 'scoreTag' } },
          { title: '再来店意欲', key: 'revisit', width: 140, align: 'right', format: { type: 'scoreTag' } },
          { title: '接客', key: 'service', width: 120, align: 'right', format: { type: 'scoreTag' } },
          { title: '料理', key: 'food', width: 120, align: 'right', format: { type: 'scoreTag' } },
          { title: '提供速度', key: 'speed', width: 130, align: 'right', format: { type: 'scoreTag' } },
          { title: '清潔感', key: 'clean', width: 130, align: 'right', format: { type: 'scoreTag' } },
        ]}
      />

      <TableNote>
        点数は 5 段階の回答を 100 点換算にしたものです。S:90〜 / A:80〜 / B:70〜 / C:60〜 / D:〜59。
      </TableNote>
    </>
  );
}

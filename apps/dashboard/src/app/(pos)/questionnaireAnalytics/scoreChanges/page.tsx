import { Card, Flex } from 'antd';

import { DataTable, TableNote, type DataRow } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { ShopPicker } from '@/components/ShopPicker';
import { TrendChart } from '@/components/charts/TrendChart';
import { requireSession } from '@/lib/auth';
import { getQuestionnaireAnswers } from '@/lib/crmQueries';
import { scoreByMonth } from '@/lib/surveyAnalytics';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'スコア推移' };

/** スコア推移（仕様書 §5.32）。月ごとの折れ線と内訳 */
export default async function ScoreChangesPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string }>;
}) {
  const session = await requireSession();
  const { shop } = await searchParams;

  const shops = session.shops.filter((s) => s.company_id === session.currentCompanyId);
  // 既定は全店舗。業態全体の傾向をまず見せる
  const target = shops.find((s) => s.id === shop);
  const answers = await getQuestionnaireAnswers(target ? [target.id] : shops.map((s) => s.id));

  const months = scoreByMonth(answers);

  const rows: DataRow[] = [...months].reverse().map((row, index, list) => {
    const previous = list[index + 1];
    return {
      key: row.month,
      month: row.month.replace('-', '年') + '月',
      answers: row.answers,
      average: row.average,
      // いちばん古い月は比べる先が無いので空にする（±0 と紛らわしいため）
      diff: previous ? row.average - previous.average : null,
      revisit: row.revisit,
      service: row.service,
      food: row.food,
      speed: row.speed,
      clean: row.clean,
    };
  });

  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <>
      <PageHeader
        title="スコア推移"
        description="アンケートの点数が月ごとにどう動いたかを見ます（100 点換算）"
        breadcrumb={[{ label: companyName }, { label: 'アンケート分析' }, { label: 'スコア推移' }]}
        extra={
          <ShopPicker shops={shops} shopId={target?.id} allowAll basePath="/questionnaireAnalytics/scoreChanges" />
        }
      />

      <Flex vertical gap={16}>
        <Card title={target ? target.name : '全店舗'}>
          {months.length === 0 ? (
            <TableNote>アンケートの回答がまだありません。</TableNote>
          ) : (
            <TrendChart
              data={months.map((row) => ({
                label: row.month.slice(5) + '月',
                average: row.average,
                revisit: row.revisit,
                service: row.service,
                food: row.food,
                speed: row.speed,
                clean: row.clean,
              }))}
              series={[
                { key: 'average', label: '総合' },
                { key: 'revisit', label: '再来店意欲' },
                { key: 'service', label: '接客' },
                { key: 'food', label: '料理' },
                { key: 'speed', label: '提供速度' },
                { key: 'clean', label: '清潔感' },
              ]}
              domain={[0, 100]}
              unit=" 点"
              height={320}
            />
          )}
        </Card>

        <DataTable
          title="月別の内訳"
          rows={rows}
          emptyText="アンケートの回答がありません"
          columns={[
            { title: '年月', key: 'month', width: 130, fixed: 'left' },
            { title: '回答数', key: 'answers', width: 100, align: 'right', format: { type: 'number' } },
            { title: '総合', key: 'average', width: 120, align: 'right', format: { type: 'scoreTag' } },
            { title: '前月差', key: 'diff', width: 110, align: 'right', format: { type: 'delta', digits: 0, unit: ' 点' } },
            { title: '再来店意欲', key: 'revisit', width: 130, align: 'right', format: { type: 'scoreTag' } },
            { title: '接客', key: 'service', width: 110, align: 'right', format: { type: 'scoreTag' } },
            { title: '料理', key: 'food', width: 110, align: 'right', format: { type: 'scoreTag' } },
            { title: '提供速度', key: 'speed', width: 120, align: 'right', format: { type: 'scoreTag' } },
            { title: '清潔感', key: 'clean', width: 120, align: 'right', format: { type: 'scoreTag' } },
          ]}
        />
      </Flex>

      <TableNote>
        点数は 5 段階の回答を 100 点換算にしたものです。S:90〜 / A:80〜 / B:70〜 / C:60〜 / D:〜59。
      </TableNote>
    </>
  );
}

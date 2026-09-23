import { Card, Space, Statistic } from 'antd';

import { DataTable, TableNote, type DataRow } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { TabLinks } from '@/components/TabLinks';
import { requireSession } from '@/lib/auth';
import { getEmployeeReviews, getQuestionnaireAnswers } from '@/lib/crmQueries';
import { clone, db } from '@/lib/demo';
import { isDemoMode, supabaseAdmin } from '@/lib/supabase';
import { qscCorrelation, rankClerks } from '@/lib/surveyAnalytics';

import { ReviewComments, type ReviewComment } from './ReviewComments';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'スタッフ評価分析' };

async function getClerkNames(
  shopIds: string[]
): Promise<Map<string, { name: string; shop: string }>> {
  if (isDemoMode()) {
    const state = db();
    return new Map(
      clone(state.clerks)
        .filter((c) => shopIds.includes(c.shop_id))
        .map((c) => [
          c.id,
          { name: c.name, shop: state.shops.find((s) => s.id === c.shop_id)?.name ?? '' },
        ])
    );
  }

  const supabase = supabaseAdmin();
  const [clerkRes, shopRes] = await Promise.all([
    supabase.from('clerks').select('id, name, shop_id').in('shop_id', shopIds),
    supabase.from('shops').select('id, name').in('id', shopIds),
  ]);

  const shopName = new Map(
    ((shopRes.data ?? []) as { id: string; name: string }[]).map((s) => [s.id, s.name])
  );

  return new Map(
    ((clerkRes.data ?? []) as { id: string; name: string; shop_id: string }[]).map((c) => [
      c.id,
      { name: c.name, shop: shopName.get(c.shop_id) ?? '' },
    ])
  );
}

/** スタッフ評価分析（仕様書 §5.32） */
export default async function EmployeeRankingPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requireSession();
  const { tab } = await searchParams;
  const active = tab ?? 'ranking';

  const shops = session.shops.filter((s) => s.company_id === session.currentCompanyId);
  const shopIds = shops.map((s) => s.id);
  const shopName = new Map(shops.map((s) => [s.id, s.name]));

  const [reviews, names, answers] = await Promise.all([
    getEmployeeReviews(shopIds),
    getClerkNames(shopIds),
    getQuestionnaireAnswers(shopIds),
  ]);

  const rows: DataRow[] = rankClerks(reviews).map((row) => ({
    key: row.clerk_id,
    name: names.get(row.clerk_id)?.name ?? row.clerk_id,
    shop: names.get(row.clerk_id)?.shop ?? null,
    good: row.good,
    bad: row.bad,
    comments: row.comments,
  }));

  // 評価コメントのタブ。新しい順に並べる
  const comments: ReviewComment[] = reviews
    .filter((review) => review.comment)
    .sort((a, b) => (a.reviewed_at < b.reviewed_at ? 1 : -1))
    .map((review) => ({
      id: review.id,
      clerk_name: names.get(review.clerk_id)?.name ?? review.clerk_id,
      shop_name: shopName.get(review.shop_id) ?? '',
      is_good: review.is_good,
      comment: review.comment ?? '',
      reviewed_at: review.reviewed_at,
    }));

  const qsc = qscCorrelation(reviews, answers);
  const qscRows: DataRow[] = qsc.rows.map((row) => ({
    key: row.shop_id,
    shop: shopName.get(row.shop_id) ?? row.shop_id,
    reviews: row.reviews,
    good_rate: row.good_rate,
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
        title="スタッフ評価分析"
        description="お客様からの Good / Bad を、スタッフごとに集計します"
        breadcrumb={[{ label: companyName }, { label: 'アンケート分析' }, { label: 'スタッフ評価分析' }]}
      />

      <Card style={{ marginBottom: 16 }}>
        <Statistic title="評価総数" value={reviews.length} suffix="件" />
      </Card>

      <TabLinks
        active={active}
        items={[
          { key: 'ranking', label: 'ランキング' },
          { key: 'comment', label: '評価コメント' },
          { key: 'qsc', label: 'QSC相関' },
        ]}
      />

      {active === 'ranking' && (
        <DataTable
          rows={rows}
          emptyText="評価がありません"
          columns={[
            { title: '順位', key: 'rank', width: 70, format: { type: 'index' } },
            { title: 'スタッフ名', key: 'name' },
            { title: '所属店舗', key: 'shop', width: 220 },
            { title: 'Good 数', key: 'good', width: 110, align: 'right', format: { type: 'tag', color: 'green' } },
            { title: 'Bad 数', key: 'bad', width: 110, align: 'right', format: { type: 'tag' } },
            { title: 'コメント数', key: 'comments', width: 120, align: 'right', format: { type: 'number' } },
          ]}
        />
      )}

      {active === 'comment' && <ReviewComments comments={comments} />}

      {active === 'qsc' && (
        <>
          <Card title="Good 率と相関の強い項目" style={{ marginBottom: 16 }}>
            <Space size="large" wrap>
              {(
                [
                  ['service', '接客'],
                  ['food', '料理'],
                  ['speed', '提供速度'],
                  ['clean', '清潔感'],
                ] as const
              ).map(([key, label]) => (
                <Statistic
                  key={key}
                  title={label}
                  value={qsc.correlation[key]}
                  precision={2}
                  valueStyle={{
                    color:
                      qsc.correlation[key] >= 0.5
                        ? '#389e0d'
                        : qsc.correlation[key] <= -0.5
                          ? '#cf1322'
                          : undefined,
                  }}
                />
              ))}
            </Space>
          </Card>

          <DataTable
            title="店舗別"
            rows={qscRows}
            emptyText="データがありません"
            columns={[
              { title: '店舗名', key: 'shop', width: 240, fixed: 'left' },
              { title: '評価数', key: 'reviews', width: 110, align: 'right', format: { type: 'number' } },
              { title: 'Good 率', key: 'good_rate', width: 120, align: 'right', format: { type: 'percent', digits: 1 } },
              { title: '接客', key: 'service', width: 110, align: 'right', format: { type: 'scoreTag' } },
              { title: '料理', key: 'food', width: 110, align: 'right', format: { type: 'scoreTag' } },
              { title: '提供速度', key: 'speed', width: 120, align: 'right', format: { type: 'scoreTag' } },
              { title: '清潔感', key: 'clean', width: 120, align: 'right', format: { type: 'scoreTag' } },
            ]}
          />

          <TableNote>
            相関は −1〜1 の値です。1 に近いほど「スタッフの評価が高い店舗ほど、その項目のスコアも高い」ことを表します。
            店舗数が少ないうちは当てになりません（いまは {qscRows.length} 店舗）。
          </TableNote>
        </>
      )}
    </>
  );
}

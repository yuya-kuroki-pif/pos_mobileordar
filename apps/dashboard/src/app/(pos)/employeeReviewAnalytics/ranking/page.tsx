import { Card, Statistic } from 'antd';

import { DataTable, type DataRow } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { requireSession } from '@/lib/auth';
import { getEmployeeReviews } from '@/lib/crmQueries';
import { clone, db } from '@/lib/demo';
import { isDemoMode, supabaseAdmin } from '@/lib/supabase';
import { rankClerks } from '@/lib/surveyAnalytics';

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
export default async function EmployeeRankingPage() {
  const session = await requireSession();

  const shops = session.shops.filter((s) => s.company_id === session.currentCompanyId);
  const shopIds = shops.map((s) => s.id);

  const [reviews, names] = await Promise.all([getEmployeeReviews(shopIds), getClerkNames(shopIds)]);

  const rows: DataRow[] = rankClerks(reviews).map((row) => ({
    key: row.clerk_id,
    name: names.get(row.clerk_id)?.name ?? row.clerk_id,
    shop: names.get(row.clerk_id)?.shop ?? null,
    good: row.good,
    bad: row.bad,
    comments: row.comments,
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
    </>
  );
}

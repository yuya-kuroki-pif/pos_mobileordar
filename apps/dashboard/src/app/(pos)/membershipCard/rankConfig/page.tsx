import { DataTable, type DataRow } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { requireSession } from '@/lib/auth';
import { getCoupons, getMembershipRanks } from '@/lib/crmQueries';
import { clone, db } from '@/lib/demo';
import { isDemoMode } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const metadata = { title: '会員ランク管理' };

/** 会員ランク管理（仕様書 §5.31） */
export default async function RankConfigPage() {
  const session = await requireSession();

  const [ranks, coupons] = await Promise.all([
    getMembershipRanks(session.currentCompanyId),
    getCoupons(session.currentCompanyId),
  ]);

  // ランクごとの会員数。来店回数の範囲で数える
  const customers = isDemoMode() ? clone(db().customers) : [];
  const couponName = new Map(coupons.map((c) => [c.id, c.name]));

  const rows: DataRow[] = ranks.map((rank, index) => {
    const next = ranks[index + 1];
    return {
      key: rank.id,
      name: rank.name,
      min_visits: `${rank.min_visits} 回以上`,
      coupon: rank.coupon_id ? (couponName.get(rank.coupon_id) ?? rank.coupon_id) : null,
      members: customers.filter(
        (c) => c.visit_count >= rank.min_visits && (!next || c.visit_count < next.min_visits)
      ).length,
    };
  });

  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <>
      <PageHeader
        title="会員ランク管理"
        description="来店回数に応じたランクと、ランクアップ時に配るクーポン"
        breadcrumb={[{ label: companyName }, { label: 'CRM' }, { label: '会員ランク管理' }]}
      />

      <DataTable
        rows={rows}
        emptyText="ランクが登録されていません"
        columns={[
          { title: 'ランク名', key: 'name', width: 180, format: { type: 'tag', color: 'gold' } },
          { title: '来店回数', key: 'min_visits', width: 150 },
          { title: 'クーポン', key: 'coupon' },
          { title: '会員数', key: 'members', width: 120, align: 'right', format: { type: 'number' } },
        ]}
      />
    </>
  );
}

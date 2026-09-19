import { Alert } from 'antd';

import { DataTable, type DataRow } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { requireSession } from '@/lib/auth';
import { getCoupons, getMiniGames } from '@/lib/crmQueries';
import { minToLabel } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'ミニゲーム' };

/** ミニゲーム（仕様書 §5.31） */
export default async function MiniGamePage() {
  const session = await requireSession();

  const [games, coupons] = await Promise.all([
    getMiniGames(session.currentCompanyId),
    getCoupons(session.currentCompanyId),
  ]);

  const shops = session.shops.filter((s) => s.company_id === session.currentCompanyId);
  const shopName = new Map(shops.map((s) => [s.id, s.name]));
  const couponName = new Map(coupons.map((c) => [c.id, c.name]));

  const rows: DataRow[] = games.map((game) => ({
    key: game.id,
    name: game.name,
    status: game.enabled ? '利用中' : '停止中',
    shops: game.shop_ids.map((id) => shopName.get(id) ?? id),
    time:
      game.time_from_min !== null && game.time_to_min !== null
        ? `${minToLabel(game.time_from_min)} 〜 ${minToLabel(game.time_to_min)}`
        : '終日',
    win_rate: game.win_rate * 100,
    win_coupon: game.win_coupon_id ? (couponName.get(game.win_coupon_id) ?? null) : null,
    lose_coupon: game.lose_coupon_id ? (couponName.get(game.lose_coupon_id) ?? null) : null,
  }));

  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <>
      <PageHeader
        title="ミニゲーム"
        description="お会計のあとに、くじ引きでクーポンを配ります"
        breadcrumb={[{ label: companyName }, { label: 'CRM' }, { label: 'ミニゲーム' }]}
      />

      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message="景品表示法にご注意ください"
        description="当選確率や景品の内容には決まりがあります。運用の前に確認してください。ゲーム画面そのものはモバイルオーダー側の実装と合わせて用意します。"
      />

      <DataTable
        rows={rows}
        emptyText="ゲームが登録されていません"
        columns={[
          { title: 'ゲーム名', key: 'name', width: 220, fixed: 'left' },
          { title: '利用状況', key: 'status', width: 110, format: { type: 'tag' } },
          { title: '利用店舗', key: 'shops', width: 240, format: { type: 'tags' } },
          { title: '適用時間帯', key: 'time', width: 170 },
          { title: '当選確率', key: 'win_rate', width: 110, align: 'right', format: { type: 'percent' } },
          { title: '当たりのお客様', key: 'win_coupon', width: 200 },
          { title: 'その他のお客様', key: 'lose_coupon', width: 200 },
        ]}
      />
    </>
  );
}

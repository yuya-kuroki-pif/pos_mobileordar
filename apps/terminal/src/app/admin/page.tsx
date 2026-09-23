import { Card, Empty, PageHeader, Stat } from '@/components/ui';
import { requireStore } from '@/lib/auth';
import { getShopPaymentMethods } from '@/lib/queries';
import {
  businessDate,
  formatBusinessDate,
  formatDateTime,
  formatYen,
  PAYMENT_METHOD_LABEL,
} from '@/lib/format';
import { getFloorMap, getItemRanking, getPayments, getSalesSummary } from '@/lib/queries';

export const metadata = { title: 'ダッシュボード' };

export default async function AdminHome() {
  const store = await requireStore();

  const today = businessDate(new Date(), store.timezone, store.business_day_cutoff_hour);
  // 直近 7 営業日ぶんの推移を見る
  const from = new Date(today);
  from.setDate(from.getDate() - 6);
  const fromYmd = from.toISOString().slice(0, 10);

  const methods = await getShopPaymentMethods(store.company_id);
  const methodName = (id: string | null, fallback: string) =>
    methods.find((row) => row.id === id)?.name ?? fallback;

  const [summary, ranking, payments, floor] = await Promise.all([
    getSalesSummary(store.id, fromYmd, today),
    getItemRanking(store.id, today, today, 10),
    getPayments(store.id, 10),
    getFloorMap(store.id),
  ]);

  const todayRow = summary.find((row) => row.business_day === today);
  const inUse = floor.filter((table) => table.session);
  const liveSales = inUse.reduce((sum, table) => sum + table.current_total, 0);

  // 週の最大値を棒グラフの基準にする
  const maxSales = Math.max(1, ...summary.map((row) => row.gross_sales));

  return (
    <>
      <PageHeader
        title="ダッシュボード"
        description={`本日（${formatBusinessDate(today)}）の状況と直近の売上`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="本日の売上（会計済み）"
          value={formatYen(todayRow?.gross_sales ?? 0)}
          sub={`${todayRow?.sessions ?? 0} 組 / ${todayRow?.guests ?? 0} 名`}
        />
        <Stat
          label="客単価"
          value={formatYen(todayRow?.avg_per_guest ?? 0)}
          sub="会計済みの合計 ÷ 人数"
        />
        <Stat
          label="在店中の売上"
          value={formatYen(liveSales)}
          sub={`${inUse.length} 卓が利用中`}
        />
        <Stat
          label="本日の見込み合計"
          value={formatYen((todayRow?.gross_sales ?? 0) + liveSales)}
          sub="会計済み + 在店中"
        />
      </div>

      {/* 直近 7 営業日 */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold">直近 7 営業日</h2>
        <Card className="p-5">
          {summary.length === 0 ? (
            <Empty title="まだ会計の記録がありません" description="レジで会計するとここに反映されます。" />
          ) : (
            <ul className="space-y-3">
              {[...summary].reverse().map((row) => (
                <li key={row.business_day} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-sm text-charcoal-500">
                    {formatBusinessDate(row.business_day)}
                  </span>
                  <div className="h-6 flex-1 overflow-hidden rounded bg-charcoal-100">
                    <div
                      className="h-full rounded bg-ember-500"
                      style={{ width: `${(row.gross_sales / maxSales) * 100}%` }}
                    />
                  </div>
                  <span className="tabular w-24 shrink-0 text-right font-semibold">
                    {formatYen(row.gross_sales)}
                  </span>
                  <span className="tabular w-16 shrink-0 text-right text-sm text-charcoal-400">
                    {row.guests}名
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* 本日の売れ筋 */}
        <section>
          <h2 className="mb-3 text-lg font-bold">本日の売れ筋</h2>
          <Card className="divide-y divide-charcoal-50">
            {ranking.length === 0 ? (
              <div className="p-5">
                <Empty title="本日の注文はまだありません" />
              </div>
            ) : (
              ranking.map((row, index) => (
                <div key={row.name} className="flex items-center gap-3 px-5 py-3">
                  <span className="tabular w-6 text-sm font-bold text-charcoal-300">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{row.name}</span>
                  <span className="tabular text-sm text-charcoal-500">{row.quantity} 点</span>
                  <span className="tabular w-20 text-right font-semibold">
                    {formatYen(row.sales)}
                  </span>
                </div>
              ))
            )}
          </Card>
        </section>

        {/* 直近の会計 */}
        <section>
          <h2 className="mb-3 text-lg font-bold">直近の会計</h2>
          <Card className="divide-y divide-charcoal-50">
            {payments.length === 0 ? (
              <div className="p-5">
                <Empty title="会計の記録がありません" />
              </div>
            ) : (
              payments.map((payment) => (
                <div key={payment.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {payment.table_name}
                      <span className="ml-2 text-xs text-charcoal-400">
                        {payment.guest_count}名
                      </span>
                    </p>
                    <p className="text-xs text-charcoal-400">
                      {formatDateTime(payment.paid_at)} ・{' '}
                      {methodName(payment.payment_method_id, PAYMENT_METHOD_LABEL[payment.method])}
                    </p>
                  </div>
                  <span className="tabular font-semibold">{formatYen(payment.total)}</span>
                </div>
              ))
            )}
          </Card>
        </section>
      </div>
    </>
  );
}

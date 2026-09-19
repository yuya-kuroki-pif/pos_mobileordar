import Link from 'next/link';

import { Card, Empty, PageHeader, Stat } from '@/components/ui';
import { requireStore } from '@/lib/auth';
import {
  businessDate,
  formatBusinessDate,
  formatDateTime,
  formatYen,
  PAYMENT_METHOD_LABEL,
} from '@/lib/format';
import { getItemRanking, getPayments, getSalesSummary } from '@/lib/queries';

import { RangePicker } from './RangePicker';

export const metadata = { title: '売上' };

/** "YYYY-MM-DD" 形式かどうか。URL パラメータをそのまま SQL へ渡さないための検証 */
function isYmd(value: string | undefined): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function shiftDays(ymd: string, days: number): string {
  const date = new Date(`${ymd}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const store = await requireStore();
  const params = await searchParams;

  const today = businessDate(new Date(), store.timezone, store.business_day_cutoff_hour);
  const to = isYmd(params.to) ? params.to : today;
  const from = isYmd(params.from) ? params.from : shiftDays(to, -29);

  const [summary, ranking, payments] = await Promise.all([
    getSalesSummary(store.id, from, to),
    getItemRanking(store.id, from, to, 20),
    getPayments(store.id, 200),
  ]);

  // 会計履歴は件数で絞って取っているので、表示範囲に合わせて再度フィルタする。
  // 取り消した会計は売上に含めないため、ここでも除いて別枠に出す
  const inRange = payments.filter((payment) => {
    if (payment.status !== 'paid') return false;
    const day = businessDate(
      new Date(payment.paid_at),
      store.timezone,
      store.business_day_cutoff_hour
    );
    return day >= from && day <= to;
  });

  const voided = payments.filter((payment) => payment.status === 'refunded');

  const totals = summary.reduce(
    (acc, row) => ({
      sales: acc.sales + row.gross_sales,
      guests: acc.guests + row.guests,
      sessions: acc.sessions + row.sessions,
      discount: acc.discount + row.discount_total,
    }),
    { sales: 0, guests: 0, sessions: 0, discount: 0 }
  );

  return (
    <>
      <PageHeader title="売上" description={`${from} 〜 ${to} の集計`} />

      <RangePicker from={from} to={to} today={today} />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="売上合計" value={formatYen(totals.sales)} sub={`${summary.length} 営業日`} />
        <Stat label="組数" value={`${totals.sessions} 組`} />
        <Stat label="客数" value={`${totals.guests} 名`} />
        <Stat
          label="客単価"
          value={formatYen(totals.guests === 0 ? 0 : Math.round(totals.sales / totals.guests))}
          sub={totals.discount > 0 ? `割引 ${formatYen(totals.discount)}` : undefined}
        />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold">営業日別</h2>
        <Card>
          {summary.length === 0 ? (
            <div className="p-5">
              <Empty title="この期間の会計記録がありません" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-charcoal-100 text-left text-xs text-charcoal-400">
                  <tr>
                    <th className="px-5 py-3 font-semibold">営業日</th>
                    <th className="px-5 py-3 text-right font-semibold">組数</th>
                    <th className="px-5 py-3 text-right font-semibold">客数</th>
                    <th className="px-5 py-3 text-right font-semibold">売上</th>
                    <th className="px-5 py-3 text-right font-semibold">客単価</th>
                    <th className="px-5 py-3 text-right font-semibold">内消費税</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-charcoal-50">
                  {summary.map((row) => (
                    <tr key={row.business_day}>
                      <td className="px-5 py-2.5 font-medium">
                        {formatBusinessDate(row.business_day)}
                      </td>
                      <td className="tabular px-5 py-2.5 text-right">{row.sessions}</td>
                      <td className="tabular px-5 py-2.5 text-right">{row.guests}</td>
                      <td className="tabular px-5 py-2.5 text-right font-semibold">
                        {formatYen(row.gross_sales)}
                      </td>
                      <td className="tabular px-5 py-2.5 text-right text-charcoal-500">
                        {formatYen(row.avg_per_guest)}
                      </td>
                      <td className="tabular px-5 py-2.5 text-right text-charcoal-400">
                        {formatYen(row.tax_total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-bold">商品別</h2>
          <Card className="divide-y divide-charcoal-50">
            {ranking.length === 0 ? (
              <div className="p-5">
                <Empty title="注文データがありません" />
              </div>
            ) : (
              ranking.map((row, index) => (
                <div key={row.name} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="tabular w-6 text-sm font-bold text-charcoal-300">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{row.name}</span>
                  <span className="tabular text-sm text-charcoal-500">{row.quantity} 点</span>
                  <span className="tabular w-24 text-right font-semibold">
                    {formatYen(row.sales)}
                  </span>
                </div>
              ))
            )}
          </Card>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold">
            会計履歴
            <span className="ml-2 text-xs font-normal text-charcoal-400">
              クリックでレシートを表示
            </span>
          </h2>
          <Card className="max-h-[600px] divide-y divide-charcoal-50 overflow-y-auto">
            {inRange.length === 0 ? (
              <div className="p-5">
                <Empty title="この期間の会計がありません" />
              </div>
            ) : (
              inRange.map((payment) => (
                <Link
                  key={payment.id}
                  href={`/pos/receipt/${payment.id}`}
                  className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-charcoal-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {payment.table_name}
                      <span className="ml-2 text-xs text-charcoal-400">
                        {payment.guest_count}名
                      </span>
                      {payment.split_count > 1 && (
                        <span className="ml-2 rounded bg-sky-100 px-1.5 py-0.5 text-[11px] font-bold text-sky-800">
                          分割 {payment.split_index}/{payment.split_count}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-charcoal-400">
                      {formatDateTime(payment.paid_at)} ・ {PAYMENT_METHOD_LABEL[payment.method]}
                      {payment.discount > 0 && ` ・ 割引 ${formatYen(payment.discount)}`}
                    </p>
                  </div>
                  <span className="tabular font-semibold">{formatYen(payment.total)}</span>
                </Link>
              ))
            )}
          </Card>
        </section>
      </div>

      {voided.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-bold">取り消した会計</h2>
          <p className="mb-3 text-sm text-charcoal-500">
            売上には含まれていません。記録として残しています。
          </p>
          <Card className="divide-y divide-charcoal-50">
            {voided.map((payment) => (
              <Link
                key={payment.id}
                href={`/pos/receipt/${payment.id}`}
                className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-charcoal-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{payment.table_name}</p>
                  <p className="text-xs text-charcoal-400">
                    {formatDateTime(payment.paid_at)}
                    {payment.void_reason && ` ・ ${payment.void_reason}`}
                  </p>
                </div>
                <span className="tabular font-semibold text-charcoal-400 line-through">
                  {formatYen(payment.total)}
                </span>
              </Link>
            ))}
          </Card>
        </section>
      )}
    </>
  );
}

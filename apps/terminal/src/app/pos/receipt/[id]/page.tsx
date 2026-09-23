import Link from 'next/link';
import { notFound } from 'next/navigation';

import { requireStore } from '@/lib/auth';
import {
  PAYMENT_METHOD_LABEL,
  SERVICE_TYPE_LABEL,
  formatDateTime,
  formatTaxRate,
  formatYen,
} from '@/lib/format';
import {
  getPaymentById,
  getSession,
  getSessionItems,
  getShopPaymentMethods,
  getTables,
} from '@/lib/queries';

import { ReceiptActions } from './ReceiptActions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'レシート' };

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = await requireStore();

  const payment = await getPaymentById(id, store.id);
  if (!payment) notFound();

  const [session, items, tables, paymentMethods] = await Promise.all([
    getSession(payment.session_id),
    getSessionItems(payment.session_id),
    getTables(store.id),
    getShopPaymentMethods(store.company_id),
  ]);

  // レシートにはお客様が選んだ支払方法の名前を出す。
  // マスターに無い（古い会計など）ときだけ、区分の名前で代用する
  const methodLabel =
    paymentMethods.find((row) => row.id === payment.payment_method_id)?.name ??
    PAYMENT_METHOD_LABEL[payment.method];

  const table = tables.find((t) => t.id === session?.table_id);

  // この会計に紐づく明細だけを載せる（分割会計では一部だけになる）
  const billed = items.filter((item) => item.payment_id === payment.id);
  // 人数割りは明細が最後の 1 回にまとまるので、その場合は伝票全体を参考表示する
  const lines = billed.length > 0 ? billed : items.filter((i) => i.status !== 'cancelled');

  const hasReduced = payment.tax_breakdown.some((row) => row.rate < store.standard_tax_rate);
  const voided = payment.status === 'refunded';

  return (
    <main className="min-h-screen bg-charcoal-100 px-4 py-8">
      <div className="mx-auto max-w-sm">
        {voided && (
          <p className="no-print mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            この会計は取り消されています
            {payment.void_reason && <span className="block font-normal">理由: {payment.void_reason}</span>}
          </p>
        )}

        {/* レシート本体。印刷時はこの部分だけが残る */}
        <div className="rounded-lg bg-white px-6 py-8 shadow-lg">
          <div className="text-center">
            <h1 className="text-lg font-bold">{store.name}</h1>
            <p className="mt-1 text-xs text-charcoal-500">領収書</p>
            {store.invoice_registration_number && (
              <p className="tabular mt-1 text-[11px] text-charcoal-500">
                登録番号 {store.invoice_registration_number}
              </p>
            )}
          </div>

          <div className="mt-5 space-y-0.5 border-y border-dashed border-charcoal-200 py-3 text-xs text-charcoal-600">
            <p>{formatDateTime(payment.paid_at)}</p>
            <p>
              {table?.name ?? '-'} / {session?.guest_count ?? 0} 名
              {session && ` / ${SERVICE_TYPE_LABEL[session.service_type]}`}
            </p>
            {payment.split_count > 1 && (
              <p className="font-semibold">
                {payment.split_count} 名で分割（{payment.split_index} 人目）
              </p>
            )}
          </div>

          <ul className="mt-4 space-y-2 text-sm">
            {lines.map((item) => (
              <li key={item.id}>
                <div className="flex justify-between gap-2">
                  <span className="min-w-0 flex-1">
                    {item.tax_rate < store.standard_tax_rate && '※'}
                    {item.name_snapshot}
                  </span>
                  <span className="tabular w-8 text-right text-charcoal-500">{item.quantity}</span>
                  <span className="tabular w-20 text-right">{formatYen(item.line_total)}</span>
                </div>
                {item.options_snapshot.length > 0 && (
                  <p className="pl-2 text-[11px] text-charcoal-400">
                    {item.options_snapshot.map((o) => o.name).join(' / ')}
                  </p>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-5 space-y-1 border-t border-dashed border-charcoal-200 pt-3 text-sm">
            <ReceiptRow label="小計" value={formatYen(payment.subtotal)} />
            {payment.service_charge > 0 && (
              <ReceiptRow label="サービス料" value={formatYen(payment.service_charge)} />
            )}
            {payment.discount > 0 && (
              <ReceiptRow label="割引" value={`-${formatYen(payment.discount)}`} />
            )}

            <div className="flex items-baseline justify-between border-t border-charcoal-200 pt-2">
              <span className="font-bold">合計</span>
              <span className="tabular text-xl font-bold">{formatYen(payment.total)}</span>
            </div>

            {/* 税率ごとの対象額と消費税額。インボイスの記載要件 */}
            <div className="mt-2 space-y-0.5 border-t border-dashed border-charcoal-200 pt-2 text-xs">
              {payment.tax_breakdown.map((row) => (
                <div key={row.rate} className="flex justify-between">
                  <span>
                    {formatTaxRate(row.rate)}
                    {row.rate < store.standard_tax_rate && '（軽減）'}対象
                  </span>
                  <span className="tabular">
                    {formatYen(row.taxable)}
                    <span className="ml-2 text-charcoal-500">
                      {store.tax_included ? '内税' : '税'} {formatYen(row.tax)}
                    </span>
                  </span>
                </div>
              ))}
              {payment.tax_breakdown.length === 0 && (
                <ReceiptRow
                  label={store.tax_included ? '（内 消費税）' : '消費税'}
                  value={formatYen(payment.tax)}
                  muted
                />
              )}
            </div>

            <div className="mt-2 border-t border-dashed border-charcoal-200 pt-2">
              <ReceiptRow label="支払方法" value={methodLabel} />
              {payment.method === 'cash' && (
                <>
                  <ReceiptRow label="お預かり" value={formatYen(payment.received)} />
                  <ReceiptRow label="おつり" value={formatYen(payment.change_due)} />
                </>
              )}
            </div>
          </div>

          {hasReduced && (
            <p className="mt-4 text-[11px] text-charcoal-500">※ は軽減税率（8%）対象</p>
          )}

          <p className="mt-6 text-center text-[11px] text-charcoal-400">ありがとうございました</p>
        </div>

        <div className="no-print mt-6 flex gap-2">
          <Link
            href="/pos"
            className="flex-1 rounded-xl bg-charcoal-800 py-3 text-center font-bold text-white"
          >
            フロアへ戻る
          </Link>
          <ReceiptActions paymentId={payment.id} voided={voided} />
        </div>
      </div>
    </main>
  );
}

function ReceiptRow({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className={`flex justify-between ${muted ? 'text-xs text-charcoal-400' : ''}`}>
      <span>{label}</span>
      <span className="tabular">{value}</span>
    </div>
  );
}

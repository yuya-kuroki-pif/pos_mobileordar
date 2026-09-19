import Link from 'next/link';
import { notFound } from 'next/navigation';

import { requireStore } from '@/lib/auth';
import { PAYMENT_METHOD_LABEL, formatDateTime, formatYen } from '@/lib/format';
import { getSession, getSessionItems, getTables } from '@/lib/queries';
import { supabaseAdmin } from '@/lib/supabase';
import type { Payment } from '@/lib/types';

import { PrintButton } from './PrintButton';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'レシート' };

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = await requireStore();

  const { data } = await supabaseAdmin()
    .from('payments')
    .select('*')
    .eq('id', id)
    .eq('store_id', store.id)
    .maybeSingle();

  const payment = data as Payment | null;
  if (!payment) notFound();

  const [session, items, tables] = await Promise.all([
    getSession(payment.session_id),
    getSessionItems(payment.session_id),
    getTables(store.id),
  ]);

  const table = tables.find((t) => t.id === session?.table_id);
  const billed = items.filter((item) => item.status !== 'cancelled');

  return (
    <main className="min-h-screen bg-charcoal-100 px-4 py-8">
      <div className="mx-auto max-w-sm">
        {/* レシート本体。印刷時はこの部分だけが残る */}
        <div className="rounded-lg bg-white px-6 py-8 shadow-lg">
          <div className="text-center">
            <h1 className="text-lg font-bold">{store.name}</h1>
            <p className="mt-1 text-xs text-charcoal-500">領収書</p>
          </div>

          <div className="mt-5 space-y-0.5 border-y border-dashed border-charcoal-200 py-3 text-xs text-charcoal-600">
            <p>{formatDateTime(payment.paid_at)}</p>
            <p>
              {table?.name ?? '-'} / {session?.guest_count ?? 0} 名
            </p>
          </div>

          <ul className="mt-4 space-y-2 text-sm">
            {billed.map((item) => (
              <li key={item.id}>
                <div className="flex justify-between gap-2">
                  <span className="min-w-0 flex-1">{item.name_snapshot}</span>
                  <span className="tabular w-8 text-right text-charcoal-500">
                    {item.quantity}
                  </span>
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
            <ReceiptRow label="（内 消費税）" value={formatYen(payment.tax)} muted />

            <div className="flex items-baseline justify-between border-t border-charcoal-200 pt-2">
              <span className="font-bold">合計</span>
              <span className="tabular text-xl font-bold">{formatYen(payment.total)}</span>
            </div>

            <ReceiptRow label="支払方法" value={PAYMENT_METHOD_LABEL[payment.method]} />
            {payment.method === 'cash' && (
              <>
                <ReceiptRow label="お預かり" value={formatYen(payment.received)} />
                <ReceiptRow label="おつり" value={formatYen(payment.change_due)} />
              </>
            )}
          </div>

          <p className="mt-6 text-center text-[11px] text-charcoal-400">
            ありがとうございました
          </p>
        </div>

        <div className="no-print mt-6 flex gap-2">
          <Link
            href="/pos"
            className="flex-1 rounded-xl bg-charcoal-800 py-3 text-center font-bold text-white"
          >
            フロアへ戻る
          </Link>
          <PrintButton />
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

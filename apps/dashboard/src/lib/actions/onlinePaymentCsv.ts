'use server';

import { requireSession } from '../auth';
import { getTerminalPaymentsForShops } from '../transactionQueries';

/** モバイル決済取引一覧 CSV（仕様書 §5.28 の onlinePayment.csv） */

export interface OnlinePaymentCsvResult {
  ok: boolean;
  error?: string;
  name?: string;
  csv?: string;
  count?: number;
}

function toCsv(header: string[], rows: (string | number)[][]): string {
  const escape = (value: string | number) => {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return '\ufeff' + [header.join(','), ...rows.map((r) => r.map(escape).join(','))].join('\r\n');
}

export async function exportOnlinePaymentCsvAction(
  shopIds: string[],
  from: string,
  to: string
): Promise<OnlinePaymentCsvResult> {
  try {
    const session = await requireSession();

    const allowed = shopIds.filter((id) => session.shops.some((shop) => shop.id === id));
    if (allowed.length === 0) return { ok: false, error: '店舗を選んでください。' };

    const shopName = new Map(session.shops.map((shop) => [shop.id, shop.name]));
    const payments = (await getTerminalPaymentsForShops(allowed)).filter((payment) => {
      const day = payment.occurred_at.slice(0, 10);
      return day >= from && day <= to;
    });

    const csv = toCsv(
      [
        '店舗名',
        '取引日時',
        '区分',
        '取引ID',
        '決済種別',
        '決済状態',
        '入金サイクル開始日',
        '締め日',
        '売上',
        '手数料',
        '手数料率',
        '手数料差引後',
        'ブランド',
        '発行国',
        'カード番号',
        '返金申請日時',
      ],
      payments.map((payment) => [
        shopName.get(payment.shop_id) ?? payment.shop_id,
        payment.occurred_at,
        payment.kind ?? '',
        payment.transaction_id,
        payment.method ?? '',
        payment.status,
        payment.cycle_start ?? '',
        payment.cycle_end ?? '',
        payment.amount,
        payment.fee,
        payment.fee_rate,
        payment.net,
        payment.brand ?? '',
        payment.issuer_country ?? '',
        payment.masked_pan ?? '',
        payment.refund_requested_at ?? '',
      ])
    );

    return { ok: true, name: `onlinePayment_${from}_${to}.csv`, csv, count: payments.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message || 'CSV を作れませんでした' };
  }
}

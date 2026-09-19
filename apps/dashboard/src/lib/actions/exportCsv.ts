'use server';

import { requireSession } from '../auth';
import { db } from '../demo';
import { isDemoMode, supabaseAdmin } from '../supabase';

/**
 * CSV ダウンロード（仕様書 §5.28）。
 *
 * 指示書は非同期ジョブにして完了後にダウンロードさせる形だが、まずは
 * その場で組み立てて返す。件数が増えて待たされるようになったら切り替える。
 */

export type ExportKind =
  | 'summaryByShops'
  | 'summary'
  | 'orders'
  | 'orderSummary'
  | 'payments'
  | 'discounts'
  | 'customerSource'
  | 'audit';

export const EXPORT_LABELS: Record<ExportKind, string> = {
  summaryByShops: '日計（日別・店舗統一） summaryByShops.csv',
  summary: '日計（日別） summary.csv',
  orders: '注文一覧 orders.csv',
  orderSummary: '出数集計 orderSummary.csv',
  payments: '支払一覧 payments.csv',
  discounts: '値引・割引一覧 discounts.csv',
  customerSource: '媒体集計 customerSource.csv',
  audit: '監査 audit.csv',
};

function toCsv(header: string[], rows: (string | number)[][]): string {
  const escape = (value: string | number) => {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return (
    '\ufeff' + [header.join(','), ...rows.map((r) => r.map(escape).join(','))].join('\r\n')
  );
}

export interface ExportResult {
  ok: boolean;
  error?: string;
  files?: { name: string; csv: string }[];
}

/** 期間と店舗を受け取り、選ばれた種類ぶんの CSV をまとめて返す */
export async function exportCsvAction(
  shopIds: string[],
  from: string,
  to: string,
  kinds: ExportKind[]
): Promise<ExportResult> {
  try {
    const session = await requireSession();

    const allowed = shopIds.filter((id) => session.shops.some((shop) => shop.id === id));
    if (allowed.length === 0) return { ok: false, error: '店舗を選んでください。' };
    if (kinds.length === 0) return { ok: false, error: '出力するファイルを選んでください。' };

    const shopName = new Map(session.shops.map((shop) => [shop.id, shop.name]));
    const data = await loadRange(allowed, from, to);

    const files: { name: string; csv: string }[] = [];

    for (const kind of kinds) {
      if (kind === 'summaryByShops' || kind === 'summary') {
        const byKey = new Map<string, { sales: number; guests: number; groups: number }>();
        for (const payment of data.payments) {
          const key = `${payment.paid_at.slice(0, 10)}|${payment.store_id}`;
          const current = byKey.get(key) ?? { sales: 0, guests: 0, groups: 0 };
          current.sales += payment.total;
          current.guests += payment.guest_count ?? 0;
          current.groups += 1;
          byKey.set(key, current);
        }

        files.push({
          name: kind === 'summaryByShops' ? 'summaryByShops.csv' : 'summary.csv',
          csv: toCsv(
            ['営業日', '店舗', '売上', '客数', '組数', '客単価'],
            [...byKey.entries()]
              .sort()
              .map(([key, value]) => {
                const [day, shopId] = key.split('|');
                return [
                  day,
                  shopName.get(shopId) ?? shopId,
                  value.sales,
                  value.guests,
                  value.groups,
                  value.guests > 0 ? Math.round(value.sales / value.guests) : 0,
                ];
              })
          ),
        });
      }

      if (kind === 'orders') {
        files.push({
          name: 'orders.csv',
          csv: toCsv(
            ['注文日時', '店舗', 'メニュー名', '単価', '個数', '小計'],
            data.items.map((item) => [
              item.placed_at,
              shopName.get(item.store_id) ?? item.store_id,
              item.name_snapshot,
              item.unit_price,
              item.quantity,
              item.line_total,
            ])
          ),
        });
      }

      if (kind === 'orderSummary') {
        const byMenu = new Map<string, { qty: number; sales: number }>();
        for (const item of data.items) {
          const current = byMenu.get(item.name_snapshot) ?? { qty: 0, sales: 0 };
          current.qty += item.quantity;
          current.sales += item.line_total;
          byMenu.set(item.name_snapshot, current);
        }

        files.push({
          name: 'orderSummary.csv',
          csv: toCsv(
            ['メニュー名', '出数', '売上'],
            [...byMenu.entries()]
              .sort((a, b) => b[1].qty - a[1].qty)
              .map(([name, value]) => [name, value.qty, value.sales])
          ),
        });
      }

      if (kind === 'payments') {
        files.push({
          name: 'payments.csv',
          csv: toCsv(
            ['会計日時', '店舗', 'レシート番号', '支払方法', '小計', '割引', '合計', '内消費税'],
            data.payments.map((p) => [
              p.paid_at,
              shopName.get(p.store_id) ?? p.store_id,
              p.receipt_number ?? '',
              p.method,
              p.subtotal,
              p.discount,
              p.total,
              p.tax,
            ])
          ),
        });
      }

      if (kind === 'discounts') {
        files.push({
          name: 'discounts.csv',
          csv: toCsv(
            ['会計日時', '店舗', 'レシート番号', '割引額'],
            data.payments
              .filter((p) => p.discount > 0)
              .map((p) => [
                p.paid_at,
                shopName.get(p.store_id) ?? p.store_id,
                p.receipt_number ?? '',
                p.discount,
              ])
          ),
        });
      }

      if (kind === 'customerSource') {
        const bySource = new Map<string, { count: number; sales: number }>();
        for (const payment of data.payments) {
          const key = payment.inflow_source_id ?? '未設定';
          const current = bySource.get(key) ?? { count: 0, sales: 0 };
          current.count += 1;
          current.sales += payment.total;
          bySource.set(key, current);
        }

        files.push({
          name: 'customerSource.csv',
          csv: toCsv(
            ['媒体ID', '組数', '売上'],
            [...bySource.entries()].map(([key, value]) => [key, value.count, value.sales])
          ),
        });
      }

      if (kind === 'audit') {
        files.push({
          name: 'audit.csv',
          csv: toCsv(
            ['発生日時', '店舗', 'イベント種別', '金額', 'レシート番号', '備考'],
            data.audits.map((log) => [
              log.occurred_at,
              shopName.get(log.shop_id) ?? log.shop_id,
              log.event_type,
              log.amount ?? '',
              log.receipt_number ?? '',
              log.note ?? '',
            ])
          ),
        });
      }
    }

    return { ok: true, files };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
}

interface RangeData {
  payments: {
    store_id: string;
    paid_at: string;
    receipt_number: number | null;
    method: string;
    subtotal: number;
    discount: number;
    total: number;
    tax: number;
    guest_count: number | null;
    inflow_source_id: string | null;
  }[];
  items: {
    store_id: string;
    placed_at: string;
    name_snapshot: string;
    unit_price: number;
    quantity: number;
    line_total: number;
  }[];
  audits: {
    shop_id: string;
    occurred_at: string;
    event_type: string;
    amount: number | null;
    receipt_number: number | null;
    note: string | null;
  }[];
}

async function loadRange(shopIds: string[], from: string, to: string): Promise<RangeData> {
  const inRange = (iso: string) => {
    const day = iso.slice(0, 10);
    return day >= from && day <= to;
  };

  if (isDemoMode()) {
    const state = db();

    const payments = state.paymentRecords.filter(
      (p) => shopIds.includes(p.store_id) && inRange(p.paid_at)
    );
    const sessionIds = new Set(payments.map((p) => p.session_id));

    const items = state.orderItemRecords
      .filter((item) => sessionIds.has(item.session_id))
      .map((item) => {
        const order = state.orderRecords.find((o) => o.id === item.order_id);
        return {
          store_id: order?.store_id ?? '',
          placed_at: order?.placed_at ?? '',
          name_snapshot: item.name_snapshot,
          unit_price: item.unit_price,
          quantity: item.quantity,
          line_total: item.line_total,
        };
      });

    return {
      payments,
      items,
      audits: state.auditLogs.filter(
        (log) => shopIds.includes(log.shop_id) && inRange(log.occurred_at)
      ),
    };
  }

  const supabase = supabaseAdmin();
  const fromIso = `${from}T00:00:00+09:00`;
  const toIso = `${to}T23:59:59+09:00`;

  const [paymentRes, auditRes] = await Promise.all([
    supabase
      .from('payments')
      .select(
        'store_id, session_id, paid_at, receipt_number, method, subtotal, discount, total, tax, guest_count, inflow_source_id'
      )
      .in('store_id', shopIds)
      .gte('paid_at', fromIso)
      .lte('paid_at', toIso),
    supabase
      .from('audit_logs')
      .select('shop_id, occurred_at, event_type, amount, receipt_number, note')
      .in('shop_id', shopIds)
      .gte('occurred_at', fromIso)
      .lte('occurred_at', toIso),
  ]);

  if (paymentRes.error) throw new Error(paymentRes.error.message);
  if (auditRes.error) throw new Error(auditRes.error.message);

  const payments = (paymentRes.data ?? []) as (RangeData['payments'][number] & {
    session_id: string;
  })[];

  const { data: itemData } = payments.length > 0
    ? await supabase
        .from('order_items')
        .select('store_id, name_snapshot, unit_price, quantity, line_total, created_at')
        .in(
          'session_id',
          payments.map((p) => p.session_id)
        )
    : { data: [] };

  return {
    payments,
    items: ((itemData ?? []) as {
      store_id: string;
      name_snapshot: string;
      unit_price: number;
      quantity: number;
      line_total: number;
      created_at: string;
    }[]).map((item) => ({
      store_id: item.store_id,
      placed_at: item.created_at,
      name_snapshot: item.name_snapshot,
      unit_price: item.unit_price,
      quantity: item.quantity,
      line_total: item.line_total,
    })),
    audits: (auditRes.data ?? []) as RangeData['audits'],
  };
}

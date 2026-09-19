import 'server-only';

import { clone, db } from './demo';
import { isDemoMode, supabaseAdmin } from './supabase';
import type {
  AuditLog,
  BankDepositCorrection,
  CashClosing,
  OrderItemRecord,
  PaymentRecord,
  TableSession,
  TerminalPayment,
} from './types';

/**
 * 取引まわりの読み取り（仕様書 §5.22〜§5.26）。
 *
 * デモモードでは 30 日ぶんの作り物を返す。Supabase では素直に引く。
 */

/** 日次処理一覧（§5.22） */
export async function getCashClosings(
  shopIds: string[],
  businessDay: string
): Promise<CashClosing[]> {
  if (shopIds.length === 0) return [];

  if (isDemoMode()) {
    return clone(
      db().cashClosings.filter(
        (c) => shopIds.includes(c.store_id) && c.business_day === businessDay
      )
    );
  }

  const { data, error } = await supabaseAdmin()
    .from('cash_drawer_closings')
    .select('*')
    .in('store_id', shopIds)
    .eq('business_day', businessDay)
    .order('closing_index');

  if (error) throw new Error(error.message);
  return (data ?? []) as CashClosing[];
}

/** 日次処理の詳細（§5.22） */
export interface ClosingDetail {
  closing: CashClosing;
  /** 支払方法ごとの売上 */
  byMethod: { name: string; amount: number }[];
  corrections: BankDepositCorrection[];
}

export async function getClosingDetail(
  shopId: string,
  businessDay: string,
  index: number
): Promise<ClosingDetail | null> {
  if (isDemoMode()) {
    const state = db();
    const closing = state.cashClosings.find(
      (c) => c.store_id === shopId && c.business_day === businessDay && c.closing_index === index
    );
    if (!closing) return null;

    const payments = state.paymentRecords.filter(
      (p) => p.store_id === shopId && p.paid_at.slice(0, 10) === businessDay
    );

    const byMethod = new Map<string, number>();
    for (const payment of payments) {
      const name =
        state.paymentMethods.find((m) => m.id === payment.payment_method_id)?.name ?? '現金';
      byMethod.set(name, (byMethod.get(name) ?? 0) + payment.total);
    }

    return {
      closing: clone(closing),
      byMethod: [...byMethod.entries()].map(([name, amount]) => ({ name, amount })),
      corrections: clone(
        state.bankDepositCorrections.filter((c) => c.closing_id === closing.id)
      ),
    };
  }

  const supabase = supabaseAdmin();

  const { data: closingData, error } = await supabase
    .from('cash_drawer_closings')
    .select('*')
    .eq('store_id', shopId)
    .eq('business_day', businessDay)
    .eq('closing_index', index)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const closing = closingData as CashClosing | null;
  if (!closing) return null;

  const [paymentRes, methodRes, correctionRes] = await Promise.all([
    supabase
      .from('payments')
      .select('total, payment_method_id')
      .eq('store_id', shopId)
      .gte('paid_at', `${businessDay}T00:00:00+09:00`)
      .lt('paid_at', `${businessDay}T23:59:59+09:00`),
    supabase.from('payment_methods').select('id, name'),
    supabase
      .from('bank_deposit_corrections')
      .select('*')
      .eq('closing_id', closing.id)
      .order('corrected_at', { ascending: false }),
  ]);

  const methodName = new Map(
    (((methodRes.data ?? []) as { id: string; name: string }[]) ?? []).map((m) => [m.id, m.name])
  );
  const byMethod = new Map<string, number>();
  for (const payment of ((paymentRes.data ?? []) as {
    total: number;
    payment_method_id: string | null;
  }[]) ?? []) {
    const name = payment.payment_method_id
      ? (methodName.get(payment.payment_method_id) ?? '現金')
      : '現金';
    byMethod.set(name, (byMethod.get(name) ?? 0) + payment.total);
  }

  return {
    closing,
    byMethod: [...byMethod.entries()].map(([name, amount]) => ({ name, amount })),
    corrections: (correctionRes.data ?? []) as BankDepositCorrection[],
  };
}

/** 会計履歴の 1 行（§5.23） */
export interface AccountingRow extends PaymentRecord {
  table_name: string | null;
  method_name: string;
  clerk_name: string | null;
}

export interface AccountingFilter {
  shopId: string;
  businessDay?: string;
  receiptNumber?: string;
  methodId?: string;
}

export async function getAccountingRows(filter: AccountingFilter): Promise<AccountingRow[]> {
  if (isDemoMode()) {
    const state = db();

    return clone(
      state.paymentRecords.filter((payment) => {
        if (payment.store_id !== filter.shopId) return false;
        if (filter.businessDay && payment.paid_at.slice(0, 10) !== filter.businessDay) return false;
        if (filter.methodId && payment.payment_method_id !== filter.methodId) return false;
        if (
          filter.receiptNumber &&
          !String(payment.receipt_number ?? '').includes(filter.receiptNumber)
        ) {
          return false;
        }
        return true;
      })
    )
      .sort((a, b) => (a.paid_at < b.paid_at ? 1 : -1))
      .map((payment) => {
        const session = state.tableSessions.find((s) => s.id === payment.session_id);
        return {
          ...payment,
          table_name: session?.table_id
            ? (state.restaurantTables.find((t) => t.id === session.table_id)?.name ?? null)
            : null,
          method_name:
            state.paymentMethods.find((m) => m.id === payment.payment_method_id)?.name ?? '現金',
          clerk_name: payment.clerk_id
            ? (state.clerks.find((c) => c.id === payment.clerk_id)?.name ?? null)
            : null,
        };
      });
  }

  const supabase = supabaseAdmin();

  let query = supabase
    .from('payments')
    .select('*')
    .eq('store_id', filter.shopId)
    .order('paid_at', { ascending: false })
    .limit(200);

  if (filter.businessDay) {
    query = query
      .gte('paid_at', `${filter.businessDay}T00:00:00+09:00`)
      .lt('paid_at', `${filter.businessDay}T23:59:59+09:00`);
  }
  if (filter.methodId) query = query.eq('payment_method_id', filter.methodId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const payments = (data ?? []) as PaymentRecord[];
  const sessionIds = payments.map((p) => p.session_id);

  const [sessionRes, methodRes, clerkRes, tableRes] = await Promise.all([
    sessionIds.length > 0
      ? supabase.from('table_sessions').select('id, table_id').in('id', sessionIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from('payment_methods').select('id, name'),
    supabase.from('clerks').select('id, name').eq('shop_id', filter.shopId),
    supabase.from('restaurant_tables').select('id, name').eq('store_id', filter.shopId),
  ]);

  const sessions = (sessionRes.data ?? []) as { id: string; table_id: string | null }[];
  const methodName = new Map(
    ((methodRes.data ?? []) as { id: string; name: string }[]).map((m) => [m.id, m.name])
  );
  const clerkName = new Map(
    ((clerkRes.data ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name])
  );
  const tableName = new Map(
    ((tableRes.data ?? []) as { id: string; name: string }[]).map((t) => [t.id, t.name])
  );

  return payments
    .filter(
      (payment) =>
        !filter.receiptNumber ||
        String(payment.receipt_number ?? '').includes(filter.receiptNumber)
    )
    .map((payment) => {
      const session = sessions.find((s) => s.id === payment.session_id);
      return {
        ...payment,
        table_name: session?.table_id ? (tableName.get(session.table_id) ?? null) : null,
        method_name: payment.payment_method_id
          ? (methodName.get(payment.payment_method_id) ?? '現金')
          : '現金',
        clerk_name: payment.clerk_id ? (clerkName.get(payment.clerk_id) ?? null) : null,
      };
    });
}

/** 会計詳細（§5.23） */
export interface AccountingDetail {
  payment: AccountingRow;
  items: OrderItemRecord[];
  session: TableSession | null;
}

export async function getAccountingDetail(paymentId: string): Promise<AccountingDetail | null> {
  if (isDemoMode()) {
    const state = db();
    const payment = state.paymentRecords.find((p) => p.id === paymentId);
    if (!payment) return null;

    const rows = await getAccountingRows({ shopId: payment.store_id });
    const row = rows.find((r) => r.id === paymentId);
    if (!row) return null;

    return {
      payment: row,
      items: clone(state.orderItemRecords.filter((i) => i.session_id === payment.session_id)),
      session: clone(state.tableSessions.find((s) => s.id === payment.session_id) ?? null),
    };
  }

  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .maybeSingle();
  if (error) throw new Error(error.message);

  const payment = data as PaymentRecord | null;
  if (!payment) return null;

  const rows = await getAccountingRows({ shopId: payment.store_id });
  const row = rows.find((r) => r.id === paymentId);

  const [itemRes, sessionRes] = await Promise.all([
    supabase.from('order_items').select('*').eq('session_id', payment.session_id),
    supabase.from('table_sessions').select('*').eq('id', payment.session_id).maybeSingle(),
  ]);

  return {
    payment: row ?? { ...payment, table_name: null, method_name: '現金', clerk_name: null },
    items: (itemRes.data ?? []) as OrderItemRecord[],
    session: (sessionRes.data as TableSession | null) ?? null,
  };
}

/** テーブル利用履歴（§5.25） */
export interface TableUsageRow extends TableSession {
  table_name: string | null;
  parent_table_name: string | null;
  order_total: number;
}

export async function getTableUsageRows(
  shopId: string,
  yearMonth: string
): Promise<TableUsageRow[]> {
  if (isDemoMode()) {
    const state = db();
    const sessions = state.tableSessions.filter(
      (s) => s.store_id === shopId && s.opened_at.slice(0, 7) === yearMonth
    );

    const tableName = (id: string | null) =>
      id ? (state.restaurantTables.find((t) => t.id === id)?.name ?? null) : null;

    return clone(sessions)
      .sort((a, b) => (a.opened_at < b.opened_at ? 1 : -1))
      .map((session) => {
        const parent = session.parent_session_id
          ? state.tableSessions.find((s) => s.id === session.parent_session_id)
          : undefined;
        return {
          ...session,
          table_name: tableName(session.table_id),
          parent_table_name: parent ? tableName(parent.table_id) : null,
          order_total: state.orderItemRecords
            .filter((i) => i.session_id === session.id)
            .reduce((sum, i) => sum + i.line_total, 0),
        };
      });
  }

  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from('table_sessions')
    .select('*')
    .eq('store_id', shopId)
    .gte('opened_at', `${yearMonth}-01T00:00:00+09:00`)
    .order('opened_at', { ascending: false })
    .limit(500);

  if (error) throw new Error(error.message);
  const sessions = (data ?? []) as TableSession[];

  const [tableRes, itemRes] = await Promise.all([
    supabase.from('restaurant_tables').select('id, name').eq('store_id', shopId),
    sessions.length > 0
      ? supabase
          .from('order_items')
          .select('session_id, line_total')
          .in(
            'session_id',
            sessions.map((s) => s.id)
          )
      : Promise.resolve({ data: [], error: null }),
  ]);

  const tableName = new Map(
    ((tableRes.data ?? []) as { id: string; name: string }[]).map((t) => [t.id, t.name])
  );
  const items = (itemRes.data ?? []) as { session_id: string; line_total: number }[];

  return sessions.map((session) => {
    const parent = session.parent_session_id
      ? sessions.find((s) => s.id === session.parent_session_id)
      : undefined;
    return {
      ...session,
      table_name: session.table_id ? (tableName.get(session.table_id) ?? null) : null,
      parent_table_name:
        parent?.table_id ? (tableName.get(parent.table_id) ?? null) : null,
      order_total: items
        .filter((i) => i.session_id === session.id)
        .reduce((sum, i) => sum + i.line_total, 0),
    };
  });
}

/** 重要操作履歴（§5.26） */
export interface AuditLogRow extends AuditLog {
  shop_name: string;
  clerk_name: string | null;
  table_name: string | null;
}

export async function getAuditLogRows(
  shopIds: string[],
  options: { eventType?: string; from?: string; to?: string } = {}
): Promise<AuditLogRow[]> {
  if (shopIds.length === 0) return [];

  if (isDemoMode()) {
    const state = db();

    return clone(
      state.auditLogs.filter((log) => {
        if (!shopIds.includes(log.shop_id)) return false;
        if (options.eventType && log.event_type !== options.eventType) return false;
        if (options.from && log.occurred_at.slice(0, 10) < options.from) return false;
        if (options.to && log.occurred_at.slice(0, 10) > options.to) return false;
        return true;
      })
    )
      .sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1))
      .slice(0, 300)
      .map((log) => ({
        ...log,
        shop_name: state.shops.find((s) => s.id === log.shop_id)?.name ?? '',
        clerk_name: log.clerk_id
          ? (state.clerks.find((c) => c.id === log.clerk_id)?.name ?? null)
          : null,
        table_name: log.table_id
          ? (state.restaurantTables.find((t) => t.id === log.table_id)?.name ?? null)
          : null,
      }));
  }

  const supabase = supabaseAdmin();

  let query = supabase
    .from('audit_logs')
    .select('*')
    .in('shop_id', shopIds)
    .order('occurred_at', { ascending: false })
    .limit(300);

  if (options.eventType) query = query.eq('event_type', options.eventType);
  if (options.from) query = query.gte('occurred_at', `${options.from}T00:00:00+09:00`);
  if (options.to) query = query.lte('occurred_at', `${options.to}T23:59:59+09:00`);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const logs = (data ?? []) as AuditLog[];

  const [shopRes, clerkRes, tableRes] = await Promise.all([
    supabase.from('shops').select('id, name').in('id', shopIds),
    supabase.from('clerks').select('id, name').in('shop_id', shopIds),
    supabase.from('restaurant_tables').select('id, name').in('store_id', shopIds),
  ]);

  const shopName = new Map(
    ((shopRes.data ?? []) as { id: string; name: string }[]).map((s) => [s.id, s.name])
  );
  const clerkName = new Map(
    ((clerkRes.data ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name])
  );
  const tableName = new Map(
    ((tableRes.data ?? []) as { id: string; name: string }[]).map((t) => [t.id, t.name])
  );

  return logs.map((log) => ({
    ...log,
    shop_name: shopName.get(log.shop_id) ?? '',
    clerk_name: log.clerk_id ? (clerkName.get(log.clerk_id) ?? null) : null,
    table_name: log.table_id ? (tableName.get(log.table_id) ?? null) : null,
  }));
}

/** キャッシュレス決済履歴（§5.24） */
export async function getTerminalPayments(shopId: string): Promise<TerminalPayment[]> {
  if (isDemoMode()) {
    return clone(db().terminalPayments.filter((p) => p.shop_id === shopId)).sort((a, b) =>
      a.occurred_at < b.occurred_at ? 1 : -1
    );
  }

  const { data, error } = await supabaseAdmin()
    .from('terminal_payments')
    .select('*')
    .eq('shop_id', shopId)
    .order('occurred_at', { ascending: false })
    .limit(300);

  if (error) throw new Error(error.message);
  return (data ?? []) as TerminalPayment[];
}

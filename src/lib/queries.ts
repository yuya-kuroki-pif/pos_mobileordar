import 'server-only';

import * as demo from './demo/repo';
import { businessDate } from './format';
import { isDemoMode, supabaseAdmin } from './supabase';
import type {
  CashDrawerClosing,
  CashMovement,
  Category,
  CategoryWithItems,
  ItemRankingRow,
  KdsItem,
  MenuItem,
  MenuItemWithOptions,
  MenuOption,
  OptionGroup,
  Order,
  OrderItem,
  Payment,
  RestaurantTable,
  SalesSummaryRow,
  SessionTotal,
  Store,
  TableSession,
  TableWithSession,
} from './types';

// ---------------------------------------------------------------------------
// 読み取り。
//
// 各関数の冒頭でデモモードを判定し、その場合はインメモリの実装へ委譲する。
// 画面側は「どちらで動いているか」を意識しなくてよい。
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 店舗 / 卓
// ---------------------------------------------------------------------------

export async function getStoreBySlug(slug: string): Promise<Store | null> {
  if (isDemoMode()) return demo.getStoreBySlug(slug);

  const { data } = await supabaseAdmin().from('stores').select('*').eq('slug', slug).maybeSingle();
  return (data as Store) ?? null;
}

export async function getStoreById(storeId: string): Promise<Store | null> {
  if (isDemoMode()) return demo.getStoreById(storeId);

  const { data } = await supabaseAdmin().from('stores').select('*').eq('id', storeId).maybeSingle();
  return (data as Store) ?? null;
}

export async function getTables(storeId: string): Promise<RestaurantTable[]> {
  if (isDemoMode()) return demo.getTables();

  const { data, error } = await supabaseAdmin()
    .from('restaurant_tables')
    .select('*')
    .eq('store_id', storeId)
    .order('sort_order');

  if (error) throw new Error(error.message);
  return (data ?? []) as RestaurantTable[];
}

export async function getTableByToken(token: string): Promise<RestaurantTable | null> {
  if (isDemoMode()) return demo.getTableByToken(token);

  const { data } = await supabaseAdmin()
    .from('restaurant_tables')
    .select('*')
    .eq('qr_token', token)
    .eq('is_active', true)
    .maybeSingle();
  return (data as RestaurantTable) ?? null;
}

/**
 * POS のフロアマップ用。卓ごとに「開いているセッション」と現在の金額を組み立てる。
 *
 * 卓の数だけクエリを投げると遅いので、卓・セッション・明細をそれぞれ 1 回ずつ
 * まとめて取得し、メモリ上で突き合わせる。
 */
export async function getFloorMap(storeId: string): Promise<TableWithSession[]> {
  if (isDemoMode()) return demo.getFloorMap();

  const db = supabaseAdmin();

  const [tablesRes, sessionsRes] = await Promise.all([
    db.from('restaurant_tables').select('*').eq('store_id', storeId).eq('is_active', true).order('sort_order'),
    db
      .from('table_sessions')
      .select('*')
      .eq('store_id', storeId)
      .in('status', ['open', 'bill_requested']),
  ]);

  if (tablesRes.error) throw new Error(tablesRes.error.message);
  if (sessionsRes.error) throw new Error(sessionsRes.error.message);

  const tables = (tablesRes.data ?? []) as RestaurantTable[];
  const sessions = (sessionsRes.data ?? []) as TableSession[];
  const sessionIds = sessions.map((s) => s.id);

  let items: Pick<OrderItem, 'session_id' | 'line_total' | 'quantity' | 'status'>[] = [];
  if (sessionIds.length > 0) {
    const { data, error } = await db
      .from('order_items')
      .select('session_id, line_total, quantity, status')
      .in('session_id', sessionIds);
    if (error) throw new Error(error.message);
    items = (data ?? []) as typeof items;
  }

  const bySession = new Map<string, { total: number; count: number; pending: number }>();
  for (const item of items) {
    const acc = bySession.get(item.session_id) ?? { total: 0, count: 0, pending: 0 };
    if (item.status !== 'cancelled') {
      acc.total += item.line_total;
      acc.count += item.quantity;
      if (item.status === 'pending' || item.status === 'cooking') acc.pending += item.quantity;
    }
    bySession.set(item.session_id, acc);
  }

  const sessionByTable = new Map(sessions.map((s) => [s.table_id, s]));

  return tables.map((table) => {
    const session = sessionByTable.get(table.id) ?? null;
    const acc = session ? bySession.get(session.id) : undefined;
    return {
      ...table,
      session,
      current_total: acc?.total ?? 0,
      item_count: acc?.count ?? 0,
      pending_count: acc?.pending ?? 0,
    };
  });
}

// ---------------------------------------------------------------------------
// メニュー
// ---------------------------------------------------------------------------

/**
 * カテゴリ > 商品 > オプショングループ > 選択肢 のツリーを組み立てる。
 * モバイルオーダーと POS の注文入力で共用する。
 *
 * @param onlyOrderable 顧客向けメニューでは非公開商品を除く
 */
export async function getMenuTree(
  storeId: string,
  onlyOrderable = true
): Promise<CategoryWithItems[]> {
  if (isDemoMode()) return demo.getMenuTree(onlyOrderable);

  const db = supabaseAdmin();

  let itemQuery = db.from('menu_items').select('*').eq('store_id', storeId).order('sort_order');
  if (onlyOrderable) itemQuery = itemQuery.eq('is_available', true);

  const [catRes, itemRes, groupRes, optionRes, linkRes] = await Promise.all([
    db.from('categories').select('*').eq('store_id', storeId).eq('is_active', true).order('sort_order'),
    itemQuery,
    db.from('option_groups').select('*').eq('store_id', storeId).order('sort_order'),
    db.from('options').select('*').eq('is_available', true).order('sort_order'),
    db.from('menu_item_option_groups').select('*').order('sort_order'),
  ]);

  for (const res of [catRes, itemRes, groupRes, optionRes, linkRes]) {
    if (res.error) throw new Error(res.error.message);
  }

  const categories = (catRes.data ?? []) as Category[];
  const items = (itemRes.data ?? []) as MenuItem[];
  const groups = (groupRes.data ?? []) as OptionGroup[];
  const options = (optionRes.data ?? []) as MenuOption[];
  const links = (linkRes.data ?? []) as {
    menu_item_id: string;
    option_group_id: string;
    sort_order: number;
  }[];

  const optionsByGroup = new Map<string, MenuOption[]>();
  for (const option of options) {
    const list = optionsByGroup.get(option.group_id) ?? [];
    list.push(option);
    optionsByGroup.set(option.group_id, list);
  }

  const groupById = new Map(groups.map((g) => [g.id, g]));

  const groupsByItem = new Map<string, MenuItemWithOptions['option_groups']>();
  for (const link of links) {
    const group = groupById.get(link.option_group_id);
    if (!group) continue; // 他店舗のグループ（リンクは全店舗ぶん取得しているため）
    const list = groupsByItem.get(link.menu_item_id) ?? [];
    list.push({ ...group, options: optionsByGroup.get(group.id) ?? [] });
    groupsByItem.set(link.menu_item_id, list);
  }

  const itemsWithOptions: MenuItemWithOptions[] = items.map((item) => ({
    ...item,
    option_groups: groupsByItem.get(item.id) ?? [],
  }));

  return categories.map((category) => ({
    ...category,
    items: itemsWithOptions.filter((item) => item.category_id === category.id),
  }));
}

/** カテゴリ未設定の商品。管理画面で編集できるよう別に取得する */
export async function getUncategorizedItems(storeId: string): Promise<MenuItem[]> {
  if (isDemoMode()) return demo.getUncategorizedItems();

  const { data, error } = await supabaseAdmin()
    .from('menu_items')
    .select('*')
    .eq('store_id', storeId)
    .is('category_id', null)
    .order('sort_order');

  if (error) throw new Error(error.message);
  return (data ?? []) as MenuItem[];
}

// ---------------------------------------------------------------------------
// セッション / 注文
// ---------------------------------------------------------------------------

export async function getSession(sessionId: string): Promise<TableSession | null> {
  if (isDemoMode()) return demo.getSession(sessionId);

  const { data } = await supabaseAdmin()
    .from('table_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();
  return (data as TableSession) ?? null;
}

/** 卓に現在開いているセッション。なければ null */
export async function getOpenSessionForTable(tableId: string): Promise<TableSession | null> {
  if (isDemoMode()) return demo.getOpenSessionForTable(tableId);

  const { data } = await supabaseAdmin()
    .from('table_sessions')
    .select('*')
    .eq('table_id', tableId)
    .in('status', ['open', 'bill_requested'])
    .maybeSingle();
  return (data as TableSession) ?? null;
}

export async function getSessionItems(sessionId: string): Promise<OrderItem[]> {
  if (isDemoMode()) return demo.getSessionItems(sessionId);

  const { data, error } = await supabaseAdmin()
    .from('order_items')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at');

  if (error) throw new Error(error.message);
  return (data ?? []) as OrderItem[];
}

export async function getSessionOrders(sessionId: string): Promise<Order[]> {
  if (isDemoMode()) return demo.getSessionOrders(sessionId);

  const { data, error } = await supabaseAdmin()
    .from('orders')
    .select('*')
    .eq('session_id', sessionId)
    .order('placed_at');

  if (error) throw new Error(error.message);
  return (data ?? []) as Order[];
}

/**
 * 会計金額。DB 側の calc_session_total() をそのまま使う。
 *
 * @param onlyUnpaid 分割会計では未会計の明細だけを対象にする
 * @param itemIds    明細を指定した分割会計。null なら絞らない
 */
export async function getSessionTotal(
  sessionId: string,
  discount = 0,
  onlyUnpaid = true,
  itemIds: string[] | null = null
): Promise<SessionTotal> {
  if (isDemoMode()) return demo.getSessionTotal(sessionId, discount, onlyUnpaid, itemIds);

  const { data, error } = await supabaseAdmin().rpc('calc_session_total', {
    p_session_id: sessionId,
    p_discount: discount,
    p_only_unpaid: onlyUnpaid,
    p_item_ids: itemIds,
  });

  if (error) throw new Error(error.message);
  // set-returning function なので配列で返ってくる
  const row = Array.isArray(data) ? data[0] : data;
  return (
    (row as SessionTotal) ?? {
      subtotal: 0,
      service_charge: 0,
      discount: 0,
      tax: 0,
      total: 0,
      tax_breakdown: [],
    }
  );
}

// ---------------------------------------------------------------------------
// KDS
// ---------------------------------------------------------------------------

/**
 * 調理待ち・調理中・提供待ちの明細を、卓名と伝票番号付きで返す。
 * 古い注文から順に並べる（先に入った注文から作る）。
 */
export async function getKdsItems(storeId: string): Promise<KdsItem[]> {
  if (isDemoMode()) return demo.getKdsItems();

  const db = supabaseAdmin();

  const { data, error } = await db
    .from('order_items')
    .select(
      `*,
       orders!inner ( order_number, channel ),
       table_sessions!inner ( restaurant_tables!inner ( name ) )`
    )
    .eq('store_id', storeId)
    .in('status', ['pending', 'cooking', 'ready'])
    .order('created_at');

  if (error) throw new Error(error.message);

  type Joined = OrderItem & {
    orders: { order_number: number; channel: KdsItem['channel'] } | null;
    table_sessions: { restaurant_tables: { name: string } | null } | null;
  };

  return ((data ?? []) as Joined[]).map((row) => {
    const { orders, table_sessions, ...item } = row;
    return {
      ...item,
      order_number: orders?.order_number ?? 0,
      channel: orders?.channel ?? 'pos',
      table_name: table_sessions?.restaurant_tables?.name ?? '-',
    };
  });
}

// ---------------------------------------------------------------------------
// 売上
// ---------------------------------------------------------------------------

export async function getSalesSummary(
  storeId: string,
  from: string,
  to: string
): Promise<SalesSummaryRow[]> {
  if (isDemoMode()) return demo.getSalesSummary(from, to);

  const { data, error } = await supabaseAdmin().rpc('sales_summary', {
    p_store_id: storeId,
    p_from: from,
    p_to: to,
  });

  if (error) throw new Error(error.message);
  return (data ?? []) as SalesSummaryRow[];
}

export async function getItemRanking(
  storeId: string,
  from: string,
  to: string,
  limit = 20
): Promise<ItemRankingRow[]> {
  if (isDemoMode()) return demo.getItemRanking(from, to, limit);

  const { data, error } = await supabaseAdmin().rpc('item_ranking', {
    p_store_id: storeId,
    p_from: from,
    p_to: to,
    p_limit: limit,
  });

  if (error) throw new Error(error.message);
  return (data ?? []) as ItemRankingRow[];
}

/** 会計履歴。卓名を添えて返す */
export async function getPayments(
  storeId: string,
  limit = 100
): Promise<(Payment & { table_name: string; guest_count: number })[]> {
  if (isDemoMode()) return demo.getPayments(limit);

  const { data, error } = await supabaseAdmin()
    .from('payments')
    .select(
      `*, table_sessions!inner ( guest_count, restaurant_tables!inner ( name ) )`
    )
    .eq('store_id', storeId)
    .order('paid_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  type Joined = Payment & {
    table_sessions: { guest_count: number; restaurant_tables: { name: string } | null } | null;
  };

  return ((data ?? []) as Joined[]).map((row) => {
    const { table_sessions, ...payment } = row;
    return {
      ...payment,
      table_name: table_sessions?.restaurant_tables?.name ?? '-',
      guest_count: table_sessions?.guest_count ?? 0,
    };
  });
}

export async function getPaymentBySession(sessionId: string): Promise<Payment | null> {
  if (isDemoMode()) return demo.getPaymentBySession(sessionId);

  const { data } = await supabaseAdmin()
    .from('payments')
    .select('*')
    .eq('session_id', sessionId)
    .eq('status', 'paid')
    .maybeSingle();
  return (data as Payment) ?? null;
}

/** レシート表示用。店舗が一致するものだけ返す */
export async function getPaymentById(
  paymentId: string,
  storeId: string
): Promise<Payment | null> {
  if (isDemoMode()) return demo.getPaymentById(paymentId);

  const { data } = await supabaseAdmin()
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .eq('store_id', storeId)
    .maybeSingle();
  return (data as Payment) ?? null;
}

// ---------------------------------------------------------------------------
// 現金在高・レジ締め
// ---------------------------------------------------------------------------

export async function getCashMovements(
  storeId: string,
  businessDay: string
): Promise<CashMovement[]> {
  if (isDemoMode()) return demo.getCashMovements(businessDay);

  const { data, error } = await supabaseAdmin()
    .from('cash_movements')
    .select('*')
    .eq('store_id', storeId)
    .eq('business_day', businessDay)
    .order('created_at');

  if (error) throw new Error(error.message);
  return (data ?? []) as CashMovement[];
}

export async function getCashClosing(
  storeId: string,
  businessDay: string
): Promise<CashDrawerClosing | null> {
  if (isDemoMode()) return demo.getCashClosing(businessDay);

  const { data } = await supabaseAdmin()
    .from('cash_drawer_closings')
    .select('*')
    .eq('store_id', storeId)
    .eq('business_day', businessDay)
    .maybeSingle();
  return (data as CashDrawerClosing) ?? null;
}

/**
 * その営業日の現金売上。締め画面で理論在高を出すために使う。
 * 取り消された会計（status = 'refunded'）は含めない。
 */
export async function getCashSales(storeId: string, businessDay: string): Promise<number> {
  if (isDemoMode()) return demo.getCashSales(businessDay);

  const store = await getStoreById(storeId);
  if (!store) return 0;

  // 営業日の判定は DB 関数と揃えたいので、前後 1 日を広めに取ってから絞り込む。
  // （タイムゾーンと区切り時刻のぶん、暦日とはずれるため）
  const { data, error } = await supabaseAdmin()
    .from('payments')
    .select('total, paid_at')
    .eq('store_id', storeId)
    .eq('status', 'paid')
    .eq('method', 'cash')
    .gte('paid_at', shiftDay(businessDay, -1))
    .lt('paid_at', shiftDay(businessDay, 2));

  if (error) throw new Error(error.message);

  return ((data ?? []) as { total: number; paid_at: string }[])
    .filter(
      (row) =>
        businessDate(new Date(row.paid_at), store.timezone, store.business_day_cutoff_hour) ===
        businessDay
    )
    .reduce((sum, row) => sum + row.total, 0);
}

function shiftDay(ymd: string, days: number): string {
  const date = new Date(`${ymd}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

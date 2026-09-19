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

  const { data } = await supabaseAdmin().from('shops').select('*').eq('slug', slug).maybeSingle();
  return (data as Store) ?? null;
}

export async function getStoreById(storeId: string): Promise<Store | null> {
  if (isDemoMode()) return demo.getStoreById(storeId);

  const { data } = await supabaseAdmin().from('shops').select('*').eq('id', storeId).maybeSingle();
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

  const shop = await getStoreById(storeId);
  if (!shop) return [];

  // マスターは業態単位、扱いは店舗単位。両方を引いて突き合わせる
  const [catRes, menuRes, dealRes, linkRes, optionRes, choiceRes, menuOptionRes] =
    await Promise.all([
      db.from('categories').select('*').eq('company_id', shop.company_id).eq('is_active', true).order('display_order'),
      db.from('menus').select('*').eq('company_id', shop.company_id).order('display_order'),
      db.from('shop_menus').select('*').eq('shop_id', storeId),
      db.from('category_menus').select('category_id, menu_id, display_order').order('display_order'),
      db.from('options').select('*').eq('company_id', shop.company_id).order('display_order'),
      db.from('choices').select('*').eq('is_available', true).order('display_order'),
      db.from('menu_options').select('menu_id, option_id, display_order').order('display_order'),
    ]);

  for (const res of [catRes, menuRes, dealRes, linkRes, optionRes, choiceRes, menuOptionRes]) {
    if (res.error) throw new Error(res.error.message);
  }

  type MenuRow = Omit<MenuItem, 'is_available' | 'is_sold_out'>;
  type DealRow = {
    menu_id: string;
    is_dealing: boolean;
    is_visible_customer: boolean;
    is_visible_staff: boolean;
    in_stock: boolean;
  };

  const categories = (catRes.data ?? []) as Category[];
  const menuRows = (menuRes.data ?? []) as MenuRow[];
  const deals = (dealRes.data ?? []) as DealRow[];
  const links = (linkRes.data ?? []) as { category_id: string; menu_id: string }[];
  const options = (optionRes.data ?? []) as OptionGroup[];
  const choices = (choiceRes.data ?? []) as MenuOption[];
  const menuOptions = (menuOptionRes.data ?? []) as { menu_id: string; option_id: string }[];

  const dealByMenu = new Map(deals.map((d) => [d.menu_id, d]));

  const choicesByOption = new Map<string, MenuOption[]>();
  for (const choice of choices) {
    const list = choicesByOption.get(choice.option_id) ?? [];
    list.push(choice);
    choicesByOption.set(choice.option_id, list);
  }

  const optionById = new Map(options.map((o) => [o.id, o]));
  const optionsByMenu = new Map<string, MenuItemWithOptions['option_groups']>();
  for (const link of menuOptions) {
    const option = optionById.get(link.option_id);
    if (!option) continue;
    const list = optionsByMenu.get(link.menu_id) ?? [];
    list.push({ ...option, options: choicesByOption.get(option.id) ?? [] });
    optionsByMenu.set(link.menu_id, list);
  }

  const items: MenuItemWithOptions[] = menuRows
    .map((menu) => {
      const deal = dealByMenu.get(menu.id);
      return {
        ...menu,
        // 店舗が扱っていて、スタッフにも出す設定なら注文できる
        is_available: Boolean(deal?.is_dealing && deal?.is_visible_staff),
        is_sold_out: deal ? !deal.in_stock : true,
        option_groups: optionsByMenu.get(menu.id) ?? [],
      };
    })
    .filter((item) => (onlyOrderable ? item.is_available && !item.is_notice_only : true));

  const menusByCategory = new Map<string, MenuItemWithOptions[]>();
  for (const link of links) {
    const item = items.find((i) => i.id === link.menu_id);
    if (!item) continue;
    const list = menusByCategory.get(link.category_id) ?? [];
    list.push(item);
    menusByCategory.set(link.category_id, list);
  }

  return categories.map((category) => ({
    ...category,
    items: menusByCategory.get(category.id) ?? [],
  }));
}

/** どのカテゴリにも属していないメニュー。管理画面で編集できるよう別に取得する */
export async function getUncategorizedItems(storeId: string): Promise<MenuItem[]> {
  if (isDemoMode()) return demo.getUncategorizedItems();

  const db = supabaseAdmin();
  const shop = await getStoreById(storeId);
  if (!shop) return [];

  const [menuRes, linkRes, dealRes] = await Promise.all([
    db.from('menus').select('*').eq('company_id', shop.company_id).order('display_order'),
    db.from('category_menus').select('menu_id'),
    db
      .from('shop_menus')
      .select('menu_id, is_dealing, is_visible_staff, in_stock')
      .eq('shop_id', storeId),
  ]);

  for (const res of [menuRes, linkRes, dealRes]) {
    if (res.error) throw new Error(res.error.message);
  }

  const linked = new Set(((linkRes.data ?? []) as { menu_id: string }[]).map((l) => l.menu_id));
  const deals = new Map(
    (
      (dealRes.data ?? []) as {
        menu_id: string;
        is_dealing: boolean;
        is_visible_staff: boolean;
        in_stock: boolean;
      }[]
    ).map((d) => [d.menu_id, d])
  );

  return ((menuRes.data ?? []) as Omit<MenuItem, 'is_available' | 'is_sold_out'>[])
    .filter((menu) => !linked.has(menu.id))
    .map((menu) => {
      const deal = deals.get(menu.id);
      return {
        ...menu,
        is_available: Boolean(deal?.is_dealing && deal?.is_visible_staff),
        is_sold_out: deal ? !deal.in_stock : true,
      };
    });
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

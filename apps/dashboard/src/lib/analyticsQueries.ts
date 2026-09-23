import 'server-only';

import { db } from './demo';
import { isDemoMode, supabaseAdmin } from './supabase';
import type {
  DailySummary,
  HourlySummary,
  MenuSummary,
  OrderItemOption,
  ProductType,
} from './types';

/**
 * 分析の集計（仕様書 §6.x）。
 *
 * 指示書は日次マテビューを想定しているが、この規模なら会計と注文明細から
 * その場で数えても十分に速く、数字が古くなる心配も無い。
 * 重くなってきたらここをマテビューへ差し替える。
 */

export interface Range {
  from: string;
  to: string;
}

/** 当月の 1 日〜末日 */
export function monthRange(yearMonth: string): Range {
  const [year, month] = yearMonth.split('-').map(Number);
  const last = new Date(year, month, 0).getDate();
  return { from: `${yearMonth}-01`, to: `${yearMonth}-${String(last).padStart(2, '0')}` };
}

interface RawPayment {
  store_id: string;
  paid_at: string;
  total: number;
  guest_count: number | null;
  status: string;
}

interface RawItem {
  session_id: string;
  menu_id: string | null;
  name_snapshot: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}

async function loadPayments(shopIds: string[], range: Range): Promise<RawPayment[]> {
  if (shopIds.length === 0) return [];

  if (isDemoMode()) {
    return db().paymentRecords.filter((p) => {
      if (!shopIds.includes(p.store_id)) return false;
      const day = p.paid_at.slice(0, 10);
      return day >= range.from && day <= range.to && p.status === 'paid';
    });
  }

  const { data, error } = await supabaseAdmin()
    .from('payments')
    .select('store_id, paid_at, total, guest_count, status')
    .in('store_id', shopIds)
    .eq('status', 'paid')
    .gte('paid_at', `${range.from}T00:00:00+09:00`)
    .lte('paid_at', `${range.to}T23:59:59+09:00`);

  if (error) throw new Error(error.message);
  return (data ?? []) as RawPayment[];
}

/** 日別の売上・客数・組数（§6.4）。目標も一緒に載せる */
export async function getDailySummaries(
  shopIds: string[],
  range: Range
): Promise<DailySummary[]> {
  const payments = await loadPayments(shopIds, range);
  const targets = await getDailyTargets(shopIds, range);

  const byDay = new Map<string, DailySummary>();

  // 期間中の全日を 0 で埋めてから積む。売上ゼロの日も並ぶようにする
  for (let d = new Date(range.from); d.toISOString().slice(0, 10) <= range.to; d.setDate(d.getDate() + 1)) {
    const day = d.toISOString().slice(0, 10);
    byDay.set(day, {
      business_date: day,
      sales: 0,
      guest_count: 0,
      group_count: 0,
      target: targets.get(day) ?? 0,
    });
  }

  for (const payment of payments) {
    const day = payment.paid_at.slice(0, 10);
    const row = byDay.get(day);
    if (!row) continue;
    row.sales += payment.total;
    row.guest_count += payment.guest_count ?? 0;
    row.group_count += 1;
  }

  return [...byDay.values()].sort((a, b) => (a.business_date < b.business_date ? -1 : 1));
}

async function getDailyTargets(shopIds: string[], range: Range): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (shopIds.length === 0) return map;

  if (isDemoMode()) {
    for (const row of db().dailySalesTargets) {
      if (!shopIds.includes(row.shop_id)) continue;
      if (row.business_date < range.from || row.business_date > range.to) continue;
      map.set(row.business_date, (map.get(row.business_date) ?? 0) + row.amount);
    }
    return map;
  }

  const { data, error } = await supabaseAdmin()
    .from('daily_sales_targets')
    .select('business_date, amount')
    .in('shop_id', shopIds)
    .gte('business_date', range.from)
    .lte('business_date', range.to);

  if (error) throw new Error(error.message);

  for (const row of (data ?? []) as { business_date: string; amount: number }[]) {
    map.set(row.business_date, (map.get(row.business_date) ?? 0) + row.amount);
  }
  return map;
}

/** 時間帯別（§6.9 の曜日・時間別分析） */
export async function getHourlySummaries(
  shopIds: string[],
  range: Range
): Promise<HourlySummary[]> {
  const payments = await loadPayments(shopIds, range);

  const byKey = new Map<string, HourlySummary>();
  for (const payment of payments) {
    const day = payment.paid_at.slice(0, 10);
    const hour = Number(payment.paid_at.slice(11, 13));
    const key = `${day}|${hour}`;

    const row = byKey.get(key) ?? { business_date: day, hour, sales: 0, guest_count: 0 };
    row.sales += payment.total;
    row.guest_count += payment.guest_count ?? 0;
    byKey.set(key, row);
  }

  return [...byKey.values()];
}

/** 商品別の集計（§6.5 の ABC 分析） */
export async function getMenuSummaries(
  shopIds: string[],
  range: Range,
  companyId: string
): Promise<MenuSummary[]> {
  if (shopIds.length === 0) return [];

  let items: RawItem[] = [];
  const menuMeta = new Map<
    string,
    { type: ProductType; category: string | null; cost: number | null }
  >();

  if (isDemoMode()) {
    const state = db();

    const sessionIds = new Set(
      state.paymentRecords
        .filter((p) => {
          if (!shopIds.includes(p.store_id)) return false;
          const day = p.paid_at.slice(0, 10);
          return day >= range.from && day <= range.to && p.status === 'paid';
        })
        .map((p) => p.session_id)
    );

    items = state.orderItemRecords.filter((item) => sessionIds.has(item.session_id));

    for (const menu of state.menus.filter((m) => m.company_id === companyId)) {
      const categoryId = state.categoryMenus.find((l) => l.menu_id === menu.id)?.category_id;
      menuMeta.set(menu.id, {
        type: menu.menu_type === 'drink' ? 'drink' : menu.menu_type === 'food' ? 'food' : 'other',
        category: categoryId
          ? (state.categories.find((c) => c.id === categoryId)?.name ?? null)
          : null,
        cost: menu.cost_price,
      });
    }
  } else {
    const supabase = supabaseAdmin();

    const { data: paymentData } = await supabase
      .from('payments')
      .select('session_id')
      .in('store_id', shopIds)
      .eq('status', 'paid')
      .gte('paid_at', `${range.from}T00:00:00+09:00`)
      .lte('paid_at', `${range.to}T23:59:59+09:00`);

    const sessionIds = ((paymentData ?? []) as { session_id: string }[]).map((p) => p.session_id);

    if (sessionIds.length > 0) {
      const { data } = await supabase
        .from('order_items')
        .select('session_id, menu_id, name_snapshot, unit_price, quantity, line_total')
        .in('session_id', sessionIds);
      items = (data ?? []) as RawItem[];
    }

    const [menuRes, catRes, linkRes] = await Promise.all([
      supabase
        .from('menus')
        .select('id, menu_type, cost_price')
        .eq('company_id', companyId),
      supabase.from('categories').select('id, name').eq('company_id', companyId),
      supabase.from('category_menus').select('category_id, menu_id'),
    ]);

    const categoryName = new Map(
      ((catRes.data ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name])
    );
    const links = (linkRes.data ?? []) as { category_id: string; menu_id: string }[];

    for (const menu of ((menuRes.data ?? []) as {
      id: string;
      menu_type: string;
      cost_price: number | null;
    }[])) {
      const link = links.find((l) => l.menu_id === menu.id);
      menuMeta.set(menu.id, {
        type: menu.menu_type === 'drink' ? 'drink' : menu.menu_type === 'food' ? 'food' : 'other',
        category: link ? (categoryName.get(link.category_id) ?? null) : null,
        cost: menu.cost_price,
      });
    }
  }

  const byMenu = new Map<string, MenuSummary>();

  for (const item of items) {
    const key = item.menu_id ?? item.name_snapshot;
    const meta = item.menu_id ? menuMeta.get(item.menu_id) : undefined;

    const row =
      byMenu.get(key) ??
      ({
        menu_id: item.menu_id,
        name: item.name_snapshot,
        category_name: meta?.category ?? null,
        menu_type: meta?.type ?? 'other',
        unit_price: item.unit_price,
        qty: 0,
        sales: 0,
        gross_profit: 0,
      } satisfies MenuSummary);

    row.qty += item.quantity;
    row.sales += item.line_total;
    // 原価が未設定のメニューは、売上をそのまま粗利として扱う
    row.gross_profit += item.line_total - (meta?.cost ?? 0) * item.quantity;
    byMenu.set(key, row);
  }

  return [...byMenu.values()].sort((a, b) => b.sales - a.sales);
}

/** 店舗ごとの売上・客数（§6.1 の店舗別 KPI） */
export interface ShopSummary {
  shop_id: string;
  sales: number;
  guest_count: number;
  group_count: number;
}

export async function getShopSummaries(
  shopIds: string[],
  range: Range
): Promise<ShopSummary[]> {
  const payments = await loadPayments(shopIds, range);

  const byShop = new Map<string, ShopSummary>(
    shopIds.map((id) => [id, { shop_id: id, sales: 0, guest_count: 0, group_count: 0 }])
  );

  for (const payment of payments) {
    const row = byShop.get(payment.store_id);
    if (!row) continue;
    row.sales += payment.total;
    row.guest_count += payment.guest_count ?? 0;
    row.group_count += 1;
  }

  return [...byShop.values()];
}

export interface CookingTimeRow {
  menu_id: string;
  name: string;
  category: string;
  orders: number;
  /** 分。注文 → 調理完了 */
  cook_min: number;
  /** 分。調理完了 → スタッフが受け取る */
  pickup_min: number;
  /** 分。受け取り → お客様に出す */
  serve_min: number;
  total_min: number;
}

/**
 * 調理・配膳時間分析（§6.9）。
 * KDS の打刻が入っている明細だけを数える。打刻が無い店舗は 0 件になる。
 */
export async function getCookingTimes(
  shopIds: string[],
  range: Range,
  categoryByMenu: Map<string, string>
): Promise<CookingTimeRow[]> {
  if (shopIds.length === 0) return [];

  let items: {
    menu_id: string | null;
    name_snapshot: string;
    placed_at: string;
    cooked_at: string | null;
    picked_up_at: string | null;
    served_at: string | null;
  }[] = [];

  if (isDemoMode()) {
    const state = db();
    const orders = new Map(
      state.orderRecords
        .filter((order) => shopIds.includes(order.store_id))
        .map((order) => [order.id, order])
    );
    items = state.orderItemRecords
      .filter((item) => orders.has(item.order_id))
      .map((item) => ({
        menu_id: item.menu_id,
        name_snapshot: item.name_snapshot,
        placed_at: orders.get(item.order_id)!.placed_at,
        cooked_at: item.cooked_at,
        picked_up_at: item.picked_up_at,
        served_at: item.served_at,
      }))
      .filter((item) => {
        const day = item.placed_at.slice(0, 10);
        return day >= range.from && day <= range.to;
      });
  } else {
    const { data, error } = await supabaseAdmin()
      .from('order_items')
      .select('menu_id, name_snapshot, cooked_at, picked_up_at, served_at, orders!inner(store_id, placed_at)')
      .in('orders.store_id', shopIds)
      .gte('orders.placed_at', `${range.from}T00:00:00+09:00`)
      .lte('orders.placed_at', `${range.to}T23:59:59+09:00`)
      .not('served_at', 'is', null)
      .limit(20000);

    if (error) throw new Error(error.message);
    items = ((data ?? []) as unknown as {
      menu_id: string | null;
      name_snapshot: string;
      cooked_at: string | null;
      picked_up_at: string | null;
      served_at: string | null;
      orders: { placed_at: string };
    }[]).map((row) => ({
      menu_id: row.menu_id,
      name_snapshot: row.name_snapshot,
      placed_at: row.orders.placed_at,
      cooked_at: row.cooked_at,
      picked_up_at: row.picked_up_at,
      served_at: row.served_at,
    }));
  }

  const minutes = (from: string, to: string) =>
    (Date.parse(to) - Date.parse(from)) / 60000;

  const acc = new Map<
    string,
    { name: string; orders: number; cook: number; pickup: number; serve: number }
  >();

  for (const item of items) {
    if (!item.cooked_at || !item.picked_up_at || !item.served_at) continue;
    const key = item.menu_id ?? item.name_snapshot;
    const current = acc.get(key) ?? { name: item.name_snapshot, orders: 0, cook: 0, pickup: 0, serve: 0 };
    current.orders += 1;
    current.cook += minutes(item.placed_at, item.cooked_at);
    current.pickup += minutes(item.cooked_at, item.picked_up_at);
    current.serve += minutes(item.picked_up_at, item.served_at);
    acc.set(key, current);
  }

  const round = (value: number) => Math.round(value * 10) / 10;

  return [...acc.entries()]
    .map(([menuId, value]) => {
      const cook = round(value.cook / value.orders);
      const pickup = round(value.pickup / value.orders);
      const serve = round(value.serve / value.orders);
      return {
        menu_id: menuId,
        name: value.name,
        category: categoryByMenu.get(menuId) ?? '—',
        orders: value.orders,
        cook_min: cook,
        pickup_min: pickup,
        serve_min: serve,
        total_min: round(cook + pickup + serve),
      };
    })
    .sort((a, b) => b.total_min - a.total_min);
}

export interface OptionSummary {
  key: string;
  group: string;
  name: string;
  qty: number;
  sales: number;
}

/** オプション別の出数と売上（§6.5 の粒度タブ「オプション別」） */
export async function getOptionSummaries(
  shopIds: string[],
  range: Range
): Promise<OptionSummary[]> {
  if (shopIds.length === 0) return [];

  let items: { quantity: number; options_snapshot: OrderItemOption[] }[] = [];

  if (isDemoMode()) {
    const state = db();
    const sessionIds = new Set(
      state.paymentRecords
        .filter((p) => {
          if (!shopIds.includes(p.store_id)) return false;
          const day = p.paid_at.slice(0, 10);
          return day >= range.from && day <= range.to && p.status === 'paid';
        })
        .map((p) => p.session_id)
    );
    items = state.orderItemRecords
      .filter((item) => sessionIds.has(item.session_id))
      .map((item) => ({ quantity: item.quantity, options_snapshot: item.options_snapshot }));
  } else {
    const supabase = supabaseAdmin();

    const { data: paymentData, error: paymentError } = await supabase
      .from('payments')
      .select('session_id')
      .in('store_id', shopIds)
      .eq('status', 'paid')
      .gte('paid_at', `${range.from}T00:00:00+09:00`)
      .lte('paid_at', `${range.to}T23:59:59+09:00`);
    if (paymentError) throw new Error(paymentError.message);

    const sessionIds = ((paymentData ?? []) as { session_id: string }[]).map((p) => p.session_id);
    if (sessionIds.length === 0) return [];

    const { data, error } = await supabase
      .from('order_items')
      .select('quantity, options_snapshot')
      .in('session_id', sessionIds)
      .limit(20000);
    if (error) throw new Error(error.message);

    items = (data ?? []) as { quantity: number; options_snapshot: OrderItemOption[] }[];
  }

  const acc = new Map<string, OptionSummary>();

  for (const item of items) {
    for (const option of item.options_snapshot ?? []) {
      const key = `${option.group}|${option.name}`;
      const current =
        acc.get(key) ?? { key, group: option.group, name: option.name, qty: 0, sales: 0 };
      current.qty += item.quantity;
      // オプションの売上は差額ぶんだけ。本体の価格は商品側で数える
      current.sales += option.price_delta * item.quantity;
      acc.set(key, current);
    }
  }

  return [...acc.values()].sort((a, b) => b.qty - a.qty);
}

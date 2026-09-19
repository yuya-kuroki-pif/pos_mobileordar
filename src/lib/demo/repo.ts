import 'server-only';

import { businessDate } from '../format';
import type {
  Category,
  CategoryWithItems,
  ItemRankingRow,
  KdsItem,
  MenuItem,
  MenuItemWithOptions,
  OptionGroupWithOptions,
  Order,
  OrderChannel,
  OrderItem,
  OrderItemStatus,
  Payment,
  PaymentMethod,
  PrepStation,
  RestaurantTable,
  SalesSummaryRow,
  SelectedOption,
  SessionTotal,
  Store,
  TableSession,
  TableWithSession,
} from '../types';
import { createDemoState, type DemoState } from './data';

/**
 * デモモードのデータ操作。
 *
 * queries.ts / actions が Supabase の代わりに呼ぶ。
 * 金額計算・伝票番号の採番・会計処理は supabase/migrations の SQL 関数と
 * 同じ手順を踏むようにしてある（片方だけ直すと挙動がずれるため要注意）。
 */

// 開発中の HMR でモジュールが再評価されてもデータが消えないよう globalThis に置く
const globalStore = globalThis as typeof globalThis & { __posDemoState?: DemoState };

function db(): DemoState {
  globalStore.__posDemoState ??= createDemoState();
  return globalStore.__posDemoState;
}

/** デモデータを初期状態に戻す */
export function resetDemoState(): void {
  globalStore.__posDemoState = createDemoState();
}

function id(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

/** 呼び出し側が受け取ったオブジェクトを書き換えても内部状態が壊れないようにする */
function clone<T>(value: T): T {
  return structuredClone(value);
}

// ===========================================================================
// 参照
// ===========================================================================

export function getStore(): Store {
  return clone(db().store);
}

export function getStoreBySlug(slug: string): Store | null {
  const state = db();
  return state.store.slug === slug ? clone(state.store) : null;
}

export function getStoreById(storeId: string): Store | null {
  const state = db();
  return state.store.id === storeId ? clone(state.store) : null;
}

export function getTables(): RestaurantTable[] {
  return clone(db().tables).sort((a, b) => a.sort_order - b.sort_order);
}

export function getTableByToken(token: string): RestaurantTable | null {
  const table = db().tables.find((t) => t.qr_token === token && t.is_active);
  return table ? clone(table) : null;
}

export function getFloorMap(): TableWithSession[] {
  const state = db();

  return state.tables
    .filter((table) => table.is_active)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((table) => {
      const session =
        state.sessions.find(
          (s) => s.table_id === table.id && (s.status === 'open' || s.status === 'bill_requested')
        ) ?? null;

      const items = session
        ? state.orderItems.filter((i) => i.session_id === session.id && i.status !== 'cancelled')
        : [];

      return {
        ...clone(table),
        session: session ? clone(session) : null,
        current_total: items.reduce((sum, i) => sum + i.line_total, 0),
        item_count: items.reduce((sum, i) => sum + i.quantity, 0),
        pending_count: items
          .filter((i) => i.status === 'pending' || i.status === 'cooking')
          .reduce((sum, i) => sum + i.quantity, 0),
      };
    });
}

export function getMenuTree(onlyOrderable: boolean): CategoryWithItems[] {
  const state = db();

  const groupsByItem = new Map<string, OptionGroupWithOptions[]>();
  for (const link of state.itemOptionGroups) {
    const group = state.optionGroups.find((g) => g.id === link.option_group_id);
    if (!group) continue;
    const list = groupsByItem.get(link.menu_item_id) ?? [];
    list.push({
      ...clone(group),
      options: clone(
        state.options.filter((o) => o.group_id === group.id && o.is_available)
      ).sort((a, b) => a.sort_order - b.sort_order),
    });
    groupsByItem.set(link.menu_item_id, list);
  }

  const items: MenuItemWithOptions[] = state.menuItems
    .filter((item) => (onlyOrderable ? item.is_available : true))
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((item) => ({ ...clone(item), option_groups: groupsByItem.get(item.id) ?? [] }));

  return state.categories
    .filter((category) => category.is_active)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((category) => ({
      ...clone(category),
      items: items.filter((item) => item.category_id === category.id),
    }));
}

export function getUncategorizedItems(): MenuItem[] {
  return clone(db().menuItems.filter((item) => item.category_id === null)).sort(
    (a, b) => a.sort_order - b.sort_order
  );
}

export function getSession(sessionId: string): TableSession | null {
  const session = db().sessions.find((s) => s.id === sessionId);
  return session ? clone(session) : null;
}

export function getOpenSessionForTable(tableId: string): TableSession | null {
  const session = db().sessions.find(
    (s) => s.table_id === tableId && (s.status === 'open' || s.status === 'bill_requested')
  );
  return session ? clone(session) : null;
}

export function getSessionItems(sessionId: string): OrderItem[] {
  return clone(db().orderItems.filter((i) => i.session_id === sessionId)).sort((a, b) =>
    a.created_at.localeCompare(b.created_at)
  );
}

export function getSessionOrders(sessionId: string): Order[] {
  return clone(db().orders.filter((o) => o.session_id === sessionId)).sort((a, b) =>
    a.placed_at.localeCompare(b.placed_at)
  );
}

export function getSessionTotal(sessionId: string, discount = 0): SessionTotal {
  const state = db();

  const subtotal = state.orderItems
    .filter((i) => i.session_id === sessionId && i.status !== 'cancelled')
    .reduce((sum, i) => sum + i.line_total, 0);

  const serviceCharge = Math.round(subtotal * state.store.service_charge_rate);
  const appliedDiscount = Math.max(discount, 0);
  const base = Math.max(subtotal + serviceCharge - appliedDiscount, 0);
  const rate = state.store.tax_rate;

  const tax = state.store.tax_included
    ? Math.round((base * rate) / (1 + rate))
    : Math.round(base * rate);

  return {
    subtotal,
    service_charge: serviceCharge,
    discount: Math.min(appliedDiscount, subtotal + serviceCharge),
    tax,
    total: state.store.tax_included ? base : base + tax,
  };
}

export function getKdsItems(): KdsItem[] {
  const state = db();

  return state.orderItems
    .filter((i) => i.status === 'pending' || i.status === 'cooking' || i.status === 'ready')
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((item) => {
      const order = state.orders.find((o) => o.id === item.order_id);
      const session = state.sessions.find((s) => s.id === item.session_id);
      const table = state.tables.find((t) => t.id === session?.table_id);
      return {
        ...clone(item),
        order_number: order?.order_number ?? 0,
        channel: order?.channel ?? ('pos' as OrderChannel),
        table_name: table?.name ?? '-',
      };
    });
}

// ---------------------------------------------------------------------------
// 売上
// ---------------------------------------------------------------------------

function paymentBusinessDate(payment: Payment): string {
  const store = db().store;
  return businessDate(new Date(payment.paid_at), store.timezone, store.business_day_cutoff_hour);
}

export function getSalesSummary(from: string, to: string): SalesSummaryRow[] {
  const state = db();

  const byDay = new Map<string, { sessions: number; guests: number; sales: number; discount: number; tax: number }>();

  for (const payment of state.payments) {
    if (payment.status !== 'paid') continue;
    const day = paymentBusinessDate(payment);
    if (day < from || day > to) continue;

    const session = state.sessions.find((s) => s.id === payment.session_id);
    const acc = byDay.get(day) ?? { sessions: 0, guests: 0, sales: 0, discount: 0, tax: 0 };
    acc.sessions += 1;
    acc.guests += session?.guest_count ?? 0;
    acc.sales += payment.total;
    acc.discount += payment.discount;
    acc.tax += payment.tax;
    byDay.set(day, acc);
  }

  return [...byDay.entries()]
    .map(([day, acc]) => ({
      business_day: day,
      sessions: acc.sessions,
      guests: acc.guests,
      gross_sales: acc.sales,
      discount_total: acc.discount,
      tax_total: acc.tax,
      avg_per_guest: acc.guests === 0 ? 0 : Math.floor(acc.sales / acc.guests),
    }))
    .sort((a, b) => b.business_day.localeCompare(a.business_day));
}

export function getItemRanking(from: string, to: string, limit: number): ItemRankingRow[] {
  const state = db();
  const store = state.store;

  const byName = new Map<string, { quantity: number; sales: number }>();

  for (const item of state.orderItems) {
    if (item.status === 'cancelled') continue;
    const day = businessDate(
      new Date(item.created_at),
      store.timezone,
      store.business_day_cutoff_hour
    );
    if (day < from || day > to) continue;

    const acc = byName.get(item.name_snapshot) ?? { quantity: 0, sales: 0 };
    acc.quantity += item.quantity;
    acc.sales += item.line_total;
    byName.set(item.name_snapshot, acc);
  }

  return [...byName.entries()]
    .map(([name, acc]) => ({ name, quantity: acc.quantity, sales: acc.sales }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, Math.max(limit, 1));
}

export function getPayments(
  limit: number
): (Payment & { table_name: string; guest_count: number })[] {
  const state = db();

  return clone(state.payments)
    .sort((a, b) => b.paid_at.localeCompare(a.paid_at))
    .slice(0, limit)
    .map((payment) => {
      const session = state.sessions.find((s) => s.id === payment.session_id);
      const table = state.tables.find((t) => t.id === session?.table_id);
      return {
        ...payment,
        table_name: table?.name ?? '-',
        guest_count: session?.guest_count ?? 0,
      };
    });
}

export function getPaymentBySession(sessionId: string): Payment | null {
  const payment = db().payments.find((p) => p.session_id === sessionId && p.status === 'paid');
  return payment ? clone(payment) : null;
}

export function getPaymentById(paymentId: string): Payment | null {
  const payment = db().payments.find((p) => p.id === paymentId);
  return payment ? clone(payment) : null;
}

// ===========================================================================
// 更新
// ===========================================================================

/** デモの PIN。実 DB では crypt() によるハッシュ照合を行う */
const DEMO_PIN = '1234';

export function verifyPin(slug: string, pin: string): string | null {
  const state = db();
  return state.store.slug === slug && pin === DEMO_PIN ? state.store.id : null;
}

export function openTableSession(tableId: string, guestCount: number): string {
  const state = db();

  const table = state.tables.find((t) => t.id === tableId && t.is_active);
  if (!table) throw new Error('卓が見つかりません。');

  const existing = state.sessions.find(
    (s) => s.table_id === tableId && (s.status === 'open' || s.status === 'bill_requested')
  );
  if (existing) return existing.id;

  const session: TableSession = {
    id: id('ses'),
    store_id: state.store.id,
    table_id: tableId,
    guest_count: Math.max(1, Math.floor(guestCount)),
    status: 'open',
    opened_at: nowIso(),
    closed_at: null,
    note: null,
  };
  state.sessions.push(session);
  return session.id;
}

export interface DemoOrderLine {
  menu_item_id: string;
  quantity: number;
  option_ids: string[];
  note?: string | null;
}

export function placeOrder(
  sessionId: string,
  channel: OrderChannel,
  lines: DemoOrderLine[]
): string {
  const state = db();

  const session = state.sessions.find((s) => s.id === sessionId);
  if (!session) throw new Error('対象の卓が見つかりません。');
  if (session.status !== 'open' && session.status !== 'bill_requested') {
    throw new Error('この卓はすでに会計済みです');
  }
  if (lines.length === 0) throw new Error('注文内容が空です');

  // 伝票番号は営業日ごとに 1 から振り直す
  const today = businessDate(new Date(), state.store.timezone, state.store.business_day_cutoff_hour);
  const todaysMax = state.orders
    .filter(
      (o) =>
        businessDate(
          new Date(o.placed_at),
          state.store.timezone,
          state.store.business_day_cutoff_hour
        ) === today
    )
    .reduce((max, o) => Math.max(max, o.order_number), 0);

  const placedAt = nowIso();
  const order: Order = {
    id: id('ord'),
    store_id: state.store.id,
    session_id: sessionId,
    order_number: todaysMax + 1,
    channel,
    note: null,
    placed_at: placedAt,
  };
  state.orders.push(order);

  for (const line of lines) {
    // 価格はクライアントから受け取らず、必ずメニューから引き直す
    const menuItem = state.menuItems.find((m) => m.id === line.menu_item_id);
    if (!menuItem) throw new Error('商品が見つかりません');
    if (!menuItem.is_available || menuItem.is_sold_out) {
      throw new Error(`「${menuItem.name}」は現在ご注文いただけません`);
    }

    const selected: SelectedOption[] = [];
    let optionsPrice = 0;
    for (const optionId of line.option_ids) {
      const option = state.options.find((o) => o.id === optionId && o.is_available);
      if (!option) continue;
      const group = state.optionGroups.find((g) => g.id === option.group_id);
      selected.push({
        group: group?.name ?? '',
        name: option.name,
        price_delta: option.price_delta,
      });
      optionsPrice += option.price_delta;
    }

    const quantity = Math.max(1, Math.floor(line.quantity));
    state.orderItems.push({
      id: id('oi'),
      store_id: state.store.id,
      order_id: order.id,
      session_id: sessionId,
      menu_item_id: menuItem.id,
      name_snapshot: menuItem.name,
      unit_price: menuItem.price,
      options_price: optionsPrice,
      options_snapshot: selected,
      quantity,
      tax_rate: menuItem.tax_rate ?? state.store.tax_rate,
      prep_station: menuItem.prep_station,
      status: 'pending',
      note: line.note?.trim() || null,
      created_at: placedAt,
      updated_at: placedAt,
      line_total: (menuItem.price + optionsPrice) * quantity,
    });
  }

  return order.id;
}

export function updateItemStatus(itemId: string, status: OrderItemStatus): void {
  const item = db().orderItems.find((i) => i.id === itemId);
  if (!item) return;
  item.status = status;
  item.updated_at = nowIso();
}

export function updateItemQuantity(itemId: string, quantity: number): void {
  const item = db().orderItems.find((i) => i.id === itemId);
  if (!item) return;

  if (quantity <= 0) {
    item.status = 'cancelled';
  } else {
    item.quantity = Math.floor(quantity);
    item.line_total = (item.unit_price + item.options_price) * item.quantity;
  }
  item.updated_at = nowIso();
}

export function requestBill(sessionId: string): void {
  const session = db().sessions.find((s) => s.id === sessionId);
  if (session?.status === 'open') session.status = 'bill_requested';
}

export function updateGuestCount(sessionId: string, guestCount: number): void {
  const session = db().sessions.find((s) => s.id === sessionId);
  if (session) session.guest_count = Math.max(1, Math.floor(guestCount));
}

export function cancelSession(sessionId: string): void {
  const state = db();
  const session = state.sessions.find((s) => s.id === sessionId);
  if (!session) return;

  const hasItems = state.orderItems.some(
    (i) => i.session_id === sessionId && i.status !== 'cancelled'
  );
  if (hasItems) throw new Error('注文が入っているため取り消せません。会計を行ってください。');

  session.status = 'cancelled';
  session.closed_at = nowIso();
}

export function checkoutSession(
  sessionId: string,
  method: PaymentMethod,
  discount: number,
  received: number
): string {
  const state = db();

  const session = state.sessions.find((s) => s.id === sessionId);
  if (!session) throw new Error('対象の卓が見つかりません。');
  if (session.status === 'closed') throw new Error('この卓はすでに会計済みです');

  const calc = getSessionTotal(sessionId, discount);

  if (method === 'cash' && received < calc.total) {
    throw new Error(`預かり金が不足しています（合計 ${calc.total}円 / 預かり ${received}円）`);
  }

  const payment: Payment = {
    id: id('pay'),
    store_id: state.store.id,
    session_id: sessionId,
    method,
    subtotal: calc.subtotal,
    discount: calc.discount,
    service_charge: calc.service_charge,
    tax: calc.tax,
    total: calc.total,
    received: method === 'cash' ? received : calc.total,
    change_due: method === 'cash' ? received - calc.total : 0,
    status: 'paid',
    note: null,
    paid_at: nowIso(),
  };
  state.payments.push(payment);

  // 未提供のまま残った明細は提供済みに倒す
  for (const item of state.orderItems) {
    if (item.session_id !== sessionId) continue;
    if (item.status === 'pending' || item.status === 'cooking' || item.status === 'ready') {
      item.status = 'served';
    }
  }

  session.status = 'closed';
  session.closed_at = nowIso();

  return payment.id;
}

// ---------------------------------------------------------------------------
// マスタ管理
// ---------------------------------------------------------------------------

export function saveCategory(input: {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
}): void {
  const state = db();
  const existing = state.categories.find((c) => c.id === input.id);

  if (existing) {
    Object.assign(existing, input);
    return;
  }

  state.categories.push({
    id: id('cat'),
    store_id: state.store.id,
    name: input.name,
    description: input.description,
    sort_order: input.sort_order,
    is_active: input.is_active,
    created_at: nowIso(),
  } satisfies Category);
}

export function deleteCategory(categoryId: string): void {
  const state = db();
  state.categories = state.categories.filter((c) => c.id !== categoryId);
  // 配下の商品は消さず「カテゴリ未設定」に移す（DB の on delete set null と同じ）
  for (const item of state.menuItems) {
    if (item.category_id === categoryId) item.category_id = null;
  }
}

export function saveMenuItem(input: {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  prep_station: PrepStation;
  is_available: boolean;
  is_sold_out: boolean;
  sort_order: number;
}): void {
  const state = db();
  const existing = state.menuItems.find((m) => m.id === input.id);

  if (existing) {
    Object.assign(existing, input, { updated_at: nowIso() });
    return;
  }

  state.menuItems.push({
    ...input,
    id: id('item'),
    store_id: state.store.id,
    tax_rate: null,
    created_at: nowIso(),
    updated_at: nowIso(),
  } satisfies MenuItem);
}

export function toggleSoldOut(itemId: string, soldOut: boolean): void {
  const item = db().menuItems.find((m) => m.id === itemId);
  if (item) {
    item.is_sold_out = soldOut;
    item.updated_at = nowIso();
  }
}

export function deleteMenuItem(itemId: string): void {
  const state = db();
  state.menuItems = state.menuItems.filter((m) => m.id !== itemId);
  state.itemOptionGroups = state.itemOptionGroups.filter((l) => l.menu_item_id !== itemId);
}

export function saveTable(input: {
  id: string;
  name: string;
  area: string | null;
  seats: number;
  sort_order: number;
  is_active: boolean;
}): void {
  const state = db();
  const existing = state.tables.find((t) => t.id === input.id);

  if (existing) {
    Object.assign(existing, input);
    return;
  }

  state.tables.push({
    ...input,
    id: id('tbl'),
    store_id: state.store.id,
    qr_token: id('demo-table'),
    created_at: nowIso(),
  } satisfies RestaurantTable);
}

export function deleteTable(tableId: string): void {
  const state = db();

  // 利用履歴のある卓は消せない（DB の on delete restrict と同じ）
  if (state.sessions.some((s) => s.table_id === tableId)) {
    throw new Error(
      'この卓には利用履歴があるため削除できません。「利用しない」に切り替えてください。'
    );
  }
  state.tables = state.tables.filter((t) => t.id !== tableId);
}

export function regenerateQrToken(tableId: string): string {
  const table = db().tables.find((t) => t.id === tableId);
  if (!table) throw new Error('卓が見つかりません。');
  table.qr_token = id('demo-table');
  return table.qr_token;
}

export function saveStoreSettings(input: {
  name: string;
  tax_rate: number;
  tax_included: boolean;
  service_charge_rate: number;
  mobile_order_open: boolean;
  opening_note: string | null;
  business_day_cutoff_hour: number;
}): void {
  Object.assign(db().store, input, { updated_at: nowIso() });
}

export function changePin(): never {
  // PIN はデモでは固定。変更できると再ログインできなくなるため受け付けない
  throw new Error('デモモードでは PIN を変更できません（固定で 1234 です）。');
}

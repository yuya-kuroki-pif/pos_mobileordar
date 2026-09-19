import 'server-only';

import { businessDate } from '../format';
import type {
  CashDrawerClosing,
  CashMovement,
  CashMovementKind,
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
  ServiceType,
  SessionTotal,
  Store,
  TableSession,
  TableWithSession,
  TaxBreakdownRow,
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

export function getMenuTree(onlyOrderable: boolean, locale = 'ja'): CategoryWithItems[] {
  const state = db();

  const groupsByItem = new Map<string, OptionGroupWithOptions[]>();
  for (const link of state.itemOptionGroups) {
    const group = state.optionGroups.find((g) => g.id === link.option_group_id);
    if (!group) continue;
    const list = groupsByItem.get(link.menu_item_id) ?? [];
    list.push({
      ...clone(group),
      options: clone(
        state.options.filter((o) => o.option_id === group.id && o.is_available)
      ).sort((a, b) => a.display_order - b.display_order),
    });
    groupsByItem.set(link.menu_item_id, list);
  }

  const items: MenuItemWithOptions[] = state.menuItems
    .filter((item) => (onlyOrderable ? item.is_available && !item.is_notice_only : true))
    .sort((a, b) => a.display_order - b.display_order)
    .map((item) => ({ ...clone(item), option_groups: groupsByItem.get(item.id) ?? [] }));

  // カテゴリとメニューは多対多（category_menus）
  const tree = state.categories
    .filter((category) => category.is_active)
    .sort((a, b) => a.display_order - b.display_order)
    .map((category) => ({
      ...clone(category),
      items: state.categoryMenus
        .filter((link) => link.category_id === category.id)
        .map((link) => items.find((item) => item.id === link.menu_id))
        .filter((item): item is MenuItemWithOptions => Boolean(item)),
    }));

  return locale === 'ja' ? tree : translateTree(tree, locale);
}

/** デモ用の訳。訳が無いものは日本語のまま残す */
const DEMO_TRANSLATIONS: Record<string, Record<string, string>> = {
  vi: {
    串焼き: 'Xiên nướng',
    炉端焼き: 'Nướng lò',
    一品料理: 'Món lẻ',
    ドリンク: 'Đồ uống',
    デザート: 'Tráng miệng',
    もも串: 'Xiên đùi gà',
    ねぎま: 'Xiên gà hành',
    'つくね（卵黄付き）': 'Chả gà viên (kèm lòng đỏ)',
    ハツ: 'Tim gà',
    ホッケ開き: 'Cá Hokke nướng',
    ハマグリ酒蒸し: 'Nghêu hấp rượu',
    ポテトフライ: 'Khoai tây chiên',
    だし巻き玉子: 'Trứng cuộn dashi',
    生ビール: 'Bia tươi',
    ハイボール: 'Highball',
    烏龍茶: 'Trà ô long',
    バニラアイス: 'Kem vani',
    焼き加減: 'Độ chín',
    サイズ: 'Kích cỡ',
    トッピング: 'Topping',
    おまかせ: 'Theo đầu bếp',
    しっかりめ: 'Chín kỹ',
    レアめ: 'Tái',
    レギュラー: 'Thường',
    メガジョッキ: 'Cốc lớn',
    温玉: 'Trứng lòng đào',
    マヨネーズ: 'Sốt mayonnaise',
    七味: 'Ớt bột shichimi',
    チーズ: 'Phô mai',
  },
  en: {
    串焼き: 'Grilled skewers',
    炉端焼き: 'Robatayaki',
    一品料理: 'A la carte',
    ドリンク: 'Drinks',
    デザート: 'Desserts',
    もも串: 'Chicken thigh skewer',
    ねぎま: 'Chicken & leek skewer',
    'つくね（卵黄付き）': 'Chicken meatball with yolk',
    ハツ: 'Chicken heart',
    ホッケ開き: 'Grilled atka mackerel',
    ハマグリ酒蒸し: 'Sake-steamed clams',
    ポテトフライ: 'French fries',
    だし巻き玉子: 'Dashi rolled omelette',
    生ビール: 'Draft beer',
    ハイボール: 'Highball',
    烏龍茶: 'Oolong tea',
    バニラアイス: 'Vanilla ice cream',
    焼き加減: 'Doneness',
    サイズ: 'Size',
    トッピング: 'Toppings',
    おまかせ: "Chef's choice",
    しっかりめ: 'Well done',
    レアめ: 'Rare',
    レギュラー: 'Regular',
    メガジョッキ: 'Mega mug',
    温玉: 'Soft-boiled egg',
    マヨネーズ: 'Mayonnaise',
    七味: 'Shichimi pepper',
    チーズ: 'Cheese',
  },
};

function translateTree(tree: CategoryWithItems[], locale: string): CategoryWithItems[] {
  const dict = DEMO_TRANSLATIONS[locale];
  if (!dict) return tree;

  const tr = (text: string) => dict[text] ?? text;

  return tree.map((category) => ({
    ...category,
    name: tr(category.name),
    items: category.items.map((item) => ({
      ...item,
      name: tr(item.name),
      option_groups: item.option_groups.map((group) => ({
        ...group,
        name: tr(group.name),
        options: group.options.map((option) => ({ ...option, name: tr(option.name) })),
      })),
    })),
  }));
}

export function getUncategorizedItems(): MenuItem[] {
  const state = db();
  const linked = new Set(state.categoryMenus.map((link) => link.menu_id));
  return clone(state.menuItems.filter((item) => !linked.has(item.id))).sort(
    (a, b) => a.display_order - b.display_order
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

/**
 * 会計金額の計算。SQL の calc_session_total と同じ手順を踏む。
 *   1. 税率ごとに合算 → 2. サービス料を標準税率へ加算
 *   → 3. 割引を金額按分（端数は最後のグループ） → 4. 税率ごとに消費税
 */
export function getSessionTotal(
  sessionId: string,
  discount = 0,
  onlyUnpaid = true,
  itemIds: string[] | null = null
): SessionTotal {
  const state = db();
  const store = state.store;

  const items = state.orderItems.filter(
    (i) =>
      i.session_id === sessionId &&
      i.status !== 'cancelled' &&
      (!onlyUnpaid || i.payment_id === null) &&
      (itemIds === null || itemIds.includes(i.id))
  );

  const subtotal = items.reduce((sum, i) => sum + i.line_total, 0);
  const serviceCharge = Math.round(subtotal * store.service_charge_rate);

  // 税率ごとに合算し、サービス料は標準税率のグループへ寄せる
  const byRate = new Map<number, number>();
  for (const item of items) {
    byRate.set(item.tax_rate, (byRate.get(item.tax_rate) ?? 0) + item.line_total);
  }
  if (serviceCharge > 0) {
    byRate.set(
      store.standard_tax_rate,
      (byRate.get(store.standard_tax_rate) ?? 0) + serviceCharge
    );
  }

  // 割引は税率の昇順に按分し、端数は最後のグループが負担する
  const groups = [...byRate.entries()].sort((a, b) => a[0] - b[0]);
  const gross = groups.reduce((sum, [, amount]) => sum + amount, 0);
  const appliedDiscount = Math.min(Math.max(discount, 0), gross);

  let allocated = 0;
  const breakdown: TaxBreakdownRow[] = [];

  groups.forEach(([rate, amount], index) => {
    const isLast = index === groups.length - 1;
    const share = gross === 0 ? 0 : Math.floor((appliedDiscount * amount) / gross);
    const actualShare = isLast ? appliedDiscount - allocated : share;
    allocated += share;

    const base = Math.max(amount - actualShare, 0);
    if (base <= 0) return;

    breakdown.push({
      rate,
      taxable: base,
      tax: store.tax_included
        ? Math.round((base * rate) / (1 + rate))
        : Math.round(base * rate),
    });
  });

  breakdown.sort((a, b) => b.rate - a.rate);

  const tax = breakdown.reduce((sum, b) => sum + b.tax, 0);
  const taxableTotal = breakdown.reduce((sum, b) => sum + b.taxable, 0);

  return {
    subtotal,
    service_charge: serviceCharge,
    discount: appliedDiscount,
    tax,
    total: store.tax_included ? taxableTotal : taxableTotal + tax,
    tax_breakdown: breakdown,
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

export function openTableSession(
  tableId: string,
  guestCount: number,
  serviceType: ServiceType = 'eat_in'
): string {
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
    service_type: serviceType,
    opened_at: nowIso(),
    closed_at: null,
    note: null,
  };
  state.sessions.push(session);
  return session.id;
}

export interface DemoOrderLine {
  menu_id: string;
  quantity: number;
  /** 選択したオプションの選択肢 ID */
  choice_ids: string[];
  note?: string | null;
}

export function placeOrder(
  sessionId: string,
  channel: OrderChannel,
  lines: DemoOrderLine[],
  serviceType: ServiceType | null = null
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

  const effectiveServiceType = serviceType ?? session.service_type;

  const placedAt = nowIso();
  const order: Order = {
    id: id('ord'),
    store_id: state.store.id,
    session_id: sessionId,
    order_number: todaysMax + 1,
    channel,
    service_type: effectiveServiceType,
    note: null,
    placed_at: placedAt,
  };
  state.orders.push(order);

  for (const line of lines) {
    // 価格はクライアントから受け取らず、必ずメニューから引き直す
    const menuItem = state.menuItems.find((m) => m.id === line.menu_id);
    if (!menuItem) throw new Error('商品が見つかりません');
    if (menuItem.is_notice_only) throw new Error(`「${menuItem.name}」は注文できません`);
    if (!menuItem.is_available || menuItem.is_sold_out) {
      throw new Error(`「${menuItem.name}」は現在ご注文いただけません`);
    }

    const selected: SelectedOption[] = [];
    let optionsPrice = 0;
    for (const choiceId of line.choice_ids) {
      const choice = state.options.find((o) => o.id === choiceId && o.is_available);
      if (!choice) continue;
      const group = state.optionGroups.find((g) => g.id === choice.option_id);
      selected.push({
        group: group?.name ?? '',
        name: choice.name,
        price_delta: choice.price,
      });
      optionsPrice += choice.price;
    }

    const quantity = Math.max(1, Math.floor(line.quantity));
    state.orderItems.push({
      id: id('oi'),
      store_id: state.store.id,
      order_id: order.id,
      session_id: sessionId,
      menu_id: menuItem.id,
      name_snapshot: menuItem.name,
      unit_price: menuItem.price,
      options_price: optionsPrice,
      options_snapshot: selected,
      quantity,
      // 持ち帰りの飲食料品だけが軽減税率。酒類・非飲食料品は標準税率のまま
      tax_rate:
        effectiveServiceType === 'takeout' && menuItem.reduced_rate_eligible
          ? state.store.reduced_tax_rate
          : menuItem.tax_rate,
      prep_station: menuItem.prep_station,
      status: 'pending',
      note: line.note?.trim() || null,
      created_at: placedAt,
      updated_at: placedAt,
      line_total: (menuItem.price + optionsPrice) * quantity,
      payment_id: null,
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

/** 提供形態の切り替え（店内 ⇔ 持ち帰り） */
export function updateServiceType(sessionId: string, serviceType: ServiceType): void {
  const session = db().sessions.find((s) => s.id === sessionId);
  if (session) session.service_type = serviceType;
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

/**
 * 会計する。
 *   itemIds 指定    → その明細だけを会計する（明細指定の分割）
 *   splitCount > 1  → 未会計分を等分する（人数割り）。端数は 1 人目が負担
 *   どちらもなし    → 未会計分をすべて会計する
 */
export function checkoutPayment(
  sessionId: string,
  method: PaymentMethod,
  discount: number,
  received: number,
  options: { itemIds?: string[] | null; splitCount?: number; splitIndex?: number } = {}
): string {
  const state = db();
  const itemIds = options.itemIds ?? null;
  const splitCount = Math.max(1, options.splitCount ?? 1);
  const splitIndex = Math.max(1, options.splitIndex ?? 1);

  const session = state.sessions.find((s) => s.id === sessionId);
  if (!session) throw new Error('対象の卓が見つかりません。');
  if (session.status === 'closed' || session.status === 'cancelled' || session.status === 'merged') {
    throw new Error('この卓はすでに会計済みです');
  }
  if (splitCount > 1 && itemIds) {
    throw new Error('明細指定と人数割りは同時に使えません');
  }
  if (splitIndex > splitCount) throw new Error('分割の指定が不正です');

  const calc = getSessionTotal(sessionId, discount, true, itemIds);
  if (calc.total === 0 && calc.subtotal === 0) {
    throw new Error('会計対象の明細がありません');
  }

  // 人数割りは端数を 1 人目が負担する
  let amount = calc.total;
  if (splitCount > 1) {
    const share = Math.floor(calc.total / splitCount);
    amount = splitIndex === 1 ? share + (calc.total - share * splitCount) : share;
  }
  const ratio = calc.total === 0 ? 0 : amount / calc.total;

  if (method === 'cash' && received < amount) {
    throw new Error('預かり金が不足しています（合計 ' + amount + '円 / 預かり ' + received + '円）');
  }

  const paymentId = id('pay');
  state.payments.push({
    id: paymentId,
    store_id: state.store.id,
    session_id: sessionId,
    method,
    subtotal: Math.round(calc.subtotal * ratio),
    discount: Math.round(calc.discount * ratio),
    service_charge: Math.round(calc.service_charge * ratio),
    tax: Math.round(calc.tax * ratio),
    total: amount,
    received: method === 'cash' ? received : amount,
    change_due: method === 'cash' ? received - amount : 0,
    status: 'paid',
    note: null,
    paid_at: nowIso(),
    tax_breakdown: calc.tax_breakdown.map((b) => ({
      rate: b.rate,
      taxable: Math.round(b.taxable * ratio),
      tax: Math.round(b.tax * ratio),
    })),
    split_count: splitCount,
    split_index: splitIndex,
    voided_at: null,
    void_reason: null,
  });

  // 明細への紐付け。人数割りでは最後の 1 回でまとめて紐付ける
  const isLast = splitIndex >= splitCount;
  for (const item of state.orderItems) {
    if (item.session_id !== sessionId) continue;
    if (item.payment_id !== null || item.status === 'cancelled') continue;
    if (itemIds ? itemIds.includes(item.id) : isLast) {
      item.payment_id = paymentId;
    }
  }

  // 未会計が残っていなければ卓を閉じる
  const remaining = state.orderItems.filter(
    (i) => i.session_id === sessionId && i.payment_id === null && i.status !== 'cancelled'
  );

  if (remaining.length === 0) {
    for (const item of state.orderItems) {
      if (item.session_id !== sessionId) continue;
      if (item.status === 'pending' || item.status === 'cooking' || item.status === 'ready') {
        item.status = 'served';
      }
    }
    session.status = 'closed';
    session.closed_at = nowIso();
  }

  return paymentId;
}

/** 会計を取り消す。明細の紐付けを外し、卓を開け直す */
export function voidPayment(paymentId: string, reason: string): void {
  const state = db();

  const payment = state.payments.find((p) => p.id === paymentId);
  if (!payment) throw new Error('会計が見つかりません');
  if (payment.status === 'refunded') throw new Error('この会計はすでに取り消されています');

  // 記録は消さず、取消として残す（売上集計は status = 'paid' だけを見る）
  payment.status = 'refunded';
  payment.voided_at = nowIso();
  payment.void_reason = reason;

  for (const item of state.orderItems) {
    if (item.payment_id === paymentId) item.payment_id = null;
  }

  // 未会計の明細が残ったなら卓を開け直す。
  // 「他に有効な会計が残っているか」で判定すると、分割会計の一部だけを
  // 取り消したときに卓が閉じたままになり、残額を再会計できなくなる。
  const hasUnpaid = state.orderItems.some(
    (i) => i.session_id === payment.session_id && i.payment_id === null && i.status !== 'cancelled'
  );
  if (hasUnpaid) {
    const session = state.sessions.find((s) => s.id === payment.session_id);
    if (session) {
      session.status = 'open';
      session.closed_at = null;
    }
  }
}

/** 卓移動 */
export function moveSession(sessionId: string, toTableId: string): void {
  const state = db();

  const session = state.sessions.find((s) => s.id === sessionId);
  if (!session) throw new Error('対象の卓が見つかりません');
  if (session.status !== 'open' && session.status !== 'bill_requested') {
    throw new Error('利用中の卓のみ移動できます');
  }

  const table = state.tables.find((t) => t.id === toTableId && t.is_active);
  if (!table) throw new Error('移動先の卓が見つかりません');

  const occupied = state.sessions.some(
    (s) => s.table_id === toTableId && (s.status === 'open' || s.status === 'bill_requested')
  );
  if (occupied) throw new Error('移動先の卓は使用中です。先に伝票を結合してください');

  session.table_id = toTableId;
}

/** 伝票結合。source を target に吸収する */
export function mergeSessions(sourceId: string, targetId: string): void {
  const state = db();

  if (sourceId === targetId) throw new Error('同じ伝票は結合できません');

  const source = state.sessions.find((s) => s.id === sourceId);
  const target = state.sessions.find((s) => s.id === targetId);
  if (!source || !target) throw new Error('対象の伝票が見つかりません');

  const isOpen = (s: TableSession) => s.status === 'open' || s.status === 'bill_requested';
  if (!isOpen(source) || !isOpen(target)) throw new Error('利用中の伝票のみ結合できます');

  if (state.payments.some((p) => p.session_id === sourceId && p.status === 'paid')) {
    throw new Error('会計済みの伝票は結合できません');
  }

  for (const order of state.orders) {
    if (order.session_id === sourceId) order.session_id = targetId;
  }
  for (const item of state.orderItems) {
    if (item.session_id === sourceId) item.session_id = targetId;
  }

  // 人数は合算する
  target.guest_count += source.guest_count;
  source.status = 'merged';
  source.closed_at = nowIso();
}

// ---------------------------------------------------------------------------
// 現金在高・レジ締め
// ---------------------------------------------------------------------------

export function getCashMovements(businessDay: string): CashMovement[] {
  return clone(db().cashMovements.filter((m) => m.business_day === businessDay)).sort((a, b) =>
    a.created_at.localeCompare(b.created_at)
  );
}

export function addCashMovement(
  businessDay: string,
  kind: CashMovementKind,
  amount: number,
  reason: string | null
): void {
  const state = db();
  state.cashMovements.push({
    id: id('cm'),
    store_id: state.store.id,
    business_day: businessDay,
    kind,
    amount: Math.max(1, Math.floor(amount)),
    reason,
    created_at: nowIso(),
  });
}

export function getCashClosing(businessDay: string): CashDrawerClosing | null {
  const closing = db().cashClosings.find((c) => c.business_day === businessDay);
  return closing ? clone(closing) : null;
}

/** 現金売上。取り消された会計は含めない */
export function getCashSales(businessDay: string): number {
  const state = db();
  const store = state.store;

  return state.payments
    .filter(
      (p) =>
        p.status === 'paid' &&
        p.method === 'cash' &&
        businessDate(new Date(p.paid_at), store.timezone, store.business_day_cutoff_hour) ===
          businessDay
    )
    .reduce((sum, p) => sum + p.total, 0);
}

/** レジ締め。理論在高 = 釣銭準備金 + 現金売上 + 入金 - 出金 */
export function closeCashDrawer(
  businessDay: string,
  openingFloat: number,
  countedCash: number,
  note: string | null
): string {
  const state = db();

  const cashSales = getCashSales(businessDay);
  const movements = state.cashMovements.filter((m) => m.business_day === businessDay);
  const cashIn = movements
    .filter((m) => m.kind === 'deposit')
    .reduce((sum, m) => sum + m.amount, 0);
  const cashOut = movements
    .filter((m) => m.kind === 'withdrawal')
    .reduce((sum, m) => sum + m.amount, 0);

  const expected = openingFloat + cashSales + cashIn - cashOut;

  const row: CashDrawerClosing = {
    id: id('cdc'),
    store_id: state.store.id,
    business_day: businessDay,
    opening_float: openingFloat,
    cash_sales: cashSales,
    cash_in: cashIn,
    cash_out: cashOut,
    expected_cash: expected,
    counted_cash: countedCash,
    difference: countedCash - expected,
    note,
    closed_at: nowIso(),
  };

  // 1 営業日 1 回。すでにあれば上書きする
  const index = state.cashClosings.findIndex((c) => c.business_day === businessDay);
  if (index === -1) state.cashClosings.push(row);
  else state.cashClosings[index] = { ...row, id: state.cashClosings[index].id };

  return row.id;
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
    company_id: state.store.company_id,
    name: input.name,
    description: input.description,
    staff_display_name: null,
    display_order: input.sort_order,
    is_active: input.is_active,
    created_at: nowIso(),
  } satisfies Category);
}

export function deleteCategory(categoryId: string): void {
  const state = db();
  state.categories = state.categories.filter((c) => c.id !== categoryId);
  // 配下の商品は消さず、紐付けだけを外す（カテゴリ未設定になる）
  state.categoryMenus = state.categoryMenus.filter((link) => link.category_id !== categoryId);
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
  reduced_rate_eligible: boolean;
}): void {
  const state = db();
  const existing = state.menuItems.find((m) => m.id === input.id);
  const { category_id, sort_order, ...rest } = input;

  const menuId = existing?.id ?? id('item');

  if (existing) {
    Object.assign(existing, rest, { display_order: sort_order, updated_at: nowIso() });
  } else {
    state.menuItems.push({
      ...rest,
      id: menuId,
      company_id: state.store.company_id,
      receipt_display_name: rest.name,
      menu_type: rest.prep_station === 'bar' ? 'drink' : 'food',
      tax_rate: state.store.standard_tax_rate,
      is_notice_only: false,
      display_order: sort_order,
      created_at: nowIso(),
      updated_at: nowIso(),
    } satisfies MenuItem);
  }

  // カテゴリとの紐付けを貼り直す（1 メニュー 1 カテゴリとして扱う）
  state.categoryMenus = state.categoryMenus.filter((link) => link.menu_id !== menuId);
  if (category_id) {
    state.categoryMenus.push({ category_id, menu_id: menuId });
  }
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
  standard_tax_rate: number;
  reduced_tax_rate: number;
  tax_included: boolean;
  service_charge_rate: number;
  mobile_order_open: boolean;
  opening_note: string | null;
  business_day_cutoff_hour: number;
  invoice_registration_number: string | null;
  cash_float_default: number;
}): void {
  Object.assign(db().store, input, { updated_at: nowIso() });
}

export function changePin(): never {
  // PIN はデモでは固定。変更できると再ログインできなくなるため受け付けない
  throw new Error('デモモードでは PIN を変更できません（固定で 1234 です）。');
}

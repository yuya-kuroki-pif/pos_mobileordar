import type {
  CashDrawerClosing,
  CashMovement,
  Category,
  MenuItem,
  MenuOption,
  OptionGroup,
  Order,
  OrderItem,
  Payment,
  PrepStation,
  RestaurantTable,
  ServiceType,
  Store,
  TableSession,
} from '../types';

/**
 * デモモードで使うインメモリのデータセット。
 *
 * supabase/seed.sql と同じメニュー構成に加えて、
 * 「開いている卓」「調理中の注文」「今日の会計済み」を最初から入れてある。
 * どの画面を開いても空っぽにならず、動きが確認できる状態を作るため。
 */
export interface DemoState {
  store: Store;
  tables: RestaurantTable[];
  categories: Category[];
  menuItems: MenuItem[];
  optionGroups: OptionGroup[];
  options: MenuOption[];
  itemOptionGroups: { menu_item_id: string; option_group_id: string; sort_order: number }[];
  /** カテゴリとメニューの紐付け（DB の category_menus） */
  categoryMenus: { category_id: string; menu_id: string }[];
  sessions: TableSession[];
  orders: Order[];
  orderItems: OrderItem[];
  payments: Payment[];
  cashMovements: CashMovement[];
  cashClosings: CashDrawerClosing[];
}

const STORE_ID = 'demo-store';

/** 分単位で過去にずらした ISO 文字列 */
function minutesAgo(base: number, minutes: number): string {
  return new Date(base - minutes * 60_000).toISOString();
}

export function createDemoState(): DemoState {
  const now = Date.now();

  const store: Store = {
    id: STORE_ID,
    company_id: 'company-demo',
    slug: 'demo',
    name: '炭火焼き デモ店',
    standard_tax_rate: 0.1,
    reduced_tax_rate: 0.08,
    tax_included: true,
    service_charge_rate: 0,
    staff_pin_hash: null, // デモでは PIN を固定値で判定するのでハッシュは持たない
    mobile_order_open: true,
    opening_note: 'ご来店ありがとうございます。ラストオーダーは 23:00 です。',
    business_day_cutoff_hour: 5,
    timezone: 'Asia/Tokyo',
    invoice_registration_number: 'T1234567890123',
    cash_float_default: 30000,
    created_at: minutesAgo(now, 60 * 24 * 30),
    updated_at: minutesAgo(now, 60 * 24 * 30),
  };

  const tables: RestaurantTable[] = [
    ['カウンター1', '1F', 1],
    ['カウンター2', '1F', 1],
    ['カウンター3', '1F', 1],
    ['A-1', '1F', 4],
    ['A-2', '1F', 4],
    ['B-1', '2F', 6],
    ['B-2', '2F', 6],
    ['個室', '2F', 8],
  ].map(([name, area, seats], index) => ({
    id: `tbl-${index + 1}`,
    store_id: STORE_ID,
    name: name as string,
    area: area as string,
    seats: seats as number,
    // デモでは URL に出るので読みやすいトークンにしておく
    qr_token: `demo-table-${index + 1}`,
    sort_order: (index + 1) * 10,
    is_active: true,
    created_at: store.created_at,
  }));

  const categories: Category[] = [
    ['串焼き', '備長炭で一本ずつ焼き上げます'],
    ['炉端焼き', '旬の魚介と野菜を炭火で'],
    ['一品料理', null],
    ['ドリンク', null],
    ['デザート', null],
  ].map(([name, description], index) => ({
    id: `cat-${index + 1}`,
    company_id: store.company_id,
    name: name as string,
    description: description as string | null,
    staff_display_name: null,
    display_order: (index + 1) * 10,
    is_active: true,
    created_at: store.created_at,
  }));

  const [kushi, robata, ippin, drink, dessert] = categories;

  let itemSeq = 0;
  const menuItems: MenuItem[] = [];
  const categoryMenus: { category_id: string; menu_id: string }[] = [];

  function addItem(
    category: Category,
    name: string,
    description: string | null,
    price: number,
    prepStation: PrepStation,
    // 酒類・非飲食料品は持ち帰りでも軽減税率の対象外
    reducedEligible = true
  ): MenuItem {
    itemSeq += 1;
    const item: MenuItem = {
      id: `item-${itemSeq}`,
      company_id: store.company_id,
      name,
      receipt_display_name: name,
      description,
      price,
      image_url: null,
      menu_type: prepStation === 'bar' ? 'drink' : 'food',
      tax_rate: 0.1,
      reduced_rate_eligible: reducedEligible,
      is_notice_only: false,
      prep_station: prepStation,
      display_order: itemSeq * 10,
      created_at: store.created_at,
      updated_at: store.created_at,
      is_available: true,
      is_sold_out: false,
    };
    menuItems.push(item);
    categoryMenus.push({ category_id: category.id, menu_id: item.id });
    return item;
  }

  const momo = addItem(kushi, 'もも串', '大山鶏のもも肉。塩 / タレ', 280, 'kitchen');
  const negima = addItem(kushi, 'ねぎま', '九条ねぎともも肉', 300, 'kitchen');
  const tsukune = addItem(kushi, 'つくね（卵黄付き）', '軟骨入りの粗挽きつくね', 380, 'kitchen');
  addItem(kushi, '皮', 'パリパリに焼き上げます', 250, 'kitchen');
  const hatsu = addItem(kushi, 'ハツ', null, 280, 'kitchen');
  addItem(kushi, '砂肝', null, 280, 'kitchen');
  addItem(kushi, 'レバー', '低温で仕上げたレア食感', 300, 'kitchen');
  addItem(kushi, '手羽先', null, 350, 'kitchen');

  const hokke = addItem(robata, 'ホッケ開き', '脂のりの良い真ほっけ', 980, 'kitchen');
  addItem(robata, '金目鯛の塩焼き', '時価。本日は 1 尾', 1580, 'kitchen');
  const hamaguri = addItem(robata, 'ハマグリ酒蒸し', null, 880, 'kitchen');
  addItem(robata, '大きな椎茸', '肉厚の原木しいたけ', 420, 'kitchen');
  const corn = addItem(robata, '焼きとうもろこし', '醤油バター', 480, 'kitchen');

  const potato = addItem(ippin, 'ポテトフライ', 'ほくほくの国産じゃがいも', 480, 'kitchen');
  const dashimaki = addItem(ippin, 'だし巻き玉子', '大根おろし添え', 580, 'kitchen');
  addItem(ippin, '自家製ポテサラ', null, 420, 'kitchen');
  const edamame = addItem(ippin, '枝豆', null, 380, 'kitchen');
  addItem(ippin, '冷やしトマト', null, 420, 'kitchen');

  const beer = addItem(drink, '生ビール', 'アサヒスーパードライ', 580, 'bar', false);
  const highball = addItem(drink, 'ハイボール', '角ハイボール', 480, 'bar', false);
  const lemonSour = addItem(drink, 'レモンサワー', '自家製レモンシロップ', 480, 'bar', false);
  addItem(drink, '日本酒（冷）', '本日のおすすめ一合', 780, 'bar', false);
  const oolong = addItem(drink, '烏龍茶', null, 350, 'bar');
  addItem(drink, 'コーラ', null, 350, 'bar');

  addItem(dessert, 'バニラアイス', null, 380, 'none');
  addItem(dessert, '本日のシャーベット', '柚子', 420, 'none');

  // 売切の見え方を確認できるよう 1 品だけ落としておく
  hamaguri.is_sold_out = true;

  const optionGroups: OptionGroup[] = [
    { id: 'grp-yaki', company_id: store.company_id, name: '焼き加減', min_choice: 0, max_choice: 1, display_order: 10 },
    { id: 'grp-size', company_id: store.company_id, name: 'サイズ', min_choice: 1, max_choice: 1, display_order: 20 },
    { id: 'grp-top', company_id: store.company_id, name: 'トッピング', min_choice: 0, max_choice: 3, display_order: 30 },
  ];

  const options: MenuOption[] = [
    { id: 'opt-yaki-1', option_id: 'grp-yaki', name: 'おまかせ', price: 0, display_order: 10, is_available: true, is_default: false },
    { id: 'opt-yaki-2', option_id: 'grp-yaki', name: 'しっかりめ', price: 0, display_order: 20, is_available: true, is_default: false },
    { id: 'opt-yaki-3', option_id: 'grp-yaki', name: 'レアめ', price: 0, display_order: 30, is_available: true, is_default: false },
    { id: 'opt-size-1', option_id: 'grp-size', name: 'レギュラー', price: 0, display_order: 10, is_available: true, is_default: false },
    { id: 'opt-size-2', option_id: 'grp-size', name: 'メガジョッキ', price: 250, display_order: 20, is_available: true, is_default: false },
    { id: 'opt-top-1', option_id: 'grp-top', name: '温玉', price: 100, display_order: 10, is_available: true, is_default: false },
    { id: 'opt-top-2', option_id: 'grp-top', name: 'マヨネーズ', price: 50, display_order: 20, is_available: true, is_default: false },
    { id: 'opt-top-3', option_id: 'grp-top', name: '七味', price: 0, display_order: 30, is_available: true, is_default: false },
    { id: 'opt-top-4', option_id: 'grp-top', name: 'チーズ', price: 150, display_order: 40, is_available: true, is_default: false },
  ];

  const itemOptionGroups = [
    { menu_item_id: momo.id, option_group_id: 'grp-yaki', sort_order: 10 },
    { menu_item_id: negima.id, option_group_id: 'grp-yaki', sort_order: 10 },
    { menu_item_id: potato.id, option_group_id: 'grp-top', sort_order: 10 },
    { menu_item_id: beer.id, option_group_id: 'grp-size', sort_order: 10 },
  ];

  // -------------------------------------------------------------------------
  // 進行中の来店と注文
  // -------------------------------------------------------------------------

  const sessions: TableSession[] = [];
  const orders: Order[] = [];
  const orderItems: OrderItem[] = [];
  const payments: Payment[] = [];
  const cashMovements: CashMovement[] = [];
  const cashClosings: CashDrawerClosing[] = [];

  let orderSeq = 0;

  const STANDARD_RATE = store.standard_tax_rate;
  const REDUCED_RATE = store.reduced_tax_rate;

  /** 提供形態と商品から適用税率を決める（SQL の place_order と同じ判定） */
  function rateFor(item: MenuItem, serviceType: ServiceType): number {
    return serviceType === 'takeout' && item.reduced_rate_eligible ? REDUCED_RATE : STANDARD_RATE;
  }

  function addOrder(
    session: TableSession,
    channel: Order['channel'],
    minutesBefore: number,
    lines: {
      item: MenuItem;
      quantity: number;
      status: OrderItem['status'];
      options?: { name: string; price_delta: number; group: string }[];
      note?: string;
    }[]
  ): Order {
    orderSeq += 1;
    const placedAt = minutesAgo(now, minutesBefore);
    const order: Order = {
      id: `ord-${orderSeq}`,
      store_id: STORE_ID,
      session_id: session.id,
      order_number: orderSeq,
      channel,
      service_type: session.service_type,
      note: null,
      placed_at: placedAt,
    };
    orders.push(order);

    lines.forEach((line, index) => {
      const optionsPrice = (line.options ?? []).reduce((sum, o) => sum + o.price_delta, 0);
      orderItems.push({
        id: `oi-${orderSeq}-${index + 1}`,
        store_id: STORE_ID,
        order_id: order.id,
        session_id: session.id,
        menu_id: line.item.id,
        name_snapshot: line.item.name,
        unit_price: line.item.price,
        options_price: optionsPrice,
        options_snapshot: line.options ?? [],
        quantity: line.quantity,
        tax_rate: rateFor(line.item, session.service_type),
        prep_station: line.item.prep_station,
        status: line.status,
        note: line.note ?? null,
        created_at: placedAt,
        updated_at: placedAt,
        line_total: (line.item.price + optionsPrice) * line.quantity,
        payment_id: null,
      });
    });

    return order;
  }

  function addSession(
    tableIndex: number,
    guestCount: number,
    minutesBefore: number,
    status: TableSession['status'],
    serviceType: ServiceType = 'eat_in'
  ): TableSession {
    const session: TableSession = {
      id: `ses-${sessions.length + 1}`,
      store_id: STORE_ID,
      table_id: tables[tableIndex].id,
      guest_count: guestCount,
      status,
      service_type: serviceType,
      opened_at: minutesAgo(now, minutesBefore),
      closed_at: null,
      note: null,
    };
    sessions.push(session);
    return session;
  }

  // A-1: 4名。先に頼んだ分は提供済み、追加注文が調理中
  const sesA = addSession(3, 4, 42, 'open');
  addOrder(sesA, 'mobile', 38, [
    { item: beer, quantity: 4, status: 'served', options: [{ group: 'サイズ', name: 'レギュラー', price_delta: 0 }] },
    { item: edamame, quantity: 2, status: 'served' },
    { item: momo, quantity: 4, status: 'served', options: [{ group: '焼き加減', name: 'おまかせ', price_delta: 0 }] },
  ]);
  addOrder(sesA, 'pos', 12, [
    { item: tsukune, quantity: 3, status: 'cooking' },
    { item: hokke, quantity: 1, status: 'cooking' },
    { item: highball, quantity: 2, status: 'ready' },
  ]);

  // カウンター2: 1名。入ったばかりで未調理
  const sesB = addSession(1, 1, 18, 'open');
  addOrder(sesB, 'mobile', 15, [
    { item: lemonSour, quantity: 1, status: 'pending' },
    { item: hatsu, quantity: 2, status: 'pending', note: 'タレで' },
    { item: dashimaki, quantity: 1, status: 'pending' },
  ]);

  // B-1: 6名。お会計希望が出ている
  const sesC = addSession(5, 6, 96, 'bill_requested');
  addOrder(sesC, 'mobile', 92, [
    { item: beer, quantity: 6, status: 'served', options: [{ group: 'サイズ', name: 'メガジョッキ', price_delta: 250 }] },
    { item: potato, quantity: 2, status: 'served', options: [{ group: 'トッピング', name: 'チーズ', price_delta: 150 }] },
    { item: negima, quantity: 6, status: 'served', options: [{ group: '焼き加減', name: 'しっかりめ', price_delta: 0 }] },
  ]);
  addOrder(sesC, 'pos', 55, [
    { item: corn, quantity: 2, status: 'served' },
    { item: oolong, quantity: 3, status: 'served' },
  ]);

  // 少し前に遅れが出ている卓（KDS で赤く出る）
  const sesD = addSession(7, 8, 34, 'open');
  addOrder(sesD, 'mobile', 26, [
    { item: momo, quantity: 8, status: 'pending', options: [{ group: '焼き加減', name: 'おまかせ', price_delta: 0 }] },
    { item: tsukune, quantity: 4, status: 'pending' },
  ]);

  // -------------------------------------------------------------------------
  // 会計済み（ダッシュボードに売上を出すため）
  // -------------------------------------------------------------------------

  function addClosedSession(
    tableIndex: number,
    guestCount: number,
    openedMinutesAgo: number,
    closedMinutesAgo: number,
    lines: { item: MenuItem; quantity: number }[],
    method: Payment['method'],
    serviceType: ServiceType = 'eat_in'
  ) {
    const session = addSession(tableIndex, guestCount, openedMinutesAgo, 'closed', serviceType);
    session.closed_at = minutesAgo(now, closedMinutesAgo);

    const order = addOrder(
      session,
      'mobile',
      openedMinutesAgo - 3,
      lines.map((line) => ({ item: line.item, quantity: line.quantity, status: 'served' as const }))
    );

    const paymentId = `pay-${payments.length + 1}`;

    // 税率ごとに集計する（内税なので総額から逆算した内訳）
    const byRate = new Map<number, number>();
    for (const line of lines) {
      const rate = rateFor(line.item, serviceType);
      byRate.set(rate, (byRate.get(rate) ?? 0) + line.item.price * line.quantity);
    }
    const breakdown = [...byRate.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([rate, taxable]) => ({
        rate,
        taxable,
        tax: Math.round((taxable * rate) / (1 + rate)),
      }));

    const subtotal = lines.reduce((sum, line) => sum + line.item.price * line.quantity, 0);
    const rounded = Math.ceil(subtotal / 1000) * 1000;

    payments.push({
      id: paymentId,
      store_id: STORE_ID,
      session_id: session.id,
      method,
      subtotal,
      discount: 0,
      service_charge: 0,
      tax: breakdown.reduce((sum, b) => sum + b.tax, 0),
      total: subtotal,
      received: method === 'cash' ? rounded : subtotal,
      change_due: method === 'cash' ? rounded - subtotal : 0,
      status: 'paid',
      note: null,
      paid_at: minutesAgo(now, closedMinutesAgo),
      tax_breakdown: breakdown,
      split_count: 1,
      split_index: 1,
      voided_at: null,
      void_reason: null,
    });

    // 会計済みの明細は payment に紐付ける
    for (const item of orderItems) {
      if (item.order_id === order.id) item.payment_id = paymentId;
    }
  }

  addClosedSession(4, 2, 180, 110, [
    { item: beer, quantity: 3 },
    { item: momo, quantity: 4 },
    { item: potato, quantity: 1 },
    { item: dashimaki, quantity: 1 },
  ], 'cash');

  addClosedSession(6, 4, 200, 130, [
    { item: highball, quantity: 5 },
    { item: hokke, quantity: 1 },
    { item: tsukune, quantity: 4 },
    { item: edamame, quantity: 2 },
  ], 'card');

  addClosedSession(0, 1, 150, 125, [
    { item: lemonSour, quantity: 2 },
    { item: negima, quantity: 3 },
  ], 'qr');

  // 持ち帰りの会計。軽減税率 8% と標準税率 10% が混ざる例として入れておく
  addClosedSession(2, 1, 95, 90, [
    { item: momo, quantity: 4 },     // 飲食料品 → 持ち帰りなら 8%
    { item: dashimaki, quantity: 1 },// 飲食料品 → 8%
    { item: beer, quantity: 1 },     // 酒類 → 持ち帰りでも 10%
  ], 'cash', 'takeout');

  // -------------------------------------------------------------------------
  // 現金の入出金（レジ締め画面で理論在高に反映される）
  // -------------------------------------------------------------------------
  const today = businessDay(now, store.business_day_cutoff_hour);

  cashMovements.push(
    {
      id: 'cm-1',
      store_id: STORE_ID,
      business_day: today,
      kind: 'deposit',
      amount: 10000,
      reason: '両替（千円札の補充）',
      created_at: minutesAgo(now, 200),
    },
    {
      id: 'cm-2',
      store_id: STORE_ID,
      business_day: today,
      kind: 'withdrawal',
      amount: 3500,
      reason: '氷の買い出し',
      created_at: minutesAgo(now, 140),
    }
  );

  return {
    store,
    tables,
    categories,
    menuItems,
    optionGroups,
    options,
    itemOptionGroups,
    sessions,
    orders,
    categoryMenus,
    orderItems,
    payments,
    cashMovements,
    cashClosings,
  };
}

/** 営業日（Asia/Tokyo・区切り時刻あり）を YYYY-MM-DD で返す */
function businessDay(base: number, cutoffHour: number): string {
  const local = new Date(new Date(base).toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  local.setHours(local.getHours() - cutoffHour);
  return [
    local.getFullYear(),
    String(local.getMonth() + 1).padStart(2, '0'),
    String(local.getDate()).padStart(2, '0'),
  ].join('-');
}

import type {
  Category,
  MenuItem,
  MenuOption,
  OptionGroup,
  Order,
  OrderItem,
  Payment,
  PrepStation,
  RestaurantTable,
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
  sessions: TableSession[];
  orders: Order[];
  orderItems: OrderItem[];
  payments: Payment[];
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
    slug: 'demo',
    name: '炭火焼き デモ店',
    tax_rate: 0.1,
    tax_included: true,
    service_charge_rate: 0,
    staff_pin_hash: null, // デモでは PIN を固定値で判定するのでハッシュは持たない
    mobile_order_open: true,
    opening_note: 'ご来店ありがとうございます。ラストオーダーは 23:00 です。',
    business_day_cutoff_hour: 5,
    timezone: 'Asia/Tokyo',
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
    store_id: STORE_ID,
    name: name as string,
    description: description as string | null,
    sort_order: (index + 1) * 10,
    is_active: true,
    created_at: store.created_at,
  }));

  const [kushi, robata, ippin, drink, dessert] = categories;

  let itemSeq = 0;
  const menuItems: MenuItem[] = [];

  function addItem(
    category: Category,
    name: string,
    description: string | null,
    price: number,
    prepStation: PrepStation
  ): MenuItem {
    itemSeq += 1;
    const item: MenuItem = {
      id: `item-${itemSeq}`,
      store_id: STORE_ID,
      category_id: category.id,
      name,
      description,
      price,
      image_url: null,
      tax_rate: null,
      prep_station: prepStation,
      is_available: true,
      is_sold_out: false,
      sort_order: itemSeq * 10,
      created_at: store.created_at,
      updated_at: store.created_at,
    };
    menuItems.push(item);
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

  const beer = addItem(drink, '生ビール', 'アサヒスーパードライ', 580, 'bar');
  const highball = addItem(drink, 'ハイボール', '角ハイボール', 480, 'bar');
  const lemonSour = addItem(drink, 'レモンサワー', '自家製レモンシロップ', 480, 'bar');
  addItem(drink, '日本酒（冷）', '本日のおすすめ一合', 780, 'bar');
  const oolong = addItem(drink, '烏龍茶', null, 350, 'bar');
  addItem(drink, 'コーラ', null, 350, 'bar');

  addItem(dessert, 'バニラアイス', null, 380, 'none');
  addItem(dessert, '本日のシャーベット', '柚子', 420, 'none');

  // 売切の見え方を確認できるよう 1 品だけ落としておく
  hamaguri.is_sold_out = true;

  const optionGroups: OptionGroup[] = [
    { id: 'grp-yaki', store_id: STORE_ID, name: '焼き加減', min_select: 0, max_select: 1, sort_order: 10 },
    { id: 'grp-size', store_id: STORE_ID, name: 'サイズ', min_select: 1, max_select: 1, sort_order: 20 },
    { id: 'grp-top', store_id: STORE_ID, name: 'トッピング', min_select: 0, max_select: 3, sort_order: 30 },
  ];

  const options: MenuOption[] = [
    { id: 'opt-yaki-1', group_id: 'grp-yaki', name: 'おまかせ', price_delta: 0, sort_order: 10, is_available: true },
    { id: 'opt-yaki-2', group_id: 'grp-yaki', name: 'しっかりめ', price_delta: 0, sort_order: 20, is_available: true },
    { id: 'opt-yaki-3', group_id: 'grp-yaki', name: 'レアめ', price_delta: 0, sort_order: 30, is_available: true },
    { id: 'opt-size-1', group_id: 'grp-size', name: 'レギュラー', price_delta: 0, sort_order: 10, is_available: true },
    { id: 'opt-size-2', group_id: 'grp-size', name: 'メガジョッキ', price_delta: 250, sort_order: 20, is_available: true },
    { id: 'opt-top-1', group_id: 'grp-top', name: '温玉', price_delta: 100, sort_order: 10, is_available: true },
    { id: 'opt-top-2', group_id: 'grp-top', name: 'マヨネーズ', price_delta: 50, sort_order: 20, is_available: true },
    { id: 'opt-top-3', group_id: 'grp-top', name: '七味', price_delta: 0, sort_order: 30, is_available: true },
    { id: 'opt-top-4', group_id: 'grp-top', name: 'チーズ', price_delta: 150, sort_order: 40, is_available: true },
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

  let orderSeq = 0;

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
        menu_item_id: line.item.id,
        name_snapshot: line.item.name,
        unit_price: line.item.price,
        options_price: optionsPrice,
        options_snapshot: line.options ?? [],
        quantity: line.quantity,
        tax_rate: 0.1,
        prep_station: line.item.prep_station,
        status: line.status,
        note: line.note ?? null,
        created_at: placedAt,
        updated_at: placedAt,
        line_total: (line.item.price + optionsPrice) * line.quantity,
      });
    });

    return order;
  }

  function addSession(
    tableIndex: number,
    guestCount: number,
    minutesBefore: number,
    status: TableSession['status']
  ): TableSession {
    const session: TableSession = {
      id: `ses-${sessions.length + 1}`,
      store_id: STORE_ID,
      table_id: tables[tableIndex].id,
      guest_count: guestCount,
      status,
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
    method: Payment['method']
  ) {
    const session = addSession(tableIndex, guestCount, openedMinutesAgo, 'closed');
    session.closed_at = minutesAgo(now, closedMinutesAgo);

    addOrder(
      session,
      'mobile',
      openedMinutesAgo - 3,
      lines.map((line) => ({ item: line.item, quantity: line.quantity, status: 'served' as const }))
    );

    const subtotal = lines.reduce((sum, line) => sum + line.item.price * line.quantity, 0);
    payments.push({
      id: `pay-${payments.length + 1}`,
      store_id: STORE_ID,
      session_id: session.id,
      method,
      subtotal,
      discount: 0,
      service_charge: 0,
      // 内税なので総額から逆算した内訳
      tax: Math.round((subtotal * 0.1) / 1.1),
      total: subtotal,
      received: method === 'cash' ? Math.ceil(subtotal / 1000) * 1000 : subtotal,
      change_due: method === 'cash' ? Math.ceil(subtotal / 1000) * 1000 - subtotal : 0,
      status: 'paid',
      note: null,
      paid_at: minutesAgo(now, closedMinutesAgo),
    });
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
    orderItems,
    payments,
  };
}

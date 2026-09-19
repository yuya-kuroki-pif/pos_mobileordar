import 'server-only';

import { buildMenuMaster } from './demoMenu';
import { buildPlanGroups, buildPlans, type PlanState } from './demoPlan';
import { buildTransactions, type TransactionState } from './demoTransactions';
import type {
  Account,
  Area,
  AutoTranslationSetting,
  CashChangerSetting,
  Clerk,
  CompulsoryAppetizer,
  CookingItem,
  HandyTerminal,
  MobileOrderDesign,
  OrderableTime,
  OrderableTimeSlot,
  RecommendationSet,
  RestaurantTable,
  ShopAppetizer,
  ShopRecommendation,
  AccountRole,
  BusinessHour,
  Category,
  CategoryRow,
  Choice,
  Company,
  Corporation,
  DiscountType,
  DishUpSlipGroup,
  InflowSource,
  KitchenPrinter,
  DailyReport,
  DailySalesTarget,
  KpiTarget,
  LineReportingBotConfig,
  Menu,
  MenuRow,
  MenuTranslation,
  MenuTypeValue,
  OptionDef,
  OptionRow,
  PaymentMethod,
  PlAccount,
  PlanGroup,
  PurchaseTransaction,
  RoleDefinition,
  Shop,
  ShopGroup,
  ShopMenu,
  Vendor,
  TerminalPaymentMethod,
} from './types';

/**
 * デモモードのデータ。端末アプリと同じ考え方で、Supabase が未設定でも
 * 画面を触れるようにしておく（データはサーバー再起動で初期状態に戻る）。
 */

const CORP_ID = 'corp-demo';

export interface DemoState extends PlanState, TransactionState {
  corporation: Corporation;
  companies: Company[];
  shops: Shop[];
  accounts: Account[];
  roles: RoleDefinition[];
  accountRoles: AccountRole[];
  shopGroups: ShopGroup[];
  businessHours: BusinessHour[];

  // --- メニューマスター（業態単位） ---
  categories: Category[];
  menus: Menu[];
  options: OptionDef[];
  choices: Choice[];
  categoryMenus: { category_id: string; menu_id: string }[];
  menuOptions: { menu_id: string; option_id: string }[];
  shopMenus: ShopMenu[];
  kitchenPrinters: KitchenPrinter[];
  dishUpSlipGroups: DishUpSlipGroup[];
  menuTranslations: MenuTranslation[];

  // --- プラン（飲み放題・コース） ---
  planGroups: PlanGroup[];

  // --- 支払方法等設定（§5.10） ---
  paymentMethods: PaymentMethod[];
  discountTypes: DiscountType[];
  inflowSources: InflowSource[];
  terminalPaymentMethods: TerminalPaymentMethod[];

  // --- P2: 取引・本部機能（§5.22〜§5.28） ---
  lineReportingBotConfigs: LineReportingBotConfig[];

  // --- P3: 分析・経営管理（§6.x） ---
  plAccounts: PlAccount[];
  vendors: Vendor[];
  purchaseTransactions: PurchaseTransaction[];
  kpiTargets: KpiTarget[];
  dailySalesTargets: DailySalesTarget[];
  dailyReports: DailyReport[];

  // --- P1 の残り（§5.7 / §5.9 / §5.11 / §5.14〜§5.19） ---
  recommendationSets: RecommendationSet[];
  recommendationMenus: { set_id: string; menu_id: string; display_order: number }[];
  shopRecommendations: ShopRecommendation[];
  autoTranslationSettings: AutoTranslationSetting[];
  compulsoryAppetizers: CompulsoryAppetizer[];
  shopAppetizers: ShopAppetizer[];
  cashChangerSettings: CashChangerSetting[];
  mobileOrderDesigns: MobileOrderDesign[];
  orderableTimes: OrderableTime[];
  orderableTimeSlots: OrderableTimeSlot[];
  shopOrderableTimes: { shop_id: string; orderable_time_id: string }[];
  cookingItems: CookingItem[];
  clerks: Clerk[];
  handyTerminals: HandyTerminal[];
  areas: Area[];
  restaurantTables: RestaurantTable[];
}

function shop(
  id: string,
  companyId: string,
  name: string,
  slug: string,
  order: number,
  /** 0:00 からの分。閉店は 1440 を超えてよい */
  openMin: number,
  closeMin: number
): Shop {
  return {
    id,
    company_id: companyId,
    slug,
    name,
    name_en: null,
    icon_url: null,
    open_time_min: openMin,
    close_time_min: closeMin,
    display_order: order,
    standard_tax_rate: 0.1,
    reduced_tax_rate: 0.08,
    tax_included: true,
    service_charge_rate: 0,
    invoice_registration_number: 'T1234567890123',
    business_day_cutoff_hour: 5,
    timezone: 'Asia/Tokyo',

    // --- 店舗タブ（§5.12） ---
    last_order_label: 'ラストオーダー',
    checkout_note: null,
    order_limit_enabled: false,
    order_limit_per_person: null,
    sold_out_daily_reset: true,
    note_input_enabled: true,
    staff_call_enabled: true,
    auto_checkout_slip: false,
    show_tax_excluded_price: false,
    checkout_guide: 'wait_at_table',
    entry_alert_enabled: false,
    entry_alert_min: null,
    last_order_alert_enabled: false,
    last_order_alert_min: null,
    tip_enabled: false,
    ai_handy: false,
    ai_chat_diagnosis: false,
    ai_menu_book_diagnosis: false,
    ai_mo_optimize: false,
    ai_daily_report: false,
    ai_sales_forecast: false,
    ai_slip_instruction: false,

    // --- レジ設定タブ（§5.12） ---
    receipt_address: '東京都墨田区江東橋 0-0-0',
    contact_info: '03-0000-0000',
    stamp_tax_office: null,
    select_staff_on_checkout: false,
    change_fund_timing: 'with_closing',
    default_inflow_free: false,
    show_zero_price_items: true,
    auto_round_discount: false,
    open_drawer_on_cashless: false,
    has_drawer_open_password: false,
    has_void_password: false,
    has_table_clear_password: false,
    use_stera: false,
    receipt_auto_print: true,
    temp_receipt_enabled: false,
    closing_by_time_slot: true,
    closing_by_location: true,
    closing_by_area: false,
    closing_by_menu_type: false,
    closing_by_inflow: false,
    closing_tax_included: true,
    time_charge_rate: 0,
    time_charge_start_min: null,
    time_charge_end_min: null,

    // --- Google マップ設定タブ（§5.12） ---
    google_place_id: null,
    gmap_review_from_survey: false,
    gmap_review_promote_mo: false,
    gmap_review_min_minutes: null,
  };
}

/** 仕様書 §10.2 の既定ロール 3 種 */
function defaultRoles(): RoleDefinition[] {
  return [
    {
      id: 'role-corp',
      corporation_id: CORP_ID,
      product: 'pos',
      name: '法人管理者',
      is_system: true,
      display_order: 10,
      permissions: {
        account_management: 'edit', bi_integration: 'edit', menu_master: 'edit',
        company_management: 'edit', crm: 'edit', analytics: 'edit',
        target_management: 'edit', vendor_registration: 'edit', purchase_list: 'edit',
        petty_cash: 'edit', shop_management: 'edit', questionnaire_analytics: 'edit',
        daily_closing: 'edit', accounting_history: 'edit', table_usage_history: 'edit',
        payment_settings: 'edit', cashless: 'edit', recommendation_menu: 'edit',
        monthly_pl_report: 'edit', pl_accounts: 'edit', income_expense: 'edit',
        cost_display: 'view', labor_cost_parttime_display: 'view',
        labor_cost_employee_display: 'view', audit_logs: 'view', account_audit_logs: 'none',
      },
    },
    {
      id: 'role-company',
      corporation_id: CORP_ID,
      product: 'pos',
      name: '業態管理者',
      is_system: true,
      display_order: 20,
      permissions: {
        account_management: 'view', bi_integration: 'view', menu_master: 'edit',
        company_management: 'edit', crm: 'edit', analytics: 'edit',
        target_management: 'edit', vendor_registration: 'view', purchase_list: 'edit',
        petty_cash: 'edit', shop_management: 'edit', questionnaire_analytics: 'edit',
        daily_closing: 'edit', accounting_history: 'edit', table_usage_history: 'edit',
        payment_settings: 'edit', cashless: 'none', recommendation_menu: 'edit',
        monthly_pl_report: 'view', pl_accounts: 'view', income_expense: 'view',
        cost_display: 'view', labor_cost_parttime_display: 'view',
        labor_cost_employee_display: 'none', audit_logs: 'view', account_audit_logs: 'none',
      },
    },
    {
      id: 'role-shop',
      corporation_id: CORP_ID,
      product: 'pos',
      name: '店舗管理者',
      is_system: true,
      display_order: 30,
      permissions: {
        account_management: 'view', bi_integration: 'view', menu_master: 'view',
        company_management: 'none', crm: 'none', analytics: 'view',
        target_management: 'view', vendor_registration: 'none', purchase_list: 'edit',
        petty_cash: 'edit', shop_management: 'edit', questionnaire_analytics: 'view',
        daily_closing: 'view', accounting_history: 'view', table_usage_history: 'none',
        payment_settings: 'none', cashless: 'none', recommendation_menu: 'view',
        monthly_pl_report: 'view', pl_accounts: 'none', income_expense: 'view',
        cost_display: 'view', labor_cost_parttime_display: 'none',
        labor_cost_employee_display: 'view', audit_logs: 'view', account_audit_logs: 'none',
      },
    },
  ];
}

function createState(): DemoState {
  const companies: Company[] = [
    { id: 'company-1', corporation_id: CORP_ID, name: '炭火焼き デモ業態', display_order: 10 },
    { id: 'company-2', corporation_id: CORP_ID, name: '海鮮スタンド デモ業態', display_order: 20 },
  ];

  const shops: Shop[] = [
    shop('shop-1', 'company-1', '炭火焼き デモ店（錦糸町）', 'demo', 10, 17 * 60, 23 * 60 + 30),
    shop('shop-2', 'company-1', '炭火焼き デモ店（平井）', 'demo-hirai', 20, 17 * 60, 23 * 60),
    shop('shop-3', 'company-2', '海鮮スタンド デモ店', 'demo-kaisen', 10, 11 * 60 + 30, 22 * 60),
  ];

  const accounts: Account[] = [
    {
      id: 'acc-1',
      corporation_id: CORP_ID,
      email: 'owner@example.com',
      name: 'デモ管理者',
      status: 'active',
      joined_at: '2026-04-01T00:00:00Z',
      created_at: '2026-04-01T00:00:00Z',
    },
    {
      id: 'acc-2',
      corporation_id: CORP_ID,
      email: 'brand@example.com',
      name: '業態担当',
      status: 'active',
      joined_at: '2026-05-10T00:00:00Z',
      created_at: '2026-05-10T00:00:00Z',
    },
    {
      id: 'acc-3',
      corporation_id: CORP_ID,
      email: 'kinshicho@example.com',
      name: '錦糸町 店長',
      status: 'invited',
      joined_at: null,
      created_at: '2026-09-01T00:00:00Z',
    },
  ];

  const accountRoles: AccountRole[] = [
    { account_id: 'acc-1', product: 'pos', role_id: 'role-corp', scope_type: 'corporation', scope_ids: [] },
    { account_id: 'acc-2', product: 'pos', role_id: 'role-company', scope_type: 'company', scope_ids: ['company-1'] },
    { account_id: 'acc-3', product: 'pos', role_id: 'role-shop', scope_type: 'shop', scope_ids: ['shop-1'] },
  ];

  const master = buildMenuMaster();

  const paymentSettings = buildPaymentSettings(companies.map((c) => c.id));
  const p1Rest = buildP1Rest(
    shops.map((s) => ({ id: s.id, company_id: s.company_id })),
    companies.map((c) => c.id)
  );

  // 取引データ。履歴画面と分析画面の見た目を確かめるために 30 日ぶん作る
  const transactions = buildTransactions({
    shops: shops.map((s) => ({ id: s.id, company_id: s.company_id })),
    menus: master.menus,
    tableIdsByShop: Object.fromEntries(
      shops.map((s) => [
        s.id,
        p1Rest.restaurantTables.filter((t) => t.store_id === s.id).map((t) => t.id),
      ])
    ),
    clerkIdsByShop: Object.fromEntries(
      shops.map((s) => [s.id, p1Rest.clerks.filter((c) => c.shop_id === s.id).map((c) => c.id)])
    ),
    paymentMethodsByCompany: Object.fromEntries(
      companies.map((c) => [
        c.id,
        paymentSettings.paymentMethods
          .filter((m) => m.company_id === c.id)
          .map((m) => ({ id: m.id, name: m.name, kind: m.kind })),
      ])
    ),
    inflowSourceIdsByCompany: Object.fromEntries(
      companies.map((c) => [
        c.id,
        paymentSettings.inflowSources.filter((i) => i.company_id === c.id).map((i) => i.id),
      ])
    ),
    days: 30,
  });

  return {
    corporation: { id: CORP_ID, name: 'デモ法人' },
    companies,
    shops,
    accounts,
    roles: defaultRoles(),
    accountRoles,
    shopGroups: [
      {
        id: 'sg-1',
        corporation_id: CORP_ID,
        name: '東京エリア',
        display_order: 10,
        shop_ids: ['shop-1', 'shop-2'],
      },
    ],
    ...master,
    businessHours: shops.flatMap((s) => [
      {
        id: `${s.id}-bh-1`,
        shop_id: s.id,
        name: 'ディナー',
        start_min: 17 * 60,
        end_min: 21 * 60,
        display_order: 10,
      },
      {
        id: `${s.id}-bh-2`,
        shop_id: s.id,
        name: '深夜',
        start_min: 21 * 60,
        end_min: 23 * 60 + 30,
        display_order: 20,
      },
    ]),
    planGroups: buildPlanGroups(),
    ...buildPlans(shops),
    ...paymentSettings,
    ...p1Rest,
    ...transactions,
    lineReportingBotConfigs: [],
    ...buildBiSeeds(
      CORP_ID,
      shops.map((s) => s.id)
    ),
    // 既定では全店舗が全品を扱う
    shopMenus: shops.flatMap((shop) =>
      master.menus
        .filter((menu) => menu.company_id === shop.company_id)
        .map((menu) => ({
          shop_id: shop.id,
          menu_id: menu.id,
          is_dealing: true,
          is_visible_customer: true,
          is_visible_staff: true,
          in_stock: true,
          stock_qty: null,
          daily_stock_qty: null,
          // 出力先は取扱メニュー一覧（§5.13）で割り当てる
          kitchen_printer_id: null,
          dish_up_slip_group_id: null,
          display_order: menu.display_order,
        }))
    ),
    kitchenPrinters: shops.flatMap((shop) =>
      [
        { suffix: 'kp-1', name: 'キッチン', order: 10, call: true, dishUp: true },
        { suffix: 'kp-2', name: 'ドリンク場', order: 20, call: true, dishUp: false },
        { suffix: 'kp-3', name: 'レジ', order: 30, call: false, dishUp: false },
      ].map((p) => ({
        id: `${shop.id}-${p.suffix}`,
        shop_id: shop.id,
        name: p.name,
        display_order: p.order,
        notify_mobile_payment: p.suffix === 'kp-3',
        print_call_slip: p.call,
        print_checkout_slip: p.suffix === 'kp-3',
        print_dish_up_slip: p.dishUp,
        print_table_move_slip: false,
        dish_up_layout: null,
        print_sound: 'none' as const,
        fallback_printer_1_id: null,
        fallback_printer_2_id: null,
      }))
    ),
    dishUpSlipGroups: shops.flatMap((shop) => [
      { id: `${shop.id}-ds-1`, shop_id: shop.id, name: '焼き場', display_order: 10 },
      { id: `${shop.id}-ds-2`, shop_id: shop.id, name: '冷菜', display_order: 20 },
    ]),
    menuTranslations: [],
  };
}

// HMR でモジュールが作り直されてもデータが消えないよう globalThis に置く。
// ただし DemoState の形を変えたときは作り直したいので、版を添えて持つ。
// （版を上げ忘れると、古い形のまま参照して実行時エラーになる）
const STATE_VERSION = 11;

const g = globalThis as typeof globalThis & {
  __dashboardDemo?: { version: number; state: DemoState };
};

export function db(): DemoState {
  if (!g.__dashboardDemo || g.__dashboardDemo.version !== STATE_VERSION) {
    g.__dashboardDemo = { version: STATE_VERSION, state: createState() };
  }
  return g.__dashboardDemo.state;
}

export function clone<T>(value: T): T {
  return structuredClone(value);
}

/** デモのログイン。メールとパスワードは固定 */
export const DEMO_LOGIN = { email: 'owner@example.com', password: 'demo1234' };

export function verifyLogin(email: string, password: string): string | null {
  if (email.trim().toLowerCase() !== DEMO_LOGIN.email || password !== DEMO_LOGIN.password) {
    return null;
  }
  return 'acc-1';
}

export const getCorporation = () => clone(db().corporation);
export const getCompanies = () =>
  clone(db().companies).sort((a, b) => a.display_order - b.display_order);
export const getShops = () => clone(db().shops).sort((a, b) => a.display_order - b.display_order);
export const getAccounts = () => clone(db().accounts);
export const getRoles = () =>
  clone(db().roles).sort((a, b) => a.display_order - b.display_order);
export const getAccountRoles = () => clone(db().accountRoles);
export const getShopGroups = () => clone(db().shopGroups);

export function getAccountById(id: string): Account | null {
  const account = db().accounts.find((a) => a.id === id);
  return account ? clone(account) : null;
}

export function getRoleForAccount(accountId: string): RoleDefinition | null {
  const link = db().accountRoles.find((r) => r.account_id === accountId && r.product === 'pos');
  if (!link) return null;
  const role = db().roles.find((r) => r.id === link.role_id);
  return role ? clone(role) : null;
}

/** 権限設定画面からの保存。既定ロールでも権限内容は変更できる */
export function saveRolePermissions(roleId: string, permissions: RoleDefinition['permissions']): void {
  const role = db().roles.find((r) => r.id === roleId);
  if (!role) throw new Error('ロールが見つかりません');
  role.permissions = permissions;
}

export function saveAccount(input: {
  id: string;
  email: string;
  name: string;
  roleId: string;
  scopeType: AccountRole['scope_type'];
  scopeIds: string[];
}): void {
  const state = db();
  const existing = state.accounts.find((a) => a.id === input.id);

  const accountId = existing?.id ?? `acc-${Math.random().toString(36).slice(2, 8)}`;
  if (existing) {
    existing.email = input.email;
    existing.name = input.name;
  } else {
    state.accounts.push({
      id: accountId,
      corporation_id: CORP_ID,
      email: input.email,
      name: input.name,
      // 新規は招待中。パスワード設定で active になる
      status: 'invited',
      joined_at: null,
      created_at: new Date().toISOString(),
    });
  }

  const link = state.accountRoles.find((r) => r.account_id === accountId && r.product === 'pos');
  if (link) {
    link.role_id = input.roleId;
    link.scope_type = input.scopeType;
    link.scope_ids = input.scopeIds;
  } else {
    state.accountRoles.push({
      account_id: accountId,
      product: 'pos',
      role_id: input.roleId,
      scope_type: input.scopeType,
      scope_ids: input.scopeIds,
    });
  }
}

export function setAccountStatus(accountId: string, status: Account['status']): void {
  const account = db().accounts.find((a) => a.id === accountId);
  if (account) account.status = status;
}


/**
 * 支払方法等設定の既定値（仕様書 §5.10）。
 * マイグレーションの seed_default_payment_settings() と同じ中身。
 */
function buildPaymentSettings(companyIds: string[]) {
  const methods: PaymentMethod[] = [];
  const discountTypes: DiscountType[] = [];
  const inflowSources: InflowSource[] = [];

  for (const companyId of companyIds) {
    methods.push(
      { id: `${companyId}-pm-1`, company_id: companyId, name: '現金', kind: 'cash', is_system: true, display_order: 10 },
      { id: `${companyId}-pm-2`, company_id: companyId, name: 'オンライン決済', kind: 'mobile', is_system: true, display_order: 20 },
      { id: `${companyId}-pm-3`, company_id: companyId, name: 'クレジットカード', kind: 'credit', is_system: false, display_order: 30 },
      { id: `${companyId}-pm-4`, company_id: companyId, name: 'QR決済', kind: 'qr', is_system: false, display_order: 40 },
      { id: `${companyId}-pm-5`, company_id: companyId, name: '電子マネー', kind: 'e_money', is_system: false, display_order: 50 }
    );

    discountTypes.push({
      id: `${companyId}-dt-1`,
      company_id: companyId,
      name: '端数値引',
      is_system: true,
      display_order: 10,
    });

    inflowSources.push(
      { id: `${companyId}-is-1`, company_id: companyId, name: 'フリー', is_system: true, display_order: 10 },
      { id: `${companyId}-is-2`, company_id: companyId, name: 'ホットペッパー', is_system: false, display_order: 20 },
      { id: `${companyId}-is-3`, company_id: companyId, name: '食べログ', is_system: false, display_order: 30 },
      { id: `${companyId}-is-4`, company_id: companyId, name: '公式HP', is_system: false, display_order: 40 },
      { id: `${companyId}-is-5`, company_id: companyId, name: 'ぐるなび', is_system: false, display_order: 50 }
    );
  }

  return { paymentMethods: methods, discountTypes, inflowSources, terminalPaymentMethods: [] };
}

/** P1 の残り（§5.7 / §5.9 / §5.11 / §5.14〜§5.19）のデモデータ */
function buildP1Rest(shops: { id: string; company_id: string }[], companyIds: string[]) {
  const recommendationSets: RecommendationSet[] = companyIds.map((companyId, index) => ({
    id: `${companyId}-rs-1`,
    company_id: companyId,
    name: '定番おすすめ',
    display_name: '当店のおすすめ',
    display_order: (index + 1) * 10,
  }));

  const compulsoryAppetizers: CompulsoryAppetizer[] = companyIds.map((companyId) => ({
    id: `${companyId}-ap-1`,
    company_id: companyId,
    name: 'お通し（夜）',
    menu_id: null,
    price: 400,
    start_min: 17 * 60,
    end_min: 23 * 60 + 30,
    display_order: 10,
  }));

  const orderableTimes: OrderableTime[] = companyIds.map((companyId) => ({
    id: `${companyId}-ot-1`,
    company_id: companyId,
    name: 'ディナー営業',
  }));

  // 月〜日を同じ時間帯にしておく。祝日（7）は未設定＝表示しない
  const orderableTimeSlots: OrderableTimeSlot[] = orderableTimes.flatMap((time) =>
    [0, 1, 2, 3, 4, 5, 6].map((day) => ({
      orderable_time_id: time.id,
      day_of_week: day,
      start_min: 17 * 60,
      end_min: 23 * 60 + 30,
    }))
  );

  const areas: Area[] = shops.flatMap((shop) => [
    { id: `${shop.id}-area-1`, shop_id: shop.id, name: '1F カウンター', display_order: 10 },
    { id: `${shop.id}-area-2`, shop_id: shop.id, name: '2F テーブル', display_order: 20 },
  ]);

  const restaurantTables: RestaurantTable[] = areas.flatMap((area, areaIndex) =>
    [1, 2, 3].map((n) => ({
      id: `${area.id}-t${n}`,
      store_id: area.shop_id,
      area_id: area.id,
      name: areaIndex % 2 === 0 ? `カウンター${n}` : `テーブル${n}`,
      seats: areaIndex % 2 === 0 ? 1 : 4,
      qr_token: `${area.id}-t${n}-token`,
      sort_order: n * 10,
      is_active: true,
    }))
  );

  return {
    recommendationSets,
    recommendationMenus: [],
    shopRecommendations: shops.map((shop) => ({
      shop_id: shop.id,
      set_id: `${shop.company_id}-rs-1`,
      is_visible: true,
    })),
    autoTranslationSettings: companyIds.map((companyId) => ({
      company_id: companyId,
      is_enabled: false,
      target_menu: true,
      target_plan: true,
      target_option: true,
      target_category: true,
      target_recommendation: true,
    })),
    compulsoryAppetizers,
    shopAppetizers: shops.map((shop) => ({
      shop_id: shop.id,
      appetizer_id: `${shop.company_id}-ap-1`,
      is_auto_order: false,
    })),
    cashChangerSettings: shops.map((shop) => ({
      shop_id: shop.id,
      keep_float_in_changer: false,
      allow_external_deposit: false,
      allow_emergency_cash: false,
    })),
    mobileOrderDesigns: companyIds.map((companyId) => ({
      company_id: companyId,
      menu_theme: 'light' as const,
      checkin_theme: 'light' as const,
    })),
    orderableTimes,
    orderableTimeSlots,
    shopOrderableTimes: shops.map((shop) => ({
      shop_id: shop.id,
      orderable_time_id: `${shop.company_id}-ot-1`,
    })),
    cookingItems: shops.flatMap((shop) => [
      { id: `${shop.id}-ci-1`, shop_id: shop.id, name: '焼き物', kitchen_printer_id: `${shop.id}-kp-1`, display_order: 10 },
      { id: `${shop.id}-ci-2`, shop_id: shop.id, name: '揚げ物', kitchen_printer_id: `${shop.id}-kp-1`, display_order: 20 },
    ]),
    clerks: shops.flatMap((shop) => [
      { id: `${shop.id}-clerk-1`, shop_id: shop.id, name: '山田', is_visible: true, display_order: 10 },
      { id: `${shop.id}-clerk-2`, shop_id: shop.id, name: '鈴木', is_visible: true, display_order: 20 },
      { id: `${shop.id}-clerk-3`, shop_id: shop.id, name: '佐藤', is_visible: false, display_order: 30 },
    ]),
    handyTerminals: shops.map((shop, index) => ({
      id: `${shop.id}-handy-1`,
      shop_id: shop.id,
      name: `ハンディ${index + 1}`,
      device_id: `DEV-${index + 1}0001`,
      status: 'active',
      app_version: '1.12.0',
      native_version: '3.4.1',
      brand: 'Generic',
      model: 'HT-10',
      os_name: 'Android',
      os_version: '13',
      registered_at: '2026-09-01T09:00:00+09:00',
    })),
    areas,
    restaurantTables,
  };
}

/** 経営管理（§6.x）のデモデータ。科目・取引先・目標・仕入れを少しだけ入れる */
function buildBiSeeds(corporationId: string, shopIds: string[]) {
  const plAccounts: PlAccount[] = [
    { id: 'pl-1', corporation_id: corporationId, code: '4000', pl_section: 'sales', name: '売上高', sub_name: 'POS売上', cost_class: null, petty_cash_usable: false, is_visible: true, company_ids: [], note: null, display_order: 10 },
    { id: 'pl-2', corporation_id: corporationId, code: '5100', pl_section: 'cogs', name: '仕入高', sub_name: 'フード', cost_class: 'variable', petty_cash_usable: true, is_visible: true, company_ids: [], note: null, display_order: 20 },
    { id: 'pl-3', corporation_id: corporationId, code: '5110', pl_section: 'cogs', name: '仕入高', sub_name: 'ドリンク', cost_class: 'variable', petty_cash_usable: true, is_visible: true, company_ids: [], note: null, display_order: 30 },
    { id: 'pl-4', corporation_id: corporationId, code: '6100', pl_section: 'labor', name: '人件費', sub_name: 'アルバイト', cost_class: 'variable', petty_cash_usable: false, is_visible: true, company_ids: [], note: null, display_order: 40 },
    { id: 'pl-5', corporation_id: corporationId, code: '7100', pl_section: 'sga', name: '水道光熱費', sub_name: null, cost_class: 'fixed', petty_cash_usable: true, is_visible: true, company_ids: [], note: null, display_order: 50 },
    { id: 'pl-6', corporation_id: corporationId, code: '7200', pl_section: 'sga', name: '家賃', sub_name: null, cost_class: 'fixed', petty_cash_usable: false, is_visible: true, company_ids: [], note: null, display_order: 60 },
  ];

  const vendors: Vendor[] = [
    { id: 'vendor-1', corporation_id: corporationId, name: '丸product 青果', kind: '食材', note: null, display_order: 10 },
    { id: 'vendor-2', corporation_id: corporationId, name: '山田酒店', kind: '酒類', note: null, display_order: 20 },
    { id: 'vendor-3', corporation_id: corporationId, name: '東京ミート', kind: '精肉', note: null, display_order: 30 },
  ];

  // 直近 10 日ぶんの仕入れ
  const purchaseTransactions: PurchaseTransaction[] = shopIds.flatMap((shopId, shopIndex) =>
    Array.from({ length: 10 }).map((_, i) => {
      const date = new Date('2026-09-19T00:00:00+09:00');
      date.setDate(date.getDate() - i);
      const isDrink = i % 3 === 0;
      const unitPrice = isDrink ? 380 : 620;
      const quantity = 5 + (i % 4) * 3;

      return {
        id: `${shopId}-pt-${i}`,
        shop_id: shopId,
        purchased_on: date.toISOString().slice(0, 10),
        vendor_id: isDrink ? 'vendor-2' : shopIndex % 2 === 0 ? 'vendor-1' : 'vendor-3',
        product_name: isDrink ? '生ビール樽' : '鶏もも肉',
        spec: isDrink ? '19L' : '2kg',
        product_type: isDrink ? ('drink' as const) : ('food' as const),
        unit_price: unitPrice,
        quantity,
        amount: unitPrice * quantity,
        source: 'manual' as const,
        note: null,
      };
    })
  );

  // 当月の目標。デモの売上（1 店舗あたり月 150 万前後）に近い値を置く
  const kpiTargets: KpiTarget[] = shopIds.map((shopId, index) => ({
    id: `${shopId}-kpi`,
    shop_id: shopId,
    year_month: '2026-09',
    sales_target: 1600000 + index * 100000,
    food_cost_target: 380000,
    drink_cost_target: 180000,
    labor_target: 420000,
    sga_target: 300000,
    guest_target: 1100,
    avg_spend_target: 1500,
  }));

  // 月間目標を日数で割って日別目標にしておく
  const dailySalesTargets: DailySalesTarget[] = shopIds.flatMap((shopId) => {
    const target = kpiTargets.find((t) => t.shop_id === shopId)?.sales_target ?? 0;
    const perDay = Math.round(target / 30);
    return Array.from({ length: 30 }).map((_, i) => ({
      shop_id: shopId,
      business_date: `2026-09-${String(i + 1).padStart(2, '0')}`,
      amount: perDay,
    }));
  });

  return {
    plAccounts,
    vendors,
    purchaseTransactions,
    kpiTargets,
    dailySalesTargets,
    dailyReports: [] as DailyReport[],
  };
}

import type { PermissionMap } from './permissions';

// ---------------------------------------------------------------------------
// 仕様書 §8.1 / §8.8 に対応する型。P0 の範囲（組織・アカウント・権限）のみ。
// メニューマスター（§8.2）や取引（§8.5）は各フェーズで追加する。
// ---------------------------------------------------------------------------

export type AccountStatus = 'active' | 'invited' | 'disabled';
export type RbacProduct = 'pos' | 'es';
export type RbacScope = 'corporation' | 'company' | 'shop';

export interface Corporation {
  id: string;
  name: string;
}

export interface Company {
  id: string;
  corporation_id: string;
  name: string;
  display_order: number;
}

/** 会計ボタンを押した後にお客様へ出す案内（仕様書 §5.12） */
export type CheckoutGuide = 'wait_at_table' | 'call_staff' | 'come_to_register';

/** 釣銭準備金を入力するタイミング（仕様書 §5.12） */
export type ChangeFundTiming = 'with_closing' | 'separate';

/** 店舗の操作用パスワード。設定のみで読み出しはしない */
export type ShopPasswordKind = 'drawer_open' | 'void' | 'table_clear';

export interface Shop {
  id: string;
  company_id: string;
  slug: string;
  name: string;
  name_en: string | null;
  icon_url: string | null;
  /** 0:00 からの分。1440 以上は翌日（1860 なら 31:00 ＝ 翌 7:00） */
  open_time_min: number | null;
  close_time_min: number | null;
  display_order: number;
  standard_tax_rate: number;
  reduced_tax_rate: number;
  tax_included: boolean;
  service_charge_rate: number;
  invoice_registration_number: string | null;
  business_day_cutoff_hour: number;
  timezone: string;

  // --- 店舗タブ（§5.12） ---
  last_order_label: string | null;
  checkout_note: string | null;
  order_limit_enabled: boolean;
  order_limit_per_person: number | null;
  sold_out_daily_reset: boolean;
  note_input_enabled: boolean;
  staff_call_enabled: boolean;
  auto_checkout_slip: boolean;
  show_tax_excluded_price: boolean;
  checkout_guide: CheckoutGuide;
  entry_alert_enabled: boolean;
  entry_alert_min: number | null;
  last_order_alert_enabled: boolean;
  last_order_alert_min: number | null;
  tip_enabled: boolean;
  ai_handy: boolean;
  ai_chat_diagnosis: boolean;
  ai_menu_book_diagnosis: boolean;
  ai_mo_optimize: boolean;
  ai_daily_report: boolean;
  ai_sales_forecast: boolean;
  ai_slip_instruction: boolean;

  // --- レジ設定タブ（§5.12） ---
  receipt_address: string | null;
  contact_info: string | null;
  stamp_tax_office: string | null;
  select_staff_on_checkout: boolean;
  change_fund_timing: ChangeFundTiming;
  default_inflow_free: boolean;
  show_zero_price_items: boolean;
  auto_round_discount: boolean;
  open_drawer_on_cashless: boolean;
  /** 設定済みかどうかだけを画面に渡す。ハッシュそのものは送らない */
  has_drawer_open_password: boolean;
  has_void_password: boolean;
  has_table_clear_password: boolean;
  use_stera: boolean;
  receipt_auto_print: boolean;
  temp_receipt_enabled: boolean;
  closing_by_time_slot: boolean;
  closing_by_location: boolean;
  closing_by_area: boolean;
  closing_by_menu_type: boolean;
  closing_by_inflow: boolean;
  closing_tax_included: boolean;
  time_charge_rate: number;
  time_charge_start_min: number | null;
  time_charge_end_min: number | null;

  // --- Google マップ設定タブ（§5.12） ---
  google_place_id: string | null;
  gmap_review_from_survey: boolean;
  gmap_review_promote_mo: boolean;
  gmap_review_min_minutes: number | null;
}

/** 営業時間帯（仕様書 §5.12）。分析画面の絞り込みに使う */
export interface BusinessHour {
  id: string;
  shop_id: string;
  name: string;
  start_min: number;
  end_min: number;
  display_order: number;
}

export interface Account {
  id: string;
  corporation_id: string;
  email: string;
  name: string;
  status: AccountStatus;
  joined_at: string | null;
  created_at: string;
}

export interface RoleDefinition {
  id: string;
  corporation_id: string;
  product: RbacProduct;
  name: string;
  is_system: boolean;
  permissions: PermissionMap;
  display_order: number;
}

export interface AccountRole {
  account_id: string;
  product: RbacProduct;
  role_id: string;
  scope_type: RbacScope;
  scope_ids: string[];
}

/** アカウント一覧で 1 行ぶんに必要な情報 */
export interface AccountRow extends Account {
  role_name: string | null;
  scope_type: RbacScope | null;
  scope_labels: string[];
}

export interface ShopGroup {
  id: string;
  corporation_id: string;
  name: string;
  display_order: number;
  shop_ids: string[];
}

/** ログイン中のユーザーが持つコンテキスト。レイアウトと権限判定に使う */
export interface SessionContext {
  account: Account;
  corporation: Corporation;
  companies: Company[];
  shops: Shop[];
  permissions: PermissionMap;
  roleName: string | null;
  /** ヘッダーの業態セレクタで選択中の業態 */
  currentCompanyId: string;
}

// ---------------------------------------------------------------------------
// メニューマスター（仕様書 §8.2）。業態単位で持つ
// ---------------------------------------------------------------------------

export type MenuTypeValue = 'food' | 'drink' | 'other';
export type ImageSize = 'large' | 'medium' | 'small' | 'hidden';
export type TaxMethod = 'incl' | 'excl';

export interface Category {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  staff_display_name: string | null;
  handy_bg_color: string | null;
  kds_color: string | null;
  display_order: number;
  is_active: boolean;
}

export interface Menu {
  id: string;
  company_id: string;
  name: string;
  receipt_display_name: string | null;
  staff_display_name: string | null;
  description: string | null;
  featured_label: string | null;
  menu_type: MenuTypeValue;
  image_url: string | null;
  image_size: ImageSize;
  tax_method: TaxMethod;
  tax_rate: number;
  price: number;
  cost_price: number | null;
  is_takeout: boolean;
  is_free_key: boolean;
  is_notice_only: boolean;
  reduced_rate_eligible: boolean;
  display_order: number;
}

export interface OptionDef {
  id: string;
  company_id: string;
  name: string;
  receipt_display_name: string | null;
  min_choice: number;
  max_choice: number;
  display_order: number;
}

export interface Choice {
  id: string;
  option_id: string;
  name: string;
  receipt_display_name: string | null;
  price: number;
  is_default: boolean;
  is_available: boolean;
  display_order: number;
}

/** メニュー一覧の 1 行（仕様書 §5.2 の列） */
export interface MenuRow extends Menu {
  category_names: string[];
  option_names: string[];
  /** この業態の店舗のうち、取扱 ON になっている店舗数 */
  dealing_shop_count: number;
}

/** カテゴリ一覧の 1 行（§5.6 の列） */
export interface CategoryRow extends Category {
  menu_names: string[];
  menu_ids: string[];
}

/** オプション一覧の 1 行（§5.5 の列） */
export interface OptionRow extends OptionDef {
  choices: Choice[];
  menu_names: string[];
  menu_ids: string[];
}

/** 店舗ごとの取扱設定（仕様書 §8.3 の shop_menus / §5.3 取扱設定タブ） */
export interface ShopMenu {
  shop_id: string;
  menu_id: string;
  is_dealing: boolean;
  is_visible_customer: boolean;
  is_visible_staff: boolean;
  in_stock: boolean;
  /** null は「無制限」 */
  stock_qty: number | null;
  /** null は「未設定」。毎日リセットされる */
  daily_stock_qty: number | null;
  kitchen_printer_id: string | null;
  dish_up_slip_group_id: string | null;
  display_order: number;
}

/**
 * キッチンプリンター（仕様書 §8.3 の roles）。
 * RBAC の roles_definitions と紛らわしいため、この名前にしている。
 */
export interface KitchenPrinter {
  id: string;
  shop_id: string;
  name: string;
  display_order: number;
  // --- 印刷設定（§5.15） ---
  notify_mobile_payment: boolean;
  print_call_slip: boolean;
  print_checkout_slip: boolean;
  print_dish_up_slip: boolean;
  print_table_move_slip: boolean;
  dish_up_layout: string | null;
  print_sound: PrintSound;
  /** 緊急時の自動振替先 */
  fallback_printer_1_id: string | null;
  fallback_printer_2_id: string | null;
}

/** デシャップグループ（仕様書 §5.16） */
export interface DishUpSlipGroup {
  id: string;
  shop_id: string;
  name: string;
  display_order: number;
}

/** 取扱メニュー一覧の 1 行（仕様書 §5.13 の列） */
export interface ShopMenuRow extends ShopMenu {
  menu_name: string;
  menu_type: MenuTypeValue;
  price: number;
  image_url: string | null;
  category_names: string[];
}

export type Locale = 'en' | 'zh-CN' | 'ko' | 'ne' | 'vi' | 'my';

export const LOCALES: { value: Locale; label: string }[] = [
  { value: 'en', label: '英語' },
  { value: 'zh-CN', label: '中国語（簡体字）' },
  { value: 'ko', label: '韓国語' },
  { value: 'ne', label: 'ネパール語' },
  { value: 'vi', label: 'ベトナム語' },
  { value: 'my', label: 'ミャンマー語' },
];

export interface MenuTranslation {
  menu_id: string;
  locale: Locale;
  name: string | null;
  description: string | null;
  featured_label: string | null;
}

/** メニュー編集画面が必要とする一式（§5.3） */
export interface MenuDetail {
  menu: Menu;
  categoryIds: string[];
  optionIds: string[];
  /** 取扱設定タブ。業態配下の全店舗ぶん（未設定の店舗も行として出す） */
  dealers: (ShopMenu & { shop_name: string })[];
  translations: MenuTranslation[];
}

// ---------------------------------------------------------------------------
// プラン（仕様書 §5.4 / §8.2）
//
// 飲み放題・コースなど「時間制限つきで、複数カテゴリのメニューを 0 円で
// 注文できる」商品。価格はプランオプションの選択肢が持つ（人数 × 単価 など）。
// ---------------------------------------------------------------------------

export type PlanOptionInput = 'count' | 'select';

export interface PlanGroup {
  id: string;
  company_id: string;
  name: string;
  display_order: number;
}

export interface Plan {
  id: string;
  company_id: string;
  name: string;
  receipt_display_name: string | null;
  handy_display_name: string | null;
  category_id: string | null;
  plan_group_id: string | null;
  description: string | null;
  has_time_limit: boolean;
  time_limit_min: number | null;
  has_end_notice: boolean;
  end_notice_min: number | null;
  featured_label: string | null;
  image_url: string | null;
  image_size: ImageSize;
  tax_method: TaxMethod;
  tax_rate: number;
  display_order: number;
}

export interface PlanChoice {
  id: string;
  plan_option_id: string;
  name: string;
  price: number;
  is_default: boolean;
  /** 個数入力のときの上限。null は無制限 */
  max_count: number | null;
  display_order: number;
}

export interface PlanOption {
  id: string;
  plan_id: string;
  name: string;
  input_type: PlanOptionInput;
  min_kinds: number;
  max_kinds: number;
  display_order: number;
  choices: PlanChoice[];
}

export interface PlanCategory {
  id: string;
  plan_id: string;
  name: string;
  display_order: number;
}

export interface PlanMenuLink {
  plan_id: string;
  plan_category_id: string;
  menu_id: string;
  price: number;
  display_order: number;
}

export interface ShopPlan {
  shop_id: string;
  plan_id: string;
  is_dealing: boolean;
  is_visible_customer: boolean;
  is_visible_staff: boolean;
  in_stock: boolean;
  display_order: number;
}

export interface PlanTranslation {
  plan_id: string;
  locale: Locale;
  name: string | null;
  description: string | null;
  featured_label: string | null;
}

/** プラン一覧の 1 行（§5.4 の列） */
export interface PlanRow extends Plan {
  category_name: string | null;
  plan_group_name: string | null;
  option_names: string[];
  plan_category_names: string[];
  dealing_shop_count: number;
}

/** プラン編集画面が必要とする一式（§5.4 の 7 タブ） */
export interface PlanDetail {
  plan: Plan;
  options: PlanOption[];
  categories: PlanCategory[];
  menus: PlanMenuLink[];
  firstOrderMenuIds: string[];
  dealers: (ShopPlan & { shop_name: string })[];
  translations: PlanTranslation[];
}

// ---------------------------------------------------------------------------
// 支払方法等設定（仕様書 §5.10）。いずれも業態単位のマスター
// ---------------------------------------------------------------------------

export type PaymentKind =
  | 'cash'
  | 'mobile'
  | 'credit'
  | 'point'
  | 'qr'
  | 'e_money'
  | 'credit_sale'
  | 'gift_certificate';

export const PAYMENT_KINDS: { value: PaymentKind; label: string }[] = [
  { value: 'cash', label: '現金' },
  { value: 'mobile', label: 'モバイル決済' },
  { value: 'credit', label: 'クレジット' },
  { value: 'point', label: 'ポイント' },
  { value: 'qr', label: 'QR決済' },
  { value: 'e_money', label: '電子マネー' },
  { value: 'credit_sale', label: '掛売' },
  { value: 'gift_certificate', label: '商品券' },
];

export interface PaymentMethod {
  id: string;
  company_id: string;
  name: string;
  kind: PaymentKind;
  /** 「現金」「オンライン決済」はシステム既定で削除できない */
  is_system: boolean;
  display_order: number;
}

export interface DiscountType {
  id: string;
  company_id: string;
  name: string;
  is_system: boolean;
  display_order: number;
}

export interface InflowSource {
  id: string;
  company_id: string;
  name: string;
  is_system: boolean;
  display_order: number;
}

/** 決済端末が返すブランド名と、支払方法の対応づけ */
export interface TerminalPaymentMethod {
  id: string;
  company_id: string;
  brand: string;
  payment_method_id: string | null;
  display_order: number;
}

/** 支払方法等設定の 4 タブぶん */
export interface PaymentSettings {
  methods: PaymentMethod[];
  discountTypes: DiscountType[];
  inflowSources: InflowSource[];
  terminals: TerminalPaymentMethod[];
}

// ---------------------------------------------------------------------------
// P1 の残り（仕様書 §5.7 / §5.9 / §5.11 / §5.14〜§5.19）
// ---------------------------------------------------------------------------

/** おすすめメニューのセット（§5.7） */
export interface RecommendationSet {
  id: string;
  company_id: string;
  name: string;
  display_name: string | null;
  display_order: number;
}

export interface ShopRecommendation {
  shop_id: string;
  set_id: string | null;
  is_visible: boolean;
}

/** 自動翻訳設定（§5.9） */
export interface AutoTranslationSetting {
  company_id: string;
  is_enabled: boolean;
  target_menu: boolean;
  target_plan: boolean;
  target_option: boolean;
  target_category: boolean;
  target_recommendation: boolean;
}

/** お通し自動設定（§5.9） */
export interface CompulsoryAppetizer {
  id: string;
  company_id: string;
  name: string;
  menu_id: string | null;
  price: number;
  start_min: number;
  end_min: number;
  display_order: number;
}

export interface ShopAppetizer {
  shop_id: string;
  appetizer_id: string;
  is_auto_order: boolean;
}

/** 自動釣銭機設定（§5.9） */
export interface CashChangerSetting {
  shop_id: string;
  keep_float_in_changer: boolean;
  allow_external_deposit: boolean;
  allow_emergency_cash: boolean;
}

/** モバイルオーダーデザイン設定（§5.11） */
export type MoTheme = 'light' | 'dark';

export interface MobileOrderDesign {
  company_id: string;
  menu_theme: MoTheme;
  checkin_theme: MoTheme;
}

/** アプリ表示時間設定（§5.14）。day_of_week は 0=日 … 6=土、7=祝日 */
export interface OrderableTime {
  id: string;
  company_id: string;
  name: string;
}

export interface OrderableTimeSlot {
  orderable_time_id: string;
  day_of_week: number;
  start_min: number;
  end_min: number;
}

export const DAY_LABELS = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日', '祝日'];

/** 印刷音（§5.15） */
export type PrintSound = 'a' | 'b' | 'none';

/** 調理アイテム（§5.16） */
export interface CookingItem {
  id: string;
  shop_id: string;
  name: string;
  kitchen_printer_id: string | null;
  display_order: number;
}

/** 店員（§5.17） */
export interface Clerk {
  id: string;
  shop_id: string;
  name: string;
  is_visible: boolean;
  display_order: number;
}

/** ハンディ端末（§5.18） */
export interface HandyTerminal {
  id: string;
  shop_id: string;
  name: string;
  device_id: string | null;
  status: string;
  app_version: string | null;
  native_version: string | null;
  brand: string | null;
  model: string | null;
  os_name: string | null;
  os_version: string | null;
  registered_at: string;
}

/** エリア（§5.19） */
export interface Area {
  id: string;
  shop_id: string;
  name: string;
  display_order: number;
}

export interface RestaurantTable {
  id: string;
  store_id: string;
  area_id: string | null;
  name: string;
  seats: number | null;
  qr_token: string | null;
  sort_order: number;
  is_active: boolean;
}

// ---------------------------------------------------------------------------
// P2: 取引・本部機能（仕様書 §5.22〜§5.28 / §8.5）
// ---------------------------------------------------------------------------

export type SessionStatus = 'open' | 'closed' | 'cleared';

export interface TableSession {
  id: string;
  store_id: string;
  table_id: string | null;
  parent_session_id: string | null;
  guest_count: number;
  status: SessionStatus;
  opened_at: string;
  closed_at: string | null;
  clear_reason: string | null;
  inflow_source_id: string | null;
}

export interface OrderRecord {
  id: string;
  store_id: string;
  session_id: string;
  order_number: number;
  channel: string;
  placed_at: string;
}

export interface OrderItemRecord {
  id: string;
  order_id: string;
  session_id: string;
  menu_id: string | null;
  name_snapshot: string;
  unit_price: number;
  quantity: number;
  tax_rate: number;
  line_total: number;
  status: string;
  /** 注文時に選ばれたオプション（§6.5 のオプション別分析に使う） */
  options_snapshot: OrderItemOption[];
  /** KDS の打刻（§6.9）。KDS を使っていない店舗では null */
  cooked_at: string | null;
  picked_up_at: string | null;
  served_at: string | null;
}

export interface OrderItemOption {
  group: string;
  name: string;
  price_delta: number;
}

/** 会計。Phase A の payments をそのまま使う */
export interface PaymentRecord {
  id: string;
  store_id: string;
  session_id: string;
  method: string;
  payment_method_id: string | null;
  receipt_number: number | null;
  clerk_id: string | null;
  guest_count: number | null;
  inflow_source_id: string | null;
  subtotal: number;
  discount: number;
  service_charge: number;
  tax: number;
  total: number;
  status: 'paid' | 'refunded';
  paid_at: string;
  voided_at: string | null;
  void_reason: string | null;
  modified_at: string | null;
}

export interface AccountingDiscount {
  id: string;
  payment_id: string;
  discount_type_id: string | null;
  amount: number;
}

export type AuditEvent =
  | 'drawer_open'
  | 'discount'
  | 'void'
  | 'table_clear'
  | 'accounting_modify'
  | 'cash_in'
  | 'cash_out'
  | 'price_override';

export const AUDIT_EVENT_LABELS: Record<AuditEvent, string> = {
  drawer_open: 'ドロワーオープン',
  discount: '値引き・割引',
  void: 'VOID',
  table_clear: 'テーブルクリア',
  accounting_modify: '会計修正',
  cash_in: '入金',
  cash_out: '出金',
  price_override: '価格変更',
};

export interface AuditLog {
  id: string;
  shop_id: string;
  event_type: AuditEvent;
  occurred_at: string;
  table_id: string | null;
  clerk_id: string | null;
  amount: number | null;
  receipt_number: number | null;
  note: string | null;
}

/** 日次処理（§5.22） */
export interface CashClosing {
  id: string;
  store_id: string;
  business_day: string;
  closing_index: number;
  closed_at: string;
  total_sales: number;
  guest_count: number;
  group_count: number;
  opening_float: number;
  cash_sales: number;
  cash_in: number;
  cash_out: number;
  expected_cash: number;
  counted_cash: number;
  difference: number;
  bank_deposit: number;
  carryover_fund: number;
  denomination_counts: Record<string, number>;
}

export interface BankDepositCorrection {
  id: string;
  closing_id: string;
  corrected_at: string;
  reason: string | null;
  before_amount: number;
  after_amount: number;
  account_id: string | null;
}

/** 金種（§5.22 の現金在高） */
export const DENOMINATIONS = [10000, 5000, 2000, 1000, 500, 100, 50, 10, 5, 1] as const;

/** キャッシュレス決済（§5.24） */
export interface TerminalPayment {
  id: string;
  shop_id: string;
  transaction_id: string;
  kind: string | null;
  method: string | null;
  status: string;
  occurred_at: string;
  amount: number;
  fee: number;
  fee_rate: number;
  net: number;
  brand: string | null;
  issuer_country: string | null;
  masked_pan: string | null;
  cycle_start: string | null;
  cycle_end: string | null;
  refund_requested_at: string | null;
}

export interface TerminalDeposit {
  id: string;
  corporation_id: string;
  requested_at: string | null;
  executed_at: string | null;
  bank_account: string | null;
  cycle_start: string | null;
  cycle_end: string | null;
  amount: number;
  sales: number;
  fee: number;
  tax: number;
  adjustment: number;
  carryover: number;
  cycle_type: string | null;
  status: string;
  statement_no: string | null;
}

/** レポートくん設定（§5.27） */
export interface LineReportingBotConfig {
  id: string;
  corporation_id: string;
  group_name: string;
  line_group_id: string | null;
  shop_ids: string[];
  send_time_min: number;
  items: Record<string, boolean>;
  is_active: boolean;
}

// ---------------------------------------------------------------------------
// P3: 分析（仕様書 §5.1 / §6.x / §8.7）
// ---------------------------------------------------------------------------

export type PlSection = 'sales' | 'cogs' | 'labor' | 'sga';
export type CostClass = 'variable' | 'fixed';
export type ProductType = 'food' | 'drink' | 'other';

export const PL_SECTION_LABELS: Record<PlSection, string> = {
  sales: '売上',
  cogs: '売上原価',
  labor: '人件費',
  sga: '販売管理費',
};

export interface PlAccount {
  id: string;
  corporation_id: string;
  code: string | null;
  pl_section: PlSection;
  name: string;
  sub_name: string | null;
  cost_class: CostClass | null;
  petty_cash_usable: boolean;
  is_visible: boolean;
  company_ids: string[];
  note: string | null;
  display_order: number;
}

export interface Vendor {
  id: string;
  corporation_id: string;
  name: string;
  kind: string | null;
  note: string | null;
  display_order: number;
}

export interface PurchaseTransaction {
  id: string;
  shop_id: string;
  purchased_on: string;
  vendor_id: string | null;
  product_name: string;
  spec: string | null;
  product_type: ProductType;
  unit_price: number;
  quantity: number;
  amount: number;
  source: 'manual' | 'auto' | 'csv';
  note: string | null;
}

export interface KpiTarget {
  id: string;
  shop_id: string;
  year_month: string;
  sales_target: number;
  food_cost_target: number;
  drink_cost_target: number;
  labor_target: number;
  sga_target: number;
  guest_target: number;
  avg_spend_target: number;
}

export interface DailySalesTarget {
  shop_id: string;
  business_date: string;
  amount: number;
}

export interface DailyReport {
  id: string;
  shop_id: string;
  business_date: string;
  weather: string | null;
  comment: string | null;
}

/** 日別の集計（§6.4） */
export interface DailySummary {
  business_date: string;
  sales: number;
  guest_count: number;
  group_count: number;
  target: number;
}

/** 時間帯別の集計（§6.9 の曜日・時間別分析） */
export interface HourlySummary {
  business_date: string;
  hour: number;
  sales: number;
  guest_count: number;
}

/** 商品別の集計（§6.5） */
export interface MenuSummary {
  menu_id: string | null;
  name: string;
  category_name: string | null;
  menu_type: ProductType;
  unit_price: number;
  qty: number;
  sales: number;
  gross_profit: number;
}

// ---------------------------------------------------------------------------
// P4: CRM（仕様書 §5.29〜§5.32 / §8.6）
// ---------------------------------------------------------------------------

export type CustomerGender = 'male' | 'female' | 'other' | 'unknown';
export type CouponKind = 'benefit' | 'discount' | 'free_menu';
export type DeliveryStatus = 'reserved' | 'draft' | 'suspended' | 'sent';
export type DeliveryTarget = 'all' | 'filtered' | 'line_ids';

export const GENDER_LABELS: Record<CustomerGender, string> = {
  male: '男性',
  female: '女性',
  other: 'その他',
  unknown: '回答しない',
};

export const COUPON_KIND_LABELS: Record<CouponKind, string> = {
  benefit: '特典の提供',
  discount: '割引',
  free_menu: '無料メニュー',
};

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  reserved: '予約中',
  draft: '下書き',
  suspended: '停止中',
  sent: '配信済み',
};

export interface Customer {
  id: string;
  corporation_id: string;
  line_user_id: string | null;
  zalo_user_id: string | null;
  display_name: string | null;
  gender: CustomerGender;
  birth_date: string | null;
  first_visit_at: string | null;
  last_visit_at: string | null;
  visit_count: number;
  rank_name: string | null;
}

/** 配信チャネル。日本は LINE、ベトナムは Zalo が主流 */
export type MessagingChannel = 'line' | 'zalo';

export const CHANNEL_LABELS: Record<MessagingChannel, string> = {
  line: 'LINE',
  zalo: 'Zalo',
};

/** LINE 公式アカウント / Zalo OA をまとめて扱う */
export interface MessagingAccount {
  id: string;
  company_id: string;
  channel: MessagingChannel;
  name: string;
  /** LINE ならチャネル ID、Zalo なら OA ID */
  channel_id: string | null;
  monthly_quota: number;
  /** Zalo の ZNS（通知メッセージ）の月間上限 */
  zns_quota: number;
  friends_total: number;
  friends_active: number;
  blocked: number;
}

export interface Coupon {
  id: string;
  company_id: string;
  kind: CouponKind;
  name: string;
  display_name: string | null;
  content: string | null;
  description: string | null;
  terms: string | null;
  image_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  valid_days: number | null;
  discount_type_id: string | null;
  menu_id: string | null;
}

export interface CouponPreset {
  id: string;
  company_id: string;
  segment: string;
  enabled: boolean;
  coupon_id: string | null;
}

export interface MessageDelivery {
  id: string;
  company_id: string;
  channel: MessagingChannel;
  messaging_account_id: string | null;
  /** Zalo の ZNS はテンプレート登録が要る */
  zns_template_id: string | null;
  name: string;
  status: DeliveryStatus;
  target_type: DeliveryTarget;
  filter: Record<string, unknown>;
  target_count: number;
  max_count: number | null;
  target_updated_at: string | null;
  scheduled_at: string | null;
  repeat_daily: boolean;
}

export interface MiniGame {
  id: string;
  company_id: string;
  name: string;
  enabled: boolean;
  shop_ids: string[];
  time_from_min: number | null;
  time_to_min: number | null;
  win_rate: number;
  win_coupon_id: string | null;
  lose_coupon_id: string | null;
}

export interface MembershipRank {
  id: string;
  company_id: string;
  name: string;
  min_visits: number;
  coupon_id: string | null;
  display_order: number;
}

export interface QuestionnaireAnswer {
  id: string;
  shop_id: string;
  customer_id: string | null;
  answered_at: string;
  revisit_score: number | null;
  service_score: number | null;
  food_score: number | null;
  speed_score: number | null;
  clean_score: number | null;
  comment: string | null;
  gender: CustomerGender;
  age: number | null;
  awareness_channel: string | null;
}

export interface MenuReview {
  id: string;
  menu_id: string;
  shop_id: string;
  customer_id: string | null;
  score: number;
  tags: string[];
  comment: string | null;
  reviewed_at: string;
}

export interface EmployeeReview {
  id: string;
  clerk_id: string;
  shop_id: string;
  customer_id: string | null;
  is_good: boolean;
  comment: string | null;
  reviewed_at: string;
}

export interface ShopQuestionnaireSetting {
  shop_id: string;
  menu_review_enabled: boolean;
  staff_review_enabled: boolean;
}

// ---------------------------------------------------------------------------
// 残りの画面ぶん（§5.31 カスタムアンケート / §5.32 配信・クーポン分析 / §7.2 クチコミ）
// ---------------------------------------------------------------------------

export type QuestionType = 'score' | 'choice' | 'multi_choice' | 'text';

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  score: '5段階評価',
  choice: '単一選択',
  multi_choice: '複数選択',
  text: '自由記述',
};

export interface Questionnaire {
  id: string;
  company_id: string;
  kind: 'line' | 'mobile_order';
  name: string;
  image_url: string | null;
  reward_coupon_id: string | null;
}

/** カスタム設問はこの数まで（§5.31） */
export const MAX_CUSTOM_QUESTIONS = 5;

export interface QuestionnaireQuestion {
  id: string;
  questionnaire_id: string;
  text: string;
  type: QuestionType;
  options: string[];
  is_custom: boolean;
  display_order: number;
}

/** 1 回ぶんの配信実績。来店につながったかまで持つ */
export interface DeliveryJob {
  id: string;
  delivery_id: string;
  shop_id: string | null;
  sent_at: string;
  sent_count: number;
  opened_count: number;
  visited_count: number;
  visited_group_count: number;
  effect_sales: number;
}

export interface CustomerCoupon {
  id: string;
  coupon_id: string;
  customer_id: string;
  issued_at: string;
  used_at: string | null;
  used_shop_id: string | null;
  effect_sales: number;
}

export interface GoogleBusinessProfile {
  shop_id: string;
  location_id: string | null;
  account_name: string | null;
  is_connected: boolean;
  synced_at: string | null;
}

export interface GoogleReview {
  id: string;
  shop_id: string;
  review_id: string | null;
  author_name: string | null;
  rating: number;
  comment: string | null;
  posted_at: string;
  reply_text: string | null;
  replied_at: string | null;
}

export interface CustomReport {
  id: string;
  corporation_id: string;
  name: string;
  owner_account_id: string | null;
  owner_name: string | null;
  share_scope: 'private' | 'corporation';
  definition: {
    source: 'sales' | 'menu' | 'survey';
    metrics: string[];
    group_by: string;
    shop_ids: string[];
  };
  updated_at: string;
}

/** §8.8 アカウントの操作ログ。POS の監査ログ（audit_logs）とは別物 */
export interface AccountAuditLog {
  id: string;
  corporation_id: string;
  account_id: string | null;
  account_name: string | null;
  action: string;
  target: string | null;
  occurred_at: string;
  ip: string | null;
}

export const ACCOUNT_ACTION_LABELS: Record<string, string> = {
  login: 'ログイン',
  logout: 'ログアウト',
  account_invite: 'アカウント招待',
  account_update: 'アカウント編集',
  account_disable: 'アカウント無効化',
  role_update: '権限設定の変更',
  menu_update: 'メニュー編集',
  shop_update: '店舗設定の変更',
  export: 'CSV ダウンロード',
};

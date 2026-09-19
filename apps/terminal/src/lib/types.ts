// ---------------------------------------------------------------------------
// DB のテーブル定義に対応する型。
// supabase/migrations/*.sql を変更したら、ここも合わせて更新すること。
// （`supabase gen types typescript` で自動生成に切り替えることもできる）
// ---------------------------------------------------------------------------

export type PrepStation = 'kitchen' | 'bar' | 'none';
/** 提供形態。持ち帰りの飲食料品にだけ軽減税率が適用される */
export type ServiceType = 'eat_in' | 'takeout';
export type SessionStatus =
  | 'open'
  | 'bill_requested'
  | 'closed'
  | 'cancelled'
  /** 伝票結合で他の伝票に吸収された */
  | 'merged';
export type OrderChannel = 'mobile' | 'pos';
export type OrderItemStatus = 'pending' | 'cooking' | 'ready' | 'served' | 'cancelled';
export type PaymentMethod = 'cash' | 'card' | 'qr' | 'e_money' | 'other';
export type PaymentStatus = 'paid' | 'refunded';
export type CashMovementKind = 'deposit' | 'withdrawal';

export interface Store {
  id: string;
  slug: string;
  name: string;
  /** 標準税率。店内飲食に適用する */
  standard_tax_rate: number;
  /** 軽減税率。持ち帰りの飲食料品に適用する */
  reduced_tax_rate: number;
  tax_included: boolean;
  service_charge_rate: number;
  staff_pin_hash: string | null;
  mobile_order_open: boolean;
  opening_note: string | null;
  business_day_cutoff_hour: number;
  timezone: string;
  /** 適格請求書発行事業者の登録番号（例: T1234567890123） */
  invoice_registration_number: string | null;
  /** レジ締め時の釣銭準備金の既定値 */
  cash_float_default: number;
  created_at: string;
  updated_at: string;
}

export interface RestaurantTable {
  id: string;
  store_id: string;
  name: string;
  area: string | null;
  seats: number;
  qr_token: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  store_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface MenuItem {
  id: string;
  store_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  /** 持ち帰り時に軽減税率を適用できる商品か。酒類・非飲食料品は false */
  reduced_rate_eligible: boolean;
  prep_station: PrepStation;
  is_available: boolean;
  is_sold_out: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface OptionGroup {
  id: string;
  store_id: string;
  name: string;
  min_select: number;
  max_select: number;
  sort_order: number;
}

export interface MenuOption {
  id: string;
  group_id: string;
  name: string;
  price_delta: number;
  sort_order: number;
  is_available: boolean;
}

/** 商品に紐づくオプショングループ（選択肢込み）。メニュー画面で使う */
export interface OptionGroupWithOptions extends OptionGroup {
  options: MenuOption[];
}

/** メニュー表示用。カテゴリ配下に商品をぶら下げた形 */
export interface MenuItemWithOptions extends MenuItem {
  option_groups: OptionGroupWithOptions[];
}

export interface CategoryWithItems extends Category {
  items: MenuItemWithOptions[];
}

export interface TableSession {
  id: string;
  store_id: string;
  table_id: string;
  guest_count: number;
  status: SessionStatus;
  /** この卓の既定の提供形態。注文ごとに上書きできる */
  service_type: ServiceType;
  opened_at: string;
  closed_at: string | null;
  note: string | null;
}

export interface Order {
  id: string;
  store_id: string;
  session_id: string;
  order_number: number;
  channel: OrderChannel;
  service_type: ServiceType;
  note: string | null;
  placed_at: string;
}

/** order_items.options_snapshot の中身 */
export interface SelectedOption {
  group: string;
  name: string;
  price_delta: number;
}

export interface OrderItem {
  id: string;
  store_id: string;
  order_id: string;
  session_id: string;
  menu_item_id: string | null;
  name_snapshot: string;
  unit_price: number;
  options_price: number;
  options_snapshot: SelectedOption[];
  quantity: number;
  tax_rate: number;
  prep_station: PrepStation;
  status: OrderItemStatus;
  note: string | null;
  created_at: string;
  updated_at: string;
  line_total: number;
  /** 支払い済みの会計。null は未会計 */
  payment_id: string | null;
}

export interface Payment {
  id: string;
  store_id: string;
  session_id: string;
  method: PaymentMethod;
  subtotal: number;
  discount: number;
  service_charge: number;
  tax: number;
  total: number;
  received: number;
  change_due: number;
  status: PaymentStatus;
  note: string | null;
  paid_at: string;
  /** インボイスの記載要件を満たすための税率別内訳 */
  tax_breakdown: TaxBreakdownRow[];
  /** 人数割りのとき何分割の何番目か */
  split_count: number;
  split_index: number;
  voided_at: string | null;
  void_reason: string | null;
}

/** 税率ごとの対象額と消費税額 */
export interface TaxBreakdownRow {
  rate: number;
  taxable: number;
  tax: number;
}

export interface CashMovement {
  id: string;
  store_id: string;
  business_day: string;
  kind: CashMovementKind;
  amount: number;
  reason: string | null;
  created_at: string;
}

export interface CashDrawerClosing {
  id: string;
  store_id: string;
  business_day: string;
  opening_float: number;
  cash_sales: number;
  cash_in: number;
  cash_out: number;
  /** 理論在高 = 釣銭準備金 + 現金売上 + 入金 - 出金 */
  expected_cash: number;
  /** 実査額 */
  counted_cash: number;
  /** 実査額 - 理論在高。プラスなら過剰、マイナスなら不足 */
  difference: number;
  note: string | null;
  closed_at: string;
}

/** calc_session_total() の戻り値 */
export interface SessionTotal {
  subtotal: number;
  service_charge: number;
  discount: number;
  tax: number;
  total: number;
  tax_breakdown: TaxBreakdownRow[];
}

/** sales_summary() の戻り値 */
export interface SalesSummaryRow {
  business_day: string;
  sessions: number;
  guests: number;
  gross_sales: number;
  discount_total: number;
  tax_total: number;
  avg_per_guest: number;
}

/** item_ranking() の戻り値 */
export interface ItemRankingRow {
  name: string;
  quantity: number;
  sales: number;
}

// ---------------------------------------------------------------------------
// 画面で組み立てる複合型
// ---------------------------------------------------------------------------

/** POS のフロアマップ 1 マス分 */
export interface TableWithSession extends RestaurantTable {
  session: TableSession | null;
  /** 現在の税込小計（会計前の暫定額） */
  current_total: number;
  item_count: number;
  /** 未提供の品数。フロアマップで「料理が滞っている卓」を見つけるのに使う */
  pending_count: number;
}

/** KDS のカード 1 枚分 */
export interface KdsItem extends OrderItem {
  table_name: string;
  order_number: number;
  channel: OrderChannel;
}

/** 注文カート（モバイル / POS 共通） */
export interface CartLine {
  /** カート内での一意キー。同じ商品でもオプションが違えば別行にする */
  key: string;
  menu_item_id: string;
  name: string;
  unit_price: number;
  quantity: number;
  option_ids: string[];
  option_labels: SelectedOption[];
  options_price: number;
  note: string;
}

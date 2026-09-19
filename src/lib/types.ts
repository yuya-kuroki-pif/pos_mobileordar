// ---------------------------------------------------------------------------
// DB のテーブル定義に対応する型。
// supabase/migrations/*.sql を変更したら、ここも合わせて更新すること。
// （`supabase gen types typescript` で自動生成に切り替えることもできる）
// ---------------------------------------------------------------------------

export type PrepStation = 'kitchen' | 'bar' | 'none';
export type SessionStatus = 'open' | 'bill_requested' | 'closed' | 'cancelled';
export type OrderChannel = 'mobile' | 'pos';
export type OrderItemStatus = 'pending' | 'cooking' | 'ready' | 'served' | 'cancelled';
export type PaymentMethod = 'cash' | 'card' | 'qr' | 'e_money' | 'other';
export type PaymentStatus = 'paid' | 'refunded';

export interface Store {
  id: string;
  slug: string;
  name: string;
  tax_rate: number;
  tax_included: boolean;
  service_charge_rate: number;
  staff_pin_hash: string | null;
  mobile_order_open: boolean;
  opening_note: string | null;
  business_day_cutoff_hour: number;
  timezone: string;
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
  tax_rate: number | null;
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
}

/** calc_session_total() の戻り値 */
export interface SessionTotal {
  subtotal: number;
  service_charge: number;
  discount: number;
  tax: number;
  total: number;
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

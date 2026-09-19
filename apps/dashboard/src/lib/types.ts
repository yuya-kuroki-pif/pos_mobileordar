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

export interface Shop {
  id: string;
  company_id: string;
  slug: string;
  name: string;
  name_en: string | null;
  icon_url: string | null;
  open_time: string | null;
  close_time: string | null;
  display_order: number;
  standard_tax_rate: number;
  reduced_tax_rate: number;
  tax_included: boolean;
  service_charge_rate: number;
  invoice_registration_number: string | null;
  business_day_cutoff_hour: number;
  timezone: string;
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

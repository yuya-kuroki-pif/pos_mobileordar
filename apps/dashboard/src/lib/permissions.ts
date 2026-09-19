/**
 * RBAC（仕様書 §10.2）
 *
 * ロール × 機能キー × 権限レベル（編集可能 / 閲覧可能 / 閲覧不可）で判定する。
 * 画面側はサイドメニューの表示とボタンの活性を制御し、
 * 実際の書き込みはサーバー側でも同じ判定を通す（二重チェック）。
 */

export type PermissionLevel = 'edit' | 'view' | 'none';

/** 仕様書 §10.2 の機能キー一覧（dinii の権限設定画面から抽出されたもの） */
export const FEATURE_KEYS = [
  'account_management',
  'bi_integration',
  'shop_ordering',
  'company_ordering',
  'custom_report',
  'menu_master',
  'company_management',
  'crm',
  'analytics',
  'target_management',
  'vendor_registration',
  'purchase_list',
  'petty_cash',
  'shop_management',
  'questionnaire_analytics',
  'daily_closing',
  'accounting_history',
  'table_usage_history',
  'payment_settings',
  'cashless',
  'recommendation_menu',
  'reservation_all',
  'attract_all',
  'monthly_pl_report',
  'pl_accounts',
  'income_expense',
  'auto_appetizer',
  'slip_instruction',
  'reservation_shop_group',
  'cost_display',
  'labor_cost_parttime_display',
  'labor_cost_employee_display',
  'audit_logs',
  'account_audit_logs',
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

/** 権限設定画面で機能をまとめて見せるための分類 */
export const FEATURE_GROUPS: { label: string; keys: FeatureKey[] }[] = [
  {
    label: '管理・設定',
    keys: ['account_management', 'company_management', 'shop_management', 'payment_settings'],
  },
  {
    label: 'メニュー',
    keys: ['menu_master', 'recommendation_menu', 'auto_appetizer', 'slip_instruction'],
  },
  {
    label: '取引・履歴',
    keys: [
      'daily_closing',
      'accounting_history',
      'table_usage_history',
      'cashless',
      'audit_logs',
      'account_audit_logs',
    ],
  },
  {
    label: '分析',
    keys: ['analytics', 'questionnaire_analytics', 'target_management', 'custom_report', 'bi_integration'],
  },
  {
    label: '経営管理',
    keys: [
      'monthly_pl_report',
      'pl_accounts',
      'income_expense',
      'purchase_list',
      'petty_cash',
      'vendor_registration',
    ],
  },
  { label: 'CRM・集客', keys: ['crm', 'attract_all'] },
  {
    label: '表示制限',
    keys: ['cost_display', 'labor_cost_parttime_display', 'labor_cost_employee_display'],
  },
  {
    label: '予約・注文',
    keys: ['shop_ordering', 'company_ordering', 'reservation_all', 'reservation_shop_group'],
  },
];

export const FEATURE_LABEL: Record<FeatureKey, string> = {
  account_management: 'アカウント管理',
  bi_integration: '経営管理連携',
  shop_ordering: '店舗並び順管理',
  company_ordering: '業態並び順管理',
  custom_report: 'カスタムレポート',
  menu_master: 'メニューマスター',
  company_management: '業態管理',
  crm: 'CRM',
  analytics: '分析',
  target_management: '目標管理',
  vendor_registration: '取引先登録',
  purchase_list: '仕入れ一覧',
  petty_cash: '小口現金登録',
  shop_management: '店舗管理',
  questionnaire_analytics: 'アンケート分析',
  daily_closing: '日次処理',
  accounting_history: '会計履歴',
  table_usage_history: 'テーブル利用履歴',
  payment_settings: '支払方法等設定',
  cashless: 'キャッシュレス',
  recommendation_menu: 'おすすめメニュー',
  reservation_all: '予約（全社）',
  attract_all: '集客',
  monthly_pl_report: '月次 PL',
  pl_accounts: '科目登録',
  income_expense: '収支登録',
  auto_appetizer: '自動お通し',
  slip_instruction: '伝票指示',
  reservation_shop_group: '予約（店舗グループ）',
  cost_display: '原価表示',
  labor_cost_parttime_display: '人件費（パート）表示',
  labor_cost_employee_display: '人件費（正社員）表示',
  audit_logs: '重要操作履歴',
  account_audit_logs: 'アカウント操作履歴',
};

export const LEVEL_LABEL: Record<PermissionLevel, string> = {
  edit: '編集可能',
  view: '閲覧可能',
  none: '閲覧不可',
};

export type PermissionMap = Partial<Record<FeatureKey, PermissionLevel>>;

/** 指定した機能の権限レベル。未設定は「閲覧不可」に倒す */
export function levelOf(permissions: PermissionMap, feature: FeatureKey): PermissionLevel {
  return permissions[feature] ?? 'none';
}

export function canEdit(permissions: PermissionMap, feature: FeatureKey): boolean {
  return levelOf(permissions, feature) === 'edit';
}

/** 閲覧以上（編集 or 閲覧）。サイドメニューの表示判定に使う */
export function canView(permissions: PermissionMap, feature: FeatureKey): boolean {
  return levelOf(permissions, feature) !== 'none';
}

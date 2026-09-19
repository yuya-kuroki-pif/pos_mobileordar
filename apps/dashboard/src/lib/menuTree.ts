import type { FeatureKey } from './permissions';

/**
 * サイドメニューの定義（仕様書 §4.2 / §4.3 / §4.4）。
 *
 * ルートは仕様書の URL をそのまま採用する（§14 の規約）。
 * 各項目に機能キーを持たせ、権限が「閲覧不可」の項目はサイドバーから隠す。
 *
 * ここに並んでいて画面がまだ無いものは、対応フェーズで実装する。
 * 未実装のルートは `pending: true` を立て、押しても迷子にならないようにしている。
 */

export interface MenuLeaf {
  key: string;
  label: string;
  href: string;
  feature?: FeatureKey;
  /** 画面が未実装（対応フェーズ待ち） */
  pending?: boolean;
}

export interface MenuGroup {
  key: string;
  label: string;
  children: MenuLeaf[];
}

export type TopSection = 'pos' | 'bi' | 'ai' | 'attract' | 'setting';

export const TOP_TABS: { key: TopSection; label: string; href: string; external?: string }[] = [
  { key: 'pos', label: 'POS', href: '/' },
  { key: 'bi', label: '経営管理', href: '/bi/flDashboard' },
  { key: 'ai', label: 'AI', href: '/shop-assessment' },
  { key: 'attract', label: '集客', href: '/attract' },
  { key: 'setting', label: '設定', href: '/setting/account' },
];

export const POS_MENU: MenuGroup[] = [
  {
    key: 'dashboard',
    label: 'ダッシュボード',
    children: [{ key: 'customer', label: '顧客分析', href: '/', feature: 'analytics' }],
  },
  {
    key: 'questionnaire',
    label: 'アンケート分析',
    children: [
      { key: 'q-score', label: '店舗スコア一覧', href: '/questionnaireAnalytics/score', feature: 'questionnaire_analytics' },
      { key: 'q-comment', label: 'コメント一覧', href: '/questionnaireAnalytics/comment', feature: 'questionnaire_analytics' },
      { key: 'q-shop', label: '店舗詳細', href: '/questionnaireAnalytics/shop', feature: 'questionnaire_analytics' },
      { key: 'q-changes', label: 'スコア推移', href: '/questionnaireAnalytics/scoreChanges', feature: 'questionnaire_analytics', pending: true },
      { key: 'q-custom', label: 'カスタムアンケート', href: '/companyQuestionnaireExport', feature: 'questionnaire_analytics', pending: true },
      { key: 'q-employee', label: 'スタッフ評価分析', href: '/employeeReviewAnalytics/ranking', feature: 'questionnaire_analytics' },
      { key: 'q-delivery', label: 'メッセージ配信分析', href: '/messageDeliveryAnalytics', feature: 'crm', pending: true },
      { key: 'q-coupon', label: 'クーポン利用分析', href: '/couponAnalytics', feature: 'crm', pending: true },
      { key: 'q-menu', label: 'メニュー評価分析', href: '/menuReviewAnalytics', feature: 'questionnaire_analytics' },
    ],
  },
  {
    key: 'export',
    label: 'データ出力・連携',
    children: [
      { key: 'csv', label: 'CSVダウンロード', href: '/aggregatedData/daily/export', feature: 'analytics' },
      { key: 'online-csv', label: 'モバイル決済取引CSV', href: '/onlinePaymentCsv/export', feature: 'cashless', pending: true },
    ],
  },
  {
    key: 'hq',
    label: '本部機能',
    children: [
      { key: 'daily-closing', label: '日次処理一覧', href: '/dailyCashRegisterBalancing', feature: 'daily_closing' },
      { key: 'accounting', label: '会計履歴一覧', href: '/accounting/history', feature: 'accounting_history' },
      { key: 'table-usage', label: 'テーブル利用履歴', href: '/tableUsageHistory', feature: 'table_usage_history' },
      { key: 'audit', label: '重要操作履歴一覧', href: '/auditLogs', feature: 'audit_logs' },
      { key: 'terminal-payment', label: 'キャッシュレス決済履歴', href: '/terminalPayment/history', feature: 'cashless' },
      { key: 'line-report', label: 'レポートくん設定', href: '/lineReportingBotConfig/active', feature: 'analytics' },
    ],
  },
  {
    key: 'menu-master',
    label: 'メニューマスター',
    children: [
      { key: 'menu', label: 'メニュー', href: '/menu', feature: 'menu_master' },
      { key: 'plan', label: 'プラン', href: '/plan', feature: 'menu_master' },
      { key: 'option', label: 'オプション', href: '/option', feature: 'menu_master' },
      { key: 'category', label: 'カテゴリ', href: '/category', feature: 'menu_master' },
      { key: 'recommend', label: 'おすすめメニュー', href: '/menuRecommendations', feature: 'recommendation_menu' },
      { key: 'menu-csv', label: 'メニュー一括編集', href: '/menuMasterCsv', feature: 'menu_master' },
    ],
  },
  {
    key: 'company',
    label: '業態管理',
    children: [
      { key: 'company-list', label: '業態一覧', href: '/company', feature: 'company_management' },
      { key: 'payment-types', label: '支払方法等設定', href: '/paymentTypes', feature: 'payment_settings' },
      { key: 'auto-translation', label: '自動翻訳設定', href: '/autoTranslation', feature: 'company_management' },
      { key: 'appetizer', label: 'お通し自動設定', href: '/menu/autoCompulsoryAppetizer', feature: 'company_management' },
      { key: 'cash-changer', label: '自動釣銭機設定', href: '/cashChanger', feature: 'company_management' },
      { key: 'mo-design', label: 'モバイルオーダーデザイン', href: '/mobileOrderDesign/theme', feature: 'company_management' },
    ],
  },
  {
    key: 'shop',
    label: '店舗管理',
    children: [
      { key: 'shop-list', label: '店舗一覧', href: '/shop', feature: 'shop_management' },
      { key: 'shop-menu', label: '取扱メニュー一覧', href: '/shop/menu', feature: 'shop_management' },
      { key: 'orderable-time', label: 'アプリ表示時間設定', href: '/orderableTime/shop', feature: 'shop_management' },
      { key: 'role', label: 'キッチンプリンター一覧', href: '/role', feature: 'shop_management' },
      { key: 'clerk', label: '店員', href: '/clerk', feature: 'shop_management' },
      { key: 'printing-main-option', label: 'プランオプション印刷設定', href: '/printing/mainOption', feature: 'shop_management' },
      { key: 'dish-up', label: 'デシャップグループ', href: '/dishUpSlipGroup', feature: 'shop_management' },
      { key: 'cooking-item', label: '調理アイテム', href: '/cookingItem', feature: 'shop_management' },
      { key: 'kitchen-order', label: 'キッチン表示・印刷順', href: '/menu/kitchen-display-order/edit', feature: 'shop_management' },
      { key: 'handy', label: 'ハンディ管理', href: '/handy', feature: 'shop_management' },
      { key: 'table', label: 'テーブル', href: '/table', feature: 'shop_management' },
      { key: 'preview', label: 'アプリ表示確認', href: '/previewUserApp', feature: 'shop_management' },
      { key: 'handout', label: '配布物', href: '/handout', feature: 'shop_management' },
    ],
  },
  {
    key: 'crm',
    label: 'CRM',
    children: [
      { key: 'message', label: 'メッセージ配信', href: '/messageDelivery', feature: 'crm' },
      { key: 'coupon', label: 'クーポン', href: '/coupon', feature: 'crm' },
      { key: 'minigame', label: 'ミニゲーム', href: '/miniGame', feature: 'crm' },
      { key: 'membership', label: '会員ランク管理', href: '/membershipCard/rankConfig', feature: 'crm' },
      { key: 'coupon-presets', label: 'クーポン自動配信', href: '/crm/couponPresets', feature: 'crm' },
      { key: 'line-accounts', label: 'LINE公式アカウント', href: '/lineOfficialAccounts', feature: 'crm' },
      { key: 'mo-questionnaire', label: 'アンケート設定', href: '/questionnaire', feature: 'crm' },
    ],
  },
];

export const BI_MENU: MenuGroup[] = [
  {
    key: 'bi-dashboard',
    label: 'ダッシュボード',
    children: [
      { key: 'fl', label: '店舗管理ダッシュボード', href: '/bi/flDashboard', feature: 'bi_integration' },
      { key: 'current', label: '売上速報', href: '/bi/current-sales', feature: 'analytics' },
      { key: 'daily-report', label: '日報', href: '/bi/dailySalesReport', feature: 'analytics' },
    ],
  },
  {
    key: 'bi-pl',
    label: 'PL',
    children: [
      { key: 'monthly-pl', label: '月次 PL', href: '/bi/monthlyPl', feature: 'monthly_pl_report' },
      { key: 'kpi-target', label: '目標設定', href: '/bi/kpiTarget', feature: 'target_management' },
    ],
  },
  {
    key: 'bi-analytics',
    label: 'POSデータ分析',
    children: [
      { key: 'sales', label: '売上分析', href: '/bi/sales-analytics', feature: 'analytics' },
      { key: 'product', label: '商品分析', href: '/bi/product-analytics', feature: 'analytics' },
      { key: 'dow-hour', label: '曜日・時間帯別', href: '/bi/dow-hour', feature: 'analytics' },
      { key: 'forecast', label: '売上予測', href: '/bi/sales-forecast', feature: 'analytics' },
    ],
  },
  {
    key: 'bi-transaction',
    label: '取引登録',
    children: [
      { key: 'purchase', label: '仕入れ登録', href: '/bi/inventoryPurchaseTransaction', feature: 'purchase_list' },
      { key: 'petty-cash', label: '小口現金', href: '/bi/pettyCash', feature: 'petty_cash' },
      { key: 'income-expense', label: '収支登録', href: '/bi/incomeExpense', feature: 'income_expense' },
    ],
  },
  {
    key: 'bi-master',
    label: '科目・取引先登録',
    children: [
      { key: 'pl-accounts', label: '科目登録', href: '/bi/plAccounts', feature: 'pl_accounts' },
      { key: 'vendors', label: '取引先登録', href: '/bi/vendors', feature: 'vendor_registration' },
    ],
  },
];

export const SETTING_MENU: MenuGroup[] = [
  {
    key: 'setting',
    label: '管理設定',
    children: [
      { key: 'account', label: 'アカウント', href: '/setting/account', feature: 'account_management' },
      { key: 'role', label: '権限設定', href: '/setting/role', feature: 'account_management' },
      { key: 'shop-group', label: '店舗グループ', href: '/setting/shopGroup', feature: 'account_management' },
      { key: 'account-audit', label: 'アカウント操作履歴', href: '/setting/auditLogs', feature: 'account_audit_logs', pending: true },
    ],
  },
];

export const AI_MENU: MenuGroup[] = [
  {
    key: 'ai',
    label: 'AI',
    children: [
      { key: 'assessment', label: 'AI 店舗診断', href: '/shop-assessment', feature: 'analytics' },
    ],
  },
];

export const ATTRACT_MENU: MenuGroup[] = [
  {
    key: 'attract',
    label: '集客',
    children: [
      { key: 'attract-dashboard', label: '集客ダッシュボード', href: '/attract/dashboard', feature: 'attract_all' },
      { key: 'review', label: 'クチコミ獲得', href: '/attract/review', feature: 'attract_all', pending: true },
    ],
  },
];

export const MENU_BY_SECTION: Record<TopSection, MenuGroup[]> = {
  pos: POS_MENU,
  bi: BI_MENU,
  ai: AI_MENU,
  attract: ATTRACT_MENU,
  setting: SETTING_MENU,
};

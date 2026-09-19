import 'server-only';

import type {
  Account,
  AccountRole,
  Category,
  CategoryRow,
  Choice,
  Company,
  Corporation,
  Menu,
  MenuRow,
  MenuTypeValue,
  OptionDef,
  OptionRow,
  RoleDefinition,
  Shop,
  ShopGroup,
} from './types';

/**
 * デモモードのデータ。端末アプリと同じ考え方で、Supabase が未設定でも
 * 画面を触れるようにしておく（データはサーバー再起動で初期状態に戻る）。
 */

const CORP_ID = 'corp-demo';

interface DemoState {
  corporation: Corporation;
  companies: Company[];
  shops: Shop[];
  accounts: Account[];
  roles: RoleDefinition[];
  accountRoles: AccountRole[];
  shopGroups: ShopGroup[];
}

function shop(
  id: string,
  companyId: string,
  name: string,
  slug: string,
  order: number,
  open: string,
  close: string
): Shop {
  return {
    id,
    company_id: companyId,
    slug,
    name,
    name_en: null,
    icon_url: null,
    open_time: open,
    close_time: close,
    display_order: order,
    standard_tax_rate: 0.1,
    reduced_tax_rate: 0.08,
    tax_included: true,
    service_charge_rate: 0,
    invoice_registration_number: 'T1234567890123',
    business_day_cutoff_hour: 5,
    timezone: 'Asia/Tokyo',
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
    shop('shop-1', 'company-1', '炭火焼き デモ店（錦糸町）', 'demo', 10, '17:00', '23:30'),
    shop('shop-2', 'company-1', '炭火焼き デモ店（平井）', 'demo-hirai', 20, '17:00', '23:00'),
    shop('shop-3', 'company-2', '海鮮スタンド デモ店', 'demo-kaisen', 10, '11:30', '22:00'),
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
  };
}

// HMR でモジュールが作り直されてもデータが消えないよう globalThis に置く
const g = globalThis as typeof globalThis & { __dashboardDemo?: DemoState };

function db(): DemoState {
  g.__dashboardDemo ??= createState();
  return g.__dashboardDemo;
}

function clone<T>(value: T): T {
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

// ---------------------------------------------------------------------------
// メニューマスター（デモ）
//
// 端末アプリのデモと同じ品揃えを、業態単位の形で持つ。
// company-1 に串焼き系、company-2 に海鮮系を入れて、
// 業態セレクタを切り替えたときに中身が変わることを確かめられるようにしている。
// ---------------------------------------------------------------------------

interface MenuSeed {
  name: string;
  price: number;
  type: MenuTypeValue;
  category: string;
  reduced: boolean;
  options?: string[];
}

const MENU_SEEDS: Record<string, { categories: string[]; options: Record<string, string[]>; menus: MenuSeed[] }> = {
  'company-1': {
    categories: ['串焼き', '炉端焼き', '一品料理', 'ドリンク', 'デザート'],
    options: {
      焼き加減: ['おまかせ', 'しっかりめ', 'レアめ'],
      サイズ: ['レギュラー', 'メガジョッキ'],
      トッピング: ['温玉', 'マヨネーズ', '七味', 'チーズ'],
    },
    menus: [
      { name: 'もも串', price: 280, type: 'food', category: '串焼き', reduced: true, options: ['焼き加減'] },
      { name: 'ねぎま', price: 300, type: 'food', category: '串焼き', reduced: true, options: ['焼き加減'] },
      { name: 'つくね（卵黄付き）', price: 380, type: 'food', category: '串焼き', reduced: true },
      { name: 'ハツ', price: 280, type: 'food', category: '串焼き', reduced: true },
      { name: 'ホッケ開き', price: 980, type: 'food', category: '炉端焼き', reduced: true },
      { name: 'ハマグリ酒蒸し', price: 880, type: 'food', category: '炉端焼き', reduced: true },
      { name: 'ポテトフライ', price: 480, type: 'food', category: '一品料理', reduced: true, options: ['トッピング'] },
      { name: 'だし巻き玉子', price: 580, type: 'food', category: '一品料理', reduced: true },
      { name: '生ビール', price: 580, type: 'drink', category: 'ドリンク', reduced: false, options: ['サイズ'] },
      { name: 'ハイボール', price: 480, type: 'drink', category: 'ドリンク', reduced: false },
      { name: '烏龍茶', price: 350, type: 'drink', category: 'ドリンク', reduced: true },
      { name: 'バニラアイス', price: 380, type: 'other', category: 'デザート', reduced: true },
    ],
  },
  'company-2': {
    categories: ['刺身', '丼もの', 'ドリンク'],
    options: { 'わさび': ['あり', 'なし'] },
    menus: [
      { name: '本日の刺身盛り', price: 1280, type: 'food', category: '刺身', reduced: true, options: ['わさび'] },
      { name: '海鮮丼', price: 1480, type: 'food', category: '丼もの', reduced: true, options: ['わさび'] },
      { name: 'ネギトロ丼', price: 1080, type: 'food', category: '丼もの', reduced: true },
      { name: '瓶ビール', price: 650, type: 'drink', category: 'ドリンク', reduced: false },
      { name: '緑茶', price: 300, type: 'drink', category: 'ドリンク', reduced: true },
    ],
  },
};

function buildMenuMaster(companyId: string) {
  const seed = MENU_SEEDS[companyId];
  if (!seed) return { categories: [], menus: [], options: [], choices: [], catLinks: [], optLinks: [] };

  const categories: Category[] = seed.categories.map((name, i) => ({
    id: `${companyId}-cat-${i + 1}`,
    company_id: companyId,
    name,
    description: null,
    staff_display_name: null,
    handy_bg_color: null,
    kds_color: null,
    display_order: (i + 1) * 10,
    is_active: true,
  }));

  const options: OptionDef[] = Object.keys(seed.options).map((name, i) => ({
    id: `${companyId}-opt-${i + 1}`,
    company_id: companyId,
    name,
    receipt_display_name: name,
    min_choice: name === 'サイズ' ? 1 : 0,
    max_choice: name === 'トッピング' ? 3 : 1,
    display_order: (i + 1) * 10,
  }));

  const choices: Choice[] = Object.entries(seed.options).flatMap(([optionName, names], oi) =>
    names.map((name, ci) => ({
      id: `${companyId}-ch-${oi + 1}-${ci + 1}`,
      option_id: `${companyId}-opt-${oi + 1}`,
      name,
      receipt_display_name: name,
      // メガジョッキだけ加算がある
      price: name === 'メガジョッキ' ? 250 : name === '温玉' ? 100 : name === 'チーズ' ? 150 : 0,
      is_default: ci === 0,
      is_available: true,
      display_order: (ci + 1) * 10,
    }))
  );

  const menus: Menu[] = seed.menus.map((m, i) => ({
    id: `${companyId}-menu-${i + 1}`,
    company_id: companyId,
    name: m.name,
    receipt_display_name: m.name,
    staff_display_name: null,
    description: null,
    featured_label: null,
    menu_type: m.type,
    image_url: null,
    image_size: 'medium',
    tax_method: 'incl',
    tax_rate: 0.1,
    price: m.price,
    cost_price: null,
    is_takeout: false,
    is_free_key: false,
    is_notice_only: false,
    reduced_rate_eligible: m.reduced,
    display_order: (i + 1) * 10,
  }));

  const catLinks = seed.menus.map((m, i) => ({
    category_id: categories.find((c) => c.name === m.category)!.id,
    menu_id: `${companyId}-menu-${i + 1}`,
  }));

  const optLinks = seed.menus.flatMap((m, i) =>
    (m.options ?? []).map((name) => ({
      menu_id: `${companyId}-menu-${i + 1}`,
      option_id: options.find((o) => o.name === name)!.id,
    }))
  );

  return { categories, menus, options, choices, catLinks, optLinks };
}

export function getMenuRows(companyId: string): MenuRow[] {
  const { menus, categories, options, catLinks, optLinks } = buildMenuMaster(companyId);
  const shopCount = db().shops.filter((s) => s.company_id === companyId).length;

  return menus.map((menu) => ({
    ...menu,
    category_names: catLinks
      .filter((l) => l.menu_id === menu.id)
      .map((l) => categories.find((c) => c.id === l.category_id)?.name ?? ''),
    option_names: optLinks
      .filter((l) => l.menu_id === menu.id)
      .map((l) => options.find((o) => o.id === l.option_id)?.name ?? ''),
    // デモでは全店舗が全品を扱っているものとする
    dealing_shop_count: shopCount,
  }));
}

export function getCategoryRows(companyId: string): CategoryRow[] {
  const { categories, menus, catLinks } = buildMenuMaster(companyId);
  return categories.map((category) => ({
    ...category,
    menu_names: catLinks
      .filter((l) => l.category_id === category.id)
      .map((l) => menus.find((m) => m.id === l.menu_id)?.name ?? ''),
  }));
}

export function getOptionRows(companyId: string): OptionRow[] {
  const { options, choices, menus, optLinks } = buildMenuMaster(companyId);
  return options.map((option) => ({
    ...option,
    choices: choices.filter((c) => c.option_id === option.id),
    menu_names: optLinks
      .filter((l) => l.option_id === option.id)
      .map((l) => menus.find((m) => m.id === l.menu_id)?.name ?? ''),
  }));
}

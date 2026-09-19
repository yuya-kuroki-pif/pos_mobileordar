import 'server-only';

import { buildMenuMaster } from './demoMenu';
import { buildPlanGroups, buildPlans, type PlanState } from './demoPlan';
import type {
  Account,
  AccountRole,
  Category,
  MenuTranslation,
  PlanGroup,
  ShopMenu,
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

export interface DemoState extends PlanState {
  corporation: Corporation;
  companies: Company[];
  shops: Shop[];
  accounts: Account[];
  roles: RoleDefinition[];
  accountRoles: AccountRole[];
  shopGroups: ShopGroup[];

  // --- メニューマスター（業態単位） ---
  categories: Category[];
  menus: Menu[];
  options: OptionDef[];
  choices: Choice[];
  categoryMenus: { category_id: string; menu_id: string }[];
  menuOptions: { menu_id: string; option_id: string }[];
  shopMenus: ShopMenu[];
  menuTranslations: MenuTranslation[];

  // --- プラン（飲み放題・コース） ---
  planGroups: PlanGroup[];
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

  const master = buildMenuMaster();

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
    planGroups: buildPlanGroups(),
    ...buildPlans(shops),
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
          display_order: menu.display_order,
        }))
    ),
    menuTranslations: [],
  };
}

// HMR でモジュールが作り直されてもデータが消えないよう globalThis に置く。
// ただし DemoState の形を変えたときは作り直したいので、版を添えて持つ。
// （版を上げ忘れると、古い形のまま参照して実行時エラーになる）
const STATE_VERSION = 4;

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


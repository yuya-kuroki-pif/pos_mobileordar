import 'server-only';

import * as demo from './demo';
import { toShop } from './shopRow';
import { isDemoMode, supabaseAdmin } from './supabase';
import type {
  Account,
  AccountRole,
  AccountRow,
  Company,
  Corporation,
  RoleDefinition,
  Shop,
  ShopGroup,
} from './types';

// ---------------------------------------------------------------------------
// 読み取り。端末アプリと同じく、冒頭でデモモードを判定して委譲する。
// ---------------------------------------------------------------------------

export async function getCorporation(corporationId: string): Promise<Corporation | null> {
  if (isDemoMode()) return demo.getCorporation();

  const { data } = await supabaseAdmin()
    .from('corporations')
    .select('id, name')
    .eq('id', corporationId)
    .maybeSingle();
  return (data as Corporation) ?? null;
}

export async function getCompanies(corporationId: string): Promise<Company[]> {
  if (isDemoMode()) return demo.getCompanies();

  const { data, error } = await supabaseAdmin()
    .from('companies')
    .select('id, corporation_id, name, display_order')
    .eq('corporation_id', corporationId)
    .order('display_order');

  if (error) throw new Error(error.message);
  return (data ?? []) as Company[];
}

/** 法人配下の全店舗。業態をまたいで扱う画面（経営管理・設定）で使う */
export async function getShops(corporationId: string): Promise<Shop[]> {
  if (isDemoMode()) return demo.getShops();

  const { data, error } = await supabaseAdmin()
    .from('shops')
    .select('*, companies!inner(corporation_id)')
    .eq('companies.corporation_id', corporationId)
    .order('display_order');

  if (error) throw new Error(error.message);

  return ((data ?? []) as Record<string, unknown>[]).map(({ companies: _companies, ...row }) =>
    toShop(row),
  );
}

export async function getAccounts(corporationId: string): Promise<Account[]> {
  if (isDemoMode()) return demo.getAccounts();

  const { data, error } = await supabaseAdmin()
    .from('accounts')
    .select('id, corporation_id, email, name, status, joined_at, created_at')
    .eq('corporation_id', corporationId)
    .order('created_at');

  if (error) throw new Error(error.message);
  return (data ?? []) as Account[];
}

export async function getRoles(corporationId: string): Promise<RoleDefinition[]> {
  if (isDemoMode()) return demo.getRoles();

  const { data, error } = await supabaseAdmin()
    .from('roles_definitions')
    .select('id, corporation_id, product, name, is_system, permissions, display_order')
    .eq('corporation_id', corporationId)
    .eq('product', 'pos')
    .order('display_order');

  if (error) throw new Error(error.message);
  return (data ?? []) as RoleDefinition[];
}

export async function getAccountRoles(accountIds: string[]): Promise<AccountRole[]> {
  if (isDemoMode()) return demo.getAccountRoles();
  if (accountIds.length === 0) return [];

  const { data, error } = await supabaseAdmin()
    .from('account_roles')
    .select('account_id, product, role_id, scope_type, scope_ids')
    .in('account_id', accountIds);

  if (error) throw new Error(error.message);
  return (data ?? []) as AccountRole[];
}

/**
 * アカウント一覧の 1 行ぶん。
 * ロール名とスコープ（全社 / 業態名 / 店舗名）を解決して返す。
 */
export async function getAccountRows(corporationId: string): Promise<AccountRow[]> {
  const [accounts, roles, companies, shops] = await Promise.all([
    getAccounts(corporationId),
    getRoles(corporationId),
    getCompanies(corporationId),
    getShops(corporationId),
  ]);
  const links = await getAccountRoles(accounts.map((a) => a.id));

  const roleById = new Map(roles.map((r) => [r.id, r]));
  const nameById = new Map<string, string>([
    ...companies.map((c) => [c.id, c.name] as const),
    ...shops.map((s) => [s.id, s.name] as const),
  ]);

  return accounts.map((account) => {
    const link = links.find((l) => l.account_id === account.id && l.product === 'pos');
    return {
      ...account,
      role_name: link ? (roleById.get(link.role_id)?.name ?? null) : null,
      scope_type: link?.scope_type ?? null,
      scope_labels:
        !link || link.scope_type === 'corporation'
          ? []
          : link.scope_ids.map((id) => nameById.get(id) ?? id),
    };
  });
}

export async function getShopGroups(corporationId: string): Promise<ShopGroup[]> {
  if (isDemoMode()) return demo.getShopGroups();

  const db = supabaseAdmin();
  const [groupsRes, membersRes] = await Promise.all([
    db
      .from('shop_groups')
      .select('id, corporation_id, name, display_order')
      .eq('corporation_id', corporationId)
      .order('display_order'),
    db.from('shop_group_members').select('group_id, shop_id'),
  ]);

  if (groupsRes.error) throw new Error(groupsRes.error.message);
  if (membersRes.error) throw new Error(membersRes.error.message);

  const members = (membersRes.data ?? []) as { group_id: string; shop_id: string }[];

  return ((groupsRes.data ?? []) as Omit<ShopGroup, 'shop_ids'>[]).map((group) => ({
    ...group,
    shop_ids: members.filter((m) => m.group_id === group.id).map((m) => m.shop_id),
  }));
}

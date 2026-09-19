import 'server-only';

import * as demo from './demoMenu';
import { isDemoMode, supabaseAdmin } from './supabase';
import type {
  CategoryRow,
  Choice,
  Menu,
  MenuDetail,
  MenuRow,
  MenuTranslation,
  OptionRow,
  ShopMenu,
} from './types';

/**
 * メニューマスターの読み取り（仕様書 §5.2 / §5.5 / §5.6）。
 *
 * マスターは業態単位なので company_id で絞る。
 * 一覧に出すカテゴリ名・オプション名・取扱店舗数は、
 * 中間テーブルをまとめて引いてメモリ上で突き合わせる。
 */

interface Link {
  menu_id: string;
}

export async function getMenuRows(companyId: string): Promise<MenuRow[]> {
  if (isDemoMode()) return demo.getMenuRows(companyId);

  const db = supabaseAdmin();

  const [menuRes, catRes, catLinkRes, optRes, optLinkRes, dealRes] = await Promise.all([
    db.from('menus').select('*').eq('company_id', companyId).order('display_order'),
    db.from('categories').select('id, name').eq('company_id', companyId),
    db.from('category_menus').select('category_id, menu_id'),
    db.from('options').select('id, name').eq('company_id', companyId),
    db.from('menu_options').select('menu_id, option_id'),
    db.from('shop_menus').select('menu_id, is_dealing'),
  ]);

  for (const res of [menuRes, catRes, catLinkRes, optRes, optLinkRes, dealRes]) {
    if (res.error) throw new Error(res.error.message);
  }

  const categoryName = new Map(
    ((catRes.data ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name])
  );
  const optionName = new Map(
    ((optRes.data ?? []) as { id: string; name: string }[]).map((o) => [o.id, o.name])
  );
  const catLinks = (catLinkRes.data ?? []) as (Link & { category_id: string })[];
  const optLinks = (optLinkRes.data ?? []) as (Link & { option_id: string })[];
  const deals = (dealRes.data ?? []) as (Link & { is_dealing: boolean })[];

  return ((menuRes.data ?? []) as MenuRow[]).map((menu) => ({
    ...menu,
    category_names: catLinks
      .filter((l) => l.menu_id === menu.id)
      .map((l) => categoryName.get(l.category_id))
      .filter((name): name is string => Boolean(name)),
    option_names: optLinks
      .filter((l) => l.menu_id === menu.id)
      .map((l) => optionName.get(l.option_id))
      .filter((name): name is string => Boolean(name)),
    dealing_shop_count: deals.filter((d) => d.menu_id === menu.id && d.is_dealing).length,
  }));
}

export async function getCategoryRows(companyId: string): Promise<CategoryRow[]> {
  if (isDemoMode()) return demo.getCategoryRows(companyId);

  const db = supabaseAdmin();

  const [catRes, menuRes, linkRes] = await Promise.all([
    db.from('categories').select('*').eq('company_id', companyId).order('display_order'),
    db.from('menus').select('id, name').eq('company_id', companyId),
    db.from('category_menus').select('category_id, menu_id').order('display_order'),
  ]);

  for (const res of [catRes, menuRes, linkRes]) {
    if (res.error) throw new Error(res.error.message);
  }

  const menuName = new Map(
    ((menuRes.data ?? []) as { id: string; name: string }[]).map((m) => [m.id, m.name])
  );
  const links = (linkRes.data ?? []) as { category_id: string; menu_id: string }[];

  return ((catRes.data ?? []) as CategoryRow[]).map((category) => {
    const own = links.filter((l) => l.category_id === category.id);
    return {
      ...category,
      menu_names: own
        .map((l) => menuName.get(l.menu_id))
        .filter((name): name is string => Boolean(name)),
      menu_ids: own.map((l) => l.menu_id),
    };
  });
}

export async function getOptionRows(companyId: string): Promise<OptionRow[]> {
  if (isDemoMode()) return demo.getOptionRows(companyId);

  const db = supabaseAdmin();

  const [optRes, choiceRes, menuRes, linkRes] = await Promise.all([
    db.from('options').select('*').eq('company_id', companyId).order('display_order'),
    db.from('choices').select('*').order('display_order'),
    db.from('menus').select('id, name').eq('company_id', companyId),
    db.from('menu_options').select('menu_id, option_id'),
  ]);

  for (const res of [optRes, choiceRes, menuRes, linkRes]) {
    if (res.error) throw new Error(res.error.message);
  }

  const choices = (choiceRes.data ?? []) as Choice[];
  const menuName = new Map(
    ((menuRes.data ?? []) as { id: string; name: string }[]).map((m) => [m.id, m.name])
  );
  const links = (linkRes.data ?? []) as { menu_id: string; option_id: string }[];

  return ((optRes.data ?? []) as OptionRow[]).map((option) => {
    const own = links.filter((l) => l.option_id === option.id);
    return {
      ...option,
      choices: choices.filter((c) => c.option_id === option.id),
      menu_names: own
        .map((l) => menuName.get(l.menu_id))
        .filter((name): name is string => Boolean(name)),
      menu_ids: own.map((l) => l.menu_id),
    };
  });
}

/** メニュー編集画面が必要とする一式（仕様書 §5.3 の 4 タブぶん） */
export async function getMenuDetail(menuId: string): Promise<MenuDetail | null> {
  if (isDemoMode()) return demo.getMenuDetail(menuId);

  const db = supabaseAdmin();

  const { data: menuData } = await db.from('menus').select('*').eq('id', menuId).maybeSingle();
  const menu = menuData as Menu | null;
  if (!menu) return null;

  const [catRes, optRes, shopRes, dealRes, transRes] = await Promise.all([
    db.from('category_menus').select('category_id').eq('menu_id', menuId),
    db.from('menu_options').select('option_id').eq('menu_id', menuId),
    db.from('shops').select('id, name, display_order').eq('company_id', menu.company_id).order('display_order'),
    db.from('shop_menus').select('*').eq('menu_id', menuId),
    db.from('menu_translations').select('*').eq('menu_id', menuId),
  ]);

  for (const res of [catRes, optRes, shopRes, dealRes, transRes]) {
    if (res.error) throw new Error(res.error.message);
  }

  const deals = (dealRes.data ?? []) as ShopMenu[];

  return {
    menu,
    categoryIds: ((catRes.data ?? []) as { category_id: string }[]).map((r) => r.category_id),
    optionIds: ((optRes.data ?? []) as { option_id: string }[]).map((r) => r.option_id),
    // 取扱設定タブは業態配下の全店舗を並べる（未設定の店舗も行として出す）
    dealers: ((shopRes.data ?? []) as { id: string; name: string }[]).map((shop) => {
      const row = deals.find((d) => d.shop_id === shop.id);
      return {
        shop_id: shop.id,
        menu_id: menuId,
        shop_name: shop.name,
        is_dealing: row?.is_dealing ?? false,
        is_visible_customer: row?.is_visible_customer ?? false,
        is_visible_staff: row?.is_visible_staff ?? false,
        in_stock: row?.in_stock ?? true,
        stock_qty: row?.stock_qty ?? null,
        daily_stock_qty: row?.daily_stock_qty ?? null,
        display_order: row?.display_order ?? 0,
      };
    }),
    translations: (transRes.data ?? []) as MenuTranslation[],
  };
}

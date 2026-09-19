import 'server-only';

import { clone, db } from './demo';
import { isDemoMode, supabaseAdmin } from './supabase';
import type {
  DishUpSlipGroup,
  KitchenPrinter,
  Menu,
  ShopMenu,
  ShopMenuRow,
} from './types';

/** 取扱メニュー一覧（仕様書 §5.13）が必要とする一式 */
export interface ShopMenuBoard {
  rows: ShopMenuRow[];
  printers: KitchenPrinter[];
  dishUpGroups: DishUpSlipGroup[];
}

/**
 * 店舗 1 つぶんの取扱メニュー。
 *
 * メニューマスターは業態単位なので、その業態の全メニューを行として並べ、
 * `shop_menus` に行が無いものは既定値（取扱なし）で埋める。
 */
export async function getShopMenuBoard(
  shopId: string,
  companyId: string
): Promise<ShopMenuBoard> {
  if (isDemoMode()) {
    const state = db();

    const menus = state.menus.filter((m) => m.company_id === companyId);
    const rows = menus
      .map((menu) => {
        const link = state.shopMenus.find(
          (sm) => sm.shop_id === shopId && sm.menu_id === menu.id
        );
        return toRow(menu, link, categoryNamesOf(menu.id), shopId);
      })
      .sort((a, b) => a.display_order - b.display_order);

    return {
      rows: clone(rows),
      printers: clone(state.kitchenPrinters.filter((p) => p.shop_id === shopId)).sort(
        (a, b) => a.display_order - b.display_order
      ),
      dishUpGroups: clone(state.dishUpSlipGroups.filter((g) => g.shop_id === shopId)).sort(
        (a, b) => a.display_order - b.display_order
      ),
    };
  }

  const supabase = supabaseAdmin();

  const [menuRes, linkRes, catRes, catLinkRes, printerRes, groupRes] = await Promise.all([
    supabase.from('menus').select('*').eq('company_id', companyId).order('display_order'),
    supabase.from('shop_menus').select('*').eq('shop_id', shopId),
    supabase.from('categories').select('id, name').eq('company_id', companyId),
    supabase.from('category_menus').select('category_id, menu_id'),
    supabase.from('kitchen_printers').select('*').eq('shop_id', shopId).order('display_order'),
    supabase.from('dish_up_slip_groups').select('*').eq('shop_id', shopId).order('display_order'),
  ]);

  for (const res of [menuRes, linkRes, catRes, catLinkRes, printerRes, groupRes]) {
    if (res.error) throw new Error(res.error.message);
  }

  const links = (linkRes.data ?? []) as ShopMenu[];
  const categoryName = new Map(
    ((catRes.data ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name])
  );
  const catLinks = (catLinkRes.data ?? []) as { category_id: string; menu_id: string }[];

  const rows = ((menuRes.data ?? []) as Menu[]).map((menu) =>
    toRow(
      menu,
      links.find((l) => l.menu_id === menu.id),
      catLinks
        .filter((l) => l.menu_id === menu.id)
        .map((l) => categoryName.get(l.category_id))
        .filter((name): name is string => Boolean(name)),
      shopId
    )
  );

  return {
    rows,
    printers: (printerRes.data ?? []) as KitchenPrinter[],
    dishUpGroups: (groupRes.data ?? []) as DishUpSlipGroup[],
  };
}

function categoryNamesOf(menuId: string): string[] {
  const state = db();
  return state.categoryMenus
    .filter((l) => l.menu_id === menuId)
    .map((l) => state.categories.find((c) => c.id === l.category_id)?.name ?? '')
    .filter(Boolean);
}

/** shop_menus に行が無い場合は「取扱なし」として並べる */
function toRow(
  menu: Menu,
  link: ShopMenu | undefined,
  categoryNames: string[],
  shopId: string
): ShopMenuRow {
  return {
    shop_id: shopId,
    menu_id: menu.id,
    is_dealing: link?.is_dealing ?? false,
    is_visible_customer: link?.is_visible_customer ?? false,
    is_visible_staff: link?.is_visible_staff ?? false,
    in_stock: link?.in_stock ?? true,
    stock_qty: link?.stock_qty ?? null,
    daily_stock_qty: link?.daily_stock_qty ?? null,
    kitchen_printer_id: link?.kitchen_printer_id ?? null,
    dish_up_slip_group_id: link?.dish_up_slip_group_id ?? null,
    display_order: link?.display_order ?? menu.display_order,
    menu_name: menu.name,
    menu_type: menu.menu_type,
    price: menu.price,
    image_url: menu.image_url,
    category_names: categoryNames,
  };
}

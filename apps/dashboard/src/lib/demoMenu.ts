import 'server-only';

import { clone, db } from './demo';
import type {
  Category,
  CategoryRow,
  Choice,
  Menu,
  MenuDetail,
  MenuRow,
  MenuTranslation,
  MenuTypeValue,
  OptionDef,
  OptionRow,
  ShopMenu,
} from './types';

/**
 * デモモードのメニューマスター。
 *
 * company-1 に串焼き系、company-2 に海鮮系を入れて、
 * 業態セレクタを切り替えると中身が変わることを確かめられるようにしている。
 * 編集した内容はメモリ上に残る（サーバー再起動で初期状態へ戻る）。
 */

interface MenuSeed {
  name: string;
  price: number;
  type: MenuTypeValue;
  category: string;
  /** 持ち帰り時に軽減税率 8% を適用できるか。酒類は false */
  reduced: boolean;
  options?: string[];
}

interface CompanySeed {
  categories: string[];
  options: Record<string, { min: number; max: number; choices: [string, number][] }>;
  menus: MenuSeed[];
}

const MENU_SEEDS: Record<string, CompanySeed> = {
  'company-1': {
    categories: ['串焼き', '炉端焼き', '一品料理', 'ドリンク', 'デザート'],
    options: {
      焼き加減: { min: 0, max: 1, choices: [['おまかせ', 0], ['しっかりめ', 0], ['レアめ', 0]] },
      サイズ: { min: 1, max: 1, choices: [['レギュラー', 0], ['メガジョッキ', 250]] },
      トッピング: {
        min: 0,
        max: 3,
        choices: [['温玉', 100], ['マヨネーズ', 50], ['七味', 0], ['チーズ', 150]],
      },
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
    options: { わさび: { min: 0, max: 1, choices: [['あり', 0], ['なし', 0]] } },
    menus: [
      { name: '本日の刺身盛り', price: 1280, type: 'food', category: '刺身', reduced: true, options: ['わさび'] },
      { name: '海鮮丼', price: 1480, type: 'food', category: '丼もの', reduced: true, options: ['わさび'] },
      { name: 'ネギトロ丼', price: 1080, type: 'food', category: '丼もの', reduced: true },
      { name: '瓶ビール', price: 650, type: 'drink', category: 'ドリンク', reduced: false },
      { name: '緑茶', price: 300, type: 'drink', category: 'ドリンク', reduced: true },
    ],
  },
};

export function buildMenuMaster() {
  const categories: Category[] = [];
  const menus: Menu[] = [];
  const options: OptionDef[] = [];
  const choices: Choice[] = [];
  const categoryMenus: { category_id: string; menu_id: string }[] = [];
  const menuOptions: { menu_id: string; option_id: string }[] = [];

  for (const [companyId, seed] of Object.entries(MENU_SEEDS)) {
    seed.categories.forEach((name, i) => {
      categories.push({
        id: `${companyId}-cat-${i + 1}`,
        company_id: companyId,
        name,
        description: null,
        staff_display_name: null,
        handy_bg_color: null,
        kds_color: null,
        display_order: (i + 1) * 10,
        is_active: true,
      });
    });

    Object.entries(seed.options).forEach(([name, def], oi) => {
      const optionId = `${companyId}-opt-${oi + 1}`;
      options.push({
        id: optionId,
        company_id: companyId,
        name,
        receipt_display_name: name,
        min_choice: def.min,
        max_choice: def.max,
        display_order: (oi + 1) * 10,
      });
      def.choices.forEach(([choiceName, price], ci) => {
        choices.push({
          id: `${optionId}-ch-${ci + 1}`,
          option_id: optionId,
          name: choiceName,
          receipt_display_name: choiceName,
          price,
          is_default: ci === 0,
          is_available: true,
          display_order: (ci + 1) * 10,
        });
      });
    });

    seed.menus.forEach((m, i) => {
      const menuId = `${companyId}-menu-${i + 1}`;
      menus.push({
        id: menuId,
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
      });

      const category = categories.find((c) => c.company_id === companyId && c.name === m.category);
      if (category) categoryMenus.push({ category_id: category.id, menu_id: menuId });

      for (const optionName of m.options ?? []) {
        const option = options.find((o) => o.company_id === companyId && o.name === optionName);
        if (option) menuOptions.push({ menu_id: menuId, option_id: option.id });
      }
    });
  }

  return { categories, menus, options, choices, categoryMenus, menuOptions };
}

// ---------------------------------------------------------------------------
// 参照
// ---------------------------------------------------------------------------

export function getMenuRows(companyId: string): MenuRow[] {
  const state = db();

  return clone(state.menus.filter((m) => m.company_id === companyId))
    .sort((a, b) => a.display_order - b.display_order)
    .map((menu) => ({
      ...menu,
      category_names: state.categoryMenus
        .filter((l) => l.menu_id === menu.id)
        .map((l) => state.categories.find((c) => c.id === l.category_id)?.name ?? ''),
      option_names: state.menuOptions
        .filter((l) => l.menu_id === menu.id)
        .map((l) => state.options.find((o) => o.id === l.option_id)?.name ?? ''),
      dealing_shop_count: state.shopMenus.filter(
        (sm) => sm.menu_id === menu.id && sm.is_dealing
      ).length,
    }));
}

export function getCategoryRows(companyId: string): CategoryRow[] {
  const state = db();

  return clone(state.categories.filter((c) => c.company_id === companyId))
    .sort((a, b) => a.display_order - b.display_order)
    .map((category) => ({
      ...category,
      menu_names: state.categoryMenus
        .filter((l) => l.category_id === category.id)
        .map((l) => state.menus.find((m) => m.id === l.menu_id)?.name ?? ''),
      menu_ids: state.categoryMenus
        .filter((l) => l.category_id === category.id)
        .map((l) => l.menu_id),
    }));
}

export function getOptionRows(companyId: string): OptionRow[] {
  const state = db();

  return clone(state.options.filter((o) => o.company_id === companyId))
    .sort((a, b) => a.display_order - b.display_order)
    .map((option) => ({
      ...option,
      choices: clone(state.choices.filter((c) => c.option_id === option.id)),
      menu_names: state.menuOptions
        .filter((l) => l.option_id === option.id)
        .map((l) => state.menus.find((m) => m.id === l.menu_id)?.name ?? ''),
      menu_ids: state.menuOptions
        .filter((l) => l.option_id === option.id)
        .map((l) => l.menu_id),
    }));
}

export function getMenuDetail(menuId: string): MenuDetail | null {
  const state = db();
  const menu = state.menus.find((m) => m.id === menuId);
  if (!menu) return null;

  // 取扱設定タブは業態配下の全店舗を並べる（未設定の店舗も行として出す）
  const shops = state.shops.filter((s) => s.company_id === menu.company_id);

  return {
    menu: clone(menu),
    categoryIds: state.categoryMenus.filter((l) => l.menu_id === menuId).map((l) => l.category_id),
    optionIds: state.menuOptions.filter((l) => l.menu_id === menuId).map((l) => l.option_id),
    dealers: shops.map((shop) => {
      const row = state.shopMenus.find((sm) => sm.shop_id === shop.id && sm.menu_id === menuId);
      return {
        shop_id: shop.id,
        menu_id: menuId,
        shop_name: shop.name,
        is_dealing: row?.is_dealing ?? false,
        is_visible_customer: row?.is_visible_customer ?? false,
        is_visible_staff: row?.is_visible_staff ?? false,
        in_stock: row?.in_stock ?? true,
        kitchen_printer_id: row?.kitchen_printer_id ?? null,
        dish_up_slip_group_id: row?.dish_up_slip_group_id ?? null,
        stock_qty: row?.stock_qty ?? null,
        daily_stock_qty: row?.daily_stock_qty ?? null,
        display_order: row?.display_order ?? menu.display_order,
      };
    }),
    translations: clone(state.menuTranslations.filter((t) => t.menu_id === menuId)),
  };
}

// ---------------------------------------------------------------------------
// 更新
// ---------------------------------------------------------------------------

export function saveMenu(companyId: string, input: Partial<Menu> & { id?: string }): string {
  const state = db();
  const existing = input.id ? state.menus.find((m) => m.id === input.id) : undefined;

  if (existing) {
    Object.assign(existing, input);
    return existing.id;
  }

  const menuId = `menu-${Math.random().toString(36).slice(2, 10)}`;
  state.menus.push({
    id: menuId,
    company_id: companyId,
    name: input.name ?? '',
    receipt_display_name: input.receipt_display_name ?? input.name ?? '',
    staff_display_name: input.staff_display_name ?? null,
    description: input.description ?? null,
    featured_label: input.featured_label ?? null,
    menu_type: input.menu_type ?? 'food',
    image_url: input.image_url ?? null,
    image_size: input.image_size ?? 'medium',
    tax_method: input.tax_method ?? 'incl',
    tax_rate: input.tax_rate ?? 0.1,
    price: input.price ?? 0,
    cost_price: input.cost_price ?? null,
    is_takeout: input.is_takeout ?? false,
    is_free_key: input.is_free_key ?? false,
    is_notice_only: input.is_notice_only ?? false,
    reduced_rate_eligible: input.reduced_rate_eligible ?? true,
    display_order: input.display_order ?? (state.menus.length + 1) * 10,
  });

  // 新規作成したメニューは、その業態の全店舗で取扱 ON にしておく
  for (const shop of state.shops.filter((s) => s.company_id === companyId)) {
    state.shopMenus.push({
      shop_id: shop.id,
      menu_id: menuId,
      is_dealing: true,
      is_visible_customer: true,
      is_visible_staff: true,
      in_stock: true,
      stock_qty: null,
      daily_stock_qty: null,
      kitchen_printer_id: null,
      dish_up_slip_group_id: null,
      display_order: 0,
    });
  }

  return menuId;
}

export function setMenuCategories(menuId: string, categoryIds: string[]): void {
  const state = db();
  state.categoryMenus = state.categoryMenus.filter((l) => l.menu_id !== menuId);
  for (const categoryId of categoryIds) {
    state.categoryMenus.push({ category_id: categoryId, menu_id: menuId });
  }
}

export function setMenuOptions(menuId: string, optionIds: string[]): void {
  const state = db();
  state.menuOptions = state.menuOptions.filter((l) => l.menu_id !== menuId);
  for (const optionId of optionIds) {
    state.menuOptions.push({ menu_id: menuId, option_id: optionId });
  }
}

export function updateShopMenu(shopId: string, menuId: string, patch: Partial<ShopMenu>): void {
  const state = db();
  const row = state.shopMenus.find((sm) => sm.shop_id === shopId && sm.menu_id === menuId);

  if (row) {
    Object.assign(row, patch);
    return;
  }

  state.shopMenus.push({
    shop_id: shopId,
    menu_id: menuId,
    is_dealing: false,
    is_visible_customer: false,
    is_visible_staff: false,
    in_stock: true,
    stock_qty: null,
    daily_stock_qty: null,
    kitchen_printer_id: null,
    dish_up_slip_group_id: null,
    display_order: 0,
    ...patch,
  });
}

export function saveMenuTranslations(menuId: string, rows: MenuTranslation[]): void {
  const state = db();
  state.menuTranslations = state.menuTranslations.filter((t) => t.menu_id !== menuId);
  state.menuTranslations.push(...rows.map((row) => ({ ...row, menu_id: menuId })));
}

// ---------------------------------------------------------------------------
// カテゴリの編集（仕様書 §5.6）
// ---------------------------------------------------------------------------

export function saveCategory(
  companyId: string,
  input: Partial<Category> & { id?: string }
): string {
  const state = db();
  const existing = input.id ? state.categories.find((c) => c.id === input.id) : undefined;

  if (existing) {
    Object.assign(existing, input);
    return existing.id;
  }

  const categoryId = `cat-${Math.random().toString(36).slice(2, 10)}`;
  state.categories.push({
    id: categoryId,
    company_id: companyId,
    name: input.name ?? '',
    description: input.description ?? null,
    staff_display_name: input.staff_display_name ?? null,
    handy_bg_color: input.handy_bg_color ?? null,
    kds_color: input.kds_color ?? null,
    display_order: input.display_order ?? (state.categories.length + 1) * 10,
    is_active: input.is_active ?? true,
  });

  return categoryId;
}

export function deleteCategory(categoryId: string): void {
  const state = db();
  state.categories = state.categories.filter((c) => c.id !== categoryId);
  state.categoryMenus = state.categoryMenus.filter((l) => l.category_id !== categoryId);
}

export function setCategoryMenus(categoryId: string, menuIds: string[]): void {
  const state = db();
  state.categoryMenus = state.categoryMenus.filter((l) => l.category_id !== categoryId);
  for (const menuId of menuIds) {
    state.categoryMenus.push({ category_id: categoryId, menu_id: menuId });
  }
}

/** カテゴリ 1 件と、そこに入っているメニュー ID */
export function getCategoryDetail(categoryId: string) {
  const state = db();
  const category = state.categories.find((c) => c.id === categoryId);
  if (!category) return null;

  return {
    category: clone(category),
    menuIds: state.categoryMenus.filter((l) => l.category_id === categoryId).map((l) => l.menu_id),
  };
}

// ---------------------------------------------------------------------------
// オプションの編集（仕様書 §5.5）
// ---------------------------------------------------------------------------

/** オプション本体と選択肢をまとめて保存する。選択肢は毎回入れ直す */
export function saveOption(
  companyId: string,
  input: Partial<OptionDef> & { id?: string },
  choices: Choice[]
): string {
  const state = db();
  const existing = input.id ? state.options.find((o) => o.id === input.id) : undefined;
  let optionId: string;

  if (existing) {
    Object.assign(existing, input);
    optionId = existing.id;
  } else {
    optionId = `opt-${Math.random().toString(36).slice(2, 10)}`;
    state.options.push({
      id: optionId,
      company_id: companyId,
      name: input.name ?? '',
      receipt_display_name: input.receipt_display_name ?? null,
      min_choice: input.min_choice ?? 0,
      max_choice: input.max_choice ?? 1,
      display_order: input.display_order ?? (state.options.length + 1) * 10,
    });
  }

  state.choices = state.choices.filter((c) => c.option_id !== optionId);
  state.choices.push(
    ...choices.map((choice, index) => ({
      ...choice,
      id: choice.id.startsWith('tmp-')
        ? `choice-${Math.random().toString(36).slice(2, 10)}`
        : choice.id,
      option_id: optionId,
      display_order: (index + 1) * 10,
    }))
  );

  return optionId;
}

export function deleteOption(optionId: string): void {
  const state = db();
  state.options = state.options.filter((o) => o.id !== optionId);
  state.choices = state.choices.filter((c) => c.option_id !== optionId);
  state.menuOptions = state.menuOptions.filter((l) => l.option_id !== optionId);
}

export function setOptionMenus(optionId: string, menuIds: string[]): void {
  const state = db();
  state.menuOptions = state.menuOptions.filter((l) => l.option_id !== optionId);
  for (const menuId of menuIds) {
    state.menuOptions.push({ menu_id: menuId, option_id: optionId });
  }
}

/** 他店舗の取扱一括設定（仕様書 §5.13）。出力先は店舗ごとの実体なので写さない */
export function copyShopMenus(sourceShopId: string, targetShopIds: string[]): void {
  const state = db();
  const source = state.shopMenus.filter((sm) => sm.shop_id === sourceShopId);

  for (const shopId of targetShopIds) {
    state.shopMenus = state.shopMenus.filter((sm) => sm.shop_id !== shopId);
    state.shopMenus.push(
      ...source.map((row) => ({
        ...row,
        shop_id: shopId,
        kitchen_printer_id: null,
        dish_up_slip_group_id: null,
      }))
    );
  }
}

import 'server-only';

import { clone, db } from './demo';
import type {
  Plan,
  PlanCategory,
  PlanChoice,
  PlanDetail,
  PlanMenuLink,
  PlanOption,
  PlanRow,
  PlanTranslation,
  ShopPlan,
} from './types';

/**
 * デモモードのプラン。
 * company-1 に「2時間飲み放題」と「宴会コース」を入れてある。
 */

export interface PlanState {
  plans: Plan[];
  planOptions: Omit<PlanOption, 'choices'>[];
  planChoices: PlanChoice[];
  planCategories: PlanCategory[];
  planMenus: PlanMenuLink[];
  planFirstOrderMenus: { plan_id: string; menu_id: string }[];
  shopPlans: ShopPlan[];
  planTranslations: PlanTranslation[];
}

/**
 * 初期データ。メニュー ID は demoMenu の採番（`company-1-menu-N`）に合わせている。
 * 順番を変えるとプラン内メニューの紐付けがずれるので注意。
 */
export function buildPlans(shops: { id: string; company_id: string }[]): PlanState {
  const plans: Plan[] = [
    {
      id: 'plan-1',
      company_id: 'company-1',
      name: '2時間飲み放題',
      receipt_display_name: '飲み放題',
      handy_display_name: '飲放',
      category_id: 'company-1-cat-4', // ドリンク
      plan_group_id: 'plan-group-1',
      description: '対象ドリンクが2時間飲み放題。ラストオーダーは終了10分前です。',
      has_time_limit: true,
      time_limit_min: 120,
      has_end_notice: true,
      end_notice_min: 10,
      featured_label: '人気',
      image_url: null,
      image_size: 'medium',
      tax_method: 'incl',
      tax_rate: 0.1,
      display_order: 10,
    },
    {
      id: 'plan-2',
      company_id: 'company-1',
      name: '宴会コース（料理のみ）',
      receipt_display_name: '宴会コース',
      handy_display_name: 'コース',
      category_id: 'company-1-cat-1', // 串焼き
      plan_group_id: 'plan-group-2',
      description: '前菜から〆まで全7品。',
      has_time_limit: false,
      time_limit_min: null,
      has_end_notice: false,
      end_notice_min: null,
      featured_label: null,
      image_url: null,
      image_size: 'medium',
      tax_method: 'incl',
      tax_rate: 0.1,
      display_order: 20,
    },
  ];

  const planOptions: Omit<PlanOption, 'choices'>[] = [
    {
      id: 'plan-1-opt-1',
      plan_id: 'plan-1',
      name: '人数',
      input_type: 'count',
      min_kinds: 1,
      max_kinds: 1,
      display_order: 10,
    },
    {
      id: 'plan-2-opt-1',
      plan_id: 'plan-2',
      name: 'コース内容',
      input_type: 'select',
      min_kinds: 1,
      max_kinds: 1,
      display_order: 10,
    },
  ];

  const planChoices: PlanChoice[] = [
    // 飲み放題は「人数 × 単価」なので、選択肢が単価を持つ
    {
      id: 'plan-1-ch-1',
      plan_option_id: 'plan-1-opt-1',
      name: '通常（1名）',
      price: 2500,
      is_default: true,
      max_count: null,
      display_order: 10,
    },
    {
      id: 'plan-1-ch-2',
      plan_option_id: 'plan-1-opt-1',
      name: '学生割（1名）',
      price: 2000,
      is_default: false,
      max_count: null,
      display_order: 20,
    },
    {
      id: 'plan-2-ch-1',
      plan_option_id: 'plan-2-opt-1',
      name: 'スタンダード',
      price: 4000,
      is_default: true,
      max_count: null,
      display_order: 10,
    },
    {
      id: 'plan-2-ch-2',
      plan_option_id: 'plan-2-opt-1',
      name: 'プレミアム',
      price: 5500,
      is_default: false,
      max_count: null,
      display_order: 20,
    },
  ];

  const planCategories: PlanCategory[] = [
    { id: 'plan-1-cat-1', plan_id: 'plan-1', name: 'ビール', display_order: 10 },
    { id: 'plan-1-cat-2', plan_id: 'plan-1', name: 'サワー・その他', display_order: 20 },
    { id: 'plan-2-cat-1', plan_id: 'plan-2', name: '前菜', display_order: 10 },
    { id: 'plan-2-cat-2', plan_id: 'plan-2', name: '焼き物', display_order: 20 },
  ];

  const planMenus: PlanMenuLink[] = [
    // 飲み放題: 生ビール / ハイボール / 烏龍茶
    { plan_id: 'plan-1', plan_category_id: 'plan-1-cat-1', menu_id: 'company-1-menu-9', price: 0, display_order: 10 },
    { plan_id: 'plan-1', plan_category_id: 'plan-1-cat-2', menu_id: 'company-1-menu-10', price: 0, display_order: 10 },
    { plan_id: 'plan-1', plan_category_id: 'plan-1-cat-2', menu_id: 'company-1-menu-11', price: 0, display_order: 20 },
    // 宴会コース: だし巻き玉子 / もも串 / つくね
    { plan_id: 'plan-2', plan_category_id: 'plan-2-cat-1', menu_id: 'company-1-menu-8', price: 0, display_order: 10 },
    { plan_id: 'plan-2', plan_category_id: 'plan-2-cat-2', menu_id: 'company-1-menu-1', price: 0, display_order: 10 },
    { plan_id: 'plan-2', plan_category_id: 'plan-2-cat-2', menu_id: 'company-1-menu-3', price: 0, display_order: 20 },
  ];

  // 宴会コースは注文と同時に「枝豆」相当（ここではだし巻き玉子）を自動で通す
  const planFirstOrderMenus = [{ plan_id: 'plan-2', menu_id: 'company-1-menu-8' }];

  // 取扱行はプランと同じ業態の店舗にだけ作る
  const shopPlans: ShopPlan[] = shops.flatMap((shop) =>
    plans
      .filter((plan) => plan.company_id === shop.company_id)
      .map((plan) => ({
        shop_id: shop.id,
        plan_id: plan.id,
        is_dealing: true,
        is_visible_customer: true,
        is_visible_staff: true,
        in_stock: true,
        display_order: plan.display_order,
      }))
  );

  return {
    plans,
    planOptions,
    planChoices,
    planCategories,
    planMenus,
    planFirstOrderMenus,
    shopPlans,
    planTranslations: [],
  };
}

export function buildPlanGroups() {
  return [
    { id: 'plan-group-1', company_id: 'company-1', name: '飲み放題', display_order: 10 },
    { id: 'plan-group-2', company_id: 'company-1', name: 'コース', display_order: 20 },
  ];
}

// ---------------------------------------------------------------------------
// 参照
// ---------------------------------------------------------------------------

export function getPlanRows(companyId: string): PlanRow[] {
  const state = db();

  return clone(state.plans.filter((p) => p.company_id === companyId))
    .sort((a, b) => a.display_order - b.display_order)
    .map((plan) => ({
      ...plan,
      category_name: state.categories.find((c) => c.id === plan.category_id)?.name ?? null,
      plan_group_name: state.planGroups.find((g) => g.id === plan.plan_group_id)?.name ?? null,
      option_names: state.planOptions
        .filter((o) => o.plan_id === plan.id)
        .map((o) => o.name),
      plan_category_names: state.planCategories
        .filter((c) => c.plan_id === plan.id)
        .sort((a, b) => a.display_order - b.display_order)
        .map((c) => c.name),
      dealing_shop_count: state.shopPlans.filter((sp) => sp.plan_id === plan.id && sp.is_dealing)
        .length,
    }));
}

export function getPlanDetail(planId: string): PlanDetail | null {
  const state = db();
  const plan = state.plans.find((p) => p.id === planId);
  if (!plan) return null;

  const shops = state.shops.filter((s) => s.company_id === plan.company_id);

  return {
    plan: clone(plan),
    options: clone(
      state.planOptions
        .filter((o) => o.plan_id === planId)
        .sort((a, b) => a.display_order - b.display_order)
    ).map((option) => ({
      ...option,
      choices: clone(
        state.planChoices
          .filter((c) => c.plan_option_id === option.id)
          .sort((a, b) => a.display_order - b.display_order)
      ),
    })),
    categories: clone(
      state.planCategories
        .filter((c) => c.plan_id === planId)
        .sort((a, b) => a.display_order - b.display_order)
    ),
    menus: clone(state.planMenus.filter((m) => m.plan_id === planId)),
    firstOrderMenuIds: state.planFirstOrderMenus
      .filter((m) => m.plan_id === planId)
      .map((m) => m.menu_id),
    dealers: shops.map((shop) => {
      const row = state.shopPlans.find((sp) => sp.shop_id === shop.id && sp.plan_id === planId);
      return {
        shop_id: shop.id,
        plan_id: planId,
        shop_name: shop.name,
        is_dealing: row?.is_dealing ?? false,
        is_visible_customer: row?.is_visible_customer ?? false,
        is_visible_staff: row?.is_visible_staff ?? false,
        in_stock: row?.in_stock ?? true,
        display_order: row?.display_order ?? plan.display_order,
      };
    }),
    translations: clone(state.planTranslations.filter((t) => t.plan_id === planId)),
  };
}

export function getPlanGroups(companyId: string) {
  return clone(db().planGroups.filter((g) => g.company_id === companyId)).sort(
    (a, b) => a.display_order - b.display_order
  );
}

// ---------------------------------------------------------------------------
// 更新
// ---------------------------------------------------------------------------

function id(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function savePlan(companyId: string, input: Partial<Plan> & { id?: string }): string {
  const state = db();
  const existing = input.id ? state.plans.find((p) => p.id === input.id) : undefined;

  if (existing) {
    Object.assign(existing, input);
    return existing.id;
  }

  const planId = id('plan');
  state.plans.push({
    id: planId,
    company_id: companyId,
    name: input.name ?? '',
    receipt_display_name: input.receipt_display_name ?? input.name ?? '',
    handy_display_name: input.handy_display_name ?? null,
    category_id: input.category_id ?? null,
    plan_group_id: input.plan_group_id ?? null,
    description: input.description ?? null,
    has_time_limit: input.has_time_limit ?? true,
    time_limit_min: input.time_limit_min ?? 120,
    has_end_notice: input.has_end_notice ?? false,
    end_notice_min: input.end_notice_min ?? null,
    featured_label: input.featured_label ?? null,
    image_url: null,
    image_size: input.image_size ?? 'medium',
    tax_method: input.tax_method ?? 'incl',
    tax_rate: input.tax_rate ?? 0.1,
    display_order: input.display_order ?? (state.plans.length + 1) * 10,
  });

  for (const shop of state.shops.filter((s) => s.company_id === companyId)) {
    state.shopPlans.push({
      shop_id: shop.id,
      plan_id: planId,
      is_dealing: true,
      is_visible_customer: true,
      is_visible_staff: true,
      in_stock: true,
      display_order: 0,
    });
  }

  return planId;
}

export function savePlanCategory(planId: string, categoryId: string, name: string): void {
  const state = db();
  const existing = state.planCategories.find((c) => c.id === categoryId);

  if (existing) {
    existing.name = name;
    return;
  }

  state.planCategories.push({
    id: id('plan-cat'),
    plan_id: planId,
    name,
    display_order: (state.planCategories.filter((c) => c.plan_id === planId).length + 1) * 10,
  });
}

export function deletePlanCategory(categoryId: string): void {
  const state = db();
  state.planCategories = state.planCategories.filter((c) => c.id !== categoryId);
  // 配下のメニュー紐付けも一緒に外す
  state.planMenus = state.planMenus.filter((m) => m.plan_category_id !== categoryId);
}

export function setPlanCategoryMenus(
  planId: string,
  planCategoryId: string,
  menuIds: string[]
): void {
  const state = db();
  state.planMenus = state.planMenus.filter(
    (m) => !(m.plan_id === planId && m.plan_category_id === planCategoryId)
  );
  menuIds.forEach((menuId, index) => {
    state.planMenus.push({
      plan_id: planId,
      plan_category_id: planCategoryId,
      menu_id: menuId,
      price: 0,
      display_order: index * 10,
    });
  });
}

export function setPlanFirstOrderMenus(planId: string, menuIds: string[]): void {
  const state = db();
  state.planFirstOrderMenus = state.planFirstOrderMenus.filter((m) => m.plan_id !== planId);
  for (const menuId of menuIds) {
    state.planFirstOrderMenus.push({ plan_id: planId, menu_id: menuId });
  }
}

export function updateShopPlan(shopId: string, planId: string, patch: Partial<ShopPlan>): void {
  const state = db();
  const row = state.shopPlans.find((sp) => sp.shop_id === shopId && sp.plan_id === planId);

  if (row) {
    Object.assign(row, patch);
    return;
  }

  state.shopPlans.push({
    shop_id: shopId,
    plan_id: planId,
    is_dealing: false,
    is_visible_customer: false,
    is_visible_staff: false,
    in_stock: true,
    display_order: 0,
    ...patch,
  });
}

/** オプションと選択肢は丸ごと置き換える（画面側でまとめて編集するため） */
export function savePlanOptions(planId: string, options: PlanOption[]): void {
  const state = db();

  const optionIds = state.planOptions.filter((o) => o.plan_id === planId).map((o) => o.id);
  state.planChoices = state.planChoices.filter((c) => !optionIds.includes(c.plan_option_id));
  state.planOptions = state.planOptions.filter((o) => o.plan_id !== planId);

  options.forEach((option, oi) => {
    const optionId = option.id || id('plan-opt');
    state.planOptions.push({
      id: optionId,
      plan_id: planId,
      name: option.name,
      input_type: option.input_type,
      min_kinds: option.min_kinds,
      max_kinds: option.max_kinds,
      display_order: (oi + 1) * 10,
    });

    option.choices.forEach((choice, ci) => {
      state.planChoices.push({
        id: choice.id || id('plan-ch'),
        plan_option_id: optionId,
        name: choice.name,
        price: choice.price,
        is_default: choice.is_default,
        max_count: choice.max_count,
        display_order: (ci + 1) * 10,
      });
    });
  });
}

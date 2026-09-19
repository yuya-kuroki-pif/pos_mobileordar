import 'server-only';

import * as demo from './demoPlan';
import { isDemoMode, supabaseAdmin } from './supabase';
import type {
  Plan,
  PlanCategory,
  PlanChoice,
  PlanDetail,
  PlanGroup,
  PlanMenuLink,
  PlanOption,
  PlanRow,
  PlanTranslation,
  ShopPlan,
} from './types';

/** プランの読み取り（仕様書 §5.4） */

export async function getPlanGroups(companyId: string): Promise<PlanGroup[]> {
  if (isDemoMode()) return demo.getPlanGroups(companyId);

  const { data, error } = await supabaseAdmin()
    .from('plan_groups')
    .select('*')
    .eq('company_id', companyId)
    .order('display_order');

  if (error) throw new Error(error.message);
  return (data ?? []) as PlanGroup[];
}

export async function getPlanRows(companyId: string): Promise<PlanRow[]> {
  if (isDemoMode()) return demo.getPlanRows(companyId);

  const db = supabaseAdmin();

  const [planRes, catRes, groupRes, optRes, planCatRes, shopRes] = await Promise.all([
    db.from('plans').select('*').eq('company_id', companyId).order('display_order'),
    db.from('categories').select('id, name').eq('company_id', companyId),
    db.from('plan_groups').select('id, name').eq('company_id', companyId),
    db.from('plan_options').select('plan_id, name').order('display_order'),
    db.from('plan_categories').select('plan_id, name').order('display_order'),
    db.from('shops').select('id').eq('company_id', companyId),
  ]);

  for (const res of [planRes, catRes, groupRes, optRes, planCatRes, shopRes]) {
    if (res.error) throw new Error(res.error.message);
  }

  // 取扱店舗数はこの業態の店舗だけで数える
  const shopIds = ((shopRes.data ?? []) as { id: string }[]).map((s) => s.id);
  const { data: dealData, error: dealError } =
    shopIds.length > 0
      ? await db.from('shop_plans').select('plan_id, is_dealing').in('shop_id', shopIds)
      : { data: [], error: null };
  if (dealError) throw new Error(dealError.message);

  const categoryName = new Map(
    ((catRes.data ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name])
  );
  const groupName = new Map(
    ((groupRes.data ?? []) as { id: string; name: string }[]).map((g) => [g.id, g.name])
  );
  const options = (optRes.data ?? []) as { plan_id: string; name: string }[];
  const planCats = (planCatRes.data ?? []) as { plan_id: string; name: string }[];
  const deals = (dealData ?? []) as { plan_id: string; is_dealing: boolean }[];

  return ((planRes.data ?? []) as Plan[]).map((plan) => ({
    ...plan,
    category_name: plan.category_id ? (categoryName.get(plan.category_id) ?? null) : null,
    plan_group_name: plan.plan_group_id ? (groupName.get(plan.plan_group_id) ?? null) : null,
    option_names: options.filter((o) => o.plan_id === plan.id).map((o) => o.name),
    plan_category_names: planCats.filter((c) => c.plan_id === plan.id).map((c) => c.name),
    dealing_shop_count: deals.filter((d) => d.plan_id === plan.id && d.is_dealing).length,
  }));
}

export async function getPlanDetail(planId: string): Promise<PlanDetail | null> {
  if (isDemoMode()) return demo.getPlanDetail(planId);

  const db = supabaseAdmin();

  const { data: planData } = await db.from('plans').select('*').eq('id', planId).maybeSingle();
  const plan = planData as Plan | null;
  if (!plan) return null;

  const [optRes, choiceRes, catRes, menuRes, firstRes, shopRes, dealRes, transRes] =
    await Promise.all([
      db.from('plan_options').select('*').eq('plan_id', planId).order('display_order'),
      db.from('plan_choices').select('*').order('display_order'),
      db.from('plan_categories').select('*').eq('plan_id', planId).order('display_order'),
      db.from('plan_menus').select('*').eq('plan_id', planId).order('display_order'),
      db.from('plan_first_order_menus').select('menu_id').eq('plan_id', planId),
      db.from('shops').select('id, name').eq('company_id', plan.company_id).order('display_order'),
      db.from('shop_plans').select('*').eq('plan_id', planId),
      db.from('plan_translations').select('*').eq('plan_id', planId),
    ]);

  for (const res of [optRes, choiceRes, catRes, menuRes, firstRes, shopRes, dealRes, transRes]) {
    if (res.error) throw new Error(res.error.message);
  }

  const choices = (choiceRes.data ?? []) as PlanChoice[];
  const deals = (dealRes.data ?? []) as ShopPlan[];

  return {
    plan,
    options: ((optRes.data ?? []) as Omit<PlanOption, 'choices'>[]).map((option) => ({
      ...option,
      choices: choices.filter((c) => c.plan_option_id === option.id),
    })),
    categories: (catRes.data ?? []) as PlanCategory[],
    menus: (menuRes.data ?? []) as PlanMenuLink[],
    firstOrderMenuIds: ((firstRes.data ?? []) as { menu_id: string }[]).map((r) => r.menu_id),
    dealers: ((shopRes.data ?? []) as { id: string; name: string }[]).map((shop) => {
      const row = deals.find((d) => d.shop_id === shop.id);
      return {
        shop_id: shop.id,
        plan_id: planId,
        shop_name: shop.name,
        is_dealing: row?.is_dealing ?? false,
        is_visible_customer: row?.is_visible_customer ?? false,
        is_visible_staff: row?.is_visible_staff ?? false,
        in_stock: row?.in_stock ?? true,
        display_order: row?.display_order ?? 0,
      };
    }),
    translations: (transRes.data ?? []) as PlanTranslation[],
  };
}

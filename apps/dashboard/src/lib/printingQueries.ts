import 'server-only';

import { clone, db } from './demo';
import { isDemoMode, supabaseAdmin } from './supabase';
import type { Category, KitchenPrinter } from './types';

/** プランオプション印刷設定（仕様書 §5.16）の 1 行 */
export interface PlanOptionPrinterRow {
  plan_option_id: string;
  plan_id: string;
  plan_name: string;
  option_name: string;
  category_name: string | null;
  kitchen_printer_id: string | null;
}

export interface PrintingBoard {
  rows: PlanOptionPrinterRow[];
  printers: KitchenPrinter[];
}

export async function getPlanOptionPrinterBoard(
  shopId: string,
  companyId: string
): Promise<PrintingBoard> {
  if (isDemoMode()) {
    const state = db();

    const plans = state.plans.filter((p) => p.company_id === companyId);
    const rows: PlanOptionPrinterRow[] = state.planOptions
      .filter((option) => plans.some((plan) => plan.id === option.plan_id))
      .map((option) => {
        const plan = plans.find((p) => p.id === option.plan_id)!;
        return {
          plan_option_id: option.id,
          plan_id: plan.id,
          plan_name: plan.name,
          option_name: option.name,
          category_name: plan.category_id
            ? (state.categories.find((c) => c.id === plan.category_id)?.name ?? null)
            : null,
          // デモでは対応づけを保持しないので常に未設定から始める
          kitchen_printer_id: null,
        };
      });

    return {
      rows,
      printers: clone(state.kitchenPrinters.filter((p) => p.shop_id === shopId)),
    };
  }

  const supabase = supabaseAdmin();

  const [planRes, optRes, catRes, printerRes, linkRes] = await Promise.all([
    supabase.from('plans').select('id, name, category_id').eq('company_id', companyId),
    supabase.from('plan_options').select('id, plan_id, name').order('display_order'),
    supabase.from('categories').select('id, name').eq('company_id', companyId),
    supabase.from('kitchen_printers').select('*').eq('shop_id', shopId).order('display_order'),
    supabase.from('plan_option_printers').select('*').eq('shop_id', shopId),
  ]);

  for (const res of [planRes, optRes, catRes, printerRes, linkRes]) {
    if (res.error) throw new Error(res.error.message);
  }

  const plans = (planRes.data ?? []) as { id: string; name: string; category_id: string | null }[];
  const categories = (catRes.data ?? []) as Pick<Category, 'id' | 'name'>[];
  const links = (linkRes.data ?? []) as {
    plan_option_id: string;
    kitchen_printer_id: string | null;
  }[];

  const rows: PlanOptionPrinterRow[] = ((optRes.data ?? []) as {
    id: string;
    plan_id: string;
    name: string;
  }[])
    .filter((option) => plans.some((plan) => plan.id === option.plan_id))
    .map((option) => {
      const plan = plans.find((p) => p.id === option.plan_id)!;
      return {
        plan_option_id: option.id,
        plan_id: plan.id,
        plan_name: plan.name,
        option_name: option.name,
        category_name: plan.category_id
          ? (categories.find((c) => c.id === plan.category_id)?.name ?? null)
          : null,
        kitchen_printer_id:
          links.find((l) => l.plan_option_id === option.id)?.kitchen_printer_id ?? null,
      };
    });

  return { rows, printers: (printerRes.data ?? []) as KitchenPrinter[] };
}

/** キッチン表示・印刷順（仕様書 §5.16）。店舗ごとにカテゴリを並べ替える */
export interface KitchenOrderRow {
  category_id: string;
  name: string;
  menu_count: number;
  display_order: number;
}

export async function getKitchenOrderRows(
  shopId: string,
  companyId: string
): Promise<KitchenOrderRow[]> {
  if (isDemoMode()) {
    const state = db();
    return state.categories
      .filter((c) => c.company_id === companyId)
      .map((category) => ({
        category_id: category.id,
        name: category.name,
        menu_count: state.categoryMenus.filter((l) => l.category_id === category.id).length,
        display_order: category.display_order,
      }))
      .sort((a, b) => a.display_order - b.display_order);
  }

  const supabase = supabaseAdmin();

  const [catRes, linkRes, orderRes] = await Promise.all([
    supabase
      .from('categories')
      .select('id, name, display_order')
      .eq('company_id', companyId)
      .order('display_order'),
    supabase.from('category_menus').select('category_id'),
    supabase.from('shop_category_orders').select('*').eq('shop_id', shopId),
  ]);

  for (const res of [catRes, linkRes, orderRes]) {
    if (res.error) throw new Error(res.error.message);
  }

  const links = (linkRes.data ?? []) as { category_id: string }[];
  const orders = (orderRes.data ?? []) as { category_id: string; display_order: number }[];

  return ((catRes.data ?? []) as Pick<Category, 'id' | 'name' | 'display_order'>[])
    .map((category) => ({
      category_id: category.id,
      name: category.name,
      menu_count: links.filter((l) => l.category_id === category.id).length,
      display_order:
        orders.find((o) => o.category_id === category.id)?.display_order ?? category.display_order,
    }))
    .sort((a, b) => a.display_order - b.display_order);
}

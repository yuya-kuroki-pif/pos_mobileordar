'use server';

import { revalidatePath } from 'next/cache';

import { requireSession } from '../auth';
import * as demo from '../demoPlan';
import { canEdit } from '../permissions';
import { isDemoMode, supabaseAdmin } from '../supabase';
import type { ImageSize, PlanOption, ShopPlan, TaxMethod } from '../types';

export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

function fail(error: unknown): ActionResult {
  const message = error instanceof Error ? error.message : String(error);
  return { ok: false, error: message || '処理に失敗しました' };
}

async function requirePlanEdit() {
  const session = await requireSession();
  if (!canEdit(session.permissions, 'menu_master')) {
    throw new Error('プランを編集する権限がありません。');
  }
  return session;
}

export interface PlanFormInput {
  id: string;
  name: string;
  receipt_display_name: string;
  handy_display_name: string;
  category_id: string | null;
  plan_group_id: string | null;
  description: string;
  has_time_limit: boolean;
  time_limit_min: number | null;
  has_end_notice: boolean;
  end_notice_min: number | null;
  featured_label: string;
  image_size: ImageSize;
  tax_method: TaxMethod;
  tax_rate: number;
  display_order: number;
}

/** 基本情報タブの保存 */
export async function savePlanAction(input: PlanFormInput): Promise<ActionResult> {
  try {
    const session = await requirePlanEdit();
    const companyId = session.currentCompanyId;

    const name = input.name.trim();
    if (!name) return { ok: false, error: 'プラン名を入力してください。' };
    if (input.has_time_limit && !input.time_limit_min) {
      return { ok: false, error: '制限時間を入力してください。' };
    }

    const payload = {
      name,
      receipt_display_name: input.receipt_display_name.trim() || name,
      handy_display_name: input.handy_display_name.trim() || null,
      category_id: input.category_id,
      plan_group_id: input.plan_group_id,
      description: input.description.trim() || null,
      has_time_limit: input.has_time_limit,
      time_limit_min: input.has_time_limit ? input.time_limit_min : null,
      has_end_notice: input.has_time_limit && input.has_end_notice,
      end_notice_min: input.has_time_limit && input.has_end_notice ? input.end_notice_min : null,
      featured_label: input.featured_label.trim() || null,
      image_size: input.image_size,
      tax_method: input.tax_method,
      tax_rate: input.tax_rate,
      display_order: input.display_order,
    };

    let planId = input.id;

    if (isDemoMode()) {
      planId = demo.savePlan(companyId, { ...payload, id: input.id || undefined });
    } else {
      const db = supabaseAdmin();

      if (planId) {
        const { error } = await db
          .from('plans')
          .update(payload)
          .eq('id', planId)
          .eq('company_id', companyId);
        if (error) throw error;
      } else {
        const { data, error } = await db
          .from('plans')
          .insert({ company_id: companyId, ...payload })
          .select('id')
          .single();
        if (error) throw error;
        planId = (data as { id: string }).id;

        const { data: shops } = await db.from('shops').select('id').eq('company_id', companyId);
        const rows = ((shops ?? []) as { id: string }[]).map((shop) => ({
          shop_id: shop.id,
          plan_id: planId,
        }));
        if (rows.length > 0) await db.from('shop_plans').insert(rows);
      }
    }

    revalidatePath('/plan');
    revalidatePath(`/plan/${planId}/edit`);
    return { ok: true, id: planId };
  } catch (error) {
    return fail(error);
  }
}

/** プラン内カテゴリの追加・改名 */
export async function savePlanCategoryAction(
  planId: string,
  categoryId: string,
  name: string
): Promise<ActionResult> {
  try {
    await requirePlanEdit();
    const trimmed = name.trim();
    if (!trimmed) return { ok: false, error: 'カテゴリ名を入力してください。' };

    if (isDemoMode()) {
      demo.savePlanCategory(planId, categoryId, trimmed);
    } else {
      const db = supabaseAdmin();
      if (categoryId) {
        const { error } = await db
          .from('plan_categories')
          .update({ name: trimmed })
          .eq('id', categoryId);
        if (error) throw error;
      } else {
        const { count } = await db
          .from('plan_categories')
          .select('id', { count: 'exact', head: true })
          .eq('plan_id', planId);
        const { error } = await db
          .from('plan_categories')
          .insert({ plan_id: planId, name: trimmed, display_order: ((count ?? 0) + 1) * 10 });
        if (error) throw error;
      }
    }

    revalidatePath(`/plan/${planId}/category`);
    revalidatePath(`/plan/${planId}/menu`);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function deletePlanCategoryAction(
  planId: string,
  categoryId: string
): Promise<ActionResult> {
  try {
    await requirePlanEdit();

    if (isDemoMode()) {
      demo.deletePlanCategory(categoryId);
    } else {
      // plan_menus は on delete cascade で一緒に落ちる
      const { error } = await supabaseAdmin()
        .from('plan_categories')
        .delete()
        .eq('id', categoryId);
      if (error) throw error;
    }

    revalidatePath(`/plan/${planId}/category`);
    revalidatePath(`/plan/${planId}/menu`);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** プラン内メニュー。カテゴリ 1 つぶんをまとめて置き換える */
export async function setPlanCategoryMenusAction(
  planId: string,
  planCategoryId: string,
  menuIds: string[]
): Promise<ActionResult> {
  try {
    await requirePlanEdit();

    if (isDemoMode()) {
      demo.setPlanCategoryMenus(planId, planCategoryId, menuIds);
    } else {
      const db = supabaseAdmin();
      await db.from('plan_menus').delete().eq('plan_category_id', planCategoryId);
      if (menuIds.length > 0) {
        const { error } = await db.from('plan_menus').insert(
          menuIds.map((menuId, index) => ({
            plan_id: planId,
            plan_category_id: planCategoryId,
            menu_id: menuId,
            price: 0,
            display_order: index * 10,
          }))
        );
        if (error) throw error;
      }
    }

    revalidatePath(`/plan/${planId}/menu`);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** 自動注文設定。プラン注文時に自動で通すメニュー */
export async function setPlanFirstOrderMenusAction(
  planId: string,
  menuIds: string[]
): Promise<ActionResult> {
  try {
    await requirePlanEdit();

    if (isDemoMode()) {
      demo.setPlanFirstOrderMenus(planId, menuIds);
    } else {
      const db = supabaseAdmin();
      await db.from('plan_first_order_menus').delete().eq('plan_id', planId);
      if (menuIds.length > 0) {
        const { error } = await db
          .from('plan_first_order_menus')
          .insert(menuIds.map((menuId) => ({ plan_id: planId, menu_id: menuId })));
        if (error) throw error;
      }
    }

    revalidatePath(`/plan/${planId}/firstOrder`);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** 取扱設定。Switch を切り替えるたびに 1 行ぶんだけ即時保存する */
export async function updateShopPlanAction(
  shopId: string,
  planId: string,
  patch: Partial<ShopPlan>
): Promise<ActionResult> {
  try {
    await requirePlanEdit();

    if (isDemoMode()) {
      demo.updateShopPlan(shopId, planId, patch);
    } else {
      const { error } = await supabaseAdmin()
        .from('shop_plans')
        .upsert({ shop_id: shopId, plan_id: planId, ...patch }, { onConflict: 'shop_id,plan_id' });
      if (error) throw error;
    }

    revalidatePath(`/plan/${planId}/dealer`);
    revalidatePath('/plan');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/**
 * オプションタブ。オプションと選択肢をまとめて置き換える。
 * 飲み放題の「人数 × 2,500 円」のように、価格は選択肢が持つ。
 */
export async function savePlanOptionsAction(
  planId: string,
  options: PlanOption[]
): Promise<ActionResult> {
  try {
    await requirePlanEdit();

    for (const option of options) {
      if (!option.name.trim()) return { ok: false, error: 'オプション名を入力してください。' };
      if (option.choices.length === 0) {
        return { ok: false, error: `「${option.name}」に選択肢を 1 つ以上追加してください。` };
      }
      if (option.choices.some((c) => !c.name.trim())) {
        return { ok: false, error: '選択肢名を入力してください。' };
      }
    }

    if (isDemoMode()) {
      demo.savePlanOptions(planId, options);
    } else {
      const db = supabaseAdmin();

      // 選択肢は options の cascade で落ちるので、オプションごと消して入れ直す
      await db.from('plan_options').delete().eq('plan_id', planId);

      for (const [oi, option] of options.entries()) {
        const { data, error } = await db
          .from('plan_options')
          .insert({
            plan_id: planId,
            name: option.name.trim(),
            input_type: option.input_type,
            min_kinds: option.min_kinds,
            max_kinds: option.max_kinds,
            display_order: (oi + 1) * 10,
          })
          .select('id')
          .single();
        if (error) throw error;

        const optionId = (data as { id: string }).id;
        const { error: choiceError } = await db.from('plan_choices').insert(
          option.choices.map((choice, ci) => ({
            plan_option_id: optionId,
            name: choice.name.trim(),
            price: Math.max(0, Math.round(choice.price)),
            is_default: choice.is_default,
            max_count: choice.max_count,
            display_order: (ci + 1) * 10,
          }))
        );
        if (choiceError) throw choiceError;
      }
    }

    revalidatePath(`/plan/${planId}/option`);
    revalidatePath('/plan');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

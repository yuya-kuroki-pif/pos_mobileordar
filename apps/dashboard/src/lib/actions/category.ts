'use server';

import { revalidatePath } from 'next/cache';

import { requireSession } from '../auth';
import * as demo from '../demoMenu';
import { canEdit } from '../permissions';
import { isDemoMode, supabaseAdmin } from '../supabase';

export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

function fail(error: unknown): ActionResult {
  const message = error instanceof Error ? error.message : String(error);
  return { ok: false, error: message || '処理に失敗しました' };
}

async function requireMenuEdit() {
  const session = await requireSession();
  if (!canEdit(session.permissions, 'menu_master')) {
    throw new Error('メニューマスターを編集する権限がありません。');
  }
  return session;
}

export interface CategoryFormInput {
  id: string;
  name: string;
  staff_display_name: string;
  description: string;
  handy_bg_color: string | null;
  kds_color: string | null;
  display_order: number;
  is_active: boolean;
  menuIds: string[];
}

/** カテゴリの新規作成・更新（仕様書 §5.6） */
export async function saveCategoryAction(input: CategoryFormInput): Promise<ActionResult> {
  try {
    const session = await requireMenuEdit();
    const companyId = session.currentCompanyId;

    const name = input.name.trim();
    if (!name) return { ok: false, error: 'カテゴリ名を入力してください。' };

    const payload = {
      name,
      staff_display_name: input.staff_display_name.trim() || null,
      description: input.description.trim() || null,
      handy_bg_color: input.handy_bg_color,
      kds_color: input.kds_color,
      display_order: input.display_order,
      is_active: input.is_active,
    };

    let categoryId = input.id;

    if (isDemoMode()) {
      categoryId = demo.saveCategory(companyId, { ...payload, id: input.id || undefined });
      demo.setCategoryMenus(categoryId, input.menuIds);
    } else {
      const db = supabaseAdmin();

      if (categoryId) {
        const { error } = await db
          .from('categories')
          .update(payload)
          .eq('id', categoryId)
          .eq('company_id', companyId);
        if (error) throw error;
      } else {
        const { data, error } = await db
          .from('categories')
          .insert({ company_id: companyId, ...payload })
          .select('id')
          .single();
        if (error) throw error;
        categoryId = (data as { id: string }).id;
      }

      await db.from('category_menus').delete().eq('category_id', categoryId);
      if (input.menuIds.length > 0) {
        const { error } = await db.from('category_menus').insert(
          input.menuIds.map((menuId, index) => ({
            category_id: categoryId,
            menu_id: menuId,
            display_order: (index + 1) * 10,
          })),
        );
        if (error) throw error;
      }
    }

    revalidatePath('/category');
    revalidatePath('/menu');
    return { ok: true, id: categoryId };
  } catch (error) {
    return fail(error);
  }
}

/**
 * カテゴリの削除。
 * `category_menus` は cascade で一緒に落ちるが、プランがこのカテゴリを
 * 指していると `plans.category_id` が null になる（on delete set null）。
 */
export async function deleteCategoryAction(categoryId: string): Promise<ActionResult> {
  try {
    const session = await requireMenuEdit();

    if (isDemoMode()) {
      demo.deleteCategory(categoryId);
    } else {
      const { error } = await supabaseAdmin()
        .from('categories')
        .delete()
        .eq('id', categoryId)
        .eq('company_id', session.currentCompanyId);
      if (error) throw error;
    }

    revalidatePath('/category');
    revalidatePath('/menu');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

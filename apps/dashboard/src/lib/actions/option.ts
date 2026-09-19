'use server';

import { revalidatePath } from 'next/cache';

import { requireSession } from '../auth';
import * as demo from '../demoMenu';
import { canEdit } from '../permissions';
import { isDemoMode, supabaseAdmin } from '../supabase';
import type { Choice } from '../types';

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

export interface OptionFormInput {
  id: string;
  name: string;
  receipt_display_name: string;
  min_choice: number;
  max_choice: number;
  display_order: number;
  choices: Choice[];
  menuIds: string[];
}

/**
 * オプションの新規作成・更新（仕様書 §5.5）。
 * 選択肢は毎回まとめて入れ直す。
 */
export async function saveOptionAction(input: OptionFormInput): Promise<ActionResult> {
  try {
    const session = await requireMenuEdit();
    const companyId = session.currentCompanyId;

    const name = input.name.trim();
    if (!name) return { ok: false, error: 'オプション名を入力してください。' };
    if (input.choices.length === 0) {
      return { ok: false, error: '選択肢を 1 つ以上追加してください。' };
    }
    if (input.choices.some((c) => !c.name.trim())) {
      return { ok: false, error: '選択肢名を入力してください。' };
    }
    if (input.min_choice > input.max_choice) {
      return { ok: false, error: '最小選択数は最大選択数以下にしてください。' };
    }
    if (input.max_choice > input.choices.length) {
      return { ok: false, error: '最大選択数が選択肢の数を超えています。' };
    }

    const payload = {
      name,
      receipt_display_name: input.receipt_display_name.trim() || null,
      min_choice: input.min_choice,
      max_choice: input.max_choice,
      display_order: input.display_order,
    };

    let optionId = input.id;

    if (isDemoMode()) {
      optionId = demo.saveOption(
        companyId,
        { ...payload, id: input.id || undefined },
        input.choices,
      );
      demo.setOptionMenus(optionId, input.menuIds);
    } else {
      const db = supabaseAdmin();

      if (optionId) {
        const { error } = await db
          .from('options')
          .update(payload)
          .eq('id', optionId)
          .eq('company_id', companyId);
        if (error) throw error;
      } else {
        const { data, error } = await db
          .from('options')
          .insert({ company_id: companyId, ...payload })
          .select('id')
          .single();
        if (error) throw error;
        optionId = (data as { id: string }).id;
      }

      await db.from('choices').delete().eq('option_id', optionId);
      const { error: choiceError } = await db.from('choices').insert(
        input.choices.map((choice, index) => ({
          option_id: optionId,
          name: choice.name.trim(),
          receipt_display_name: choice.receipt_display_name?.trim() || null,
          price: Math.round(choice.price),
          is_default: choice.is_default,
          is_available: choice.is_available,
          display_order: (index + 1) * 10,
        })),
      );
      if (choiceError) throw choiceError;

      await db.from('menu_options').delete().eq('option_id', optionId);
      if (input.menuIds.length > 0) {
        const { error } = await db.from('menu_options').insert(
          input.menuIds.map((menuId) => ({
            menu_id: menuId,
            option_id: optionId,
          })),
        );
        if (error) throw error;
      }
    }

    revalidatePath('/option');
    revalidatePath('/menu');
    return { ok: true, id: optionId };
  } catch (error) {
    return fail(error);
  }
}

/** オプションの削除。選択肢とメニューへの紐付けも一緒に消える */
export async function deleteOptionAction(optionId: string): Promise<ActionResult> {
  try {
    const session = await requireMenuEdit();

    if (isDemoMode()) {
      demo.deleteOption(optionId);
    } else {
      const { error } = await supabaseAdmin()
        .from('options')
        .delete()
        .eq('id', optionId)
        .eq('company_id', session.currentCompanyId);
      if (error) throw error;
    }

    revalidatePath('/option');
    revalidatePath('/menu');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
